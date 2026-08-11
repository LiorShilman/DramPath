import { useState } from 'react'
import { Button } from '../ui'
import { calculateBarDurationMs } from '../../domain/calculations/event-timing'
import type { InteractiveExercise } from '../../domain'
import type { VisualTrainerPhase } from '../../hooks/useVisualTrainer'

export interface TransportControlsProps {
  exercise: Pick<InteractiveExercise, 'title' | 'bpm' | 'timeSignature' | 'bars' | 'loopCount'>
  phase: VisualTrainerPhase
  isDemo: boolean
  currentBar: number
  currentBeat: number
  /** ms elapsed since the exercise itself started (count-in excluded) —
   * shown as a running mm:ss / mm:ss total, not just bar/beat, since a real
   * imported song is long enough that "תיבה 47 מתוך 119" alone doesn't say
   * much about how far along you actually are. */
  elapsedMs: number
  /** Jumps the current run (demo or real) to an arbitrary point — real-run
   * scoring only counts notes from the seek point onward (accuracy/combo
   * reset there too), same tradeoff seeking already made for demo; explicit
   * user request to allow it for real practice too, not just demo. */
  onSeek?: (offsetMs: number) => void
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onRestart: () => void
  onExit: () => void
  /** Mutes only the click track, not the exercise's own drum sounds —
   * explicit user request, no way to silence the metronome during
   * practice. */
  isMetronomeMuted: boolean
  onToggleMetronomeMute: () => void
}

function formatDuration(totalMs: number): string {
  const totalSeconds = Math.floor(Math.max(0, totalMs) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** VISUAL_DRUM_TRAINER_SPEC.md §5's top area — exercise name, BPM, time
 * signature, bar number, and Start/Pause/Restart/Exit. */
export function TransportControls({
  exercise,
  phase,
  isDemo,
  currentBar,
  currentBeat,
  elapsedMs,
  onSeek,
  onStart,
  onPause,
  onResume,
  onRestart,
  onExit,
  isMetronomeMuted,
  onToggleMetronomeMute,
}: TransportControlsProps) {
  const isActive = phase === 'count-in' || phase === 'running'
  // Same formula as exercise-schedule.ts's calculateExerciseDurationMs, but
  // that helper takes a full InteractiveExercise — this component only
  // receives the Pick'd subset it actually needs, so the (one-line) math is
  // duplicated here rather than widening the prop type just for this.
  const totalMs = calculateBarDurationMs(exercise.bpm, exercise.timeSignature) * exercise.bars * exercise.loopCount
  // Local preview value while actively dragging the seek bar — the real
  // onSeekDemo (a full playback restart at the new offset) only fires on
  // release, not on every pixel of drag (a range input's onChange fires
  // continuously, and re-seeking that often would restart the audio engine
  // dozens of times a second and glitch badly).
  const [dragValueMs, setDragValueMs] = useState<number | null>(null)

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-2 [box-shadow:var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">
            {exercise.title}
            {isDemo && isActive && (
              <span className="ms-2 rounded-[var(--radius-card)] bg-[var(--color-primary)]/15 px-2 py-0.5 text-xs font-normal text-[var(--color-primary)]">
                מדגים
              </span>
            )}
          </span>
          <span className="text-sm text-[var(--color-text-muted)]">
            {exercise.bpm} BPM · {exercise.timeSignature.numerator}/{exercise.timeSignature.denominator} · תיבה{' '}
            {Math.min(currentBar, exercise.bars)} מתוך {exercise.bars} ·{' '}
            <span dir="ltr" className="inline-block">
              {formatDuration(elapsedMs)} / {formatDuration(totalMs)}
            </span>
          </span>
          <div className="flex gap-1.5" aria-label="פעימות המטרונום" role="img">
            {Array.from({ length: exercise.timeSignature.numerator }, (_, index) => {
              const beatNumber = index + 1
              const isCurrentBeat = isActive && beatNumber === currentBeat
              return (
                <span
                  key={beatNumber}
                  className={`h-2.5 w-2.5 rounded-full transition-colors duration-75 ${
                    isCurrentBeat
                      ? beatNumber === 1
                        ? 'bg-[var(--color-primary)]'
                        : 'bg-[var(--color-text)]'
                      : 'bg-[var(--color-border)]'
                  }`}
                />
              )
            })}
          </div>
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
          <Button
            variant="ghost"
            onClick={onToggleMetronomeMute}
            aria-label={isMetronomeMuted ? 'הפעל מטרונום' : 'השתק מטרונום'}
            title={isMetronomeMuted ? 'הפעל מטרונום' : 'השתק מטרונום'}
          >
            {isMetronomeMuted ? '🔇' : '🔊'}
          </Button>
          <Button variant="danger-outline" onClick={onExit}>
            יציאה
          </Button>
        </div>
      </div>

      {/* dir="ltr" so dragging left-to-right always means "forward,"
          matching the elapsed/total time display above regardless of the
          page's own RTL. Available for a real run too, not just demo (see
          onSeek's own doc comment on the scoring tradeoff that implies). */}
      {phase !== 'idle' && onSeek && (
        <input
          type="range"
          aria-label="דילוג"
          dir="ltr"
          min={0}
          max={Math.max(1, totalMs)}
          value={dragValueMs ?? Math.min(elapsedMs, totalMs)}
          onChange={(event) => setDragValueMs(Number(event.target.value))}
          onMouseUp={(event) => {
            onSeek(Number(event.currentTarget.value))
            setDragValueMs(null)
          }}
          onTouchEnd={(event) => {
            onSeek(Number(event.currentTarget.value))
            setDragValueMs(null)
          }}
          onKeyUp={(event) => {
            onSeek(Number(event.currentTarget.value))
            setDragValueMs(null)
          }}
          className="w-full accent-[var(--color-primary)]"
        />
      )}
    </div>
  )
}
