import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { lessonRepository, weekRepository, resourceRepository, interactiveExerciseRepository } from '../../data/repositories'
import { GENERATED_TRACK_TAG } from '../curriculum/use-cases/generate-curriculum-track'
import { CUSTOM_LESSON_TAG, generateSnareHihatLessonUseCase } from './use-cases/generate-snare-hihat-lesson'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ResourceThumbnail } from '../../components/ResourceThumbnail'
import { FileTypeIcon } from '../../components/FileTypeIcon'
import { Badge, Button, PageHeader } from '../../components/ui'
import { LESSON_CATEGORY_LABELS, LESSON_STATUS_LABELS, LESSON_STATUS_BADGE_VARIANTS } from './lesson-labels'
import type { Lesson, LessonCategory, LessonStatus, Resource, Week } from '../../domain'

const ALL = 'all' as const

// FileTypeIcon only needs a mimeType-shaped string to pick the right icon
// (it checks startsWith('video/') / === 'application/pdf' / etc.) — these
// three cover the two file types the user actually asked to see at a
// glance (PDF notation, MP4 lesson video) plus a catch-all so nothing
// attached is silently invisible.
const RESOURCE_CATEGORY_LABEL: Record<string, string> = {
  'application/pdf': 'PDF',
  'video/*': 'וידאו',
  'image/*': 'תמונה',
  other: 'קובץ',
}

function categorizeMimeType(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'application/pdf'
  if (mimeType.startsWith('video/')) return 'video/*'
  if (mimeType.startsWith('image/')) return 'image/*'
  return 'other'
}

// One badge per distinct file *category* attached to the lesson (not one
// per file) — a lesson with 3 PDFs shows a single "PDF ×3" badge, not 3
// identical icons.
function attachedResourceCategories(
  lesson: Lesson,
  resourceById: Map<string, Resource>,
): { category: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const id of lesson.resourceIds) {
    const resource = resourceById.get(id)
    if (!resource) continue
    const category = categorizeMimeType(resource.mimeType)
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([category, count]) => ({ category, count }))
}

export function LessonsListPage() {
  const navigate = useNavigate()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [weeks, setWeeks] = useState<Week[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)

  const [weekFilter, setWeekFilter] = useState<string>(ALL)
  const [categoryFilter, setCategoryFilter] = useState<LessonCategory | typeof ALL>(ALL)
  const [statusFilter, setStatusFilter] = useState<LessonStatus | typeof ALL>(ALL)
  const [tagFilter, setTagFilter] = useState<string>(ALL)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSetSearch = useDebouncedCallback((value: string) => setSearch(value), 250)

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Lesson | null>(null)

  async function reload() {
    const [allLessons, allWeeks, allResources] = await Promise.all([
      lessonRepository.getAll(),
      weekRepository.getAll(),
      resourceRepository.getAll(),
    ])
    setLessons(allLessons.sort((a, b) => a.order - b.order))
    setWeeks(allWeeks.sort((a, b) => a.order - b.order))
    setResources(allResources)
    setLoading(false)
  }

  useEffect(() => {
    // Fetch-on-mount from Dexie — see the same justified suppression in
    // useDashboardData.ts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [])

  const weekTitleById = useMemo(
    () => new Map(weeks.map((week) => [week.id, week.title])),
    [weeks],
  )

  const resourceById = useMemo(
    () => new Map(resources.map((resource) => [resource.id, resource])),
    [resources],
  )

  const allTags = useMemo(
    () => Array.from(new Set(lessons.flatMap((lesson) => lesson.tags))).sort(),
    [lessons],
  )

  const filtersActive =
    weekFilter !== ALL || categoryFilter !== ALL || statusFilter !== ALL || tagFilter !== ALL || search !== ''

  const filteredLessons = useMemo(() => {
    return lessons.filter((lesson) => {
      if (weekFilter !== ALL && lesson.weekId !== weekFilter) return false
      if (categoryFilter !== ALL && lesson.category !== categoryFilter) return false
      if (statusFilter !== ALL && lesson.status !== statusFilter) return false
      if (tagFilter !== ALL && !lesson.tags.includes(tagFilter)) return false
      if (search) {
        const haystack = `${lesson.title} ${lesson.notes ?? ''}`.toLowerCase()
        if (!haystack.includes(search.toLowerCase())) return false
      }
      return true
    })
  }, [lessons, weekFilter, categoryFilter, statusFilter, tagFilter, search])

  async function handleCreate() {
    const nextOrder = lessons.length > 0 ? Math.max(...lessons.map((l) => l.order)) + 1 : 1
    const created = await lessonRepository.create({
      order: nextOrder,
      title: 'שיעור חדש',
      category: 'technique',
      status: 'not_started',
      resourceIds: [],
      exerciseIds: [],
      tags: [],
    })
    void navigate(`/lessons/${created.id}`)
  }

  // Idempotent, not guarded-with-an-error like the curriculum generator —
  // this is a single hand-authored lesson, not a batch, so re-clicking just
  // takes you to the one that already exists instead of piling up
  // duplicates. Also self-healing: a lesson with no linked exercise (e.g.
  // the exercise was deleted separately via ExerciseSelectPage's own
  // delete button, which only removes the InteractiveExercise, never the
  // Lesson pointing at it — confirmed as the real cause of a report where
  // the lesson kept showing up but its exercise had silently vanished)
  // gets deleted and regenerated fresh instead of navigating to a page
  // with nothing to practice.
  async function handleGenerateSnareHihatLesson() {
    const existing = lessons.find((lesson) => lesson.tags.includes(CUSTOM_LESSON_TAG))
    if (existing) {
      const linkedExercises = await interactiveExerciseRepository.findByLessonId(existing.id)
      if (linkedExercises.length > 0) {
        void navigate(`/lessons/${existing.id}`)
        return
      }
      await lessonRepository.remove(existing.id)
    }
    const { lessonId } = await generateSnareHihatLessonUseCase()
    void navigate(`/lessons/${lessonId}`)
  }

  async function handleDuplicate(lesson: Lesson) {
    const nextOrder = Math.max(...lessons.map((l) => l.order)) + 1
    const created = await lessonRepository.create({
      order: nextOrder,
      title: `${lesson.title} (עותק)`,
      description: lesson.description,
      weekId: lesson.weekId,
      category: lesson.category,
      externalVideoUrl: lesson.externalVideoUrl,
      resourceIds: [],
      exerciseIds: lesson.exerciseIds,
      tags: lesson.tags,
      status: 'not_started',
      completionCriteria: lesson.completionCriteria,
      notes: lesson.notes,
    })
    void navigate(`/lessons/${created.id}`)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    await lessonRepository.remove(deleteTarget.id)
    setDeleteTarget(null)
    void reload()
  }

  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) return
    const sorted = [...lessons].sort((a, b) => a.order - b.order)
    const fromIndex = sorted.findIndex((lesson) => lesson.id === draggingId)
    const toIndex = sorted.findIndex((lesson) => lesson.id === targetId)
    if (fromIndex === -1 || toIndex === -1) return

    const reordered = [...sorted]
    const [moved] = reordered.splice(fromIndex, 1)
    if (moved) reordered.splice(toIndex, 0, moved)

    const updates: Array<{ id: string; order: number }> = []
    const nextLessons = reordered.map((lesson, index) => {
      const order = index + 1
      if (lesson.order !== order) updates.push({ id: lesson.id, order })
      return { ...lesson, order }
    })

    setLessons(nextLessons)
    setDraggingId(null)
    void Promise.all(updates.map((update) => lessonRepository.patch(update.id, { order: update.order })))
  }

  const reorderEnabled = !filtersActive

  if (loading) {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <PageHeader
        title="ספריית שיעורים"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void navigate('/practice/visual/curriculum')}>
              מסלול שיעורים אוטומטי
            </Button>
            <Button variant="secondary" onClick={() => void handleGenerateSnareHihatLesson()}>
              שיעור סנר + היי-הט מתקדם
            </Button>
            <Button onClick={() => void handleCreate()}>+ שיעור חדש</Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <input
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value)
            debouncedSetSearch(event.target.value)
          }}
          placeholder="חיפוש..."
          aria-label="חיפוש שיעורים"
          className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
        />
        <select
          aria-label="סינון לפי שבוע"
          value={weekFilter}
          onChange={(event) => setWeekFilter(event.target.value)}
          className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1.5 text-sm"
        >
          <option value={ALL}>כל השבועות</option>
          {weeks.map((week) => (
            <option key={week.id} value={week.id}>
              {week.title}
            </option>
          ))}
        </select>
        <select
          aria-label="סינון לפי קטגוריה"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value as LessonCategory | typeof ALL)}
          className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1.5 text-sm"
        >
          <option value={ALL}>כל הקטגוריות</option>
          {Object.entries(LESSON_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="סינון לפי סטטוס"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as LessonStatus | typeof ALL)}
          className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1.5 text-sm"
        >
          <option value={ALL}>כל הסטטוסים</option>
          {Object.entries(LESSON_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {allTags.length > 0 && (
          <select
            aria-label="סינון לפי תגית"
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1.5 text-sm"
          >
            <option value={ALL}>כל התגיות</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        )}
      </div>

      {filteredLessons.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">לא נמצאו שיעורים.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filteredLessons.map((lesson) => (
            <li
              key={lesson.id}
              draggable={reorderEnabled}
              onDragStart={() => setDraggingId(lesson.id)}
              onDragOver={(event) => reorderEnabled && event.preventDefault()}
              onDrop={() => handleDrop(lesson.id)}
              className={`flex flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] p-3 [box-shadow:var(--shadow-card)] sm:flex-row sm:items-center sm:justify-start sm:gap-4 ${
                lesson.tags.includes(GENERATED_TRACK_TAG) ? 'bg-[var(--color-primary)]/10' : 'bg-[var(--color-surface-raised)]'
              }`}
            >
              <Link
                to={`/lessons/${lesson.id}`}
                className="flex min-w-0 items-center gap-3 font-semibold hover:underline sm:w-[28rem] sm:shrink-0"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <ResourceThumbnail resource={resourceById.get(lesson.coverImageResourceId ?? '')} size={40} />
                </span>
                <span className="truncate">
                  {lesson.order}. {lesson.title}
                </span>
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)] sm:flex-nowrap">
                <span className="w-20 shrink-0 truncate">
                  {lesson.weekId ? weekTitleById.get(lesson.weekId) : '—'}
                </span>
                <span className="w-28 shrink-0 truncate">{LESSON_CATEGORY_LABELS[lesson.category]}</span>
                <Badge variant={LESSON_STATUS_BADGE_VARIANTS[lesson.status]} className="w-28 shrink-0 justify-center">
                  {LESSON_STATUS_LABELS[lesson.status]}
                </Badge>
                {/* Which file types are attached (PDF notation, MP4 lesson
                    video, ...) — a glance-level cue so opening every lesson
                    isn't the only way to know what's there. One badge per
                    distinct category, not per file. */}
                {/* Fixed width — without it, a row with zero badges
                    collapses to no width at all while a row with one shows
                    a wider gap, shifting every later column out of
                    alignment between rows (reported via screenshot). Kept
                    deliberately narrow (not matching the wider w-20/w-28
                    columns like week/category) — this row was already at
                    its width budget before this column existed, and a
                    wider reservation pushed the delete button past the
                    card's own edge (reported via a second screenshot). */}
                <div className="flex w-10 shrink-0 items-center gap-1">
                  {attachedResourceCategories(lesson, resourceById).map(({ category, count }) => (
                    <span
                      key={category}
                      title={`${RESOURCE_CATEGORY_LABEL[category] ?? category}${count > 1 ? ` ×${count}` : ''}`}
                      className="flex items-center gap-0.5 rounded-[var(--radius-card)] bg-[var(--color-surface)] px-1.5 py-0.5 text-xs text-[var(--color-text-muted)]"
                    >
                      <FileTypeIcon mimeType={category} size={14} />
                      {count > 1 && count}
                    </span>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-20 shrink-0"
                  onClick={() => void handleDuplicate(lesson)}
                >
                  שכפול
                </Button>
                <Button
                  size="sm"
                  variant="danger-outline"
                  className="w-20 shrink-0"
                  onClick={() => setDeleteTarget(lesson)}
                >
                  מחיקה
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`למחוק את "${deleteTarget?.title ?? ''}"?`}
        description="לא ניתן לבטל פעולה זו."
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
