import type { LessonCategory, LessonStatus } from '../../domain'

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
