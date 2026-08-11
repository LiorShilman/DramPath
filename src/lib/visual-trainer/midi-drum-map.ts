import type { DrumInstrument } from '../../domain'

// Reverse-engineered against the user's own Lemon T550 module using
// tools/midi-inspector.html (a standalone Web MIDI logging page, not part
// of the app) — every hit arrived as a Note On on MIDI channel 10 (General
// MIDI's percussion channel, as expected for a drum module), and most note
// numbers happen to match the standard GM percussion map (36 kick, 38
// snare, 43 High Floor Tom, 46 Open Hi-Hat, 49 Crash 1, 51/59 Ride 1/2) —
// but NOT all of them: 30 for closed hi-hat has no GM meaning at all (GM's
// own closed-hihat note is 42), so this mapping is this specific module's
// own behavior, not a general GM assumption other e-kits can be expected
// to share.
//
// 51 and 59 (GM "Ride Cymbal 1"/"Ride Cymbal 2" — the ride's bow vs
// edge/bell zone) both map to the same 'ride' — DrumPath has no separate
// per-zone ride instrument, unlike hihat's genuine open/closed split.
//
// tom_mid vs tom_high (45 vs 48) is the one entry here that's inferred
// rather than confirmed on-kit: GM names 45 "Low Tom" and 48 "Hi-Mid Tom",
// so the higher-pitched rack tom (tom_high) should be 48 and the
// lower-pitched one (tom_mid) should be 45 — swap these two if a real hit
// test shows otherwise.
export const MIDI_NOTE_TO_INSTRUMENT: Readonly<Record<number, DrumInstrument>> = {
  30: 'hihat_closed',
  36: 'kick',
  38: 'snare',
  43: 'tom_floor',
  45: 'tom_mid',
  46: 'hihat_open',
  48: 'tom_high',
  49: 'crash',
  51: 'ride',
  59: 'ride',
}
