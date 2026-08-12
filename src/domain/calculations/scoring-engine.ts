import type { DynamicsGrade, HitResult, ExtraHitEvent } from '../hit-result'

// VISUAL_DRUM_TRAINER_SPEC.md §2/§5 — the spec names Accuracy/Combo/Timing
// Error as feedback metrics but doesn't give exact formulas; these were
// confirmed with the user:
// - Accuracy = non-miss hits / (expected events + extra hits) * 100 — an
//   extra hit (wrong instrument/timing, no matching event) counts as a
//   mistake just like a miss does.
// - Combo = consecutive non-miss hits, broken by a miss OR an extra hit;
//   early/late do NOT break it, only perfect/early/late all continue it.

export interface ScoringSummary {
  accuracyPercent: number
  currentCombo: number
  bestCombo: number
  averageTimingErrorMs: number | undefined
}

export function calculateAccuracy(
  hitResults: HitResult[],
  extraHits: ExtraHitEvent[],
  totalExpectedEvents: number,
): number {
  const denominator = totalExpectedEvents + extraHits.length
  if (denominator === 0) return 0

  const nonMissCount = hitResults.filter((result) => result.grade !== 'miss').length
  return (nonMissCount / denominator) * 100
}

interface ComboEvent {
  timeMs: number
  breaksCombo: boolean
}

export function calculateCombo(
  hitResults: HitResult[],
  extraHits: ExtraHitEvent[],
): { current: number; best: number } {
  const events: ComboEvent[] = [
    ...hitResults.map((result) => ({ timeMs: result.expectedTimeMs, breaksCombo: result.grade === 'miss' })),
    ...extraHits.map((extraHit) => ({ timeMs: extraHit.hitTimeMs, breaksCombo: true })),
  ].sort((a, b) => a.timeMs - b.timeMs)

  let current = 0
  let best = 0
  for (const event of events) {
    if (event.breaksCombo) {
      current = 0
      continue
    }
    current += 1
    best = Math.max(best, current)
  }

  return { current, best }
}

// Average magnitude of timing error across non-miss hits — a signed
// average would mask a player who's consistently both early and late by
// similar amounts, so this reports "how far off on average" instead.
export function calculateAverageTimingError(hitResults: HitResult[]): number | undefined {
  const errors = hitResults
    .filter((result) => result.grade !== 'miss' && result.timingErrorMs !== undefined)
    .map((result) => Math.abs(result.timingErrorMs!))

  if (errors.length === 0) return undefined
  return errors.reduce((sum, value) => sum + value, 0) / errors.length
}

export function summarizeScoring(
  hitResults: HitResult[],
  extraHits: ExtraHitEvent[],
  totalExpectedEvents: number,
): ScoringSummary {
  const combo = calculateCombo(hitResults, extraHits)
  return {
    accuracyPercent: calculateAccuracy(hitResults, extraHits, totalExpectedEvents),
    currentCombo: combo.current,
    bestCombo: combo.best,
    averageTimingErrorMs: calculateAverageTimingError(hitResults),
  }
}

export interface DynamicsDataPoint {
  hitId: string
  actualVelocity: number
  dynamicsGrade: DynamicsGrade | undefined
}

export interface DynamicsSummary {
  points: DynamicsDataPoint[]
}

// Every hit that carried real MIDI velocity data, in the order they were
// recorded — the post-session velocity-consistency graph's data source.
// dynamicsGrade is only populated for the subset that were accented notes
// (see hit-matcher.ts's gradeDynamics); a plain (non-accented) hit still
// contributes its velocity point, just uncolored by correctness.
export function summarizeDynamics(hitResults: HitResult[]): DynamicsSummary {
  const points = hitResults
    .filter((result) => result.actualVelocity !== undefined)
    .map((result) => ({
      hitId: result.id,
      actualVelocity: result.actualVelocity!,
      dynamicsGrade: result.dynamicsGrade,
    }))
  return { points }
}
