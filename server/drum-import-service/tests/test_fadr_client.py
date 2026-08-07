from __future__ import annotations

import json
from pathlib import Path

import httpx
import numpy as np
import pytest

from app import fadr_client
from app.fadr_client import FADR_BASE_URL, FadrError, separate_song_to_stems


@pytest.fixture(autouse=True)
def _fadr_api_key(monkeypatch):
    # separate_song_to_stems requires an API key for every real call it
    # makes — set a fake one for every test in this file except
    # test_is_configured_reflects_env_var, which manages the env var itself
    # and doesn't call any authenticated endpoint.
    monkeypatch.setenv("FADR_API_KEY", "test-key-123")


def _json_response(status_code: int, body: dict) -> httpx.Response:
    return httpx.Response(status_code, content=json.dumps(body).encode())


class FakeFadrTransport(httpx.MockTransport):
    """Simulates the exact call sequence separate_song_to_stems makes
    against a real Fadr account (shapes confirmed 2026-08-06, not assumed
    from docs — see fadr_client.py's own module doc comment): every
    document is wrapped ({"asset": {...}}/{"task": {...}}), a task's
    resulting assets live on its PARENT asset's own `stems` array (plain id
    strings, not objects), and completion is status.complete (bool), not a
    "done"/"failed" string. main_stems/drum_sub_stems each need one entry
    with a distinct "stemType" (main_stems must include one 'drums' entry).
    """

    def __init__(self, main_stems: list[dict], drum_sub_stems: list[dict], main_task_polls: int = 1, drum_task_polls: int = 1):
        self.main_stems = main_stems
        self.drum_sub_stems = drum_sub_stems
        self._main_polls_remaining = main_task_polls
        self._drum_polls_remaining = drum_task_polls
        self.requested_urls: list[str] = []
        super().__init__(self._handle)

    def _stems_by_id(self, entries: list[dict]) -> dict[str, dict]:
        return {entry["_id"]: entry for entry in entries}

    def _handle(self, request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        self.requested_urls.append(url)
        all_stems = self._stems_by_id(self.main_stems) | self._stems_by_id(self.drum_sub_stems)

        if url.endswith("/assets/upload2"):
            return _json_response(200, {"url": "https://cdn.fake/upload-song", "s3Path": "songs/fake.mp3"})
        if url == "https://cdn.fake/upload-song":
            return httpx.Response(200)
        if url.endswith("/assets") and request.method == "POST":
            return _json_response(200, {"asset": {"_id": "song-asset-id"}})
        if url.endswith("/assets/analyze/stem"):
            body = json.loads(request.content)
            if body["stemType"] == "main":
                return _json_response(200, {"msg": "ok", "task": {"_id": "main-task-id"}})
            if body["stemType"] == "drum-stem":
                return _json_response(200, {"msg": "ok", "task": {"_id": "drum-task-id"}})
        if url.endswith("/tasks/main-task-id"):
            complete = self._main_polls_remaining <= 1
            self._main_polls_remaining = max(0, self._main_polls_remaining - 1)
            return _json_response(200, {"task": {"_id": "main-task-id", "status": {"msg": "...", "complete": complete}}})
        if url.endswith("/tasks/drum-task-id"):
            complete = self._drum_polls_remaining <= 1
            self._drum_polls_remaining = max(0, self._drum_polls_remaining - 1)
            return _json_response(200, {"task": {"_id": "drum-task-id", "status": {"msg": "...", "complete": complete}}})
        if url.endswith("/assets/song-asset-id"):
            return _json_response(200, {"asset": {"_id": "song-asset-id", "stems": [e["_id"] for e in self.main_stems]}})
        drums_id = next((e["_id"] for e in self.main_stems if e["stemType"] == "drums"), None)
        for stem_id, entry in all_stems.items():
            if url.endswith(f"/assets/{stem_id}"):
                # Real asset docs carry both fields at once: metaData.stemType
                # (what this stem IS) and stems (its OWN children, [] until a
                # further separation has run on it) — the "drums" entry needs
                # both, since it's read once for its stemType (as a main-stem
                # child) and again for its own children (after drum-stem runs).
                asset = {"_id": stem_id, "metaData": {"stemType": entry["stemType"]}}
                if stem_id == drums_id:
                    asset["stems"] = [e["_id"] for e in self.drum_sub_stems]
                return _json_response(200, {"asset": asset})
        if "/assets/download/" in url and url.endswith("/hq"):
            asset_id = url.split("/assets/download/")[1].split("/")[0]
            return _json_response(200, {"url": f"https://cdn.fake/download/{asset_id}"})
        if url.startswith("https://cdn.fake/download/"):
            return httpx.Response(200, content=b"fake-audio-bytes")

        raise AssertionError(f"Unexpected request in FakeFadrTransport: {request.method} {url}")


def _default_main_stems() -> list[dict]:
    return [
        {"_id": "vocals-id", "stemType": "vocals"},
        {"_id": "drums-id", "stemType": "drums"},
        {"_id": "bass-id", "stemType": "bass"},
    ]


async def _run_separate(transport: FakeFadrTransport, tmp_path: Path):
    async with httpx.AsyncClient(base_url=FADR_BASE_URL, transport=transport) as client:
        return await separate_song_to_stems(b"fake-song-bytes", "my-song.mp3", tmp_path, client)


@pytest.mark.asyncio
async def test_downloads_and_maps_recognized_drum_sub_stems(tmp_path, monkeypatch):
    monkeypatch.setattr(fadr_client, "POLL_INTERVAL_SECONDS", 0.0)
    transport = FakeFadrTransport(
        main_stems=_default_main_stems(),
        drum_sub_stems=[
            {"_id": "kick-id", "stemType": "kick"},
            {"_id": "snare-id", "stemType": "snare"},
            {"_id": "other-id", "stemType": "drums-other"},
        ],
    )

    stem_paths, warnings = await _run_separate(transport, tmp_path)

    # Confirmed real Fadr behavior: drum-stem separation only ever returns
    # kick/snare/drums-other — "drums-other" (hihat+toms+cymbals mixed) maps
    # to analyze_stems' own catch-all "residual" field.
    assert set(stem_paths) == {"kick", "snare", "residual"}
    assert warnings == []
    for path in stem_paths.values():
        assert path.exists()
        assert path.read_bytes() == b"fake-audio-bytes"


@pytest.mark.asyncio
async def test_waits_through_incomplete_status_before_done(tmp_path, monkeypatch):
    monkeypatch.setattr(fadr_client, "POLL_INTERVAL_SECONDS", 0.0)
    transport = FakeFadrTransport(
        main_stems=_default_main_stems(),
        drum_sub_stems=[{"_id": "kick-id", "stemType": "kick"}],
        main_task_polls=3,
        drum_task_polls=2,
    )

    stem_paths, _ = await _run_separate(transport, tmp_path)

    assert "kick" in stem_paths
    # Confirms the poll loop actually re-requested task status rather than
    # accepting the first (incomplete) response as final.
    assert transport.requested_urls.count(f"{FADR_BASE_URL}/tasks/main-task-id") == 3
    assert transport.requested_urls.count(f"{FADR_BASE_URL}/tasks/drum-task-id") == 2


@pytest.mark.asyncio
async def test_mixes_down_multiple_tom_sub_stems_into_one_toms_file(tmp_path, monkeypatch):
    # Not a real Fadr response as of 2026-08 (it only returns kick/snare/
    # drums-other) — this exercises the forward-compatible fallback path in
    # case a future API version does split toms out.
    monkeypatch.setattr(fadr_client, "POLL_INTERVAL_SECONDS", 0.0)
    monkeypatch.setattr(fadr_client, "decode", lambda path: np.zeros(100, dtype=np.float32))
    transport = FakeFadrTransport(
        main_stems=_default_main_stems(),
        drum_sub_stems=[
            {"_id": "kick-id", "stemType": "kick"},
            {"_id": "tom1-id", "stemType": "tom_high"},
            {"_id": "tom2-id", "stemType": "tom_mid"},
        ],
    )

    stem_paths, warnings = await _run_separate(transport, tmp_path)

    assert set(stem_paths) == {"kick", "toms"}
    assert stem_paths["toms"].exists()
    assert warnings == []


@pytest.mark.asyncio
async def test_warns_and_skips_unrecognized_stem_types_instead_of_failing(tmp_path, monkeypatch):
    monkeypatch.setattr(fadr_client, "POLL_INTERVAL_SECONDS", 0.0)
    transport = FakeFadrTransport(
        main_stems=_default_main_stems(),
        drum_sub_stems=[
            {"_id": "kick-id", "stemType": "kick"},
            {"_id": "mystery-id", "stemType": "some-new-fadr-category"},
        ],
    )

    stem_paths, warnings = await _run_separate(transport, tmp_path)

    assert set(stem_paths) == {"kick"}
    assert len(warnings) == 1
    assert "some-new-fadr-category" in warnings[0]


@pytest.mark.asyncio
async def test_raises_fadr_error_when_no_drums_stem_is_found(tmp_path, monkeypatch):
    monkeypatch.setattr(fadr_client, "POLL_INTERVAL_SECONDS", 0.0)
    transport = FakeFadrTransport(
        main_stems=[{"_id": "vocals-id", "stemType": "vocals"}, {"_id": "bass-id", "stemType": "bass"}],
        drum_sub_stems=[],
    )

    with pytest.raises(FadrError, match="drums"):
        await _run_separate(transport, tmp_path)


@pytest.mark.asyncio
async def test_raises_fadr_error_on_incomplete_status_past_timeout(tmp_path, monkeypatch):
    monkeypatch.setattr(fadr_client, "POLL_INTERVAL_SECONDS", 0.0)
    monkeypatch.setattr(fadr_client, "POLL_TIMEOUT_SECONDS", 0.0)
    transport = FakeFadrTransport(main_stems=_default_main_stems(), drum_sub_stems=[], main_task_polls=999)

    with pytest.raises(FadrError, match="did not finish"):
        await _run_separate(transport, tmp_path)


def test_is_configured_reflects_env_var(monkeypatch):
    monkeypatch.delenv("FADR_API_KEY", raising=False)
    assert fadr_client.is_configured() is False

    monkeypatch.setenv("FADR_API_KEY", "test-key-123")
    assert fadr_client.is_configured() is True
