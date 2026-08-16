import { useEffect, useMemo, useState } from 'react'
import {
  practiceSessionRepository,
  practiceEntryRepository,
  exerciseRepository,
  lessonRepository,
} from '../../data/repositories'
import { sumDurationSeconds } from '../../domain/calculations'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { buildJournalCsv } from '../../lib/backup/journal-csv'
import { Button, Card, PageHeader } from '../../components/ui'
import { groupSessionsByPeriod, type JournalGrouping } from './group-sessions'
import type { Exercise, Lesson, PracticeEntry, PracticeSession } from '../../domain'

const DEFAULT_MANUAL_ENTRY_MINUTES = 30

const RESULT_LABELS: Record<PracticeEntry['result'], string> = {
  clean: 'נקי',
  needs_work: 'דורש עבודה',
  skipped: 'דילוג',
}

const GROUPING_LABELS: Record<JournalGrouping, string> = {
  day: 'יום',
  week: 'שבוע',
  month: 'חודש',
}

function formatMinutes(seconds: number): number {
  return Math.round(seconds / 60)
}

function formatGroupLabel(key: string, grouping: JournalGrouping): string {
  if (grouping === 'month') {
    const [year, month] = key.split('-').map(Number)
    return new Date(year ?? 0, (month ?? 1) - 1, 1).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
    })
  }
  const date = new Date(key)
  return grouping === 'week'
    ? `שבוע שמתחיל ב-${date.toLocaleDateString('he-IL')}`
    : date.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

interface SessionRowProps {
  session: PracticeSession
  entries: PracticeEntry[]
  exercisesById: Map<string, Exercise>
  lessonsById: Map<string, Lesson>
  onUpdated: (session: PracticeSession) => void
  onDeleted: (id: string) => void
}

function SessionRow({ session, entries, exercisesById, lessonsById, onUpdated, onDeleted }: SessionRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes] = useState(session.notes ?? '')
  const [mood, setMood] = useState(session.mood ?? 0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const lessonTitle = session.lessonId ? lessonsById.get(session.lessonId)?.title : undefined

  const debouncedSave = useDebouncedCallback(async (patch: { notes?: string; mood?: number }) => {
    const updated = await practiceSessionRepository.patch(session.id, {
      notes: patch.notes || undefined,
      mood: patch.mood ? (patch.mood as 1 | 2 | 3 | 4 | 5) : undefined,
    })
    onUpdated(updated)
  }, 500)

  async function handleDelete() {
    await practiceSessionRepository.removeWithEntries(session.id)
    setConfirmDelete(false)
    onDeleted(session.id)
  }

  async function handleStatusChange(status: 'completed' | 'abandoned') {
    const updated = await practiceSessionRepository.patch(session.id, { status })
    onUpdated(updated)
  }

  return (
    <li className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 [box-shadow:var(--shadow-card)]">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full flex-col gap-1 text-start sm:flex-row sm:items-center sm:justify-between"
      >
        <span>
          {lessonTitle && <span className="font-medium">{lessonTitle} · </span>}
          {new Date(session.startedAt).toLocaleString('he-IL', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </span>
        <span className="text-sm text-[var(--color-text-muted)]">
          {formatMinutes(sumDurationSeconds(entries))} דק׳ · {entries.length} תרגילים ·{' '}
          {session.status === 'completed' ? 'הושלם' : 'ננטש'}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3 border-t border-[var(--color-border)] pt-3">
          {entries.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between">
                  <span>{exercisesById.get(entry.exerciseId)?.name ?? 'תרגיל שנמחק'}</span>
                  <span className="tabular-nums text-[var(--color-text-muted)]">
                    {entry.bpm ?? '—'} BPM · {RESULT_LABELS[entry.result]}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--color-text-muted)]">סטטוס</span>
            <Button
              size="sm"
              variant={session.status === 'completed' ? 'primary' : 'ghost'}
              aria-pressed={session.status === 'completed'}
              onClick={() => void handleStatusChange('completed')}
            >
              בוצע
            </Button>
            <Button
              size="sm"
              variant={session.status === 'abandoned' ? 'primary' : 'ghost'}
              aria-pressed={session.status === 'abandoned'}
              onClick={() => void handleStatusChange('abandoned')}
            >
              לא בוצע
            </Button>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            הערה כללית
            <input
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value)
                debouncedSave({ notes: event.target.value, mood })
              }}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            תחושה (1-5)
            <select
              value={mood}
              onChange={(event) => {
                const value = Number(event.target.value)
                setMood(value)
                debouncedSave({ notes, mood: value })
              }}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1"
            >
              <option value={0}>ללא</option>
              {[1, 2, 3, 4, 5].map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>

          <Button
            size="sm"
            variant="danger-outline"
            className="self-start"
            onClick={() => setConfirmDelete(true)}
          >
            מחיקת אימון
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="למחוק את האימון?"
        description="כל הרשומות של האימון הזה יימחקו. לא ניתן לבטל פעולה זו."
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </li>
  )
}

interface AddSessionFormProps {
  lessons: Lesson[]
  onAdd: (lessonId: string, dateValue: string, status: 'completed' | 'abandoned') => void
  onCancel: () => void
}

function AddSessionForm({ lessons, onAdd, onCancel }: AddSessionFormProps) {
  const [lessonId, setLessonId] = useState(lessons[0]?.id ?? '')
  const [dateValue, setDateValue] = useState(() => new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState<'completed' | 'abandoned'>('completed')

  return (
    <Card>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (lessonId) onAdd(lessonId, dateValue, status)
        }}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          שיעור
          <select
            aria-label="בחירת שיעור"
            value={lessonId}
            onChange={(event) => setLessonId(event.target.value)}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
          >
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.title}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          תאריך
          <input
            type="date"
            aria-label="תאריך"
            value={dateValue}
            onChange={(event) => setDateValue(event.target.value)}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
          />
        </label>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--color-text-muted)]">סטטוס</span>
          <Button
            type="button"
            size="sm"
            variant={status === 'completed' ? 'primary' : 'ghost'}
            aria-pressed={status === 'completed'}
            onClick={() => setStatus('completed')}
          >
            בוצע
          </Button>
          <Button
            type="button"
            size="sm"
            variant={status === 'abandoned' ? 'primary' : 'ghost'}
            aria-pressed={status === 'abandoned'}
            onClick={() => setStatus('abandoned')}
          >
            לא בוצע
          </Button>
        </div>

        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={!lessonId}>
            שמירה
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            ביטול
          </Button>
        </div>
      </form>
    </Card>
  )
}

export function JournalPage() {
  const [sessions, setSessions] = useState<PracticeSession[]>([])
  const [entries, setEntries] = useState<PracticeEntry[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [grouping, setGrouping] = useState<JournalGrouping>('day')
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    async function load() {
      const [allSessions, allEntries, allExercises, allLessons] = await Promise.all([
        practiceSessionRepository.getAll(),
        practiceEntryRepository.getAll(),
        exerciseRepository.getAll(),
        lessonRepository.getAll(),
      ])
      setSessions(allSessions.filter((session) => session.status !== 'draft'))
      setEntries(allEntries)
      setExercises(allExercises)
      setLessons(allLessons.slice().sort((a, b) => a.order - b.order))
      setLoading(false)
    }
    void load()
  }, [])

  const exercisesById = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [
    exercises,
  ])
  const lessonsById = useMemo(() => new Map(lessons.map((lesson) => [lesson.id, lesson])), [lessons])
  const entriesBySessionId = useMemo(() => {
    const map = new Map<string, PracticeEntry[]>()
    for (const entry of entries) {
      const list = map.get(entry.sessionId) ?? []
      list.push(entry)
      map.set(entry.sessionId, list)
    }
    return map
  }, [entries])

  const groups = useMemo(() => groupSessionsByPeriod(sessions, grouping), [sessions, grouping])

  function handleUpdated(updated: PracticeSession) {
    setSessions((prev) => prev.map((session) => (session.id === updated.id ? updated : session)))
  }

  function handleDeleted(id: string) {
    setSessions((prev) => prev.filter((session) => session.id !== id))
    setEntries((prev) => prev.filter((entry) => entry.sessionId !== id))
  }

  async function handleAddSession(
    lessonId: string,
    dateValue: string,
    status: 'completed' | 'abandoned',
  ) {
    const lesson = lessonsById.get(lessonId)
    const startedAt = new Date(dateValue).toISOString()
    const created = await practiceSessionRepository.create({
      startedAt,
      endedAt: startedAt,
      status,
      plannedDurationMinutes: DEFAULT_MANUAL_ENTRY_MINUTES,
      actualDurationSeconds: 0,
      plannedExerciseIds: lesson?.exerciseIds ?? [],
      currentExerciseIndex: 0,
      lessonId,
    })
    setSessions((prev) => [...prev, created])
    setShowAddForm(false)
  }

  function handleExportCsv() {
    const csv = buildJournalCsv(entries, exercises)
    // Leading BOM so Excel opens the Hebrew text as UTF-8 instead of guessing wrong.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `drumpath-journal-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader
        title="יומן אימונים"
        actions={
          <>
            {lessons.length > 0 && (
              <Button size="sm" onClick={() => setShowAddForm((value) => !value)}>
                הוספת אימון
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={handleExportCsv} disabled={entries.length === 0}>
              ייצוא CSV
            </Button>
            {(Object.keys(GROUPING_LABELS) as JournalGrouping[]).map((option) => (
              <Button
                key={option}
                size="sm"
                variant={grouping === option ? 'primary' : 'ghost'}
                onClick={() => setGrouping(option)}
                aria-pressed={grouping === option}
              >
                לפי {GROUPING_LABELS[option]}
              </Button>
            ))}
          </>
        }
      />

      {showAddForm && (
        <AddSessionForm
          lessons={lessons}
          onAdd={(lessonId, dateValue, status) => void handleAddSession(lessonId, dateValue, status)}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {groups.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">עדיין אין אימונים ביומן.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => {
            const groupEntries = group.sessions.flatMap(
              (session) => entriesBySessionId.get(session.id) ?? [],
            )
            return (
              <section key={group.key}>
                <h3 className="mb-2 flex items-baseline justify-between text-sm text-[var(--color-text-muted)]">
                  <span>{formatGroupLabel(group.key, grouping)}</span>
                  <span>
                    {group.sessions.length} אימונים · {formatMinutes(sumDurationSeconds(groupEntries))}{' '}
                    דק׳
                  </span>
                </h3>
                <ul className="flex flex-col gap-2">
                  {group.sessions.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      entries={entriesBySessionId.get(session.id) ?? []}
                      exercisesById={exercisesById}
                      lessonsById={lessonsById}
                      onUpdated={handleUpdated}
                      onDeleted={handleDeleted}
                    />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
