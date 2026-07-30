import { describe, expect, it } from 'vitest'
import { calculateAccuracy, calculateAverageTimingError, calculateCombo } from './scoring-engine'
import type { ExtraHitEvent, HitGrade, HitResult } from '../hit-result'

function makeHit(grade: HitGrade, expectedTimeMs: number, timingErrorMs?: number): HitResult {
  return {
    id: `hit-${expectedTimeMs}`,
    expectedEventId: `event-${expectedTimeMs}`,
    instrument: 'kick',
    expectedTimeMs,
    grade,
    timingErrorMs,
  }
}

function makeExtraHit(hitTimeMs: number): ExtraHitEvent {
  return { id: `extra-${hitTimeMs}`, instrument: 'kick', hitTimeMs }
}

describe('calculateAccuracy', () => {
  it('divides non-miss hits by total expected events', () => {
    const hitResults = [
      makeHit('perfect', 1),
      makeHit('early', 2),
      makeHit('late', 3),
      makeHit('perfect', 4),
      makeHit('perfect', 5),
      makeHit('perfect', 6),
      makeHit('perfect', 7),
      makeHit('miss', 8),
      makeHit('miss', 9),
      makeHit('miss', 10),
    ]
    expect(calculateAccuracy(hitResults, [], 10)).toBe(70)
  })

  it('counts extra hits as mistakes that widen the denominator', () => {
    const hitResults = [makeHit('perfect', 1), makeHit('perfect', 2)]
    const extraHits = [makeExtraHit(3)]
    // 2 non-miss hits out of (2 expected + 1 extra) = 66.67%
    expect(calculateAccuracy(hitResults, extraHits, 2)).toBeCloseTo(66.67, 1)
  })

  it('returns 0 rather than NaN when there is nothing to score', () => {
    expect(calculateAccuracy([], [], 0)).toBe(0)
  })
})

describe('calculateCombo', () => {
  it('resets on a miss but keeps counting through early/late', () => {
    const hitResults = [
      makeHit('perfect', 1),
      makeHit('perfect', 2),
      makeHit('miss', 3),
      makeHit('perfect', 4),
      makeHit('early', 5),
    ]
    expect(calculateCombo(hitResults, [])).toEqual({ current: 2, best: 2 })
  })

  it('is all zero for empty input', () => {
    expect(calculateCombo([], [])).toEqual({ current: 0, best: 0 })
  })

  it('keeps a perfect run of hits as both current and best', () => {
    const hitResults = [1, 2, 3, 4, 5].map((t) => makeHit('perfect', t))
    expect(calculateCombo(hitResults, [])).toEqual({ current: 5, best: 5 })
  })

  it('breaks the combo on an extra hit, not just a miss', () => {
    const hitResults = [makeHit('perfect', 1), makeHit('perfect', 2)]
    const extraHits = [makeExtraHit(3)]
    expect(calculateCombo(hitResults, extraHits)).toEqual({ current: 0, best: 2 })
  })

  it('does not break the combo on early or late alone', () => {
    const hitResults = [makeHit('perfect', 1), makeHit('early', 2), makeHit('late', 3), makeHit('perfect', 4)]
    expect(calculateCombo(hitResults, [])).toEqual({ current: 4, best: 4 })
  })
})

describe('calculateAverageTimingError', () => {
  it('averages the magnitude of timing error across non-miss hits', () => {
    const hitResults = [makeHit('early', 1, -20), makeHit('late', 2, 40), makeHit('perfect', 3, 0)]
    expect(calculateAverageTimingError(hitResults)).toBeCloseTo(20, 5)
  })

  it('returns undefined when every hit is a miss', () => {
    const hitResults = [makeHit('miss', 1), makeHit('miss', 2)]
    expect(calculateAverageTimingError(hitResults)).toBeUndefined()
  })
})
