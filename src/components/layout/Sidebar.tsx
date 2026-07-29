import { NavLink } from 'react-router'
import { NAV_ITEMS } from '../../app/nav-items'

// Desktop/tablet navigation — a vertical icon+label rail. Replaces the old
// single wrapping row of 10 items, which read as cramped at any width.
export function Sidebar() {
  return (
    <nav
      aria-label="ניווט ראשי"
      className="hidden w-56 shrink-0 flex-col gap-1 border-l border-[var(--color-border)] p-3 md:flex"
    >
      {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-[var(--radius-card)] px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'bg-[var(--color-primary)] font-semibold text-white'
                : 'text-[var(--color-text)] hover:bg-[var(--color-surface)]'
            }`
          }
        >
          <Icon size={18} aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
