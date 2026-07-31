import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Badge, Button, PageHeader, buttonClassName } from '../../components/ui'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { DEMO_EXERCISES } from './demo-exercises'
import { DIFFICULTY_LABELS, DIFFICULTY_VARIANTS } from './exercise-difficulty-labels'
import { interactiveExerciseRepository } from '../../data/repositories'
import type { InteractiveExercise } from '../../domain'

/**
 * VISUAL_DRUM_TRAINER_SPEC.md §14's ExerciseSelectPage. Lists the built-in
 * demo catalog (src/features/visual-trainer/demo-exercises.ts) alongside
 * any exercises the user has built themselves (persisted, unlike the demo
 * ones which stay in-memory).
 */
export function ExerciseSelectPage() {
  const [customExercises, setCustomExercises] = useState<InteractiveExercise[]>([])
  const [pendingDeletion, setPendingDeletion] = useState<InteractiveExercise | undefined>(undefined)

  useEffect(() => {
    void interactiveExerciseRepository.getAll().then((all) => {
      setCustomExercises(all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    })
  }, [])

  async function confirmDelete() {
    if (!pendingDeletion) return
    await interactiveExerciseRepository.remove(pendingDeletion.id)
    setCustomExercises((current) => current.filter((exercise) => exercise.id !== pendingDeletion.id))
    setPendingDeletion(undefined)
  }

  const allExercises = [...customExercises, ...DEMO_EXERCISES]

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <PageHeader
        title="תרגול ויזואלי"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/practice/visual/build"
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-1.5 text-sm hover:underline"
            >
              + תרגיל חדש
            </Link>
            <Link
              to="/practice/visual/free-notation"
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-1.5 text-sm hover:underline"
            >
              תרגול חופשי לפי תווים
            </Link>
          </div>
        }
      />
      <ul className="flex flex-col gap-2">
        {allExercises.map((exercise) => {
          const isCustom = customExercises.some((custom) => custom.id === exercise.id)
          return (
            <li
              key={exercise.id}
              className="flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 [box-shadow:var(--shadow-card)]"
            >
              <Link to={`/practice/visual/${exercise.id}`} className="group flex flex-1 items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold group-hover:underline">
                  {exercise.title}
                  {isCustom && (
                    <Badge variant="primary" className="shrink-0">
                      שלי
                    </Badge>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <span className="w-16 shrink-0 text-center">{exercise.bpm} BPM</span>
                  <Badge variant={DIFFICULTY_VARIANTS[exercise.difficulty]} className="w-16 shrink-0 justify-center">
                    {DIFFICULTY_LABELS[exercise.difficulty]}
                  </Badge>
                </span>
              </Link>
              {isCustom && (
                <>
                  <Link
                    to={`/practice/visual/build/${exercise.id}`}
                    className={buttonClassName('ghost', 'sm')}
                    aria-label={`עריכת ${exercise.title}`}
                  >
                    עריכה
                  </Link>
                  <Button
                    size="sm"
                    variant="danger-outline"
                    onClick={() => setPendingDeletion(exercise)}
                    aria-label={`מחיקת ${exercise.title}`}
                  >
                    מחיקה
                  </Button>
                </>
              )}
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        open={pendingDeletion !== undefined}
        title={`למחוק את "${pendingDeletion?.title}"?`}
        description="לא ניתן לבטל פעולה זו."
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDeletion(undefined)}
      />
    </div>
  )
}
