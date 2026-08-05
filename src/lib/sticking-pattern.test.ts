import { describe, expect, it } from 'vitest'
import { handForSubTick, STICKING_PATTERNS } from './sticking-pattern'

describe('handForSubTick', () => {
  it('is always the right hand for quarters', () => {
    expect(handForSubTick('quarter', 0)).toBe('R')
  })

  it('keeps both eighth-note subdivisions on the right hand', () => {
    expect(handForSubTick('eighth', 0)).toBe('R')
    expect(handForSubTick('eighth', 1)).toBe('R')
  })

  it('alternates R L R L across the four sixteenth-note subdivisions', () => {
    expect(handForSubTick('sixteenth', 0)).toBe('R')
    expect(handForSubTick('sixteenth', 1)).toBe('L')
    expect(handForSubTick('sixteenth', 2)).toBe('R')
    expect(handForSubTick('sixteenth', 3)).toBe('L')
  })

  it('wraps around for an out-of-range index, matching the pattern length', () => {
    expect(handForSubTick('sixteenth', 4)).toBe(STICKING_PATTERNS.sixteenth[0])
    expect(handForSubTick('eighth', 2)).toBe(STICKING_PATTERNS.eighth[0])
  })
})
