"""Optional Fadr (api.fadr.com) cloud stem-separation client — ADR 0008.
Only used by /api/v1/analyze-from-song; /api/v1/analyze (manual stem
upload) never touches this module, and this module never touches Dexie or
any DrumPath persistence — it just produces the same dict[str, Path] shape
analyze_stems() already accepts from a manually-uploaded stem set.

FADR_API_KEY is read server-side only (os.environ.get, loaded from a
gitignored .env via main.py's load_dotenv() call) — Fadr's own docs are
explicit that the key must never reach frontend/browser code, so there is
no other place this could live.

Response shapes below are confirmed against a real Fadr account (2026-08-06),
not assumed from docs prose, which turned out to be wrong in two real ways:
- POST /assets, GET /assets/:_id, POST /assets/analyze/stem, and GET
  /tasks/:_id are all wrapped (e.g. {"asset": {...}} / {"task": {...}}),
  never a bare document.
- A task's own completion signal is task.status.complete (bool), with a
  human-readable task.status.msg ("Stemming" -> "Analyzing" -> "Stemming
  Complete") — there is no "done"/"failed" string status field at all.
- A stem-separation task's resulting assets are NOT listed on the task
  document (its own output.assets stays [] even once complete) — they're
  referenced from the PARENT asset's own `stems` array, as plain id
  strings (not objects), each needing its own GET /assets/:_id to read its
  metaData.stemType.
- Fadr's "drum-stem" re-separation (run on the "drums" stem from a normal
  main separation) only splits into 3 pieces: kick, snare, and
  "drums-other" (hihat/toms/cymbals/everything else, all mixed into one
  file) — not the individual hihat/toms/ride/crash breakdown Fadr's own
  marketing implies. See ADR 0008's consequences section for what this
  means for import fidelity.
"""

from __future__ import annotations

import asyncio
import os
import time
from pathlib import Path

import numpy as np
from scipy.io import wavfile

from .pipeline.decode import decode
from .pipeline.constants import SR

FADR_BASE_URL = "https://api.fadr.com"
POLL_INTERVAL_SECONDS = 5.0
# Per-stage timeout (main separation, then the drums-only re-separation each
# get their own budget) — generous, since a full song's separation is a real
# compute job on Fadr's side, not a quick call.
POLL_TIMEOUT_SECONDS = 300.0

# Confirmed against a real account: a "drum-stem" re-separation only ever
# returns these 3 metaData.stemType values. "drums-other" is everything
# that isn't kick or snare (hihat, toms, cymbals, all mixed into one file)
# — mapped to analyze_stems' own "residual" field (still gets onset
# detection, just no per-instrument/tom-pitch classification), same as a
# manual import's own catch-all stem. hihat/hh/ride/crash/tom* entries are
# kept here too in case a higher Fadr tier or a future API version ever
# does return them separately — harmless if never matched.
_STEM_TYPE_TO_FIELD = {
    "kick": "kick",
    "snare": "snare",
    "drums-other": "residual",
    "hihat": "hh",
    "hh": "hh",
    "ride": "ride",
    "crash": "crash",
}


class FadrError(RuntimeError):
    """Any Fadr API failure — network error, task failure, timeout, or an
    unrecognized response shape."""


def api_key() -> str | None:
    return os.environ.get("FADR_API_KEY")


def is_configured() -> bool:
    return api_key() is not None


def _auth_headers() -> dict[str, str]:
    key = api_key()
    if not key:
        raise FadrError("FADR_API_KEY is not configured.")
    return {"Authorization": f"Bearer {key}"}


async def _create_upload_url(client, name: str, extension: str) -> tuple[str, str]:
    response = await client.post("/assets/upload2", headers=_auth_headers(), json={"name": name, "extension": extension})
    response.raise_for_status()
    body = response.json()
    return body["url"], body["s3Path"]


async def _upload_bytes(client, upload_url: str, content: bytes, content_type: str) -> None:
    response = await client.put(upload_url, content=content, headers={"Content-Type": content_type})
    response.raise_for_status()


async def _create_asset(client, s3_path: str, name: str, extension: str, group: str) -> str:
    response = await client.post(
        "/assets", headers=_auth_headers(), json={"s3Path": s3_path, "name": name, "extension": extension, "group": group},
    )
    response.raise_for_status()
    # Confirmed against a real account: the asset doc is wrapped in
    # {"asset": {...}}, not returned bare — same wrapping likely applies to
    # GET /assets/:_id (see _get_asset's own doc note).
    return response.json()["asset"]["_id"]


async def _start_stem_task(client, asset_id: str, stem_type: str) -> str:
    response = await client.post("/assets/analyze/stem", headers=_auth_headers(), json={"_id": asset_id, "stemType": stem_type})
    response.raise_for_status()
    # Confirmed against a real account: wrapped in {"msg": ..., "task": {...}}.
    return response.json()["task"]["_id"]


async def _poll_task(client, task_id: str) -> dict:
    """Returns the unwrapped task document once its status.complete is true.
    Confirmed against a real account: GET /tasks/:_id is wrapped in
    {"task": {...}}, and completion is task.status.complete (a bool) with a
    human-readable status.msg ("Stemming" -> "Analyzing" -> "Stemming
    Complete") — there is no "done"/"failed" string status field at all,
    contrary to what Fadr's own docs prose suggested. A real separation
    finished in ~15s in testing (2 polls at a 5s interval), well under the
    overall timeout below."""
    deadline = time.monotonic() + POLL_TIMEOUT_SECONDS
    while True:
        response = await client.get(f"/tasks/{task_id}", headers=_auth_headers())
        response.raise_for_status()
        task = response.json()["task"]
        status = task.get("status") or {}
        if status.get("complete"):
            return task
        if status.get("error") or status.get("failed"):
            raise FadrError(f"Fadr task {task_id} failed: {status}")
        if time.monotonic() > deadline:
            raise FadrError(f"Fadr task {task_id} did not finish within {POLL_TIMEOUT_SECONDS:.0f}s (last status: {status!r}).")
        await asyncio.sleep(POLL_INTERVAL_SECONDS)


async def _get_asset(client, asset_id: str) -> dict:
    response = await client.get(f"/assets/{asset_id}", headers=_auth_headers())
    response.raise_for_status()
    # Confirmed against a real account: wrapped in {"asset": {...}}, same as
    # POST /assets.
    return response.json()["asset"]


async def _download_asset_bytes(client, asset_id: str) -> bytes:
    response = await client.get(f"/assets/download/{asset_id}/hq", headers=_auth_headers())
    response.raise_for_status()
    download_url = response.json()["url"]
    downloaded = await client.get(download_url)
    downloaded.raise_for_status()
    return downloaded.content


async def _fetch_child_stems(client, parent_asset: dict) -> list[dict]:
    """Returns [{"_id": ..., "stemType": ...}, ...] for a parent asset's
    resulting stems. Confirmed against a real account: a completed
    separation task's own document never lists its results (output.assets
    stays [] even once done) — the parent asset's own `stems` field is
    where they actually live, as plain id strings, each needing its own
    GET /assets/:_id to read metaData.stemType. Raises FadrError (with the
    raw asset doc) if `stems` is missing/empty, so a real run makes any
    future shape change obvious rather than failing silently."""
    stem_ids = parent_asset.get("stems")
    if not stem_ids:
        raise FadrError(f"Fadr's separation produced no child stems on asset {parent_asset.get('_id')!r}: {parent_asset!r}")

    entries = []
    for stem_id in stem_ids:
        child = await _get_asset(client, stem_id)
        entries.append({"_id": stem_id, "stemType": child.get("metaData", {}).get("stemType")})
    return entries


def _mix_down_toms(tom_arrays: list[np.ndarray], tmp_dir: Path) -> Path:
    """Sums however many separate tom stems Fadr returned into one combined
    file — analyze_stems' own tom classifier (app/pipeline/toms.py) already
    expects a single 'toms' stem it splits by pitch itself, same contract
    as a manually-uploaded toms stem."""
    max_len = max(len(a) for a in tom_arrays)
    mixed = np.zeros(max_len, dtype=np.float32)
    for array in tom_arrays:
        mixed[: len(array)] += array
    peak = float(np.max(np.abs(mixed)))
    if peak > 1.0:
        mixed = mixed / peak
    dest = tmp_dir / "toms.wav"
    wavfile.write(dest, SR, mixed)
    return dest


async def separate_song_to_stems(song_bytes: bytes, filename: str, tmp_dir: Path, client) -> tuple[dict[str, Path], list[str]]:
    """Uploads a full song to Fadr, separates it into main stems, locates
    the resulting "drums" stem, re-separates *that* into individual
    instruments, and downloads each recognized one into tmp_dir.

    Returns (stem_paths, warnings): stem_paths keys are a subset of
    analyze_stems' own expected keys (kick/snare/toms/hh/ride/crash) —
    ready to pass straight into that unmodified function, same as a
    manually-uploaded stem set. `client` is an already-open
    httpx.AsyncClient (base_url=FADR_BASE_URL) — passed in rather than
    opened here so tests can inject one pointed at a mock transport.
    """
    warnings: list[str] = []
    extension = (Path(filename).suffix.lstrip(".") or "mp3").lower()
    base_name = Path(filename).stem or "song"

    upload_url, s3_path = await _create_upload_url(client, base_name, extension)
    await _upload_bytes(client, upload_url, song_bytes, "audio/mpeg")
    song_asset_id = await _create_asset(client, s3_path, base_name, extension, group="drumpath-import")

    main_task_id = await _start_stem_task(client, song_asset_id, "main")
    await _poll_task(client, main_task_id)
    song_asset = await _get_asset(client, song_asset_id)
    main_stems = await _fetch_child_stems(client, song_asset)

    drums_entry = next((entry for entry in main_stems if entry["stemType"] == "drums"), None)
    if drums_entry is None:
        raise FadrError(f"Fadr's main-stem separation did not include a 'drums' stem. Got: {main_stems!r}")
    drums_asset_id = drums_entry["_id"]

    drum_task_id = await _start_stem_task(client, drums_asset_id, "drum-stem")
    await _poll_task(client, drum_task_id)
    drums_asset = await _get_asset(client, drums_asset_id)
    sub_stems = await _fetch_child_stems(client, drums_asset)

    stem_paths: dict[str, Path] = {}
    tom_arrays: list[np.ndarray] = []

    for index, entry in enumerate(sub_stems):
        asset_id = entry["_id"]
        stem_type = entry["stemType"]
        if not stem_type:
            warnings.append(f"Fadr returned a drum sub-stem with no metaData.stemType — skipped. Raw entry: {entry!r}")
            continue

        mapped_field = _STEM_TYPE_TO_FIELD.get(stem_type)
        if mapped_field is not None:
            content = await _download_asset_bytes(client, asset_id)
            dest = tmp_dir / f"{mapped_field}.wav"
            dest.write_bytes(content)
            stem_paths[mapped_field] = dest
            continue

        # Not part of a real "drum-stem" response as of 2026-08 (confirmed:
        # it only ever returns kick/snare/drums-other), but kept in case a
        # future Fadr API version does split toms out — same mix-down
        # analyze_stems' own tom classifier expects from a manual import.
        if stem_type.startswith("tom"):
            content = await _download_asset_bytes(client, asset_id)
            tom_dest = tmp_dir / f"_tom_{index}_{stem_type}.wav"
            tom_dest.write_bytes(content)
            tom_arrays.append(decode(tom_dest))
            continue

        warnings.append(f"Fadr returned an unrecognized drum stem type {stem_type!r} — skipped.")

    if tom_arrays:
        stem_paths["toms"] = _mix_down_toms(tom_arrays, tmp_dir)

    if not stem_paths:
        raise FadrError(f"Fadr's drum-stem separation did not return any recognizable stems. Got: {sub_stems!r}")

    return stem_paths, warnings
