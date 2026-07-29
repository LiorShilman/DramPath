import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { weekRepository, lessonRepository, achievementRepository } from '../../data/repositories'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { nowIso } from '../../domain'
import { Badge, Button, PageHeader } from '../../components/ui'
import type { BadgeVariant } from '../../components/ui'
import type { Lesson, Week } from '../../domain'

const weekFormSchema = z.object({
  title: z.string().min(1, 'שדה חובה'),
  focus: z.string(),
})
type WeekFormValues = z.infer<typeof weekFormSchema>

const STATUS_LABELS: Record<Week['status'], string> = {
  locked: 'נעול',
  active: 'פעיל',
  completed: 'הושלם',
}

const STATUS_BADGE_VARIANTS: Record<Week['status'], BadgeVariant> = {
  locked: 'neutral',
  active: 'primary',
  completed: 'success',
}

export function WeekDetailPage() {
  const { weekId } = useParams<{ weekId: string }>()
  const [week, setWeek] = useState<Week | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])

  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<WeekFormValues>({
    resolver: zodResolver(weekFormSchema),
    defaultValues: { title: '', focus: '' },
  })

  useEffect(() => {
    if (!weekId) return
    let cancelled = false

    async function load() {
      const [loadedWeek, allLessons] = await Promise.all([
        weekRepository.getById(weekId as string),
        lessonRepository.getAll(),
      ])
      if (cancelled) return
      if (loadedWeek) {
        setWeek(loadedWeek)
        reset({ title: loadedWeek.title, focus: loadedWeek.focus ?? '' })
      }
      setLessons(
        allLessons
          .filter((lesson) => lesson.weekId === weekId)
          .sort((a, b) => a.order - b.order),
      )
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [weekId, reset])

  const debouncedSave = useDebouncedCallback(async (values: WeekFormValues) => {
    if (!weekId) return
    const updated = await weekRepository.patch(weekId, values)
    setWeek(updated)
  }, 500)

  useEffect(() => {
    const subscription = watch((formValues) => {
      const parsed = weekFormSchema.safeParse(formValues)
      if (parsed.success) debouncedSave(parsed.data)
    })
    return () => subscription.unsubscribe()
  }, [watch, debouncedSave])

  async function handleActivate() {
    if (!weekId) return
    setWeek(await weekRepository.activateWeek(weekId))
  }

  async function handleSetStatus(status: Week['status']) {
    if (!weekId) return
    const wasCompleted = week?.status === 'completed'
    const updated = await weekRepository.patch(weekId, { status })
    setWeek(updated)

    if (!wasCompleted && updated.status === 'completed') {
      await achievementRepository.create({
        type: 'week_completed',
        title: `שבוע הושלם: ${updated.title}`,
        relatedEntityId: updated.id,
        achievedAt: nowIso(),
      })
    }
  }

  if (!week) {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <PageHeader title={week.title} backTo="/course" backLabel="← חזרה למסלול הקורס" />

      <form className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          שם השבוע
          <input
            {...register('title')}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
          />
          {errors.title && (
            <span className="text-sm text-[var(--color-danger)]">{errors.title.message}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          מוקד השבוע
          <textarea
            {...register('focus')}
            rows={2}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
          />
        </label>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_BADGE_VARIANTS[week.status]}>{STATUS_LABELS[week.status]}</Badge>
        <Button onClick={() => void handleActivate()} disabled={week.status === 'active'}>
          הפוך לשבוע הנוכחי
        </Button>
        <Button
          variant="ghost"
          onClick={() => void handleSetStatus('completed')}
          disabled={week.status === 'completed'}
        >
          סמן כהושלם
        </Button>
        <Button
          variant="ghost"
          onClick={() => void handleSetStatus('locked')}
          disabled={week.status === 'locked'}
        >
          נעל
        </Button>
      </div>

      <section>
        <h3 className="mb-2 text-sm text-[var(--color-text-muted)]">שיעורי השבוע</h3>
        {lessons.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">אין שיעורים משויכים לשבוע זה</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {lessons.map((lesson) => (
              <li key={lesson.id}>
                <Link
                  to={`/lessons/${lesson.id}`}
                  className="block rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm [box-shadow:var(--shadow-card)] hover:bg-[var(--color-surface)]"
                >
                  {lesson.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
