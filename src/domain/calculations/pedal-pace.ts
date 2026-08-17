// PedalDisciplinePage's live pace readout — smoothed over the last few
// CLOSED hits only (an open/leak hit clears the caller's own window
// entirely, this function just averages whatever it's given). A raw
// two-hit interval swings wildly on a single early/late strike, at the
// cost of a small lag before this reflects a genuine tempo change.
// undefined until at least two timestamps are given (nothing to compute an
// interval from yet).
export function computePaceBpm(recentHitTimestampsMs: number[]): number | undefined {
  if (recentHitTimestampsMs.length < 2) return undefined
  let totalIntervalMs = 0
  for (let i = 1; i < recentHitTimestampsMs.length; i += 1) {
    totalIntervalMs += recentHitTimestampsMs[i]! - recentHitTimestampsMs[i - 1]!
  }
  const avgIntervalMs = totalIntervalMs / (recentHitTimestampsMs.length - 1)
  return avgIntervalMs > 0 ? Math.round(60000 / avgIntervalMs) : undefined
}
