import { describe, expect, it } from 'vitest'
import { calculateEventTimeMs } from './event-timing'

const FOUR_FOUR = { numerator: 4, denominator: 4 }
const THREE_FOUR = { numerator: 3, denominator: 4 }

describe('calculateEventTimeMs', () => {
  it('is 0 at the very start of the exercise', () => {
    expect(
      calculateEventTimeMs(
        { bar: 1, beat: 1, subdivisionIndex: 0 },
        { bpm: 120, timeSignature: FOUR_FOUR, subdivision: 'quarter' },
      ),
    ).toBe(0)
  })

  it('advances by one beat duration on the second beat', () => {
    expect(
      calculateEventTimeMs(
        { bar: 1, beat: 2, subdivisionIndex: 0 },
        { bpm: 120, timeSignature: FOUR_FOUR, subdivision: 'quarter' },
      ),
    ).toBe(500)
  })

  it('places an eighth-note "&" halfway through the beat', () => {
    expect(
      calculateEventTimeMs(
        { bar: 1, beat: 1, subdivisionIndex: 1 },
        { bpm: 120, timeSignature: FOUR_FOUR, subdivision: 'eighth' },
      ),
    ).toBe(250)
  })

  it('handles a sixteenth-note subdivision at a slower tempo', () => {
    expect(
      calculateEventTimeMs(
        { bar: 1, beat: 2, subdivisionIndex: 2 },
        { bpm: 60, timeSignature: FOUR_FOUR, subdivision: 'sixteenth' },
      ),
    ).toBe(1500)
  })

  it('advances by one full bar on the second bar', () => {
    expect(
      calculateEventTimeMs(
        { bar: 2, beat: 1, subdivisionIndex: 0 },
        { bpm: 120, timeSignature: FOUR_FOUR, subdivision: 'quarter' },
      ),
    ).toBe(2000)
  })

  it('uses a shorter bar length for a 3/4 time signature', () => {
    expect(
      calculateEventTimeMs(
        { bar: 2, beat: 1, subdivisionIndex: 0 },
        { bpm: 120, timeSignature: THREE_FOUR, subdivision: 'quarter' },
      ),
    ).toBe(1500)
  })
})
