import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { exerciseRepository } from '../../data/repositories'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Button, PageHeader } from '../../components/ui'
import { EXERCISE_CATEGORY_LABELS } from './exercise-labels'
import type { Exercise, ExerciseCategory } from '../../domain'

const ALL = 'all' as const

export function ExercisesListPage() {
  const navigate = useNavigate()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)

  const [categoryFilter, setCategoryFilter] = useState<ExerciseCategory | typeof ALL>(ALL)
  const [difficultyFilter, setDifficultyFilter] = useState<string>(ALL)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSetSearch = useDebouncedCallback((value: string) => setSearch(value), 250)

  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null)

  async function reload() {
    const all = await exerciseRepository.getAll()
    setExercises(all.sort((a, b) => a.name.localeCompare(b.name)))
    setLoading(false)
  }

  useEffect(() => {
    // Fetch-on-mount from Dexie — see the same justified suppression in
    // useDashboardData.ts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [])

  const filtered = useMemo(() => {
    return exercises.filter((exercise) => {
      if (!includeArchived && exercise.isArchived) return false
      if (categoryFilter !== ALL && exercise.category !== categoryFilter) return false
      if (difficultyFilter !== ALL && String(exercise.difficulty) !== difficultyFilter) return false
      if (search && !exercise.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [exercises, categoryFilter, difficultyFilter, includeArchived, search])

  async function handleCreate() {
    const created = await exerciseRepository.create({
      name: 'תרגיל חדש',
      category: 'technique',
      instructions: '',
      startBpm: 60,
      targetBpm: 80,
      minBpm: 40,
      maxBpm: 160,
      durationSeconds: 60,
      repetitionsTarget: 8,
      subdivision: 'quarter',
      difficulty: 1,
      tags: [],
      isArchived: false,
    })
    void navigate(`/exercises/${created.id}`)
  }

  async function handleDuplicate(exercise: Exercise) {
    const created = await exerciseRepository.create({
      name: `${exercise.name} (עותק)`,
      category: exercise.category,
      instructions: exercise.instructions,
      notationResourceId: undefined,
      startBpm: exercise.startBpm,
      targetBpm: exercise.targetBpm,
      minBpm: exercise.minBpm,
      maxBpm: exercise.maxBpm,
      durationSeconds: exercise.durationSeconds,
      repetitionsTarget: exercise.repetitionsTarget,
      subdivision: exercise.subdivision,
      difficulty: exercise.difficulty,
      tags: exercise.tags,
      isArchived: false,
    })
    void navigate(`/exercises/${created.id}`)
  }

  async function handleToggleArchive(exercise: Exercise) {
    await exerciseRepository.patch(exercise.id, { isArchived: !exercise.isArchived })
    void reload()
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    await exerciseRepository.removeAndUnlink(deleteTarget.id)
    setDeleteTarget(null)
    void reload()
  }

  if (loading) {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="ספריית תרגילים"
        actions={<Button onClick={() => void handleCreate()}>+ תרגיל חדש</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value)
            debouncedSetSearch(event.target.value)
          }}
          placeholder="חיפוש..."
          aria-label="חיפוש תרגילים"
          className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
        />
        <select
          aria-label="סינון לפי קטגוריה"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value as ExerciseCategory | typeof ALL)}
          className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1.5 text-sm"
        >
          <option value={ALL}>כל הקטגוריות</option>
          {Object.entries(EXERCISE_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="סינון לפי רמת קושי"
          value={difficultyFilter}
          onChange={(event) => setDifficultyFilter(event.target.value)}
          className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1.5 text-sm"
        >
          <option value={ALL}>כל רמות הקושי</option>
          {[1, 2, 3, 4, 5].map((level) => (
            <option key={level} value={level}>
              רמה {level}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => setIncludeArchived(event.target.checked)}
          />
          כלול ארכיון
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">לא נמצאו תרגילים.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((exercise) => (
            <li
              key={exercise.id}
              className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 [box-shadow:var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between"
            >
              <Link to={`/exercises/${exercise.id}`} className="font-semibold hover:underline">
                {exercise.name}
                {exercise.isArchived ? ' (בארכיון)' : ''}
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <span>{EXERCISE_CATEGORY_LABELS[exercise.category]}</span>
                <span className="tabular-nums">יעד {exercise.targetBpm} BPM</span>
                <Button size="sm" variant="ghost" onClick={() => void handleToggleArchive(exercise)}>
                  {exercise.isArchived ? 'הוצא מארכיון' : 'העבר לארכיון'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void handleDuplicate(exercise)}>
                  שכפול
                </Button>
                <Button size="sm" variant="danger-outline" onClick={() => setDeleteTarget(exercise)}>
                  מחיקה
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`למחוק את "${deleteTarget?.name ?? ''}"?`}
        description="התרגיל יוסר גם מכל השיעורים המקושרים אליו. לא ניתן לבטל פעולה זו."
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
