export interface LiveAccuracyMeterProps {
  /** 0-100 — already computed live by the caller (useVisualTrainer's own
   * scoring.accuracyPercent on the desktop, or the phone's mirrored
   * NotationStatePayload.liveAccuracyPercent). This component is purely
   * presentational, no polling/clock of its own. */
  accuracyPercent: number
}

// Explicit user request: see accuracy visually *during* a run, not just at
// the end (SessionResults already covers the end) — a combination of a
// number (precise) and a bar (immediate at a glance), matching the same
// tier colors used elsewhere for grading (success/warning/danger).
function tierColor(percent: number): string {
  if (percent >= 90) return 'var(--color-success-text)'
  if (percent >= 70) return 'var(--color-warning-text)'
  return 'var(--color-danger-text)'
}

export function LiveAccuracyMeter({ accuracyPercent }: LiveAccuracyMeterProps) {
  const clamped = Math.max(0, Math.min(100, accuracyPercent))
  const color = tierColor(clamped)
  return (
    <div className="flex items-center gap-2" aria-label={`דיוק חי: ${Math.round(clamped)} אחוז`}>
      <div className="h-2 w-16 overflow-hidden rounded-full bg-[var(--color-border)]" aria-hidden="true">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${clamped}%`, backgroundColor: color }} />
      </div>
      <span className="text-sm font-semibold tabular-nums" style={{ color }}>
        {Math.round(clamped)}%
      </span>
    </div>
  )
}
