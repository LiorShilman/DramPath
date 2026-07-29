import type { HTMLAttributes } from 'react'

export type CardBorder = 'default' | 'primary' | 'warning'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg'
  border?: CardBorder
}

const PADDING_CLASSES: Record<NonNullable<CardProps['padding']>, string> = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

// Border color as a variant map (not a className override) — two utilities
// both setting border-color would otherwise have unpredictable precedence,
// since Tailwind's generated rule order isn't the same as class-string order.
const BORDER_CLASSES: Record<CardBorder, string> = {
  default: 'border-[var(--color-border)]',
  primary: 'border-[var(--color-primary-text)]',
  warning: 'border-[var(--color-warning-text)]',
}

// Shared "elevated surface" look — replaces the flat 1px-border-only cards
// that used to be hand-rolled per page (rounded border + bg-surface + shadow).
export function Card({ padding = 'md', border = 'default', className = '', ...rest }: CardProps) {
  return (
    <div
      className={[
        'rounded-[var(--radius-card)] border bg-[var(--color-surface-raised)] [box-shadow:var(--shadow-card)]',
        BORDER_CLASSES[border],
        PADDING_CLASSES[padding],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  )
}
