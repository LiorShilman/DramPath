import { useEffect, useState, type CSSProperties } from 'react'
import type { DrumInstrument } from '../../domain'
import { withBaseUrl } from '../../lib/asset-url'

// 9 instruments share 8 visual pieces — hihat_closed/hihat_open are the
// same physical hi-hat, matching the 8 real product photos available
// (public/drum-kit/) — one per piece, hihat.png already shows the full
// stand+pedal so no separate open/closed artwork is needed.
type DrumPiece = 'kick' | 'snare' | 'hihat' | 'ride' | 'crash' | 'tom_high' | 'tom_mid' | 'tom_floor'

const INSTRUMENT_TO_PIECE: Record<DrumInstrument, DrumPiece> = {
  kick: 'kick',
  snare: 'snare',
  hihat_closed: 'hihat',
  hihat_open: 'hihat',
  ride: 'ride',
  crash: 'crash',
  tom_high: 'tom_high',
  tom_mid: 'tom_mid',
  tom_floor: 'tom_floor',
}

const CYMBAL_PIECES: ReadonlySet<DrumPiece> = new Set(['ride', 'crash', 'hihat'])

// Reverse of INSTRUMENT_TO_PIECE, for tap targets — hihat has no separate
// open/closed artwork to distinguish a tap between them, so a tap always
// resolves to the closed variant (the more common/basic case).
const PIECE_TO_INSTRUMENT: Record<DrumPiece, DrumInstrument> = {
  kick: 'kick',
  snare: 'snare',
  hihat: 'hihat_closed',
  ride: 'ride',
  crash: 'crash',
  tom_high: 'tom_high',
  tom_mid: 'tom_mid',
  tom_floor: 'tom_floor',
}

// Loose collage layout (percent of the container) approximating a kit from
// the player's viewpoint — these are real product photos rather than a
// technical drawing, so positions are laid out by eye, not calculated.
// Front-facing kit shape, tightly grouped like an assembled kit rather than
// scattered pieces: crash/ride angled at the top corners bookending the two
// mounted toms (touching each other, directly above the kick), hihat stand
// at the player's far left, snare/kick in the front row with the kick
// largest and centered. tom_floor sits further back and to the right
// (lower top%, higher left% than a naive "same row as kick" placement) —
// pulled back explicitly per user feedback, since kick and tom_floor
// overlapping heavily in the same row made kick's rounded edge look like it
// was cutting into tom_floor's silhouette (DOM/paint order already has
// tom_floor on top — see the isActive doc comment on DrumKitProps — this
// was a spacing issue, not a stacking one).
const PIECE_LAYOUT: Record<DrumPiece, CSSProperties> = {
  crash: { top: '0%', left: '9%', width: '40%' },
  tom_high: { top: '16%', left: '34%', width: '28%' },
  tom_mid: { top: '16%', left: '56%', width: '28%' },
  ride: { top: '0%', left: '73%', width: '40%' },
  hihat: { top: '20%', left: '-4%', width: '28%' },
  snare: { top: '34%', left: '12%', width: '32%' },
  kick: { top: '34%', left: '26%', width: '50%' },
  tom_floor: { top: '26%', left: '60%', width: '36%' },
}

const PIECE_IMAGE_SRC: Record<DrumPiece, string> = {
  kick: withBaseUrl('drum-kit/kick.png'),
  snare: withBaseUrl('drum-kit/snare.png'),
  hihat: withBaseUrl('drum-kit/hihat.png'),
  ride: withBaseUrl('drum-kit/ride.png'),
  crash: withBaseUrl('drum-kit/crash.png'),
  tom_high: withBaseUrl('drum-kit/tom-high.png'),
  tom_mid: withBaseUrl('drum-kit/tom-mid.png'),
  tom_floor: withBaseUrl('drum-kit/tom-floor.png'),
}

// Pieces with a real "hit" product photo (blue head): swap to it for a
// brief flash instead of the scale animation every other piece uses
// (explicit user request — "the same resolution as the original, used
// instead of moving the image"). Matches .drum-hit's 120ms scale animation
// duration plus a little buffer so the swap doesn't feel cut short.
const HIT_IMAGE_SRC: Partial<Record<DrumPiece, string>> = {
  snare: withBaseUrl('drum-kit/snare-hit.png'),
  kick: withBaseUrl('drum-kit/kick-hit.png'),
  tom_floor: withBaseUrl('drum-kit/tom-floor-hit.png'),
  tom_mid: withBaseUrl('drum-kit/tom-mid-hit.png'),
  tom_high: withBaseUrl('drum-kit/tom-high-hit.png'),
}
const HIT_FLASH_MS = 150

// Every piece photo is a known fixed size (tom_floor is the only non-square
// one) — pinning aspect-ratio means the browser reserves the right space
// immediately, so a freshly-mounted <img> (every hit remounts its piece,
// see DrumKitProps' isActive comment) can never visibly collapse/pop-in
// while it decodes, on top of the actual pixel-alignment work below.
const PIECE_ASPECT_RATIO: Partial<Record<DrumPiece, string>> = {
  tom_floor: '320 / 480',
}

const PIECE_ALT: Record<DrumPiece, string> = {
  kick: 'בס דראם',
  snare: 'סנר',
  hihat: 'היי-הט',
  ride: 'ריייד',
  crash: 'קראש',
  tom_high: 'טמטם גבוה',
  tom_mid: 'טמטם אמצעי',
  tom_floor: 'טמטם רצפה',
}

export interface DrumKitProps {
  /** Keyed by instrument so two different instruments hit at (near-)the
   * same time both get their own entry instead of one overwriting the
   * other — a single `activeHit` value could only ever highlight one
   * piece, which made simultaneous hits look like only one registered.
   * A new hitToken per hit (e.g. crypto.randomUUID()) forces the piece to
   * remount so its CSS hit-animation restarts even on rapid repeated hits
   * of the same instrument — a class toggle alone can't restart an
   * animation that's already applied. */
  activeHits?: Partial<Record<DrumInstrument, string>>
  /** When provided, every piece becomes a tap/click target — calls this
   * with the instrument it represents. Optional and purely additive:
   * existing keyboard-driven callers (VisualTrainerPage,
   * FreeNotationPracticePage) don't pass it, so their pieces stay
   * non-interactive, exactly as before. */
  onPieceHit?: (instrument: DrumInstrument) => void
}

/** Real product photos (public/drum-kit/) laid out as a kit collage —
 * VISUAL_DRUM_TRAINER_SPEC.md §13's hit-animation contract (data-instrument
 * + .drum-piece/.hit/.cymbal classes) is unchanged from the earlier
 * hand-drawn SVG version, so the CSS in index.css didn't need to change.
 * Key letters are shown in the pinned bottom `KeyboardGuide` bar instead of
 * on the pieces themselves — badges layered on the photos were reported as
 * hurting the kit's look. */
/** A piece's own image swap (for pieces with a HIT_IMAGE_SRC entry): starts
 * true exactly when a fresh hit mounts this component (the parent already
 * remounts on a new `key` per hit — see DrumKit's isActive comment), then
 * flips itself back after the flash window so the blue-head photo doesn't
 * stay showing forever. */
function PieceImage({ piece, isActive }: { piece: DrumPiece; isActive: boolean }) {
  const hitImageSrc = HIT_IMAGE_SRC[piece]
  const [showHitImage, setShowHitImage] = useState(isActive && hitImageSrc !== undefined)

  useEffect(() => {
    if (!showHitImage) return
    const timeoutId = window.setTimeout(() => setShowHitImage(false), HIT_FLASH_MS)
    return () => window.clearTimeout(timeoutId)
  }, [showHitImage])

  const src = showHitImage && hitImageSrc ? hitImageSrc : PIECE_IMAGE_SRC[piece]
  const aspectRatio = PIECE_ASPECT_RATIO[piece]
  return (
    <img
      src={src}
      alt={PIECE_ALT[piece]}
      className="w-full drop-shadow-lg"
      style={aspectRatio ? { aspectRatio } : undefined}
    />
  )
}

// Every hit-image src, warmed into the browser's HTTP cache once on the
// kit's first mount — a piece's hit image is otherwise only ever requested
// lazily, the first time that piece is actually hit, which could show as a
// blank/late-popping-in flash instead of an instant swap, independent of
// how precisely the image itself is pixel-aligned to the idle photo.
const HIT_IMAGE_SRCS = Object.values(HIT_IMAGE_SRC)

export function DrumKit({ activeHits, onPieceHit }: DrumKitProps) {
  useEffect(() => {
    for (const src of HIT_IMAGE_SRCS) {
      const image = new Image()
      image.src = src
    }
  }, [])

  const pieceTokens: Partial<Record<DrumPiece, string>> = {}
  if (activeHits) {
    for (const [instrument, token] of Object.entries(activeHits) as [DrumInstrument, string | undefined][]) {
      if (token) pieceTokens[INSTRUMENT_TO_PIECE[instrument]] = token
    }
  }

  return (
    <div className="relative aspect-[4/3] w-full">
      {(Object.keys(PIECE_LAYOUT) as DrumPiece[]).map((piece) => {
        const token = pieceTokens[piece]
        const isActive = token !== undefined
        // A piece with a HIT_IMAGE_SRC entry gets its feedback from
        // PieceImage's blue-head image swap plus a lighter glow
        // (image-hit), instead of the scale animation every other piece
        // uses.
        const hasHitImage = HIT_IMAGE_SRC[piece] !== undefined
        const stateClass = isActive ? (hasHitImage ? ' image-hit' : ' hit') : ''
        const className = `drum-piece${CYMBAL_PIECES.has(piece) ? ' cymbal' : ''}${stateClass}`
        return (
          <div
            key={isActive ? token : `${piece}-idle`}
            data-instrument={piece}
            className={`${className}${onPieceHit ? ' touch-manipulation cursor-pointer select-none' : ''}`}
            style={{ position: 'absolute', ...PIECE_LAYOUT[piece] }}
            role={onPieceHit ? 'button' : undefined}
            tabIndex={onPieceHit ? 0 : undefined}
            aria-label={onPieceHit ? PIECE_ALT[piece] : undefined}
            onPointerDown={onPieceHit ? () => onPieceHit(PIECE_TO_INSTRUMENT[piece]) : undefined}
            onKeyDown={
              onPieceHit
                ? (event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    onPieceHit(PIECE_TO_INSTRUMENT[piece])
                  }
                : undefined
            }
          >
            <PieceImage piece={piece} isActive={isActive} />
            {/* A CSS-drawn stick (index.css's .drumstick) rather than
                another product photo: it's reusable across every piece with
                one rule instead of needing a per-piece asset sourced and
                pixel-aligned the way the hit-image photos were. Always
                rendered — index.css only animates/shows it while the
                parent has .hit or .image-hit, so it's invisible at rest.
                Not rendered for kick, which is foot-pedal-operated. */}
            {piece !== 'kick' && <div className="drumstick" aria-hidden="true" />}
          </div>
        )
      })}
    </div>
  )
}
