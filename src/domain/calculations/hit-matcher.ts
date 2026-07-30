import type { DrumInstrument, InteractiveExerciseDifficulty } from '../interactive-exercise'
import type { HitGrade } from '../hit-result'

// VISUAL_DRUM_TRAINER_SPEC.md §11 — grading windows by difficulty.
export interface GradingThresholds {
  perfectMs: number
  hitMs: number
}

export const GRADING_THRESHOLDS: Record<InteractiveExerciseDifficulty, GradingThresholds> = {
  beginner: { perfectMs: 60, hitMs: 130 },
  intermediate: { perfectMs: 40, hitMs: 90 },
  advanced: { perfectMs: 25, hitMs: 60 },
}

export interface PendingDrumEvent {
  eventId: string
  instrument: DrumInstrument
  expectedTimeMs: number
}

export interface MatchedHit {
  eventId: string
  timingErrorMs: number
}

// §11 steps 1-4: among still-unanswered events for the pressed instrument,
// pick the one nearest in time to the keypress; if it's within the hit
// window, it's a match. Two equidistant candidates resolve to the earlier
// one (not specified by the spec, chosen as the tie-break).
export function findMatchingEvent(
  pending: PendingDrumEvent[],
  instrument: DrumInstrument,
  hitTimeMs: number,
  thresholds: GradingThresholds,
): MatchedHit | undefined {
  let nearest: PendingDrumEvent | undefined
  let nearestAbsError = Infinity

  for (const candidate of pending) {
    if (candidate.instrument !== instrument) continue
    const absError = Math.abs(hitTimeMs - candidate.expectedTimeMs)
    const isCloser = absError < nearestAbsError
    const isEarlierTie =
      absError === nearestAbsError && nearest !== undefined && candidate.expectedTimeMs < nearest.expectedTimeMs
    if (isCloser || isEarlierTie) {
      nearest = candidate
      nearestAbsError = absError
    }
  }

  if (!nearest || nearestAbsError > thresholds.hitMs) return undefined
  return { eventId: nearest.eventId, timingErrorMs: hitTimeMs - nearest.expectedTimeMs }
}

// Grades a hit already known to be a match (within the hit window) — never
// returns 'miss', since a matched hit is by definition not one.
export function gradeTimingError(
  timingErrorMs: number,
  thresholds: GradingThresholds,
): Exclude<HitGrade, 'miss'> {
  if (Math.abs(timingErrorMs) <= thresholds.perfectMs) return 'perfect'
  return timingErrorMs < 0 ? 'early' : 'late'
}

// §11 step 6: pending events whose hit window has fully elapsed with no
// matching keypress.
export function detectMissedEvents(
  pending: PendingDrumEvent[],
  currentTimeMs: number,
  thresholds: GradingThresholds,
): PendingDrumEvent[] {
  return pending.filter((event) => currentTimeMs - event.expectedTimeMs > thresholds.hitMs)
}
