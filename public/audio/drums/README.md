# Real drum samples (optional)

This folder is empty by default — DrumPath synthesizes every drum sound in
code (`src/lib/visual-trainer/drum-synth.ts`) when no sample file is found
here, so nothing breaks without this folder having any content.

To use real recorded samples instead, drop one short one-shot audio file
per instrument here, named exactly:

- `kick.wav` (or `.mp3`)
- `snare.wav`
- `hihat_closed.wav`
- `hihat_open.wav`
- `ride.wav`
- `crash.wav`
- `tom_high.wav`
- `tom_mid.wav`
- `tom_floor.wav`

Each file is picked up automatically the next time the app loads — no code
changes needed. An instrument with no matching file keeps using the
synthesized sound; you can mix real samples for some instruments with
synthesized sound for others.

Tips for the files themselves:
- Short one-shot hits (a few hundred ms, `hihat_open`/`crash`/`ride` can run
  longer), not loops.
- Normalize volume across instruments so the mix doesn't need per-file gain
  tweaks later.
- Mono or stereo both work; keep file sizes reasonable (this is a PWA — big
  files slow down the first load and offline caching).
