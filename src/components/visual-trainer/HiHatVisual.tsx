export interface HiHatHitFeedback {
  kind: 'closed' | 'open'
  token: string
}

export interface HiHatVisualProps {
  isRunning: boolean
  feedback: HiHatHitFeedback | null
}

// The animated hi-hat itself — two bars whose gap smoothly transitions
// based on the last real hit, plus a glow/shake burst on every hit (keyed
// by feedback.token so two consecutive same-result hits both visibly pulse,
// not just a class toggle that no-ops on an unchanged state). Shared
// between PedalDisciplinePage (desktop) and its own phone mirror in
// TouchDrumKitPage, so both draw the exact same visual.
export function HiHatVisual({ isRunning, feedback }: HiHatVisualProps) {
  const gapPx = !isRunning || !feedback ? 18 : feedback.kind === 'closed' ? 6 : 34

  return (
    <div className="relative flex h-48 w-72 items-end justify-center">
      {/* Live-pace pulse ring — fires only on a closed hit (never on an
          open/leak one), so how OFTEN it pulses is itself a visual read of
          the player's current pace, alongside the numeric BPM readout next
          to the streak. Centered independent of the stand/cymbals below, so
          it doesn't shift if the gap animation moves the top cymbal. */}
      {feedback?.kind === 'closed' && (
        <div
          key={feedback.token}
          className="pedal-pace-ring pointer-events-none absolute bottom-16 left-1/2 h-24 w-24 -translate-x-1/2 rounded-full border-2 border-[var(--color-success-text)]"
        />
      )}
      <div
        key={feedback?.token ?? 'idle'}
        className={`pedal-hihat-glow absolute inset-0 ${feedback ? feedback.kind : ''}`}
      >
        {/* stand */}
        <div className="absolute bottom-0 left-1/2 h-40 w-2 -translate-x-1/2 rounded-full bg-[var(--color-border)]" />
        {/* bottom cymbal — fixed */}
        <div className="absolute bottom-16 left-1/2 h-5 w-64 -translate-x-1/2 rounded-[50%] bg-gradient-to-b from-amber-400 to-amber-700 shadow-lg" />
        {/* top cymbal — moves with gapPx */}
        <div
          className="absolute left-1/2 h-5 w-60 -translate-x-1/2 rounded-[50%] bg-gradient-to-b from-amber-300 to-amber-600 shadow-lg transition-[bottom] duration-150 ease-out"
          style={{ bottom: `${64 + gapPx}px` }}
        />
      </div>
    </div>
  )
}
