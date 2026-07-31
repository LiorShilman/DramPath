import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useNavigate, useParams } from 'react-router'
import { PageHeader } from '../../components/ui'
import { DrumKit } from '../../components/visual-trainer/DrumKit'
import { NoteHighway } from '../../components/visual-trainer/NoteHighway'
import type { NoteHighwayHandle } from '../../components/visual-trainer/NoteHighway'
import { TransportControls } from '../../components/visual-trainer/TransportControls'
import { HitFeedback } from '../../components/visual-trainer/HitFeedback'
import { KeyboardGuide } from '../../components/visual-trainer/KeyboardGuide'
import { SessionResults } from '../../components/visual-trainer/SessionResults'
import { useVisualTrainer } from '../../hooks/useVisualTrainer'
import { findDemoExercise } from './demo-exercises'
import { interactiveExerciseRepository } from '../../data/repositories'
import type { InteractiveExercise } from '../../domain'

interface VisualTrainerRunnerProps {
  exercise: InteractiveExercise
  highwayRef: RefObject<NoteHighwayHandle | null>
}

// Split from VisualTrainerPage so useVisualTrainer (which needs a real
// InteractiveExercise, not an optional one) is only ever called once we
// know the exercise actually exists — same "look up, then delegate to an
// inner component" pattern used for a possibly-missing entity elsewhere in
// this codebase (e.g. LessonDetailPage's not-found handling).
function VisualTrainerRunner({ exercise, highwayRef }: VisualTrainerRunnerProps) {
  const navigate = useNavigate()
  const trainer = useVisualTrainer(exercise, highwayRef)

  function handleExit() {
    trainer.exit()
    void navigate('/practice/visual')
  }

  return (
    <div className="flex flex-col gap-2 pb-16">
      <PageHeader title={exercise.title} backTo="/practice/visual" backLabel="← חזרה לרשימת התרגילים" />

      <TransportControls
        exercise={exercise}
        phase={trainer.phase}
        currentBar={trainer.currentBar}
        onStart={trainer.start}
        onPause={trainer.pause}
        onResume={trainer.resume}
        onRestart={trainer.restart}
        onExit={handleExit}
      />

      <HitFeedback lastGrade={trainer.lastGrade} scoring={trainer.scoring} />

      <NoteHighway ref={highwayRef} events={exercise.events} exercise={exercise} />

      <div className="mx-auto w-full max-w-lg">
        <DrumKit activeHit={trainer.activeHit} />
      </div>

      <KeyboardGuide />

      {trainer.phase === 'finished' && (
        <SessionResults
          exerciseTitle={exercise.title}
          scoring={trainer.scoring}
          gradeCounts={trainer.gradeCounts}
          onRestart={trainer.restart}
          onExit={handleExit}
        />
      )}
    </div>
  )
}

export function VisualTrainerPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  // Demo exercises resolve instantly (in-memory, pure) — a plain derived
  // value, no effect needed. Only exercises this misses fall through to the
  // (async) repository lookup below, so the built-in catalog keeps its
  // current zero-latency load.
  const demoExercise = useMemo(() => (exerciseId ? findDemoExercise(exerciseId) : undefined), [exerciseId])
  // undefined = "not resolved yet", 'not-found' = "resolved, doesn't exist"
  // — a real 3-state result instead of a separate loading boolean, so the
  // only setState call in the effect below is inside the async callback
  // (no synchronous setState in the effect body itself).
  const [persistedResult, setPersistedResult] = useState<InteractiveExercise | 'not-found' | undefined>(undefined)
  const highwayRef = useRef<NoteHighwayHandle>(null)

  useEffect(() => {
    if (!exerciseId || demoExercise) return

    let cancelled = false
    void interactiveExerciseRepository.getById(exerciseId).then((found) => {
      if (!cancelled) setPersistedResult(found ?? 'not-found')
    })
    return () => {
      cancelled = true
    }
  }, [exerciseId, demoExercise])

  const exercise = demoExercise ?? (persistedResult === 'not-found' ? undefined : persistedResult)
  const isLoading = Boolean(exerciseId) && !demoExercise && persistedResult === undefined

  if (isLoading) {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  if (!exercise) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="תרגיל לא נמצא" backTo="/practice/visual" backLabel="← חזרה לרשימת התרגילים" />
        <p className="text-[var(--color-text-muted)]">התרגיל המבוקש לא קיים.</p>
      </div>
    )
  }

  return <VisualTrainerRunner exercise={exercise} highwayRef={highwayRef} />
}
