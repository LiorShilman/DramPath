import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Button, PageHeader } from '../../components/ui'
import { VisualTrainerRunner } from './VisualTrainerPage'
import { resolveExercise } from './resolve-exercise'
import { practiceRoutineRepository } from '../../data/repositories'
import type { InteractiveExercise, PracticeRoutine } from '../../domain'
import type { NoteHighwayHandle } from '../../components/visual-trainer/NoteHighway'

const ROUTINES_LIST_PATH = '/practice/visual/routines'

/** Runs a practice routine (setlist) end to end — resolves every step's
 * exercise up front (not lazily per step, which would reintroduce the same
 * async-resolution race VisualTrainerPage's own key={exercise.id} was built
 * to close, just inside this page instead), then renders ONE
 * VisualTrainerRunner across the whole routine with NO key, so the same
 * AudioContext/engine stays alive for every step (see VisualTrainerRunner's
 * own auto-start-effect comment for why a fresh AudioContext per step is a
 * real autoplay-policy risk, not just a style preference). */
export function RoutinePlayerPage() {
  const { routineId } = useParams<{ routineId: string }>()
  const navigate = useNavigate()
  const highwayRef = useRef<NoteHighwayHandle>(null)
  const [routine, setRoutine] = useState<PracticeRoutine | 'not-found' | undefined>(undefined)
  const [steps, setSteps] = useState<(InteractiveExercise | 'not-found')[] | undefined>(undefined)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  useEffect(() => {
    if (!routineId) return
    let cancelled = false
    void practiceRoutineRepository.getById(routineId).then((found) => {
      if (!cancelled) setRoutine(found ?? 'not-found')
    })
    return () => {
      cancelled = true
    }
  }, [routineId])

  useEffect(() => {
    if (!routine || routine === 'not-found') return
    let cancelled = false
    void Promise.all(routine.exerciseIds.map((exerciseId) => resolveExercise(exerciseId))).then((resolved) => {
      if (!cancelled) setSteps(resolved)
    })
    return () => {
      cancelled = true
    }
  }, [routine])

  function handleNext() {
    setCurrentStepIndex((current) => Math.min(current + 1, (steps?.length ?? 1) - 1))
  }

  // Explicit user request — repeating the current step is already covered
  // by the ordinary Start/Play action once a step reaches 'idle'/'finished'
  // (beginPlayback resets fully regardless of whether it's called via
  // start() or restart()), but going back to redo an EARLIER step wasn't
  // possible at all. Symmetric to handleNext; onPrevious is only ever
  // passed down once a step back genuinely exists (see the render below),
  // so this is never reachable at index 0.
  function handlePrevious() {
    setCurrentStepIndex((current) => Math.max(current - 1, 0))
  }

  if (routine === undefined || (routine !== 'not-found' && steps === undefined)) {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  if (routine === 'not-found') {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="רצף לא נמצא" backTo={ROUTINES_LIST_PATH} backLabel="← חזרה לרצפים" />
        <p className="text-[var(--color-text-muted)]">הרצף המבוקש לא קיים.</p>
      </div>
    )
  }

  const resolvedSteps = steps!
  const currentStep = resolvedSteps[currentStepIndex]

  if (currentStep === undefined || currentStep === 'not-found') {
    // A step's exercise was deleted since the routine was built — no
    // cascade cleanup exists for this anywhere in the app (same accepted
    // gap Lesson/Song.exerciseIds already lives with) — skip past it
    // instead of crashing; the rest of the routine is still playable.
    const isLastStep = currentStepIndex >= resolvedSteps.length - 1
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title={routine.title}
          backTo={ROUTINES_LIST_PATH}
          backLabel="← חזרה לרצפים"
          actions={
            <span className="text-sm text-[var(--color-text-muted)]">
              שלב {currentStepIndex + 1} מתוך {resolvedSteps.length}
            </span>
          }
        />
        <p className="text-[var(--color-warning-text)]">התרגיל בשלב זה נמחק ואינו זמין עוד.</p>
        {isLastStep ? (
          <Button onClick={() => void navigate(ROUTINES_LIST_PATH)}>חזרה לרצפים</Button>
        ) : (
          <Button onClick={handleNext}>דילוג לתרגיל הבא</Button>
        )}
      </div>
    )
  }

  return (
    <VisualTrainerRunner
      exercise={currentStep}
      highwayRef={highwayRef}
      exitTo={ROUTINES_LIST_PATH}
      exitLabel="← חזרה לרצפים"
      routineStep={{ index: currentStepIndex, total: resolvedSteps.length, onNext: handleNext }}
      autoStartOnMount={currentStepIndex > 0}
      onSkip={handleNext}
      onPrevious={currentStepIndex > 0 ? handlePrevious : undefined}
    />
  )
}
