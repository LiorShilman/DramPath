import type { HTMLAttributes } from 'react'

export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'border-[var(--color-border)] text-[var(--color-text-muted)]',
  primary: 'border-[var(--color-primary-text)] text-[var(--color-primary-text)]',
  success: 'border-[var(--color-success-text)] text-[var(--color-success-text)]',
  warning: 'border-[var(--color-warning-text)] text-[var(--color-warning-text)]',
  danger: 'border-[var(--color-danger-text)] text-[var(--color-danger-text)]',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

// Status pills — week/lesson/exercise status, result labels, etc. Text is
// always paired with a matching border, per §30 "no reliance on color alone".
// `pointer-events-none`: purely decorative/informational everywhere it's
// used, never itself the click target — a Badge sitting next to a checkbox
// inside a <label> should never be able to swallow a click meant for the
// label/checkbox underneath it.
export function Badge({ variant = 'neutral', className = '', ...rest }: BadgeProps) {
  return (
    <span
      className={[
        'pointer-events-none inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        VARIANT_CLASSES[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  )
}
