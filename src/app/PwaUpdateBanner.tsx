import { useRegisterSW } from 'virtual:pwa-register/react'

// §28: service-worker updates are always an explicit, dismissible prompt —
// never applied automatically mid-workout.
export function PwaUpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm">
      <span>גרסה חדשה של DrumPath זמינה.</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="rounded-[var(--radius-card)] bg-[var(--color-primary)] px-3 py-1 text-white"
        >
          רענון עכשיו
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-1"
        >
          מאוחר יותר
        </button>
      </div>
    </div>
  )
}
