import { Link } from 'react-router'
import { Badge, PageHeader } from '../../components/ui'
import type { BadgeVariant } from '../../components/ui'
import { DEMO_EXERCISES } from './demo-exercises'
import type { InteractiveExerciseDifficulty } from '../../domain'

const DIFFICULTY_LABELS: Record<InteractiveExerciseDifficulty, string> = {
  beginner: 'מתחיל',
  intermediate: 'בינוני',
  advanced: 'מתקדם',
}

const DIFFICULTY_VARIANTS: Record<InteractiveExerciseDifficulty, BadgeVariant> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'danger',
}

/**
 * VISUAL_DRUM_TRAINER_SPEC.md §14's ExerciseSelectPage. Lists an in-memory
 * catalog (src/features/visual-trainer/demo-exercises.ts) rather than
 * persisted exercises — real IndexedDB-backed exercises land in Stage 6.
 */
export function ExerciseSelectPage() {
  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <PageHeader
        title="תרגול ויזואלי"
        actions={
          <Link
            to="/practice/visual/free-notation"
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-1.5 text-sm hover:underline"
          >
            תרגול חופשי לפי תווים
          </Link>
        }
      />
      <ul className="flex flex-col gap-2">
        {DEMO_EXERCISES.map((exercise) => (
          <li key={exercise.id}>
            <Link
              to={`/practice/visual/${exercise.id}`}
              className="flex items-center justify-between gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 [box-shadow:var(--shadow-card)] hover:underline"
            >
              <span className="font-semibold">{exercise.title}</span>
              <span className="flex shrink-0 items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <span className="w-16 shrink-0 text-center">{exercise.bpm} BPM</span>
                <Badge variant={DIFFICULTY_VARIANTS[exercise.difficulty]} className="w-16 shrink-0 justify-center">
                  {DIFFICULTY_LABELS[exercise.difficulty]}
                </Badge>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
