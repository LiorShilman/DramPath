import { useState } from 'react'

export interface HiHatHitFeedback {
  kind: 'closed' | 'open'
  token: string
}

export interface HiHatVisualProps {
  isRunning: boolean
  feedback: HiHatHitFeedback | null
  /** Live pace (BPM), smoothed over the last few closed hits — drives the
   * pulse ring's own animation-duration, so the ring visibly speeds up/
   * slows down with real tempo, not just how often it fires. Omitted (or
   * undefined) falls back to a fixed default duration. */
  paceBpm?: number
}

const DEFAULT_PULSE_DURATION_MS = 450

// The animated hi-hat itself — two bars whose gap smoothly transitions
// based on the last real hit, plus a glow/shake burst on every hit and a
// pace pulse ring on every closed hit. Shared between PedalDisciplinePage
// (desktop) and its own phone mirror in TouchDrumKitPage, so both draw the
// exact same visual.
export function HiHatVisual({ isRunning, feedback, paceBpm }: HiHatVisualProps) {
  const gapPx = !isRunning || !feedback ? 18 : feedback.kind === 'closed' ? 6 : 34

  // Alternates which of two identical (but distinctly-named) keyframe
  // animations plays on each closed hit — "adjust state during render",
  // React's own documented pattern for deriving state from a prop change,
  // not an effect. Lets the SAME permanent ring node re-trigger its pulse
  // on every hit (even two closed hits in a row) without ever being
  // unmounted/remounted or key-remounted — direct user report that a
  // key-remounted element on this same screen (the streak number) caused a
  // brief layout jump; a permanent node with only its class/style changing
  // can't do that.
  const [pulseParity, setPulseParity] = useState<0 | 1>(0)
  const [lastPulseToken, setLastPulseToken] = useState<string | undefined>(undefined)
  if (feedback?.kind === 'closed' && feedback.token !== lastPulseToken) {
    setLastPulseToken(feedback.token)
    setPulseParity((previous) => (previous === 0 ? 1 : 0))
  }

  const pulseClassName =
    feedback?.kind === 'closed' ? (pulseParity === 0 ? 'pedal-pace-ring-a' : 'pedal-pace-ring-b') : 'pedal-pace-ring-idle'
  const pulseDurationMs = paceBpm ? 60000 / paceBpm : DEFAULT_PULSE_DURATION_MS

  return (
    <div className="relative flex h-48 w-72 items-end justify-center">
      {/* Live-pace pulse ring — see its own classes' doc comment in
          index.css for why this is a permanent node, never conditionally
          mounted/removed. Centered independent of the stand/cymbals below,
          so it doesn't shift if the gap animation moves the top cymbal. */}
      <div
        className={`pointer-events-none absolute bottom-16 left-1/2 h-24 w-24 -translate-x-1/2 rounded-full border-2 border-[var(--color-success-text)] ${pulseClassName}`}
        style={{ animationDuration: `${pulseDurationMs}ms` }}
      />
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
