import { describe, expect, it } from 'vitest'
import { convertHitTimeToExerciseElapsedMs } from './clock-sync-math'

describe('convertHitTimeToExerciseElapsedMs', () => {
  it('is 0 for a hit exactly at the exercise start (after count-in)', () => {
    // clockOffsetMs=100 -> audio clock ms = hitTimeMs - 100
    // exercise start (audio clock ms) = startAudioTimeSeconds*1000 + countInDurationMs = 1000 + 2000 = 3000
    // hitTimeMs must map to audioClockMs=3000 -> hitTimeMs = 3100
    expect(convertHitTimeToExerciseElapsedMs(3100, 100, 1, 2000)).toBe(0)
  })

  it('is positive for a hit after the exercise started', () => {
    expect(convertHitTimeToExerciseElapsedMs(3600, 100, 1, 2000)).toBe(500)
  })

  it('is negative for a hit still during count-in', () => {
    expect(convertHitTimeToExerciseElapsedMs(2600, 100, 1, 2000)).toBe(-500)
  })

  it('accounts for a nonzero clock offset correctly', () => {
    // Same scenario as the first test, but with a different (larger) offset.
    expect(convertHitTimeToExerciseElapsedMs(53000, 50000, 1, 2000)).toBe(0)
  })
})
