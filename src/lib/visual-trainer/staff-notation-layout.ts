import type { DrumInstrument } from '../../domain'

export type Notehead = 'normal' | 'x'

export interface StaffPosition {
  // Bottom staff line = 0, each line/space above it = +1 step (line2=2,
  // line3=4 (middle line), line4=6, top line=8; space above top line=9,
  // one step further above=10). Confirmed directly with the user, spot by
  // spot, for every instrument.
  position: number
  notehead: Notehead
  // A short ledger line drawn through the notehead — only crash needs one,
  // to visually separate it from hihat (also above the staff, no ledger).
  ledger?: boolean
}

export const STAFF_POSITION: Record<DrumInstrument, StaffPosition> = {
  kick: { position: 1, notehead: 'normal' }, // bottom space
  tom_floor: { position: 2, notehead: 'normal' }, // 2nd line from bottom
  snare: { position: 6, notehead: 'normal' }, // 2nd line from top
  tom_mid: { position: 7, notehead: 'normal' }, // top space
  tom_high: { position: 8, notehead: 'normal' }, // top line
  ride: { position: 8, notehead: 'x' }, // top line
  hihat_closed: { position: 9, notehead: 'x' }, // above staff, no ledger
  hihat_open: { position: 9, notehead: 'x' }, // above staff, no ledger — same mark as closed
  crash: { position: 10, notehead: 'x', ledger: true }, // above staff, with ledger
}

// Converts a staff position number into a y-offset in pixels, measured
// upward from the bottom staff line — the caller flips this into an SVG
// y-coordinate (SVG y grows downward).
export function staffPositionToOffsetPx(position: number, lineSpacingPx: number): number {
  return position * (lineSpacingPx / 2)
}
