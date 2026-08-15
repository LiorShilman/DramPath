import { describe, expect, it } from 'vitest'
import { calculateAccuracy, calculateAverageTimingError, calculateCombo, summarizeDynamics } from './scoring-engine'
import type { DynamicsGrade, ExtraHitEvent, HitGrade, HitResult } from '../hit-result'

function makeHit(
  grade: HitGrade,
  expectedTimeMs: number,
  timingErrorMs?: number,
  dynamics?: { actualVelocity: number; dynamicsGrade?: DynamicsGrade },
): HitResult {
  return {
    id: `hit-${expectedTimeMs}`,
    expectedEventId: `event-${expectedTimeMs}`,
    instrument: 'kick',
    expectedTimeMs,
    grade,
    timingErrorMs,
    actualVelocity: dynamics?.actualVelocity,
    dynamicsGrade: dynamics?.dynamicsGrade,
  }
}

function makeExtraHit(hitTimeMs: number): ExtraHitEvent {
  return { id: `extra-${hitTimeMs}`, instrument: 'kick', hitTimeMs }
}

describe('calculateAccuracy', () => {
  it('divides non-miss hits by how many events have resolved (hit or missed) so far', () => {
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
    expect(calculateAccuracy(hitResults, [])).toBe(70)
  })

  it('counts extra hits as mistakes that widen the denominator', () => {
    const hitResults = [makeHit('perfect', 1), makeHit('perfect', 2)]
    const extraHits = [makeExtraHit(3)]
    // 2 non-miss hits out of (2 resolved + 1 extra) = 66.67%
    expect(calculateAccuracy(hitResults, extraHits)).toBeCloseTo(66.67, 1)
  })

  it('returns 100 (nothing to judge yet), not 0 or NaN, when nothing has resolved', () => {
    // Explicit user feedback: a live indicator denominated by the whole
    // piece necessarily starts at 0% and climbs toward the final score as
    // more of the piece is simply reached — reads as "doing badly" before
    // anything has actually happened. 100 ("nothing wrong yet") avoids that.
    expect(calculateAccuracy([], [])).toBe(100)
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

describe('summarizeDynamics', () => {
  it('excludes hits with no actualVelocity (keyboard/phone input)', () => {
    const hitResults = [makeHit('perfect', 1), makeHit('perfect', 2, undefined, { actualVelocity: 100 })]
    expect(summarizeDynamics(hitResults).points).toHaveLength(1)
  })

  it('includes a non-accented MIDI hit with dynamicsGrade undefined', () => {
    const hitResults = [makeHit('perfect', 1, undefined, { actualVelocity: 90 })]
    expect(summarizeDynamics(hitResults).points).toEqual([{ hitId: 'hit-1', actualVelocity: 90, dynamicsGrade: undefined }])
  })

  it('includes an accented MIDI hit with its dynamicsGrade', () => {
    const hitResults = [makeHit('perfect', 1, undefined, { actualVelocity: 120, dynamicsGrade: 'correct' })]
    expect(summarizeDynamics(hitResults).points).toEqual([{ hitId: 'hit-1', actualVelocity: 120, dynamicsGrade: 'correct' }])
  })

  it('returns an empty points array for empty input', () => {
    expect(summarizeDynamics([])).toEqual({ points: [] })
  })
})
