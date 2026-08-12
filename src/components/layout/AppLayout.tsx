import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { PwaUpdateBanner } from '../../app/PwaUpdateBanner'
import { RemoteHostProvider } from '../../features/visual-trainer/RemoteHostProvider'
import { Sidebar } from './Sidebar'
import { BottomTabBar } from './BottomTabBar'

// RemoteHostProvider wraps <Outlet/> here specifically because AppLayout is
// the one component that stays mounted across every nested-route navigation
// under "/" (dashboard, lessons, exercises, practice/visual/*, ...) — the
// single desktop/"host" phone-relay connection (ADR 0007) needs to survive
// exercise switches and exist even before any practice page is open, for
// remote exercise-list browsing. See remote-host-context.tsx.
export function AppLayout() {
  return (
    <RemoteHostProvider>
      <div className="flex min-h-svh flex-col">
        <PwaUpdateBanner />

        <header className="border-b border-[var(--color-border)] px-4 py-3">
          <h1 className="text-xl font-semibold text-[var(--color-primary-text)]">DrumPath</h1>
        </header>

        <div className="flex flex-1">
          <Sidebar />

          <main className="flex-1 p-4 pb-20 md:pb-4">
            <Suspense fallback={<p className="text-[var(--color-text-muted)]">טוען…</p>}>
              <Outlet />
            </Suspense>
          </main>
        </div>

        <BottomTabBar />
      </div>
    </RemoteHostProvider>
  )
}
