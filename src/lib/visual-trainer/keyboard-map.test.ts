import { describe, expect, it } from 'vitest'
import { DEFAULT_KEYBOARD_MAP, codeToKeyLabel, getKeyLabelForInstrument, mapCodeToInstrument } from './keyboard-map'
import type { DrumInstrument } from '../../domain'

describe('mapCodeToInstrument', () => {
  it('maps KeyJ to kick in the default map', () => {
    expect(mapCodeToInstrument('KeyJ', DEFAULT_KEYBOARD_MAP)).toBe('kick')
  })

  it('returns undefined for an unmapped code', () => {
    expect(mapCodeToInstrument('KeyZ', DEFAULT_KEYBOARD_MAP)).toBeUndefined()
  })

  it('exercises every instrument in the default map', () => {
    const expected: Record<string, DrumInstrument> = {
      KeyJ: 'kick',
      KeyF: 'snare',
      KeyD: 'hihat_closed',
      KeyS: 'hihat_open',
      KeyO: 'ride',
      KeyE: 'crash',
      KeyU: 'tom_high',
      KeyI: 'tom_mid',
      KeyK: 'tom_floor',
    }
    for (const [code, instrument] of Object.entries(expected)) {
      expect(mapCodeToInstrument(code, DEFAULT_KEYBOARD_MAP)).toBe(instrument)
    }
  })
})

describe('codeToKeyLabel', () => {
  it('strips the "Key" prefix', () => {
    expect(codeToKeyLabel('KeyF')).toBe('F')
  })
})

describe('getKeyLabelForInstrument', () => {
  it('finds the key label for an instrument in the default map', () => {
    expect(getKeyLabelForInstrument('snare')).toBe('F')
    expect(getKeyLabelForInstrument('tom_floor')).toBe('K')
  })

  it('respects a custom key map', () => {
    expect(getKeyLabelForInstrument('kick', { KeyZ: 'kick' })).toBe('Z')
  })

  it('returns undefined for an instrument with no mapped key', () => {
    expect(getKeyLabelForInstrument('kick', {})).toBeUndefined()
  })
})
