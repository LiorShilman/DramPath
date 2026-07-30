import { describe, expect, it } from 'vitest'
import { createId, nowIso } from '../shared'
import {
  calculateExerciseDurationMs,
  resolveEventScheduleMs,
  resolveMetronomeBeatScheduleMs,
} from './exercise-schedule'
import type { DrumNoteEvent, InteractiveExercise } from '../interactive-exercise'

function baseEvent(overrides: Partial<DrumNoteEvent> = {}): DrumNoteEvent {
  return {
    id: createId(),
    bar: 1,
    beat: 1,
    subdivisionIndex: 0,
    instrument: 'kick',
    velocity: 100,
    ...overrides,
  }
}

function baseExercise(overrides: Partial<InteractiveExercise> = {}): InteractiveExercise {
  const now = nowIso()
  return {
    id: createId(),
    title: 'תרגיל',
    difficulty: 'beginner',
    bpm: 120,
    minBpm: 60,
    maxBpm: 160,
    timeSignature: { numerator: 4, denominator: 4 },
    subdivision: 'quarter',
    bars: 2,
    loopCount: 1,
    displayMode: 'note_highway',
    events: [baseEvent()],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('calculateExerciseDurationMs', () => {
  it('is bars * barDurationMs for a single loop', () => {
    // 120bpm quarter-note beat = 500ms, 4/4 bar = 2000ms, 2 bars = 4000ms
    expect(calculateExerciseDurationMs(baseExercise({ bars: 2, loopCount: 1 }))).toBe(4000)
  })

  it('scales linearly with loopCount', () => {
    expect(calculateExerciseDurationMs(baseExercise({ bars: 2, loopCount: 2 }))).toBe(8000)
  })
})

describe('resolveEventScheduleMs', () => {
  it('produces one entry per loop, offset by exactly one loop duration', () => {
    const exercise = baseExercise({
      bars: 1,
      loopCount: 2,
      events: [baseEvent({ bar: 1, beat: 1, subdivisionIndex: 0 })],
    })
    const scheduled = resolveEventScheduleMs(exercise)
    expect(scheduled).toHaveLength(2)
    expect(scheduled[0]!.timeMs).toBe(0)
    // One loop = 1 bar * 2000ms (4/4 @ 120bpm) = 2000ms
    expect(scheduled[1]!.timeMs).toBe(2000)
  })
})

describe('resolveMetronomeBeatScheduleMs', () => {
  it('produces bars * numerator * loopCount beat times, evenly spaced', () => {
    const exercise = baseExercise({
      bars: 2,
      loopCount: 1,
      timeSignature: { numerator: 4, denominator: 4 },
    })
    const beats = resolveMetronomeBeatScheduleMs(exercise)
    expect(beats).toHaveLength(8)
    expect(beats).toEqual([0, 500, 1000, 1500, 2000, 2500, 3000, 3500])
  })

  it('produces fewer beats per bar for a 3/4 time signature', () => {
    const exercise = baseExercise({
      bars: 1,
      loopCount: 1,
      timeSignature: { numerator: 3, denominator: 4 },
    })
    const beats = resolveMetronomeBeatScheduleMs(exercise)
    expect(beats).toHaveLength(3)
    expect(beats).toEqual([0, 500, 1000])
  })
})
