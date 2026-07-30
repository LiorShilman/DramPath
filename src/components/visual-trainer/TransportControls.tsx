import { Button } from '../ui'
import type { InteractiveExercise } from '../../domain'
import type { VisualTrainerPhase } from '../../hooks/useVisualTrainer'

export interface TransportControlsProps {
  exercise: Pick<InteractiveExercise, 'title' | 'bpm' | 'timeSignature' | 'bars'>
  phase: VisualTrainerPhase
  currentBar: number
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onRestart: () => void
  onExit: () => void
}

/** VISUAL_DRUM_TRAINER_SPEC.md §5's top area — exercise name, BPM, time
 * signature, bar number, and Start/Pause/Restart/Exit. */
export function TransportControls({
  exercise,
  phase,
  currentBar,
  onStart,
  onPause,
  onResume,
  onRestart,
  onExit,
}: TransportControlsProps) {
  const isActive = phase === 'count-in' || phase === 'running'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 [box-shadow:var(--shadow-card)]">
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold">{exercise.title}</span>
        <span className="text-sm text-[var(--color-text-muted)]">
          {exercise.bpm} BPM · {exercise.timeSignature.numerator}/{exercise.timeSignature.denominator} · תיבה{' '}
          {Math.min(currentBar, exercise.bars)} מתוך {exercise.bars}
        </span>
      </div>

      <div className="flex gap-2">
        {phase === 'idle' && <Button onClick={onStart}>התחל</Button>}
        {isActive && (
          <Button variant="secondary" onClick={onPause}>
            השהה
          </Button>
        )}
        {phase === 'paused' && <Button onClick={onResume}>המשך</Button>}
        {phase !== 'idle' && (
          <Button variant="ghost" onClick={onRestart}>
            התחל מחדש
          </Button>
        )}
        <Button variant="danger-outline" onClick={onExit}>
          יציאה
        </Button>
      </div>
    </div>
  )
}
