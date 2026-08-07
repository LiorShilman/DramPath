# DrumPath Drum Import Service

A local, single-user analysis service that wraps the drum-stem transcription
pipeline (onset detection, beat/tempo tracking, tom classification,
sixteenth-note quantization) behind one synchronous HTTP endpoint. It exists
so DrumPath's own `/practice/visual/import` screen can upload separated drum
stems and get back a quantized event list, without a manual per-song script
run.

This is **not** the full backend described in
`DRUM_AUDIO_IMPORT_AND_TRANSCRIPTION_SPEC (2).md` (no job queue, no SSE
progress, no MIDI/MusicXML/PDF export — see `docs/adr/0006-drum-import-
local-first-boundary.md` in the DrumPath repo for why). It's a much smaller
service scoped to exactly what DrumPath's import screen needs.

## Setup

1. Python 3.11–3.14 (a virtualenv is strongly recommended):
   ```powershell
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```
2. `ffmpeg` must be reachable. Either put it on PATH, or point the
   `FFMPEG_BIN` environment variable at the binary directly (no PATH change
   needed):
   ```powershell
   winget install -e --id Gyan.FFmpeg
   # open a NEW terminal (PATH changes don't apply to already-open shells), then:
   ffmpeg -version
   # if that still doesn't resolve, find the installed exe and set:
   $env:FFMPEG_BIN = "C:\Users\<you>\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_...\ffmpeg-...\bin\ffmpeg.exe"
   ```
3. (Optional, ADR 0008) To enable "upload a full song" via Fadr Plus's
   cloud stem separation instead of always needing pre-separated stems:
   copy `.env.example` to `.env` and fill in `FADR_API_KEY` (from your
   Fadr account's API tab). Leave it unset to keep the service exactly as
   it was before this option existed — `/api/v1/analyze` never depends on
   it. **Never commit `.env`** (already gitignored).

## Run

```powershell
uvicorn app.main:app --port 8000 --reload
```

Run this alongside DrumPath's own `npm run dev` (a separate terminal) — the
two are independent processes. By default the service only accepts requests
from `http://localhost:5173` (Vite's default dev port); override with the
`ALLOWED_ORIGIN` environment variable if your dev server runs elsewhere.

## Endpoints

- `GET /api/v1/health` — `{ status, ffmpegAvailable, ffmpegPath, version, fadrConfigured }`.
- `POST /api/v1/analyze` — `multipart/form-data` with up to 7 optional file
  parts (`kick`, `snare`, `toms`, `hh`, `ride`, `crash`, `residual`), returns
  the quantized event list as JSON. See `app/schemas.py` for the exact
  shape (mirrored on the DrumPath side at
  `src/features/drum-import/domain/analyze-response.ts`).
- `POST /api/v1/analyze-from-song` — `multipart/form-data` with one `song`
  file part (a full song, not pre-separated stems). Only available when
  `FADR_API_KEY` is configured (503 otherwise) — internally calls Fadr's
  cloud API (`app/fadr_client.py`) to separate the song, then feeds the
  result into the exact same analysis pipeline as `/api/v1/analyze`. See
  `docs/adr/0008-fadr-cloud-stem-separation.md` in the DrumPath repo.

## Tests

```powershell
pytest
```

`tests/test_pipeline_smoke.py` uses synthetic audio (no ffmpeg dependency).
`tests/test_api.py` exercises the FastAPI app via `TestClient`.
`tests/test_fadr_client.py` mocks every Fadr HTTP call (`httpx.MockTransport`)
— no real network access or API key needed to run the suite.

## Attribution

The detection/beat-tracking/tom-classification algorithms in
`app/pipeline/` are ported from a working standalone script the project
owner wrote and used to transcribe a real song before this service existed.
That script (`generate_drum_trial.py`) also produces MIDI/MusicXML/PDF
files directly — this service intentionally does not duplicate that part;
run the standalone script separately if you want those file formats.
