import { useMemo, useRef } from 'react'
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
  const exercise = useMemo(() => (exerciseId ? findDemoExercise(exerciseId) : undefined), [exerciseId])
  const highwayRef = useRef<NoteHighwayHandle>(null)

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
