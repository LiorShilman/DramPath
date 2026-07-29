import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  coursePlanRepository,
  weekRepository,
  lessonRepository,
  exerciseRepository,
  practiceEntryRepository,
  practiceSessionRepository,
} from '../../data/repositories'
import { buildDailyPlan, getExercisesForWeek, getLatestCleanBpm } from '../../domain/calculations'
import { nowIso, type Exercise, type PracticeSession } from '../../domain'
import { EXERCISE_CATEGORY_LABELS } from '../exercises/exercise-labels'
import { Button, PageHeader, buttonClassName } from '../../components/ui'

const DURATION_PRESETS = [10, 20, 30, 45] as const

export function TodayPage() {
  const navigate = useNavigate()
  const [session, setSession] = useState<PracticeSession | null>(null)
  const [planExercises, setPlanExercises] = useState<Exercise[]>([])
  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [recentEntries, setRecentEntries] = useState<
    Awaited<ReturnType<typeof practiceEntryRepository.getAll>>
  >([])
  const [status, setStatus] = useState<'loading' | 'empty' | 'ready'>('loading')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [addExerciseId, setAddExerciseId] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      const coursePlans = await coursePlanRepository.getAll()
      const activePlan = coursePlans.find((plan) => plan.isActive) ?? coursePlans[0]
      const [weeks, lessons, exercises, entries, sessions] = await Promise.all([
        weekRepository.getAll(),
        lessonRepository.getAll(),
        exerciseRepository.getAll(),
        practiceEntryRepository.getAll(),
        practiceSessionRepository.getAll(),
      ])
      if (cancelled) return

      if (!activePlan || exercises.length === 0) {
        setStatus('empty')
        return
      }

      setAllExercises(exercises)
      setRecentEntries(entries)

      const activeWeek = weeks.find(
        (week) => week.coursePlanId === activePlan.id && week.status === 'active',
      )
      const lessonsThisWeek = activeWeek
        ? lessons.filter((lesson) => lesson.weekId === activeWeek.id)
        : []
      const weekExercises = getExercisesForWeek(lessonsThisWeek, exercises)

      const existingDraft = sessions
        .filter((candidate) => candidate.status === 'draft')
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]

      if (existingDraft && existingDraft.plannedExerciseIds.length > 0) {
        setSession(existingDraft)
        setPlanExercises(
          existingDraft.plannedExerciseIds
            .map((id) => exercises.find((exercise) => exercise.id === id))
            .filter((exercise): exercise is Exercise => exercise !== undefined),
        )
        setStatus('ready')
        return
      }

      const plan = buildDailyPlan({
        weekExercises,
        allExercises: exercises,
        recentEntries: entries,
        plannedDurationMinutes: existingDraft?.plannedDurationMinutes ?? 20,
      })

      const persisted = existingDraft
        ? await practiceSessionRepository.patch(existingDraft.id, {
            plannedExerciseIds: plan.map((exercise) => exercise.id),
          })
        : await practiceSessionRepository.create({
            startedAt: nowIso(),
            status: 'draft',
            plannedDurationMinutes: 20,
            actualDurationSeconds: 0,
            weekId: activeWeek?.id,
            plannedExerciseIds: plan.map((exercise) => exercise.id),
            currentExerciseIndex: 0,
          })

      if (cancelled) return
      setSession(persisted)
      setPlanExercises(plan)
      setStatus('ready')
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function persistPlan(nextPlan: Exercise[]) {
    setPlanExercises(nextPlan)
    if (!session) return
    const updated = await practiceSessionRepository.patch(session.id, {
      plannedExerciseIds: nextPlan.map((exercise) => exercise.id),
    })
    setSession(updated)
  }

  async function handleDurationChange(minutes: number) {
    if (!session) return
    const activePlanWeekId = session.weekId
    const lessons = await lessonRepository.getAll()
    const lessonsThisWeek = activePlanWeekId
      ? lessons.filter((lesson) => lesson.weekId === activePlanWeekId)
      : []
    const weekExercises = getExercisesForWeek(lessonsThisWeek, allExercises)
    const plan = buildDailyPlan({
      weekExercises,
      allExercises,
      recentEntries,
      plannedDurationMinutes: minutes,
    })
    const updated = await practiceSessionRepository.patch(session.id, {
      plannedDurationMinutes: minutes,
      plannedExerciseIds: plan.map((exercise) => exercise.id),
    })
    setSession(updated)
    setPlanExercises(plan)
  }

  function handleRemove(exerciseId: string) {
    void persistPlan(planExercises.filter((exercise) => exercise.id !== exerciseId))
  }

  function handleAdd() {
    const exercise = allExercises.find((candidate) => candidate.id === addExerciseId)
    if (!exercise) return
    void persistPlan([...planExercises, exercise])
    setAddExerciseId('')
  }

  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) return
    const fromIndex = planExercises.findIndex((exercise) => exercise.id === draggingId)
    const toIndex = planExercises.findIndex((exercise) => exercise.id === targetId)
    if (fromIndex === -1 || toIndex === -1) return

    const reordered = [...planExercises]
    const [moved] = reordered.splice(fromIndex, 1)
    if (moved) reordered.splice(toIndex, 0, moved)
    setDraggingId(null)
    void persistPlan(reordered)
  }

  async function handleStart() {
    void navigate('/practice/session')
  }

  const availableToAdd = useMemo(
    () => allExercises.filter((exercise) => !planExercises.some((p) => p.id === exercise.id)),
    [allExercises, planExercises],
  )

  if (status === 'loading') {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  if (status === 'empty') {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-[var(--color-text-muted)]">
          אין עדיין תרגילים במערכת. עברו לאשף ההפעלה כדי לטעון נתוני פתיחה.
        </p>
        <Link to="/setup" className={buttonClassName('primary', 'lg')}>
          לאשף ההפעלה
        </Link>
      </div>
    )
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title="האימון של היום" />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[var(--color-text-muted)]">משך אימון:</span>
        {DURATION_PRESETS.map((minutes) => (
          <Button
            key={minutes}
            size="sm"
            variant={session?.plannedDurationMinutes === minutes ? 'primary' : 'ghost'}
            onClick={() => void handleDurationChange(minutes)}
            aria-pressed={session?.plannedDurationMinutes === minutes}
          >
            {minutes} דק'
          </Button>
        ))}
      </div>

      {planExercises.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">
          לא נבחרו תרגילים להיום. הוסיפו תרגילים מהרשימה למטה.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {planExercises.map((exercise) => {
            const lastBpm = getLatestCleanBpm(recentEntries, exercise.id)
            return (
              <li
                key={exercise.id}
                draggable
                onDragStart={() => setDraggingId(exercise.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDrop(exercise.id)}
                className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 [box-shadow:var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{exercise.name}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {EXERCISE_CATEGORY_LABELS[exercise.category]} ·{' '}
                    {Math.round(exercise.durationSeconds / 60)} דק׳ ·{' '}
                    <span className="tabular-nums">
                      {lastBpm ?? '—'}/{exercise.targetBpm} BPM
                    </span>
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="self-start"
                  onClick={() => handleRemove(exercise.id)}
                  aria-label={`הסר את ${exercise.name} מהתוכנית`}
                >
                  הסר
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {availableToAdd.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="הוספת תרגיל לתוכנית"
            value={addExerciseId}
            onChange={(event) => setAddExerciseId(event.target.value)}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1.5 text-sm"
          >
            <option value="">בחרו תרגיל להוספה...</option>
            {availableToAdd.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
          <Button size="sm" variant="ghost" onClick={handleAdd} disabled={!addExerciseId}>
            הוסף
          </Button>
        </div>
      )}

      <Button
        size="lg"
        className="self-start"
        onClick={() => void handleStart()}
        disabled={planExercises.length === 0}
      >
        התחל אימון
      </Button>
    </div>
  )
}
