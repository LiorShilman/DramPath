import type { DrumInstrument, InteractiveExerciseDifficulty } from '../interactive-exercise'
import type { DynamicsGrade, HitGrade } from '../hit-result'

// VISUAL_DRUM_TRAINER_SPEC.md §11 — grading windows by difficulty.
export interface GradingThresholds {
  perfectMs: number
  hitMs: number
}

export const GRADING_THRESHOLDS: Record<InteractiveExerciseDifficulty, GradingThresholds> = {
  // perfectMs widened repeatedly (90/60/35 -> 105/70/40 -> 110/75/45) on
  // direct user feedback that real e-kit hits landing well within a beat
  // still graded early/late more often than felt right — hitMs (the miss
  // boundary) is untouched throughout, so this only grows the "perfect"
  // slice of an already-registered hit. beginner's own final push to 180
  // (a deliberate, explicit choice, not a mechanical continuation of the
  // same small step) leaves only a 15ms early/late sliver against its
  // 195 hitMs — intentional: this stage is about building coordination
  // itself, not timing precision, so grading collapses to near-binary
  // hit/miss on purpose.
  beginner: { perfectMs: 180, hitMs: 195 },
  intermediate: { perfectMs: 75, hitMs: 135 },
  advanced: { perfectMs: 45, hitMs: 90 },
}

export interface PendingDrumEvent {
  eventId: string
  instrument: DrumInstrument
  expectedTimeMs: number
  // The matched DrumNoteEvent's own authored velocity/accent, carried
  // through so a real (MIDI) hit can be graded on dynamics, not just
  // timing — see gradeDynamics below. accent is normalized to a plain
  // boolean here (DrumNoteEvent.accent is optional) so callers never have
  // to handle a third undefined state.
  velocity: number
  accent: boolean
}

export interface MatchedHit {
  eventId: string
  timingErrorMs: number
  velocity: number
  accent: boolean
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
  return {
    eventId: nearest.eventId,
    timingErrorMs: hitTimeMs - nearest.expectedTimeMs,
    velocity: nearest.velocity,
    accent: nearest.accent,
  }
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

// A drummer's own repeated strikes at the same intended dynamic vary by
// roughly ±10-15 (out of MIDI's 0-127 velocity range) from kit
// sensitivity/motor noise alone; a real accent typically adds 20-40+ over
// the surrounding baseline. 15 sits just above that noise floor (a
// same-dynamic re-hit essentially never accidentally clears it) while
// staying well below what a real accent produces, so a genuine accent
// isn't graded too-soft on a technicality. Not scaled per
// InteractiveExerciseDifficulty like GRADING_THRESHOLDS — striking force
// is a motor-control concept, not a rhythmic-complexity one.
export const ACCENT_VELOCITY_MARGIN = 15

// Only meaningful for a matched event with accent:true and a real
// actualVelocity (MIDI-only) — callers gate on both before calling this;
// it stays a pure two-number comparison, same shape as gradeTimingError.
export function gradeDynamics(eventVelocity: number, actualVelocity: number): DynamicsGrade {
  return actualVelocity >= eventVelocity + ACCENT_VELOCITY_MARGIN ? 'correct' : 'too-soft'
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
