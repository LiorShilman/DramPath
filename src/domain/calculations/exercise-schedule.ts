import type { DrumNoteEvent, InteractiveExercise } from '../interactive-exercise'
import { calculateBarDurationMs, calculateEventTimeMs } from './event-timing'

// VISUAL_DRUM_TRAINER_SPEC.md §9 — "what plays when," expressed as plain
// data (ms offsets from exercise start) so the Web Audio orchestration
// layer (src/lib/visual-trainer/) only has to schedule against real time,
// never re-derive musical timing itself. Kept pure/framework-free and
// fully unit-testable, same split as event-timing.ts.

function calculateSingleLoopDurationMs(exercise: InteractiveExercise): number {
  return exercise.bars * calculateBarDurationMs(exercise.bpm, exercise.timeSignature)
}

export function calculateExerciseDurationMs(exercise: InteractiveExercise): number {
  return calculateSingleLoopDurationMs(exercise) * exercise.loopCount
}

export interface ScheduledEvent {
  event: DrumNoteEvent
  timeMs: number
}

// Every event's absolute ms offset from exercise start, expanded across
// all loopCount repeats.
export function resolveEventScheduleMs(exercise: InteractiveExercise): ScheduledEvent[] {
  const loopDurationMs = calculateSingleLoopDurationMs(exercise)
  const scheduled: ScheduledEvent[] = []

  for (let loopIndex = 0; loopIndex < exercise.loopCount; loopIndex += 1) {
    const loopOffsetMs = loopIndex * loopDurationMs
    for (const event of exercise.events) {
      scheduled.push({ event, timeMs: calculateEventTimeMs(event, exercise) + loopOffsetMs })
    }
  }

  return scheduled.sort((a, b) => a.timeMs - b.timeMs)
}

// Every beat's ms offset (for the metronome click track), loop-aware the
// same way.
export function resolveMetronomeBeatScheduleMs(exercise: InteractiveExercise): number[] {
  const loopDurationMs = calculateSingleLoopDurationMs(exercise)
  const beatTimesMs: number[] = []

  for (let loopIndex = 0; loopIndex < exercise.loopCount; loopIndex += 1) {
    const loopOffsetMs = loopIndex * loopDurationMs
    for (let bar = 1; bar <= exercise.bars; bar += 1) {
      for (let beat = 1; beat <= exercise.timeSignature.numerator; beat += 1) {
        beatTimesMs.push(calculateEventTimeMs({ bar, beat, subdivisionIndex: 0 }, exercise) + loopOffsetMs)
      }
    }
  }

  return beatTimesMs
}
