import { describe, expect, it } from 'vitest'
import { DEFAULT_KEYBOARD_MAP, mapCodeToInstrument } from './keyboard-map'
import type { DrumInstrument } from '../../domain'

describe('mapCodeToInstrument', () => {
  it('maps KeyF to kick in the default map', () => {
    expect(mapCodeToInstrument('KeyF', DEFAULT_KEYBOARD_MAP)).toBe('kick')
  })

  it('returns undefined for an unmapped code', () => {
    expect(mapCodeToInstrument('KeyZ', DEFAULT_KEYBOARD_MAP)).toBeUndefined()
  })

  it('exercises every instrument in the default map', () => {
    const expected: Record<string, DrumInstrument> = {
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
    for (const [code, instrument] of Object.entries(expected)) {
      expect(mapCodeToInstrument(code, DEFAULT_KEYBOARD_MAP)).toBe(instrument)
    }
  })
})
