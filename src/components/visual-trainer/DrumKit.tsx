import { useEffect, useState, type CSSProperties } from 'react'
import type { DrumInstrument } from '../../domain'

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

// Loose collage layout (percent of the container) approximating a kit from
// the player's viewpoint — these are real product photos rather than a
// technical drawing, so positions are laid out by eye, not calculated.
// Front-facing kit shape, tightly grouped like an assembled kit rather than
// scattered pieces: crash/ride angled at the top corners bookending the two
// mounted toms (touching each other, directly above the kick), hihat stand
// at the player's far left, snare/kick/floor-tom overlapping into one front
// row with the kick largest and centered.
const PIECE_LAYOUT: Record<DrumPiece, CSSProperties> = {
  crash: { top: '0%', left: '9%', width: '40%' },
  tom_high: { top: '16%', left: '34%', width: '28%' },
  tom_mid: { top: '16%', left: '56%', width: '28%' },
  ride: { top: '0%', left: '73%', width: '40%' },
  hihat: { top: '20%', left: '-4%', width: '28%' },
  snare: { top: '34%', left: '12%', width: '32%' },
  kick: { top: '34%', left: '26%', width: '50%' },
  tom_floor: { top: '34%', left: '55%', width: '38%' },
}

const PIECE_IMAGE_SRC: Record<DrumPiece, string> = {
  kick: '/drum-kit/kick.png',
  snare: '/drum-kit/snare.png',
  hihat: '/drum-kit/hihat.png',
  ride: '/drum-kit/ride.png',
  crash: '/drum-kit/crash.png',
  tom_high: '/drum-kit/tom-high.png',
  tom_mid: '/drum-kit/tom-mid.png',
  tom_floor: '/drum-kit/tom-floor.png',
}

// Pieces with a real "hit" product photo (blue head): swap to it for a
// brief flash instead of the scale animation every other piece uses
// (explicit user request — "the same resolution as the original, used
// instead of moving the image"). Matches .drum-hit's 120ms scale animation
// duration plus a little buffer so the swap doesn't feel cut short.
const HIT_IMAGE_SRC: Partial<Record<DrumPiece, string>> = {
  snare: '/drum-kit/snare-hit.png',
  kick: '/drum-kit/kick-hit.png',
  tom_floor: '/drum-kit/tom-floor-hit.png',
  tom_mid: '/drum-kit/tom-mid-hit.png',
  tom_high: '/drum-kit/tom-high-hit.png',
}
const HIT_FLASH_MS = 150

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
  return <img src={src} alt={PIECE_ALT[piece]} className="w-full drop-shadow-lg" />
}

export function DrumKit({ activeHits }: DrumKitProps) {
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
        // PieceImage's blue-head image swap instead of the scale animation
        // every other piece uses.
        const hasHitImage = HIT_IMAGE_SRC[piece] !== undefined
        const className = `drum-piece${CYMBAL_PIECES.has(piece) ? ' cymbal' : ''}${isActive && !hasHitImage ? ' hit' : ''}`
        return (
          <div
            key={isActive ? token : `${piece}-idle`}
            data-instrument={piece}
            className={className}
            style={{ position: 'absolute', ...PIECE_LAYOUT[piece] }}
          >
            <PieceImage piece={piece} isActive={isActive} />
          </div>
        )
      })}
    </div>
  )
}
