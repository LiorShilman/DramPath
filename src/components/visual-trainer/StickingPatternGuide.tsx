import type { CSSProperties } from 'react'
import { STICKING_PATTERNS, handForSubTick } from '../../lib/sticking-pattern'
import type { Hand } from '../../lib/sticking-pattern'
import type { Subdivision } from '../../domain'

export interface StickingPatternGuideProps {
  subdivision: Subdivision
  /** Which subdivision within the current beat is playing right now (0 =
   * the beat itself) — undefined/null while the metronome is stopped, so
   * neither pad is struck. */
  activeSubdivisionIndex?: number | null
  /** Increments on every tick, even repeats of the same hand (e.g. eighths
   * are R R) — used to key the hit-flash animation so it replays each time,
   * not just when the active hand actually changes. */
  activeTick?: number
  /** The static "י ש" reference caption below the pads. Defaults to shown;
   * TouchDrumKitPage's toolbar is cramped enough that the caption (a row of
   * lone Hebrew letters at 10-12px) read as unexplained stray marks rather
   * than a legible sequence, so it opts out. */
  showCaption?: boolean
}

const HAND_LABELS: Record<Hand, string> = { R: 'ימין', L: 'שמאל' }

const HAND_COLORS: Record<Hand, { border: string; bg: string; text: string; flashVar: string }> = {
  R: {
    border: 'border-[var(--color-primary-text)]/50',
    bg: 'bg-[var(--color-primary-text)]/10',
    text: 'text-[var(--color-primary-text)]',
    flashVar: 'var(--color-primary-text)',
  },
  L: {
    border: 'border-[var(--color-warning-text)]/50',
    bg: 'bg-[var(--color-warning-text)]/10',
    text: 'text-[var(--color-warning-text)]',
    flashVar: 'var(--color-warning-text)',
  },
}

interface StickingPadProps {
  hand: Hand
  isActive: boolean
  activeTick?: number
}

// A fixed target pad for one hand — flashes to that hand's own color and
// pulses in place (index.css's .sticking-pad-hit) every time that hand is
// due. A same-place scale+color pulse, not a directional swing-in
// animation: three rounds of a CSS-drawn stick swinging in from outside all
// looked wrong with no way here to actually see the rendered result and
// iterate on the geometry — a pulse has no direction to get wrong. Keyed by
// activeTick, not just isActive: without the key, two consecutive ticks on
// the same hand (eighths: R R) wouldn't remount the element, so the
// animation would only play once instead of on every strike.
function StickingPad({ hand, isActive, activeTick }: StickingPadProps) {
  const colors = HAND_COLORS[hand]
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        key={isActive ? `${hand}-${activeTick}` : hand}
        aria-label={HAND_LABELS[hand]}
        style={isActive ? ({ '--sticking-pad-flash-color': colors.flashVar } as CSSProperties) : undefined}
        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${colors.border} ${colors.bg} ${
          isActive ? 'sticking-pad-hit' : ''
        }`}
      >
        <span className={`text-sm font-bold ${colors.text}`}>{hand === 'R' ? 'י' : 'ש'}</span>
      </div>
      <span className="text-[10px] text-[var(--color-text-muted)]">{HAND_LABELS[hand]}</span>
    </div>
  )
}

/** Two fixed hand-pads (right, left) — each flashes and pulses when it's
 * due on a metronome subdivision tick, per the course's sticking
 * progression (quarters/eighths stay on the right hand, sixteenths
 * alternate R L R L). A static caption below spells out the whole pattern
 * as a reference, so the sequence stays visible between ticks too, not
 * just whichever hand happens to be due right now. */
export function StickingPatternGuide({
  subdivision,
  activeSubdivisionIndex,
  activeTick,
  showCaption = true,
}: StickingPatternGuideProps) {
  const pattern = STICKING_PATTERNS[subdivision]
  const activeHand = activeSubdivisionIndex != null ? handForSubTick(subdivision, activeSubdivisionIndex) : undefined

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Right-hand pad coded first: this app's RTL default already lands a
          row's first DOM child on the physical right (same convention noted
          in FreeNotationPracticePage's own column-order comment) — matches
          which hand it actually represents. */}
      <div className="flex items-center justify-center gap-6">
        <StickingPad hand="R" isActive={activeHand === 'R'} activeTick={activeTick} />
        <StickingPad hand="L" isActive={activeHand === 'L'} activeTick={activeTick} />
      </div>
      {showCaption && (
        <span data-testid="sticking-pattern-caption" className="text-xs text-[var(--color-text-muted)]" dir="ltr">
          {pattern.map((hand) => (hand === 'R' ? 'י' : 'ש')).join(' ')}
        </span>
      )}
    </div>
  )
}
