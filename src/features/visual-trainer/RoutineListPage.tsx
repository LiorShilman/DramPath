import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Badge, Button, PageHeader, buttonClassName } from '../../components/ui'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { practiceRoutineRepository } from '../../data/repositories'
import { resolveExercise } from './resolve-exercise'
import type { PracticeRoutine } from '../../domain'

/** Practice routines (setlists) — chains of existing InteractiveExercise
 * entities that auto-advance during a run. Same list+detail convention as
 * ExerciseSelectPage, one level down at practice/visual/routines. */
export function RoutineListPage() {
  const [routines, setRoutines] = useState<PracticeRoutine[]>([])
  const [pendingDeletion, setPendingDeletion] = useState<PracticeRoutine | undefined>(undefined)
  // Which routines have at least one step whose exercise was since deleted
  // (no cascade cleanup exists — see RoutinePlayerPage's own not-found
  // handling) — resolved once per routine list load so a stale routine is
  // visibly flagged before the user even tries to open/select it, not just
  // discovered as a dead end mid-run on the phone.
  const [routinesMissingSteps, setRoutinesMissingSteps] = useState<Set<string>>(new Set())

  useEffect(() => {
    void practiceRoutineRepository.getAll().then((all) => {
      const sorted = all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      setRoutines(sorted)
      void Promise.all(
        sorted.map(async (routine) => {
          const resolved = await Promise.all(routine.exerciseIds.map((id) => resolveExercise(id)))
          return resolved.some((step) => step === 'not-found') ? routine.id : undefined
        }),
      ).then((flagged) => {
        setRoutinesMissingSteps(new Set(flagged.filter((id): id is string => id !== undefined)))
      })
    })
  }, [])

  async function confirmDelete() {
    if (!pendingDeletion) return
    await practiceRoutineRepository.remove(pendingDeletion.id)
    setRoutines((current) => current.filter((routine) => routine.id !== pendingDeletion.id))
    setPendingDeletion(undefined)
  }

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <PageHeader
        title="רצפי תרגול"
        backTo="/practice/visual"
        backLabel="← חזרה לרשימת התרגילים"
        actions={
          <Link
            to="/practice/visual/routines/build"
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-1.5 text-sm hover:underline"
          >
            + רצף חדש
          </Link>
        }
      />

      {routines.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">
          עדיין אין רצפי תרגול. רצף מאפשר לשרשר כמה תרגילים לתרגול רציף שמתקדם אוטומטית מאחד לשני.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {routines.map((routine) => (
            <li
              key={routine.id}
              className="flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 [box-shadow:var(--shadow-card)]"
            >
              <Link
                to={`/practice/visual/routines/${routine.id}/play`}
                className="group flex flex-1 items-center justify-between gap-2"
              >
                <span className="font-semibold group-hover:underline">{routine.title}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {routinesMissingSteps.has(routine.id) && (
                    <Badge variant="danger">שיעורים חסרים</Badge>
                  )}
                  <Badge variant="neutral">{routine.exerciseIds.length} תרגילים</Badge>
                </span>
              </Link>
              <Link
                to={`/practice/visual/routines/build/${routine.id}`}
                className={buttonClassName('ghost', 'sm')}
                aria-label={`עריכת ${routine.title}`}
              >
                עריכה
              </Link>
              <Button
                size="sm"
                variant="danger-outline"
                onClick={() => setPendingDeletion(routine)}
                aria-label={`מחיקת ${routine.title}`}
              >
                מחיקה
              </Button>
            </li>
          ))}
        </ul>
      )}

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
