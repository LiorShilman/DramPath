"""Local drum-import analysis service — FastAPI, single synchronous
endpoint, no job queue/SSE (see docs/adr/0006-drum-import-local-first-
boundary.md in the DrumPath repo for the architectural boundary this
serves). Run with:

    uvicorn app.main:app --port 8000 --reload

from this directory, after `pip install -r requirements.txt`. CORS origin
is env-driven (ALLOWED_ORIGIN, default http://localhost:5173 — Vite's
default dev port) so it doesn't silently break if the frontend's port ever
shifts.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import fadr_client
from .fadr_client import FADR_BASE_URL, FadrError
from .pipeline.analyze import analyze_stems
from .pipeline.constants import ALGORITHM_VERSION
from .pipeline.decode import DecodeError, ffmpeg_available
from .schemas import AnalyzeResponse, HealthResponse

# No-op if .env doesn't exist (e.g. CI, or FADR_API_KEY set some other way)
# — see ADR 0008 for why this service holds a .env at all now.
load_dotenv()

app = FastAPI(title="DrumPath Drum Import Service", version=ALGORITHM_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("ALLOWED_ORIGIN", "http://localhost:5173")],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    # Chrome's Private Network Access (PNA) policy requires this explicit
    # opt-in before it lets a page served from a public origin (the
    # deployed https:// domain) reach a private-network target like
    # 127.0.0.1 — without it, a real browser silently blocks the request
    # client-side (observed as net::ERR_BLOCKED_BY_CLIENT, in both a normal
    # and an Incognito window) even though the request never reaches this
    # server at all, so it can't be diagnosed from server-side logs alone.
    # A first custom-middleware attempt at this header was wrong — Starlette
    # already rejects the preflight with its own 400 before app code runs
    # unless this constructor flag is set.
    allow_private_network=True,
)

STEM_FIELDS = ("kick", "snare", "toms", "hh", "ride", "crash", "residual")


@app.get("/api/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    available, path = ffmpeg_available()
    return HealthResponse(
        status="ok",
        ffmpegAvailable=available,
        ffmpegPath=path,
        version=ALGORITHM_VERSION,
        fadrConfigured=fadr_client.is_configured(),
    )


@app.post("/api/v1/analyze", response_model=AnalyzeResponse)
async def analyze(
    kick: UploadFile | None = None,
    snare: UploadFile | None = None,
    toms: UploadFile | None = None,
    hh: UploadFile | None = None,
    ride: UploadFile | None = None,
    crash: UploadFile | None = None,
    residual: UploadFile | None = None,
) -> AnalyzeResponse:
    uploads = {
        "kick": kick, "snare": snare, "toms": toms, "hh": hh,
        "ride": ride, "crash": crash, "residual": residual,
    }
    provided = {name: file for name, file in uploads.items() if file is not None}
    if not provided:
        raise HTTPException(status_code=400, detail="At least one stem file is required.")

    available, _ = ffmpeg_available()
    if not available:
        raise HTTPException(
            status_code=503,
            detail="ffmpeg is not available on the server (set FFMPEG_BIN or install ffmpeg).",
        )

    with tempfile.TemporaryDirectory(prefix="drum-import-") as tmp:
        tmp_dir = Path(tmp)
        stem_paths: dict[str, Path] = {}
        for name, file in provided.items():
            suffix = Path(file.filename or "").suffix or ".bin"
            dest = tmp_dir / f"{name}{suffix}"
            dest.write_bytes(await file.read())
            stem_paths[name] = dest

        try:
            result = analyze_stems(stem_paths)
        except DecodeError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    return AnalyzeResponse.model_validate(result)


@app.post("/api/v1/analyze-from-song", response_model=AnalyzeResponse)
async def analyze_from_song(song: UploadFile) -> AnalyzeResponse:
    """ADR 0008 — optional Fadr-backed path: one full song in, same
    AnalyzeResponse out as /api/v1/analyze. Only reachable when
    FADR_API_KEY is configured (mirrors the health endpoint's own check,
    so a stale frontend can't reach this without the server also agreeing
    it's available)."""
    if not fadr_client.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Fadr integration is not configured on this server (set FADR_API_KEY).",
        )

    available, _ = ffmpeg_available()
    if not available:
        raise HTTPException(
            status_code=503,
            detail="ffmpeg is not available on the server (set FFMPEG_BIN or install ffmpeg).",
        )

    song_bytes = await song.read()
    if not song_bytes:
        raise HTTPException(status_code=400, detail="Uploaded song file is empty.")

    with tempfile.TemporaryDirectory(prefix="drum-import-fadr-") as tmp:
        tmp_dir = Path(tmp)
        try:
            async with httpx.AsyncClient(base_url=FADR_BASE_URL, timeout=60.0) as client:
                stem_paths, fadr_warnings = await fadr_client.separate_song_to_stems(
                    song_bytes, song.filename or "song.mp3", tmp_dir, client,
                )
        except FadrError as error:
            raise HTTPException(status_code=502, detail=f"Fadr stem separation failed: {error}") from error

        try:
            result = analyze_stems(stem_paths)
        except DecodeError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    result["warnings"] = [*result.get("warnings", []), *fadr_warnings]
    return AnalyzeResponse.model_validate(result)
