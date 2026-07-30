import type { ReactNode } from 'react'
import type { DrumInstrument } from '../../domain'

// 9 instruments share 8 visual pieces — hihat_closed/hihat_open are the
// same physical hi-hat, per VISUAL_DRUM_TRAINER_SPEC.md §13's own 8-layer
// SVG list (Bass, Snare, High/Mid/Floor Tom, Hi-Hat, Ride, Crash).
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

const CYMBAL_PIECES: ReadonlySet<DrumPiece> = new Set(['ride', 'crash'])

export interface DrumKitSvgProps {
  /** A new hitToken per hit (e.g. crypto.randomUUID()) forces the piece to
   * remount so its CSS hit-animation restarts even on rapid repeated hits
   * of the same instrument — a class toggle alone can't restart an
   * animation that's already applied. */
  activeHit?: { instrument: DrumInstrument; hitToken: string }
}

interface PieceProps {
  piece: DrumPiece
  isActive: boolean
  hitToken: string | undefined
  children: ReactNode
}

function Piece({ piece, isActive, hitToken, children }: PieceProps) {
  const className = `drum-piece${CYMBAL_PIECES.has(piece) ? ' cymbal' : ''}${isActive ? ' hit' : ''}`
  return (
    <g key={isActive && hitToken ? hitToken : `${piece}-idle`} data-instrument={piece} className={className}>
      {children}
    </g>
  )
}

/** Stylized, hand-drawn SVG drum kit — VISUAL_DRUM_TRAINER_SPEC.md §13. */
export function DrumKitSvg({ activeHit }: DrumKitSvgProps) {
  const activePiece = activeHit ? INSTRUMENT_TO_PIECE[activeHit.instrument] : undefined

  function isActive(piece: DrumPiece): boolean {
    return activePiece === piece
  }

  return (
    <svg viewBox="0 0 400 260" role="img" aria-label="ערכת תופים" className="h-full w-full">
      <Piece piece="crash" isActive={isActive('crash')} hitToken={activeHit?.hitToken}>
        <ellipse cx={70} cy={50} rx={55} ry={12} fill="#a78bfa" />
      </Piece>
      <Piece piece="ride" isActive={isActive('ride')} hitToken={activeHit?.hitToken}>
        <ellipse cx={330} cy={55} rx={60} ry={13} fill="#38bdf8" />
      </Piece>
      <Piece piece="hihat" isActive={isActive('hihat')} hitToken={activeHit?.hitToken}>
        <ellipse cx={90} cy={110} rx={40} ry={10} fill="#facc15" />
        <ellipse cx={90} cy={102} rx={40} ry={10} fill="#fde047" />
      </Piece>
      <Piece piece="tom_high" isActive={isActive('tom_high')} hitToken={activeHit?.hitToken}>
        <circle cx={175} cy={90} r={30} fill="#34d399" />
      </Piece>
      <Piece piece="tom_mid" isActive={isActive('tom_mid')} hitToken={activeHit?.hitToken}>
        <circle cx={250} cy={95} r={32} fill="#22c55e" />
      </Piece>
      <Piece piece="snare" isActive={isActive('snare')} hitToken={activeHit?.hitToken}>
        <circle cx={175} cy={175} r={34} fill="#f59e0b" />
      </Piece>
      <Piece piece="tom_floor" isActive={isActive('tom_floor')} hitToken={activeHit?.hitToken}>
        <circle cx={300} cy={185} r={38} fill="#16a34a" />
      </Piece>
      <Piece piece="kick" isActive={isActive('kick')} hitToken={activeHit?.hitToken}>
        <circle cx={225} cy={215} r={45} fill="#e11d48" />
      </Piece>
    </svg>
  )
}
