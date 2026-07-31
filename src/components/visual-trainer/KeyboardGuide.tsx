import { useEffect, useRef, useState } from 'react'
import { Card } from '../ui'
import { DEFAULT_KEYBOARD_MAP, codeToKeyLabel } from '../../lib/visual-trainer/keyboard-map'
import { INSTRUMENT_LABELS } from '../../lib/visual-trainer/instrument-labels'
import type { DrumInstrument } from '../../domain'

// pressedInstruments (sourced from useVisualTrainer/useFreeDrumPlayback's
// activeHits) is append-only — a token is set on press and never cleared,
// so without this the lit-up state would stay on forever after the first
// press instead of just flashing. FLASH_DURATION_MS tracks each token
// locally and clears it shortly after, independent of the prop itself.
const FLASH_DURATION_MS = 220

// Grouped by physical row (top QWERTY row, then home row) and ordered
// left-to-right within each row, so the guide's layout mirrors where the
// keys actually sit on the keyboard instead of an arbitrary list order.
const KEY_ROWS: readonly (readonly string[])[] = [
  ['KeyE', 'KeyR', 'KeyT', 'KeyU', 'KeyI', 'KeyO'],
  ['KeyD', 'KeyF', 'KeyJ'],
]

// A soft 3D keycap: an inset top highlight (light catching the upper edge)
// plus a solid bottom "wall" and a diffuse drop shadow for lift, built from
// the app's own tokens. --color-primary is theme-invariant (tokens.css: a
// "fill tone... always paired with white text"), so its rgb equivalent is
// hardcoded here for the glow's alpha — a bare var() can't carry
// transparency on its own.
const KEYCAP_SHADOW =
  'inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 0 var(--color-border), 0 4px 6px -2px rgba(15,23,24,0.15)'
const KEYCAP_ACTIVE_SHADOW =
  'inset 0 1px 0 rgba(255,255,255,0.4), 0 3px 0 var(--color-primary-dark), 0 6px 12px -2px rgba(15,23,24,0.25), 0 0 16px 3px rgba(11,110,117,0.55)'

export interface KeyboardGuideProps {
  /** 'fixed' (default) pins a compact bar to the viewport bottom — good for
   * a page with nothing else to put beside it. 'inline' renders as a plain
   * card meant to sit next to the drum kit in a side-by-side column, with
   * bigger key buttons since it isn't fighting for a thin bottom strip. */
  variant?: 'fixed' | 'inline'
  /** When given, keys whose instrument is in this set light up and the rest
   * dim — lets a specific exercise/song highlight only the keys it actually
   * uses. Omit to show every key at even, neutral emphasis (e.g. free
   * practice with no fixed note set). */
  relevantInstruments?: ReadonlySet<DrumInstrument>
  /** Keyed by instrument to a fresh token per hit (same shape as DrumKit's
   * `activeHits`) — lights the key up with a brief press animation the
   * moment its instrument is actually played, independent of
   * relevantInstruments' persistent song-relevance glow. A new token forces
   * the badge to remount so the animation restarts even on rapid repeated
   * presses of the same key. */
  pressedInstruments?: Partial<Record<DrumInstrument, string>>
}

/** VISUAL_DRUM_TRAINER_SPEC.md §6 — a static legend so a first-time player
 * knows which key is which drum without memorizing the spec's table. */
export function KeyboardGuide({ variant = 'fixed', relevantInstruments, pressedInstruments }: KeyboardGuideProps = {}) {
  const [flashingTokens, setFlashingTokens] = useState<ReadonlySet<string>>(new Set())
  const seenTokensRef = useRef<Set<string>>(new Set())
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  useEffect(() => {
    if (!pressedInstruments) return
    for (const token of Object.values(pressedInstruments)) {
      if (!token || seenTokensRef.current.has(token)) continue
      seenTokensRef.current.add(token)
      setFlashingTokens((prev) => new Set(prev).add(token))
      const timer = setTimeout(() => {
        timersRef.current.delete(timer)
        setFlashingTokens((prev) => {
          if (!prev.has(token)) return prev
          const next = new Set(prev)
          next.delete(token)
          return next
        })
      }, FLASH_DURATION_MS)
      timersRef.current.add(timer)
    }
  }, [pressedInstruments])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const timer of timers) clearTimeout(timer)
    }
  }, [])

  const isDimmed = (instrument: DrumInstrument) => relevantInstruments !== undefined && !relevantInstruments.has(instrument)
  const isActive = (instrument: DrumInstrument) => relevantInstruments !== undefined && relevantInstruments.has(instrument)
  const pressedToken = (instrument: DrumInstrument) => pressedInstruments?.[instrument]
  const isFlashing = (instrument: DrumInstrument) => {
    const token = pressedToken(instrument)
    return token !== undefined && flashingTokens.has(token)
  }

  // No explicit width on the Card below, on purpose: it's block-level with
  // no intrinsic width, so it naturally stretches to match a sibling Card
  // (e.g. the metronome bar) in a stacked flex-col column, and just as
  // naturally shrinks to its own content width when it's a flex-row item
  // beside the drum kit — each page's own layout decides, not this
  // component.
  if (variant === 'inline') {
    return (
      <Card padding="md" className="max-w-full shrink-0">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">מקשים</h3>
        <div className="flex max-w-full flex-col gap-5">
          {KEY_ROWS.map((row, rowIndex) => (
            // dir="ltr" + flex-nowrap: this row is a physical keyboard
            // layout, not text — in the app's RTL context a plain flex row
            // would mirror the DOM order (rendering the keys backwards
            // relative to the real keyboard), and wrapping would split one
            // physical row across two visual lines whenever the column is
            // narrow. Each key is a compact badge-over-label stack instead
            // of side-by-side so a 6-key row usually fits on one line;
            // overflow-x-auto is the fallback for columns too narrow even
            // for that, so the row scrolls internally instead of forcing
            // this card (and the page around it) wider than its column.
            <ul
              key={rowIndex}
              dir="ltr"
              // py-2 (not just pb-1): setting overflow-x without an explicit
              // overflow-y forces the browser to compute overflow-y as auto
              // too (can't mix 'visible' with a non-visible axis), which
              // then clips anything poking past this row's own box — a lit
              // key's -translate-y-0.5 lift did exactly that against a
              // top-flush row. The padding gives it room so nothing actually
              // reaches the clip edge.
              className="flex flex-nowrap items-start justify-center gap-x-2.5 overflow-x-auto py-2"
            >
              {row.map((code) => {
                const instrument = DEFAULT_KEYBOARD_MAP[code]!
                const dimmed = isDimmed(instrument)
                const active = isActive(instrument)
                const pressed = pressedToken(instrument)
                const flashing = isFlashing(instrument)
                const lit = active || flashing
                return (
                  <li
                    key={code}
                    dir="rtl"
                    className={`flex w-14 shrink-0 flex-col items-center gap-1.5${dimmed ? ' opacity-35' : ''}`}
                  >
                    <span
                      key={pressed ?? `${code}-idle`}
                      className={`key-cap flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold transition-transform duration-150 ${
                        flashing ? 'pressed' : ''
                      } ${
                        lit
                          ? 'bg-[var(--color-primary)] text-white -translate-y-0.5'
                          : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]'
                      }`}
                      style={{ boxShadow: lit ? KEYCAP_ACTIVE_SHADOW : KEYCAP_SHADOW }}
                    >
                      {codeToKeyLabel(code)}
                    </span>
                    <span className="text-center text-xs leading-tight text-[var(--color-text-muted)]">
                      {INSTRUMENT_LABELS[instrument]}
                    </span>
                  </li>
                )
              })}
            </ul>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 [padding-bottom:env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-1 overflow-x-auto">
        {KEY_ROWS.map((row, rowIndex) => (
          <ul key={rowIndex} dir="ltr" className="flex flex-nowrap items-center justify-center gap-x-4 py-0.5 text-sm">
            {row.map((code) => {
              const instrument = DEFAULT_KEYBOARD_MAP[code]!
              const dimmed = isDimmed(instrument)
              const active = isActive(instrument)
              const pressed = pressedToken(instrument)
              const flashing = isFlashing(instrument)
              const lit = active || flashing
              return (
                <li key={code} dir="rtl" className={`flex items-center gap-1.5${dimmed ? ' opacity-35' : ''}`}>
                  <span
                    key={pressed ?? `${code}-idle`}
                    className={`key-cap flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                      flashing ? 'pressed' : ''
                    } ${
                      lit
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]'
                    }`}
                    style={{ boxShadow: lit ? KEYCAP_ACTIVE_SHADOW : KEYCAP_SHADOW }}
                  >
                    {codeToKeyLabel(code)}
                  </span>
                  <span className="text-[var(--color-text-muted)]">{INSTRUMENT_LABELS[instrument]}</span>
                </li>
              )
            })}
          </ul>
        ))}
      </div>
    </div>
  )
}
