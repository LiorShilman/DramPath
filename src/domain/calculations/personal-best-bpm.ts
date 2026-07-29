import type { PracticeEntry } from '../practice-entry'

/**
 * §21: "שיא BPM = BPM הגבוה ביותר שסומן clean" — the highest-ever clean
 * BPM, not the most recent one (that's Stage 2's getLatestCleanBpm).
 */
export function getPersonalBestBpm(
  entries: PracticeEntry[],
  exerciseId: string,
): number | undefined {
  const cleanBpms = entries
    .filter((entry) => entry.exerciseId === exerciseId && entry.result === 'clean')
    .map((entry) => entry.bpm)
    .filter((bpm): bpm is number => bpm !== undefined)

  return cleanBpms.length > 0 ? Math.max(...cleanBpms) : undefined
}
