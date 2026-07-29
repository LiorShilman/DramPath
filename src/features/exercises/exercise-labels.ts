import type { ExerciseCategory, Subdivision } from '../../domain'

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  technique: 'טכניקה',
  coordination: 'קואורדינציה',
  reading: 'קריאת קצב',
  groove: 'מקצב',
  fill: 'מעבר',
  combo: 'שילוב',
  song: 'שיר',
}

export const SUBDIVISION_LABELS: Record<Subdivision, string> = {
  quarter: 'רבעים',
  eighth: 'שמיניות',
  sixteenth: 'שש-עשריות',
}
