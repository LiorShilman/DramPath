import type { Subdivision } from '../domain'

export type Hand = 'R' | 'L'

// The hand-independence progression from the course: quarters are a single
// right-hand pulse per beat; eighths keep both subdivisions on the right
// hand; sixteenths alternate hands to fill in the extra subdivisions
// (R L R L). Indexed by subdivisionIndexInBeat (0-based, same convention as
// DrumNoteEvent.subdivisionIndex elsewhere in the domain).
export const STICKING_PATTERNS: Record<Subdivision, Hand[]> = {
  quarter: ['R'],
  eighth: ['R', 'R'],
  sixteenth: ['R', 'L', 'R', 'L'],
}

export function handForSubTick(subdivision: Subdivision, subdivisionIndexInBeat: number): Hand {
  const pattern = STICKING_PATTERNS[subdivision]
  return pattern[subdivisionIndexInBeat % pattern.length]!
}
