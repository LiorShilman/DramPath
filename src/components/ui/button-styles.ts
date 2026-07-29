export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'success'
  | 'warning'
  | 'danger'
  | 'danger-outline'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-card)] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--color-primary)] text-white hover:opacity-90',
  secondary:
    'border border-[var(--color-primary-text)] text-[var(--color-primary-text)] hover:bg-[var(--color-surface)]',
  ghost:
    'border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)]',
  success: 'bg-[var(--color-success)] text-white hover:opacity-90',
  warning: 'bg-[var(--color-warning)] text-white hover:opacity-90',
  danger: 'bg-[var(--color-danger)] text-white hover:opacity-90',
  'danger-outline':
    'border border-[var(--color-danger-text)] text-[var(--color-danger-text)] hover:bg-[var(--color-surface)]',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-2.5 py-1 text-sm',
  md: 'min-h-9 px-4 py-2 text-sm',
  lg: 'min-h-11 px-4 py-2',
}

export function buttonClassName(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className = '',
): string {
  return [BASE, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className].filter(Boolean).join(' ')
}
