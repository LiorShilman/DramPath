import type { ReactNode } from 'react'
import { Link } from 'react-router'

export interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  backTo?: string
  backLabel?: string
  actions?: ReactNode
}

// Standardizes the "<h2> + optional back-link + optional actions" header
// pattern repeated at the top of nearly every list/detail screen.
export function PageHeader({ title, subtitle, backTo, backLabel, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      {backTo && (
        <Link to={backTo} className="text-sm text-[var(--color-primary-text)]">
          {backLabel ?? '← חזרה'}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {subtitle && <p className="text-sm text-[var(--color-text-muted)]">{subtitle}</p>}
    </div>
  )
}
