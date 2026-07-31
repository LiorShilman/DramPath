import type { DrumInstrument } from '../../domain'

// Used by NoteHighway for its lane colors — DrumKit now renders real product
// photos (public/drum-kit/) instead of colored shapes, but keeping this
// palette lets NoteHighway's note colors still map to a recognizable lane.
// matches its drum kit piece. Fixed, deliberately vivid hex values rather
// than design-system tokens — a rhythm-game highway needs 9 stable,
// mutually distinguishable lane colors, which the app's ~4-color semantic
// palette (primary/success/warning/danger) can't provide without repeats.
// Matches DEFAULT_KEYBOARD_MAP's own left-to-right layout (keyboard-map.ts,
// KeyboardGuide's two rows): home row (hi-hat open/closed, snare, kick,
// floor-tom) first, then the top row (crash/high-tom/mid-tom/ride) — the
// home row is the one most exercises actually use, so its instruments land
// in the first lanes instead of being pushed toward the highway's far side.
export const LANE_ORDER: DrumInstrument[] = [
  'hihat_open',
  'hihat_closed',
  'snare',
  'kick',
  'tom_floor',
  'crash',
  'tom_high',
  'tom_mid',
  'ride',
]

// All 9 chosen at roughly the same perceived brightness/saturation (varying
// only hue) — an earlier pass mixed near-white yellows with dark greens/
// reds, which read as "some notes are lit, some are dim" rather than just
// 9 equally-present lanes (reported directly by the user).
export const INSTRUMENT_COLORS: Record<DrumInstrument, string> = {
  kick: '#f4655c',
  snare: '#f2994a',
  hihat_closed: '#f2c94c',
  hihat_open: '#d9c94c',
  ride: '#56ccf2',
  crash: '#bb6bd9',
  tom_high: '#6fcf97',
  tom_mid: '#4fb477',
  tom_floor: '#2f9e6e',
}
