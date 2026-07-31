import type { DrumInstrument } from '../../domain'

// VISUAL_DRUM_TRAINER_SPEC.md §6 — keyed by KeyboardEvent.code (physical key
// position), not KeyboardEvent.key. The spec writes the mapping as literal
// characters (F/J/D/...), but .key is layout-dependent — with a Hebrew
// input language active (likely, in a Hebrew-first app) the physical F/J/D
// keys produce entirely different .key values, silently breaking every
// mapping. .code reports physical position regardless of active layout,
// the standard technique for keyboard-driven games.
export type DrumKeyboardMap = Record<string, DrumInstrument>

// Chosen so each key's left-right position on the keyboard roughly matches
// its instrument's left-right position on the drum kit (VISUAL_DRUM_TRAINER_SPEC.md
// §6): crash/toms/ride left-to-right along the top row, hi-hat (leftmost on
// the kit) at the left of the home row, then snare/kick/floor-tom
// continuing left-to-right. tom_high/tom_mid/ride sit on U/I/O — all under
// the right hand — rather than spanning R/T/U (left hand into right hand),
// so playing that run doesn't force a hand-crossing reach; crash (E) is
// played rarely enough by comparison to stay on the left hand alone.
export const DEFAULT_KEYBOARD_MAP: DrumKeyboardMap = {
  KeyE: 'crash',
  KeyU: 'tom_high',
  KeyI: 'tom_mid',
  KeyO: 'ride',
  KeyS: 'hihat_open',
  KeyD: 'hihat_closed',
  KeyF: 'snare',
  KeyJ: 'kick',
  KeyK: 'tom_floor',
}

export function mapCodeToInstrument(code: string, keyMap: DrumKeyboardMap): DrumInstrument | undefined {
  return keyMap[code]
}

// e.g. 'KeyF' -> 'F' — the short label shown to the player (KeyboardGuide's
// legend, and each falling note in NoteHighway).
export function codeToKeyLabel(code: string): string {
  return code.replace('Key', '')
}

export function getKeyLabelForInstrument(
  instrument: DrumInstrument,
  keyMap: DrumKeyboardMap = DEFAULT_KEYBOARD_MAP,
): string | undefined {
  const entry = Object.entries(keyMap).find(([, mappedInstrument]) => mappedInstrument === instrument)
  return entry ? codeToKeyLabel(entry[0]) : undefined
}
