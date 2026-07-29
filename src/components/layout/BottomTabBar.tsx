import { useState } from 'react'
import { NavLink } from 'react-router'
import { MoreHorizontal } from 'lucide-react'
import { NAV_ITEMS } from '../../app/nav-items'

const PRIMARY_PATHS = ['/', '/today', '/course', '/journal', '/settings']

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-card)] px-1 py-1 text-[11px] transition-colors ${
    isActive ? 'text-[var(--color-primary-text)]' : 'text-[var(--color-text-muted)]'
  }`

// Mobile navigation — a fixed 5-item tab bar (the most-used screens) plus a
// "עוד" overflow panel for the rest, replacing the old wrapping 10-item row.
export function BottomTabBar() {
  const [moreOpen, setMoreOpen] = useState(false)
  const primaryItems = NAV_ITEMS.filter((item) => PRIMARY_PATHS.includes(item.path))
  const overflowItems = NAV_ITEMS.filter((item) => !PRIMARY_PATHS.includes(item.path))

  return (
    <div className="md:hidden">
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <nav
            aria-label="ניווט נוסף"
            className="fixed inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-2 [box-shadow:var(--shadow-card)]"
          >
            {overflowItems.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-[var(--radius-card)] px-3 py-2 text-sm ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--color-text)] hover:bg-[var(--color-surface)]'
                  }`
                }
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
        </>
      )}

      <nav
        aria-label="ניווט תחתון"
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-1 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)] px-1 py-1 [padding-bottom:env(safe-area-inset-bottom)]"
      >
        {primaryItems.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path} end={path === '/'} className={tabClass}>
            <Icon size={20} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen((value) => !value)}
          aria-expanded={moreOpen}
          className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-card)] px-1 py-1 text-[11px] transition-colors ${
            moreOpen ? 'text-[var(--color-primary-text)]' : 'text-[var(--color-text-muted)]'
          }`}
        >
          <MoreHorizontal size={20} aria-hidden="true" />
          עוד
        </button>
      </nav>
    </div>
  )
}
