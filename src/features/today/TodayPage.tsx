import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  lessonRepository,
  exerciseRepository,
  practiceEntryRepository,
  practiceSessionRepository,
} from '../../data/repositories'
import { getLatestCleanBpm } from '../../domain/calculations'
import { nowIso } from '../../domain'
import type { Exercise, Lesson, PracticeSession } from '../../domain'
import { EXERCISE_CATEGORY_LABELS } from '../exercises/exercise-labels'
import { Button, PageHeader, buttonClassName } from '../../components/ui'

const DURATION_PRESETS = [10, 20, 30, 45] as const

export function TodayPage() {
  const navigate = useNavigate()
  const [session, setSession] = useState<PracticeSession | null>(null)
  const [planExercises, setPlanExercises] = useState<Exercise[]>([])
  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [recentEntries, setRecentEntries] = useState<
    Awaited<ReturnType<typeof practiceEntryRepository.getAll>>
  >([])
  const [status, setStatus] = useState<'loading' | 'empty' | 'ready'>('loading')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [addExerciseId, setAddExerciseId] = useState('')
  const [selectedLessonId, setSelectedLessonId] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [lessonsList, exercises, entries, sessions] = await Promise.all([
        lessonRepository.getAll(),
        exerciseRepository.getAll(),
        practiceEntryRepository.getAll(),
        practiceSessionRepository.getAll(),
      ])
      if (cancelled) return

      if (exercises.length === 0) {
        setStatus('empty')
        return
      }

      setAllExercises(exercises)
      setLessons([...lessonsList].sort((a, b) => a.order - b.order))
      setRecentEntries(entries)

      // Trust whatever draft already exists, regardless of how many
      // exercises are currently planned in it — an intentionally emptied
      // plan (every exercise removed one at a time) is real, persisted
      // state, not "no draft yet". Explicit user report: an
      // emptied-plan-length check here used to treat a cleared plan as
      // missing and silently regenerate a fresh algorithmic one on the very
      // next load, so a removal never actually stuck.
      const existingDraft = sessions
        .filter((candidate) => candidate.status === 'draft')
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]

      if (existingDraft) {
        setSession(existingDraft)
        setPlanExercises(
          existingDraft.plannedExerciseIds
            .map((id) => exercises.find((exercise) => exercise.id === id))
            .filter((exercise): exercise is Exercise => exercise !== undefined),
        )
        setStatus('ready')
        return
      }

      const created = await practiceSessionRepository.create({
        startedAt: nowIso(),
        status: 'draft',
        plannedDurationMinutes: 20,
        actualDurationSeconds: 0,
        plannedExerciseIds: [],
        currentExerciseIndex: 0,
      })
      if (cancelled) return
      setSession(created)
      setPlanExercises([])
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
    const updated = await practiceSessionRepository.patch(session.id, {
      plannedDurationMinutes: minutes,
    })
    setSession(updated)
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

  // Explicit user request: pick a real lesson (by its real title) instead
  // of an algorithmic warmup/focus/needs-work/fun recommendation that had
  // no real relationship to independent, self-directed practice — replaces
  // the current plan with exactly that lesson's own linked exercises.
  function handleSelectLesson(lessonId: string) {
    setSelectedLessonId(lessonId)
    const lesson = lessons.find((candidate) => candidate.id === lessonId)
    if (!lesson) return
    const lessonExercises = lesson.exerciseIds
      .map((id) => allExercises.find((exercise) => exercise.id === id))
      .filter((exercise): exercise is Exercise => exercise !== undefined)
    void persistPlan(lessonExercises)
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

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }),
    [],
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
      <PageHeader title="האימון של היום" subtitle={todayLabel} />

      {lessons.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--color-text-muted)]">שיעור:</span>
          <select
            aria-label="בחירת שיעור להיום"
            value={selectedLessonId}
            onChange={(event) => handleSelectLesson(event.target.value)}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1.5 text-sm"
          >
            <option value="">בחרו שיעור...</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.title}
              </option>
            ))}
          </select>
        </div>
      )}

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
          לא נבחרו תרגילים להיום. בחרו שיעור למעלה, או הוסיפו תרגילים מהרשימה למטה.
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
