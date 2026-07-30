import type { DrumInstrument } from '../../domain'

// Shared between DrumKitSvg and NoteHighway so a lane's color always
// matches its drum kit piece. Fixed, deliberately vivid hex values rather
// than design-system tokens — a rhythm-game highway needs 9 stable,
// mutually distinguishable lane colors, which the app's ~4-color semantic
// palette (primary/success/warning/danger) can't provide without repeats.
export const LANE_ORDER: DrumInstrument[] = [
  'crash',
  'ride',
  'hihat_open',
  'hihat_closed',
  'tom_high',
  'tom_mid',
  'snare',
  'tom_floor',
  'kick',
]

export const INSTRUMENT_COLORS: Record<DrumInstrument, string> = {
  kick: '#e11d48',
  snare: '#f59e0b',
  hihat_closed: '#facc15',
  hihat_open: '#fde047',
  ride: '#38bdf8',
  crash: '#a78bfa',
  tom_high: '#34d399',
  tom_mid: '#22c55e',
  tom_floor: '#16a34a',
}
