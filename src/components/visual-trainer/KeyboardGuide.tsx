import { Card } from '../ui'
import { DEFAULT_KEYBOARD_MAP, codeToKeyLabel } from '../../lib/visual-trainer/keyboard-map'
import { INSTRUMENT_LABELS } from '../../lib/visual-trainer/instrument-labels'

export interface KeyboardGuideProps {
  /** 'fixed' (default) pins a compact bar to the viewport bottom — good for
   * a page with nothing else to put beside it. 'inline' renders as a plain
   * card meant to sit next to the drum kit in a side-by-side column, with
   * bigger key buttons since it isn't fighting for a thin bottom strip. */
  variant?: 'fixed' | 'inline'
}

/** VISUAL_DRUM_TRAINER_SPEC.md §6 — a static legend so a first-time player
 * knows which key is which drum without memorizing the spec's table. */
export function KeyboardGuide({ variant = 'fixed' }: KeyboardGuideProps = {}) {
  if (variant === 'inline') {
    return (
      <Card padding="md" className="w-fit min-w-[26rem] shrink-0">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">מקשים</h3>
        <ul className="grid grid-cols-2 justify-items-start gap-x-4 gap-y-4 text-base">
          {Object.entries(DEFAULT_KEYBOARD_MAP).map(([code, instrument]) => (
            <li key={code} className="flex items-center gap-2 whitespace-nowrap">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-primary)]/15 text-lg font-bold [box-shadow:var(--shadow-card)]">
                {codeToKeyLabel(code)}
              </span>
              <span className="text-[var(--color-text-muted)]">{INSTRUMENT_LABELS[instrument]}</span>
            </li>
          ))}
        </ul>
      </Card>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 [padding-bottom:env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
        {Object.entries(DEFAULT_KEYBOARD_MAP).map(([code, instrument]) => (
          <li key={code} className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-semibold">
              {codeToKeyLabel(code)}
            </span>
            <span className="text-[var(--color-text-muted)]">{INSTRUMENT_LABELS[instrument]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
