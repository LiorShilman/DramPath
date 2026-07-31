import type { CSSProperties } from 'react'
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
  /** A new hitToken per hit (e.g. crypto.randomUUID()) forces the piece to
   * remount so its CSS hit-animation restarts even on rapid repeated hits
   * of the same instrument — a class toggle alone can't restart an
   * animation that's already applied. */
  activeHit?: { instrument: DrumInstrument; hitToken: string }
}

/** Real product photos (public/drum-kit/) laid out as a kit collage —
 * VISUAL_DRUM_TRAINER_SPEC.md §13's hit-animation contract (data-instrument
 * + .drum-piece/.hit/.cymbal classes) is unchanged from the earlier
 * hand-drawn SVG version, so the CSS in index.css didn't need to change.
 * Key letters are shown in the pinned bottom `KeyboardGuide` bar instead of
 * on the pieces themselves — badges layered on the photos were reported as
 * hurting the kit's look. */
export function DrumKit({ activeHit }: DrumKitProps) {
  const activePiece = activeHit ? INSTRUMENT_TO_PIECE[activeHit.instrument] : undefined

  return (
    <div className="relative aspect-[4/3] w-full">
      {(Object.keys(PIECE_LAYOUT) as DrumPiece[]).map((piece) => {
        const isActive = activePiece === piece
        const className = `drum-piece${CYMBAL_PIECES.has(piece) ? ' cymbal' : ''}${isActive ? ' hit' : ''}`
        return (
          <div
            key={isActive && activeHit ? activeHit.hitToken : `${piece}-idle`}
            data-instrument={piece}
            className={className}
            style={{ position: 'absolute', ...PIECE_LAYOUT[piece] }}
          >
            <img src={PIECE_IMAGE_SRC[piece]} alt={PIECE_ALT[piece]} className="w-full drop-shadow-lg" />
          </div>
        )
      })}
    </div>
  )
}
