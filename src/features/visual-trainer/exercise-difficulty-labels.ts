import type { BadgeVariant } from '../../components/ui'
import type { InteractiveExerciseDifficulty } from '../../domain'

export const DIFFICULTY_LABELS: Record<InteractiveExerciseDifficulty, string> = {
  beginner: 'מתחיל',
  intermediate: 'בינוני',
  advanced: 'מתקדם',
}

export const DIFFICULTY_VARIANTS: Record<InteractiveExerciseDifficulty, BadgeVariant> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'danger',
}
