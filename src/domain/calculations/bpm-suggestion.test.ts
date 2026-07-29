import { describe, expect, it } from 'vitest'
import { suggestBpmChange } from './bpm-suggestion'

const base = { currentBpm: 100, minBpm: 40, maxBpm: 160, bpmStep: 5 }

describe('suggestBpmChange', () => {
  it('suggests +bpmStep after 3 clean reps', () => {
    const result = suggestBpmChange({ ...base, cleanStreak: 3, needsWorkStreak: 0 })
    expect(result).toEqual({ direction: 'up', suggestedBpm: 105 })
  })

  it('suggests -bpmStep after 2 needs-work marks', () => {
    const result = suggestBpmChange({ ...base, cleanStreak: 0, needsWorkStreak: 2 })
    expect(result).toEqual({ direction: 'down', suggestedBpm: 95 })
  })

  it('does not suggest anything below the thresholds', () => {
    const result = suggestBpmChange({ ...base, cleanStreak: 2, needsWorkStreak: 1 })
    expect(result.direction).toBe('none')
  })

  it('clamps the upward suggestion to maxBpm', () => {
    const result = suggestBpmChange({
      ...base,
      currentBpm: 158,
      cleanStreak: 3,
      needsWorkStreak: 0,
    })
    expect(result).toEqual({ direction: 'up', suggestedBpm: 160 })
  })

  it('does not suggest up when already at maxBpm', () => {
    const result = suggestBpmChange({
      ...base,
      currentBpm: 160,
      cleanStreak: 3,
      needsWorkStreak: 0,
    })
    expect(result.direction).toBe('none')
  })

  it('clamps the downward suggestion to minBpm', () => {
    const result = suggestBpmChange({
      ...base,
      currentBpm: 42,
      cleanStreak: 0,
      needsWorkStreak: 2,
    })
    expect(result).toEqual({ direction: 'down', suggestedBpm: 40 })
  })
})
