import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { coursePlanRepository, weekRepository, lessonRepository } from '../../data/repositories'
import { calculateWeekCompletion } from '../../domain/calculations'
import { Badge, PageHeader } from '../../components/ui'
import type { BadgeVariant } from '../../components/ui'
import type { Week } from '../../domain'

interface WeekRow {
  week: Week
  completion: number
  lessonCount: number
}

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

export function CoursePage() {
  const [rows, setRows] = useState<WeekRow[] | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const plans = await coursePlanRepository.getAll()
      const activePlan = plans.find((plan) => plan.isActive) ?? plans[0]
      if (!activePlan) {
        if (!cancelled) setRows([])
        return
      }

      const [weeks, lessons] = await Promise.all([
        weekRepository.getAll(),
        lessonRepository.getAll(),
      ])
      const courseWeeks = weeks
        .filter((week) => week.coursePlanId === activePlan.id)
        .sort((a, b) => a.order - b.order)

      const computed = courseWeeks.map((week) => {
        const weekLessons = lessons.filter((lesson) => lesson.weekId === week.id)
        return {
          week,
          completion: calculateWeekCompletion(weekLessons),
          lessonCount: weekLessons.length,
        }
      })

      if (!cancelled) setRows(computed)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (rows === null) {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  if (rows.length === 0) {
    return (
      <p className="text-[var(--color-text-muted)]">
        אין מסלול טעון עדיין. עברו לאשף ההפעלה כדי לטעון נתוני פתיחה.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="מסלול הקורס" />
      <ul className="flex flex-col gap-2">
        {rows.map(({ week, completion, lessonCount }) => (
          <li key={week.id}>
            <Link
              to={`/course/weeks/${week.id}`}
              className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 [box-shadow:var(--shadow-card)] hover:bg-[var(--color-surface)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold">{week.title}</p>
                <p className="text-sm text-[var(--color-text-muted)]">{week.focus}</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span>{lessonCount} שיעורים</span>
                <span className="tabular-nums">{Math.round(completion * 100)}%</span>
                <Badge variant={STATUS_BADGE_VARIANTS[week.status]}>
                  {STATUS_LABELS[week.status]}
                </Badge>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
