import { DEFAULT_KEYBOARD_MAP, codeToKeyLabel } from '../../lib/visual-trainer/keyboard-map'
import { INSTRUMENT_LABELS } from '../../lib/visual-trainer/instrument-labels'

/** VISUAL_DRUM_TRAINER_SPEC.md §6 — a static legend so a first-time player
 * knows which key is which drum without memorizing the spec's table. Pinned
 * to the bottom of the viewport (not the page flow) so it stays visible as
 * a constant reference while playing, instead of taking up vertical space
 * in the runner's already-tight layout budget. */
export function KeyboardGuide() {
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
