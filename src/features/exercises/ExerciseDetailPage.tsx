import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  exerciseRepository,
  practiceEntryRepository,
  resourceRepository,
} from '../../data/repositories'
import { exerciseCategorySchema, subdivisionSchema } from '../../domain'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Button, PageHeader } from '../../components/ui'
import { EXERCISE_CATEGORY_LABELS, SUBDIVISION_LABELS } from './exercise-labels'
import type { Exercise, PracticeEntry, Resource } from '../../domain'

const exerciseFormSchema = z
  .object({
    name: z.string().min(1, 'שדה חובה'),
    category: exerciseCategorySchema,
    instructions: z.string(),
    startBpm: z.coerce.number().int().positive('חייב להיות חיובי'),
    targetBpm: z.coerce.number().int().positive('חייב להיות חיובי'),
    minBpm: z.coerce.number().int().positive('חייב להיות חיובי'),
    maxBpm: z.coerce.number().int().positive('חייב להיות חיובי'),
    durationSeconds: z.coerce.number().int().positive('חייב להיות חיובי'),
    repetitionsTarget: z.coerce.number().int().positive('חייב להיות חיובי'),
    subdivision: subdivisionSchema,
    difficulty: z.coerce.number().int().min(1).max(5),
    tagsText: z.string(),
    isArchived: z.boolean(),
    notationResourceId: z.string(),
  })
  .refine((values) => values.minBpm <= values.maxBpm, {
    message: 'BPM מינימלי לא יכול לעלות על BPM מקסימלי',
    path: ['minBpm'],
  })
type ExerciseFormValues = z.infer<typeof exerciseFormSchema>
// z.coerce.number() fields have input type `unknown` (raw form value) but
// output type `number` (after parsing) — the form itself must be typed by
// the input shape; debouncedSave/save logic uses the parsed output shape.
type ExerciseFormInput = z.input<typeof exerciseFormSchema>

function exerciseToFormValues(exercise: Exercise): ExerciseFormInput {
  return {
    name: exercise.name,
    category: exercise.category,
    instructions: exercise.instructions,
    startBpm: exercise.startBpm,
    targetBpm: exercise.targetBpm,
    minBpm: exercise.minBpm,
    maxBpm: exercise.maxBpm,
    durationSeconds: exercise.durationSeconds,
    repetitionsTarget: exercise.repetitionsTarget,
    subdivision: exercise.subdivision,
    difficulty: exercise.difficulty,
    tagsText: exercise.tags.join(', '),
    isArchived: exercise.isArchived,
    notationResourceId: exercise.notationResourceId ?? '',
  }
}

const RESULT_LABELS: Record<PracticeEntry['result'], string> = {
  clean: 'נקי',
  needs_work: 'דורש עבודה',
  skipped: 'דולג',
}

export function ExerciseDetailPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const navigate = useNavigate()
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [entries, setEntries] = useState<PracticeEntry[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<ExerciseFormInput>({
    resolver: zodResolver(exerciseFormSchema),
  })

  useEffect(() => {
    if (!exerciseId) return
    let cancelled = false

    async function load() {
      const [loadedExercise, exerciseEntries, allResources] = await Promise.all([
        exerciseRepository.getById(exerciseId as string),
        practiceEntryRepository.getByExerciseId(exerciseId as string),
        resourceRepository.getAll(),
      ])
      if (cancelled) return
      if (loadedExercise) {
        setExercise(loadedExercise)
        reset(exerciseToFormValues(loadedExercise))
      }
      setEntries(exerciseEntries.sort((a, b) => b.startedAt.localeCompare(a.startedAt)))
      setResources(allResources.sort((a, b) => a.fileName.localeCompare(b.fileName)))
    }

    void load()

    // See the same reasoning in LessonDetailPage.tsx: a file added to the
    // library from another tab (or a back-navigation that doesn't remount
    // this page) would otherwise leave `resources` stale until reload.
    function handleVisible() {
      if (document.visibilityState === 'visible') void resourceRepository.getAll().then((all) => {
        if (!cancelled) setResources(all.sort((a, b) => a.fileName.localeCompare(b.fileName)))
      })
    }
    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('focus', handleVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('focus', handleVisible)
    }
  }, [exerciseId, reset])

  const debouncedSave = useDebouncedCallback(async (values: ExerciseFormValues) => {
    if (!exerciseId) return
    const tags = values.tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
    const updated = await exerciseRepository.patch(exerciseId, {
      name: values.name,
      category: values.category,
      instructions: values.instructions,
      startBpm: values.startBpm,
      targetBpm: values.targetBpm,
      minBpm: values.minBpm,
      maxBpm: values.maxBpm,
      durationSeconds: values.durationSeconds,
      repetitionsTarget: values.repetitionsTarget,
      subdivision: values.subdivision,
      difficulty: values.difficulty,
      tags,
      isArchived: values.isArchived,
      notationResourceId: values.notationResourceId || undefined,
    })
    setExercise(updated)
  }, 500)

  useEffect(() => {
    const subscription = watch((formValues) => {
      const parsed = exerciseFormSchema.safeParse(formValues)
      if (parsed.success) debouncedSave(parsed.data)
    })
    return () => subscription.unsubscribe()
  }, [watch, debouncedSave])

  async function handleDelete() {
    if (!exerciseId) return
    await exerciseRepository.removeAndUnlink(exerciseId)
    setConfirmDelete(false)
    void navigate('/exercises')
  }

  if (!exercise) {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title={exercise.name} backTo="/exercises" backLabel="← חזרה לספריית תרגילים" />

      <form className="flex flex-col gap-3">
        {Object.keys(errors).length > 0 && (
          <div className="rounded-[var(--radius-card)] border border-[var(--color-danger-text)] p-2 text-sm text-[var(--color-danger-text)]">
            יש לתקן שגיאות בטופס לפני שהשינויים יישמרו.
          </div>
        )}

        <label className="flex flex-col gap-1 text-sm">
          שם התרגיל
          <input
            {...register('name')}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
          />
          {errors.name && (
            <span className="text-sm text-[var(--color-danger-text)]">{errors.name.message}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          הוראות
          <textarea
            {...register('instructions')}
            rows={3}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
          />
        </label>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            קטגוריה
            <select
              {...register('category')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-2"
            >
              {Object.entries(EXERCISE_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            חלוקה
            <select
              {...register('subdivision')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-2"
            >
              {Object.entries(SUBDIVISION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            רמת קושי (1-5)
            <input
              type="number"
              min={1}
              max={5}
              {...register('difficulty')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            BPM התחלתי
            <input
              type="number"
              {...register('startBpm')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            BPM יעד
            <input
              type="number"
              {...register('targetBpm')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            BPM מינימלי
            <input
              type="number"
              {...register('minBpm')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
            {errors.minBpm && (
              <span className="text-sm text-[var(--color-danger-text)]">{errors.minBpm.message}</span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            BPM מקסימלי
            <input
              type="number"
              {...register('maxBpm')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            משך (שניות)
            <input
              type="number"
              {...register('durationSeconds')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            יעד חזרות
            <input
              type="number"
              {...register('repetitionsTarget')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          תגיות (מופרדות בפסיק)
          <input
            {...register('tagsText')}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('isArchived')} />
          בארכיון
        </label>

        <label className="flex flex-col gap-1 text-sm">
          קובץ תווים
          <select
            {...register('notationResourceId')}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-2"
          >
            <option value="">ללא</option>
            {resources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.sourceType === 'link' ? `🔗 ${resource.fileName}` : resource.fileName}
              </option>
            ))}
          </select>
        </label>
      </form>

      <section>
        <h3 className="mb-2 text-sm text-[var(--color-text-muted)]">היסטוריית תרגול</h3>
        {entries.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">אין עדיין רשומות תרגול לתרגיל זה</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-1.5"
              >
                <span>{new Date(entry.startedAt).toLocaleDateString('he-IL')}</span>
                <span className="tabular-nums">{entry.bpm ?? '—'} BPM</span>
                <span>{RESULT_LABELS[entry.result]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button variant="danger-outline" className="self-start" onClick={() => setConfirmDelete(true)}>
        מחיקת תרגיל
      </Button>

      <ConfirmDialog
        open={confirmDelete}
        title={`למחוק את "${exercise.name}"?`}
        description="התרגיל יוסר גם מכל השיעורים המקושרים אליו. לא ניתן לבטל פעולה זו."
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
