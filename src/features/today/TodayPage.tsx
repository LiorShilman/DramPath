import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { lessonRepository, practiceSessionRepository } from '../../data/repositories'
import { nowIso } from '../../domain'
import type { Lesson, PracticeSession } from '../../domain'
import { Button, PageHeader, buttonClassName } from '../../components/ui'

const DURATION_PRESETS = [10, 20, 30, 45] as const

export function TodayPage() {
  const navigate = useNavigate()
  const [session, setSession] = useState<PracticeSession | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [status, setStatus] = useState<'loading' | 'empty' | 'ready'>('loading')
  const [selectedLessonId, setSelectedLessonId] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [lessonsList, sessions] = await Promise.all([
        lessonRepository.getAll(),
        practiceSessionRepository.getAll(),
      ])
      if (cancelled) return

      if (lessonsList.length === 0) {
        setStatus('empty')
        return
      }

      setLessons([...lessonsList].sort((a, b) => a.order - b.order))

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
        setSelectedLessonId(existingDraft.lessonId ?? '')
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
      setStatus('ready')
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleDurationChange(minutes: number) {
    if (!session) return
    const updated = await practiceSessionRepository.patch(session.id, {
      plannedDurationMinutes: minutes,
    })
    setSession(updated)
  }

  async function handleDateChange(dateValue: string) {
    if (!session || !dateValue) return
    const updated = await practiceSessionRepository.patch(session.id, {
      startedAt: new Date(dateValue).toISOString(),
    })
    setSession(updated)
  }

  // Explicit user request: pick a real lesson (by its real title) instead
  // of an algorithmic warmup/focus/needs-work/fun recommendation that had
  // no real relationship to independent, self-directed practice — replaces
  // the current plan with exactly that lesson's own linked exercises, with
  // no per-exercise add/remove/reorder step in between.
  async function handleSelectLesson(lessonId: string) {
    setSelectedLessonId(lessonId)
    const lesson = lessons.find((candidate) => candidate.id === lessonId)
    if (!lesson || !session) return
    const updated = await practiceSessionRepository.patch(session.id, {
      lessonId,
      plannedExerciseIds: lesson.exerciseIds,
    })
    setSession(updated)
  }

  async function handleStart() {
    void navigate('/practice/session')
  }

  const dateValue = useMemo(() => session?.startedAt.slice(0, 10) ?? '', [session])

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
        <span className="text-sm text-[var(--color-text-muted)]">שיעור:</span>
        <select
          aria-label="בחירת שיעור להיום"
          value={selectedLessonId}
          onChange={(event) => void handleSelectLesson(event.target.value)}
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

      <label className="flex items-center gap-2 text-sm">
        <span className="text-[var(--color-text-muted)]">תאריך:</span>
        <input
          type="date"
          value={dateValue}
          onChange={(event) => void handleDateChange(event.target.value)}
          className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1.5 text-sm"
        />
      </label>

      <Button
        size="lg"
        className="self-start"
        onClick={() => void handleStart()}
        disabled={!session || session.plannedExerciseIds.length === 0}
      >
        התחל אימון
      </Button>
    </div>
  )
}
