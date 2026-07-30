import type { LessonCategory, LessonStatus } from '../../domain'
import type { BadgeVariant } from '../../components/ui'

export const LESSON_CATEGORY_LABELS: Record<LessonCategory, string> = {
  technique: 'טכניקה',
  coordination: 'קואורדינציה',
  reading: 'קריאת קצב',
  groove: 'מקצב',
  fill: 'מעבר',
  song: 'שיר',
}

export const LESSON_STATUS_LABELS: Record<LessonStatus, string> = {
  not_started: 'טרם התחיל',
  active: 'פעיל',
  completed: 'הושלם',
}

export const LESSON_STATUS_BADGE_VARIANTS: Record<LessonStatus, BadgeVariant> = {
  not_started: 'neutral',
  active: 'primary',
  completed: 'success',
}
