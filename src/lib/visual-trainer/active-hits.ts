import type { DrumInstrument } from '../../domain'

/**
 * Marks `instrument` as freshly hit with a new token, moving its key to the
 * *end* of the object's own iteration order — a plain `{ ...prev,
 * [instrument]: token }` update leaves an already-present key exactly
 * where it was first inserted, since JS only appends a key at the end the
 * first time it's ever set.
 *
 * This matters because DrumKit's own piece-token resolution
 * (INSTRUMENT_TO_PIECE) walks activeHits in this same iteration order and
 * lets the last-seen entry win whenever two different instruments share
 * one visual piece (hihat_open/hihat_closed both draw the one hihat piece)
 * — without this fix, whichever of the two instruments was hit for the
 * very first time *later* in the session permanently keeps its key
 * positioned last, and "wins" DrumKit's glow forever afterward regardless
 * of which one is actually being hit right now (reported directly: open
 * hi-hat stopped visually glowing at all once closed had been hit even
 * once after it).
 */
export function markHit(
  prev: Partial<Record<DrumInstrument, string>>,
  instrument: DrumInstrument,
  token: string,
): Partial<Record<DrumInstrument, string>> {
  const next = { ...prev }
  delete next[instrument]
  next[instrument] = token
  return next
}
