import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  lessonRepository,
  weekRepository,
  exerciseRepository,
  resourceRepository,
  achievementRepository,
} from '../../data/repositories'
import { lessonCategorySchema, lessonStatusSchema, nowIso } from '../../domain'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Button, PageHeader } from '../../components/ui'
import { LESSON_CATEGORY_LABELS, LESSON_STATUS_LABELS } from './lesson-labels'
import type { Exercise, Lesson, Resource, Week } from '../../domain'

const lessonFormSchema = z.object({
  title: z.string().min(1, 'שדה חובה'),
  description: z.string(),
  weekId: z.string(),
  category: lessonCategorySchema,
  externalVideoUrl: z
    .string()
    .refine((value) => value === '' || /^https?:\/\//.test(value), {
      message: 'קישור חייב להתחיל ב-http:// או https://',
    }),
  status: lessonStatusSchema,
  completionCriteria: z.string(),
  notes: z.string(),
  tagsText: z.string(),
})
type LessonFormValues = z.infer<typeof lessonFormSchema>

function lessonToFormValues(lesson: Lesson): LessonFormValues {
  return {
    title: lesson.title,
    description: lesson.description ?? '',
    weekId: lesson.weekId ?? '',
    category: lesson.category,
    externalVideoUrl: lesson.externalVideoUrl ?? '',
    status: lesson.status,
    completionCriteria: lesson.completionCriteria ?? '',
    notes: lesson.notes ?? '',
    tagsText: lesson.tags.join(', '),
  }
}

export function LessonDetailPage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const navigate = useNavigate()
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [weeks, setWeeks] = useState<Week[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [resources, setResources] = useState<Resource[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<LessonFormValues>({
    resolver: zodResolver(lessonFormSchema),
    defaultValues: lessonToFormValues({
      id: '',
      order: 0,
      title: '',
      category: 'technique',
      resourceIds: [],
      exerciseIds: [],
      tags: [],
      status: 'not_started',
      createdAt: '',
      updatedAt: '',
    }),
  })

  useEffect(() => {
    if (!lessonId) return
    let cancelled = false

    async function load() {
      const [loadedLesson, allWeeks, allExercises, allResources] = await Promise.all([
        lessonRepository.getById(lessonId as string),
        weekRepository.getAll(),
        exerciseRepository.getAll(),
        resourceRepository.getAll(),
      ])
      if (cancelled) return
      if (loadedLesson) {
        setLesson(loadedLesson)
        reset(lessonToFormValues(loadedLesson))
      }
      setWeeks(allWeeks.sort((a, b) => a.order - b.order))
      setExercises(allExercises.sort((a, b) => a.name.localeCompare(b.name)))
      setResources(allResources.sort((a, b) => a.fileName.localeCompare(b.fileName)))
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [lessonId, reset])

  const debouncedSave = useDebouncedCallback(async (values: LessonFormValues) => {
    if (!lessonId) return
    const wasCompleted = lesson?.status === 'completed'
    const tags = values.tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
    const updated = await lessonRepository.patch(lessonId, {
      title: values.title,
      description: values.description || undefined,
      weekId: values.weekId || undefined,
      category: values.category,
      externalVideoUrl: values.externalVideoUrl || undefined,
      status: values.status,
      completionCriteria: values.completionCriteria || undefined,
      notes: values.notes || undefined,
      tags,
    })
    setLesson(updated)

    if (!wasCompleted && updated.status === 'completed') {
      await achievementRepository.create({
        type: 'lesson_completed',
        title: `שיעור הושלם: ${updated.title}`,
        relatedEntityId: updated.id,
        achievedAt: nowIso(),
      })
    }
  }, 500)

  useEffect(() => {
    const subscription = watch((formValues) => {
      const parsed = lessonFormSchema.safeParse(formValues)
      if (parsed.success) debouncedSave(parsed.data)
    })
    return () => subscription.unsubscribe()
  }, [watch, debouncedSave])

  async function handleToggleExercise(exerciseId: string) {
    if (!lesson) return
    const nextExerciseIds = lesson.exerciseIds.includes(exerciseId)
      ? lesson.exerciseIds.filter((id) => id !== exerciseId)
      : [...lesson.exerciseIds, exerciseId]
    const updated = await lessonRepository.patch(lesson.id, { exerciseIds: nextExerciseIds })
    setLesson(updated)
  }

  async function handleToggleResource(resourceId: string) {
    if (!lesson) return
    const nextResourceIds = lesson.resourceIds.includes(resourceId)
      ? lesson.resourceIds.filter((id) => id !== resourceId)
      : [...lesson.resourceIds, resourceId]
    const updated = await lessonRepository.patch(lesson.id, { resourceIds: nextResourceIds })
    setLesson(updated)
  }

  async function handleDelete() {
    if (!lessonId) return
    await lessonRepository.remove(lessonId)
    setConfirmDelete(false)
    void navigate('/lessons')
  }

  const visibleExercises = useMemo(() => {
    if (!exerciseSearch) return exercises
    const needle = exerciseSearch.toLowerCase()
    return exercises.filter((exercise) => exercise.name.toLowerCase().includes(needle))
  }, [exercises, exerciseSearch])

  if (!lesson) {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title={lesson.title} backTo="/lessons" backLabel="← חזרה לספריית שיעורים" />

      <form className="flex flex-col gap-3">
        {Object.keys(errors).length > 0 && (
          <div className="rounded-[var(--radius-card)] border border-[var(--color-danger-text)] p-2 text-sm text-[var(--color-danger-text)]">
            יש לתקן שגיאות בטופס לפני שהשינויים יישמרו.
          </div>
        )}

        <label className="flex flex-col gap-1 text-sm">
          שם השיעור
          <input
            {...register('title')}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
          />
          {errors.title && (
            <span className="text-sm text-[var(--color-danger-text)]">{errors.title.message}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          תיאור
          <textarea
            {...register('description')}
            rows={2}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            שבוע
            <select
              {...register('weekId')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-2"
            >
              <option value="">ללא שיוך</option>
              {weeks.map((week) => (
                <option key={week.id} value={week.id}>
                  {week.title}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            קטגוריה
            <select
              {...register('category')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-2"
            >
              {Object.entries(LESSON_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            סטטוס
            <select
              {...register('status')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-2"
            >
              {Object.entries(LESSON_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            תגיות (מופרדות בפסיק)
            <input
              {...register('tagsText')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          קישור לשיעור המקורי
          <input
            {...register('externalVideoUrl')}
            placeholder="https://..."
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
          />
          {errors.externalVideoUrl && (
            <span className="text-sm text-[var(--color-danger-text)]">
              {errors.externalVideoUrl.message}
            </span>
          )}
        </label>

        {lesson.externalVideoUrl && (
          <p className="text-sm">
            <a
              href={lesson.externalVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-primary-text)]"
            >
              פתח את השיעור המקורי ↗
            </a>
            <span className="text-[var(--color-text-muted)]"> — דורש חיבור לאינטרנט</span>
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm">
          תנאי השלמה
          <input
            {...register('completionCriteria')}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          הערות
          <textarea
            {...register('notes')}
            rows={3}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
          />
        </label>
      </form>

      <section>
        <h3 className="mb-2 text-sm text-[var(--color-text-muted)]">תרגילים קשורים</h3>
        <input
          value={exerciseSearch}
          onChange={(event) => setExerciseSearch(event.target.value)}
          placeholder="חיפוש תרגיל..."
          aria-label="חיפוש תרגילים לשיוך"
          className="mb-2 w-full rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
        />
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {visibleExercises.map((exercise) => (
            <li key={exercise.id}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={lesson.exerciseIds.includes(exercise.id)}
                  onChange={() => void handleToggleExercise(exercise.id)}
                />
                {exercise.name}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-sm text-[var(--color-text-muted)]">קבצים מצורפים</h3>
        {resources.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            אין עדיין קבצים בספרייה. ניתן להעלות ב-
            <Link to="/library" className="text-[var(--color-primary-text)]">
              ספריית קבצים
            </Link>
            .
          </p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {resources.map((resource) => (
              <li key={resource.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={lesson.resourceIds.includes(resource.id)}
                    onChange={() => void handleToggleResource(resource.id)}
                  />
                  {resource.fileName}
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button
        variant="danger-outline"
        className="self-start"
        onClick={() => setConfirmDelete(true)}
      >
        מחיקת שיעור
      </Button>

      <ConfirmDialog
        open={confirmDelete}
        title={`למחוק את "${lesson.title}"?`}
        description="לא ניתן לבטל פעולה זו."
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
