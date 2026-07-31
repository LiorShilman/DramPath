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
  // The user's own vocabulary uses "שורה" (line) to mean a *space* between
  // staff lines, not a line itself — confirmed explicitly ("שורה זה רווח")
  // after a round of live corrections. Every position below is re-derived
  // from that: "שורה X" = the Xth space, "קו" = an actual line.
  kick: { position: 1, notehead: 'normal' }, // bottom space
  tom_floor: { position: 3, notehead: 'normal' }, // 2nd space from bottom
  snare: { position: 5, notehead: 'normal' }, // 2nd space from top
  tom_mid: { position: 6, notehead: 'normal' }, // between the top space and the 2nd space from top -> the line between them
  tom_high: { position: 7, notehead: 'normal' }, // top space
  ride: { position: 8, notehead: 'x' }, // top line (explicitly "קו עליון", a real line)
  hihat_closed: { position: 9, notehead: 'x' }, // above staff, no ledger
  hihat_open: { position: 9, notehead: 'x' }, // above staff, no ledger — same mark as closed
  crash: { position: 9, notehead: 'x', ledger: true }, // same height as hihat — the ledger line is the only distinguishing mark
}

// Converts a staff position number into a y-offset in pixels, measured
// upward from the bottom staff line — the caller flips this into an SVG
// y-coordinate (SVG y grows downward).
export function staffPositionToOffsetPx(position: number, lineSpacingPx: number): number {
  return position * (lineSpacingPx / 2)
}
