import { describe, expect, it } from 'vitest'
import { computePaceBpm } from './pedal-pace'

describe('computePaceBpm', () => {
  it('returns undefined with fewer than two timestamps', () => {
    expect(computePaceBpm([])).toBeUndefined()
    expect(computePaceBpm([1000])).toBeUndefined()
  })

  it('computes BPM from a single interval', () => {
    // 500ms apart = 120 BPM (60000 / 500).
    expect(computePaceBpm([0, 500])).toBe(120)
  })

  it('averages multiple intervals rather than just using the last one', () => {
    // Intervals of 500, 500, 1000 -> average 666.67ms -> ~90 BPM.
    expect(computePaceBpm([0, 500, 1000, 2000])).toBe(90)
  })

  it('is not thrown off by a single early/late hit as much as a raw last-interval reading would be', () => {
    // Five steady 500ms intervals (120 BPM) plus one slow 2000ms outlier —
    // the average absorbs it instead of the whole reading collapsing to
    // whatever the single worst interval alone would imply.
    const steady = [0, 500, 1000, 1500, 2000, 4000]
    const bpm = computePaceBpm(steady)!
    expect(bpm).toBeGreaterThan(60)
    expect(bpm).toBeLessThan(120)
  })
})
