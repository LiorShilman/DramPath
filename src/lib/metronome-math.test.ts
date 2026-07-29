import { describe, expect, it } from 'vitest'
import { subdivisionIntervalSeconds, clampBpm, calculateTapTempoBpm } from './metronome-math'

describe('subdivisionIntervalSeconds', () => {
  it('computes the quarter-note interval directly from bpm', () => {
    expect(subdivisionIntervalSeconds(60, 'quarter')).toBeCloseTo(1)
    expect(subdivisionIntervalSeconds(120, 'quarter')).toBeCloseTo(0.5)
  })

  it('halves the interval for eighths and quarters it for sixteenths', () => {
    expect(subdivisionIntervalSeconds(60, 'eighth')).toBeCloseTo(0.5)
    expect(subdivisionIntervalSeconds(60, 'sixteenth')).toBeCloseTo(0.25)
  })
})

describe('clampBpm', () => {
  it('clamps to the default 30-240 range', () => {
    expect(clampBpm(10)).toBe(30)
    expect(clampBpm(300)).toBe(240)
    expect(clampBpm(100)).toBe(100)
  })

  it('rounds fractional values', () => {
    expect(clampBpm(100.6)).toBe(101)
  })

  it('respects custom bounds', () => {
    expect(clampBpm(200, 40, 160)).toBe(160)
  })
})

describe('calculateTapTempoBpm', () => {
  it('averages the intervals between the last taps into a bpm', () => {
    // Four taps, 500ms apart -> 120 BPM.
    const result = calculateTapTempoBpm([0, 500, 1000, 1500])
    expect(result).toBe(120)
  })

  it('uses only the last 5 taps', () => {
    const ancientOutlier = [0, 5000] // would badly skew the average if included
    const steadyTaps = [10000, 10500, 11000, 11500, 12000]
    const result = calculateTapTempoBpm([...ancientOutlier, ...steadyTaps])
    expect(result).toBe(120)
  })

  it('returns undefined with fewer than two taps', () => {
    expect(calculateTapTempoBpm([])).toBeUndefined()
    expect(calculateTapTempoBpm([1000])).toBeUndefined()
  })

  it('ignores an unreasonably long gap between taps', () => {
    const result = calculateTapTempoBpm([0, 500, 1000, 10000])
    // The 9000ms gap is dropped; remaining 500ms intervals -> 120 BPM.
    expect(result).toBe(120)
  })
})
