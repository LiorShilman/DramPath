import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Badge, Button, PageHeader, buttonClassName } from '../../components/ui'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { practiceRoutineRepository } from '../../data/repositories'
import type { PracticeRoutine } from '../../domain'

/** Practice routines (setlists) — chains of existing InteractiveExercise
 * entities that auto-advance during a run. Same list+detail convention as
 * ExerciseSelectPage, one level down at practice/visual/routines. */
export function RoutineListPage() {
  const [routines, setRoutines] = useState<PracticeRoutine[]>([])
  const [pendingDeletion, setPendingDeletion] = useState<PracticeRoutine | undefined>(undefined)

  useEffect(() => {
    void practiceRoutineRepository.getAll().then((all) => {
      setRoutines(all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
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
                <Badge variant="neutral" className="shrink-0">
                  {routine.exerciseIds.length} תרגילים
                </Badge>
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
