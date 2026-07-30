// Note Highway presentation math: maps a note's absolute time to a 0..1+
// progress value along the highway (0 = just appearing, 1 = exactly at the
// hit line). Pure and framework-free so it's fully unit-testable — the
// component itself only ever calls this from an imperative rAF loop.

const APPEAR_EARLY_MARGIN = 0.05
const LINGER_PAST_HIT_LINE = 0.3

export function calculateNoteProgress(eventTimeMs: number, currentTimeMs: number, lookaheadMs: number): number {
  return 1 - (eventTimeMs - currentTimeMs) / lookaheadMs
}

// A note is visible slightly before it's technically "reachable" (so it
// doesn't pop into existence right at the top edge) and lingers briefly
// past the hit line so a Miss is visible for a moment before disappearing.
export function isNoteVisible(progress: number): boolean {
  return progress >= -APPEAR_EARLY_MARGIN && progress <= 1 + LINGER_PAST_HIT_LINE
}
