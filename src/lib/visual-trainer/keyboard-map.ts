import type { DrumInstrument } from '../../domain'

// VISUAL_DRUM_TRAINER_SPEC.md §6 — keyed by KeyboardEvent.code (physical key
// position), not KeyboardEvent.key. The spec writes the mapping as literal
// characters (F/J/D/...), but .key is layout-dependent — with a Hebrew
// input language active (likely, in a Hebrew-first app) the physical F/J/D
// keys produce entirely different .key values, silently breaking every
// mapping. .code reports physical position regardless of active layout,
// the standard technique for keyboard-driven games.
export type DrumKeyboardMap = Record<string, DrumInstrument>

export const DEFAULT_KEYBOARD_MAP: DrumKeyboardMap = {
  KeyF: 'kick',
  KeyJ: 'snare',
  KeyD: 'hihat_closed',
  KeyE: 'hihat_open',
  KeyR: 'ride',
  KeyT: 'crash',
  KeyU: 'tom_high',
  KeyI: 'tom_mid',
  KeyO: 'tom_floor',
}

export function mapCodeToInstrument(code: string, keyMap: DrumKeyboardMap): DrumInstrument | undefined {
  return keyMap[code]
}
