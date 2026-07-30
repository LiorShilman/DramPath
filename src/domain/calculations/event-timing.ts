import type { Subdivision } from '../exercise'
import type { TimeSignature } from '../interactive-exercise'

// VISUAL_DRUM_TRAINER_SPEC.md §8 — musical time, never raw milliseconds
// alone: every event is stored as bar/beat/subdivisionIndex and converted
// to an absolute ms offset only for scheduling/matching.
//
// Duplicated intentionally from lib/metronome-math's NOTES_PER_BEAT — domain
// must never import from lib (confirmed one-way lib -> domain dependency).
export const SUBDIVISIONS_PER_BEAT: Record<Subdivision, number> = {
  quarter: 1,
  eighth: 2,
  sixteenth: 4,
}

export function calculateBeatDurationMs(bpm: number): number {
  return 60000 / bpm
}

export function calculateBarDurationMs(bpm: number, timeSignature: TimeSignature): number {
  return calculateBeatDurationMs(bpm) * timeSignature.numerator
}

export interface EventTimeInput {
  bar: number
  beat: number
  subdivisionIndex: number
}

export interface EventTimingContext {
  bpm: number
  timeSignature: TimeSignature
  subdivision: Subdivision
}

// bar/beat are 1-indexed (bar 1, beat 1 = exercise start, matching musician
// counting); subdivisionIndex is 0-indexed (spec's own example: eighth
// notes "0 = the beat number, 1 = &").
export function calculateEventTimeMs(event: EventTimeInput, context: EventTimingContext): number {
  const beatDurationMs = calculateBeatDurationMs(context.bpm)
  const barDurationMs = beatDurationMs * context.timeSignature.numerator
  const subdivisionDurationMs = beatDurationMs / SUBDIVISIONS_PER_BEAT[context.subdivision]

  return (
    (event.bar - 1) * barDurationMs +
    (event.beat - 1) * beatDurationMs +
    event.subdivisionIndex * subdivisionDurationMs
  )
}
