# ADR 0006: Drum Audio Import stays an optional, separate service boundary

## Status
Accepted — Stage 0 of `DRUM_AUDIO_IMPORT_AND_TRANSCRIPTION_SPEC.md`.

## Context
`DRUM_AUDIO_IMPORT_AND_TRANSCRIPTION_SPEC.md` adds a large new capability — audio upload, drum stem analysis, tempo tracking, tom classification, quantization, and MIDI/MusicXML/PDF export — on top of DrumPath, a Local-first, single-user PWA with no backend (`SPEC.md`). The audio DSP pipeline (FFmpeg, stem separation, STFT/spectral-flux onset detection, beat tracking) is computationally heavy and outside the existing Vite/React/Dexie stack; there is no server component anywhere in this repository today. The import spec itself proposes an ASP.NET Core + Python Worker stack as a *recommendation*, explicitly not something already implemented.

Two options: (a) push audio analysis into the browser (WebAssembly DSP, on-device), keeping the whole app server-free; (b) treat import/transcription as an optional, separate service the PWA talks to only when creating a new transcription, with everything else — practice, scoring, offline use, existing exercises — staying exactly as Local-first as today.

## Decision
Drum Audio Import is a bounded, optional service, external to DrumPath's core. The PWA:
- Never requires the import service to be reachable for anything except *starting a new* transcription job.
- Writes nothing to Dexie on the service's behalf — `ApproveDrumImportUseCase` (Stage 6) is the only place a completed, user-approved import is persisted, through the existing Repository pattern, exactly like every other write path in the app.
- Keeps every existing route, keyboard mapping, sample, scoring rule, and offline guarantee unchanged; the import service's absence or failure has zero effect on Dashboard, Today, Course, Practice, Journal, Analytics, Library, Settings, or the existing Visual Trainer runner.
- Treats the service's own API contract (`DrumImportJob`, `DrumScoreDocument`, SSE progress, etc.) as a boundary DrumPath validates with Zod on every response — never a trusted extension of the local data model.

`Exercise` (core library entity) and `InteractiveExercise` (Visual Trainer's playable entity) stay distinct, as they already are; an approved import creates one of each, linked by `exerciseId`, through their existing separate Repositories — the import feature does not introduce a third parallel exercise concept.

## Rationale
- Matches the existing, load-bearing product decision ("Local-first, single-user, no backend for MVP" — `SPEC.md`) without silently reversing it for one feature; the import service is additive, not a foundation swap.
- In-browser WebAssembly DSP for stem separation and beat tracking at production quality is a multi-month research effort on its own and isn't what either spec asks for — treating it as out of scope for this ADR avoids scope creep into audio ML.
- A hard service boundary makes "no capability regression" (import spec §0.1) mechanically checkable: if the service is down, every existing screen and the entire practice loop still work, because none of them import from or depend on the service's code path.
- Keeps the bundle-size budget (`SPEC.md`: 350KB gzip initial) intact — the import feature's own UI (waveform review, stem mixer, notation preview) is a separate Lazy route, not a dependency of the app shell.

## Consequences
- A new transcription cannot be created offline or without the service configured — this is accepted and documented (import spec §41, out of scope for MVP: "Processing מלא בדפדפן").
- Every write the import feature makes to local storage goes through the same Repository + Zod validation path as the rest of the app; there is no separate "trust the service" fast path.
- Stage 1 (domain types, Zod schemas, `DrumScoreDocument`, adapters) can proceed without any server code existing yet — the domain layer is defined and testable independent of whether the ASP.NET/Python service is ever built, matching the import spec's own staging (§42, Stage 1 before Stage 2).
