import type { PracticeEntry } from '../practice-entry'

/**
 * §13 BPM algorithm step 1: "התחלה ב-BPM האחרון שהוגדר כנקי" — the most
 * recent `clean` entry's bpm for the given exercise, or undefined if the
 * exercise has never been marked clean.
 */
export function getLatestCleanBpm(
  entries: PracticeEntry[],
  exerciseId: string,
): number | undefined {
  const cleanEntries = entries
    .filter(
      (entry) =>
        entry.exerciseId === exerciseId &&
        entry.result === 'clean' &&
        entry.bpm !== undefined,
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))

  return cleanEntries[0]?.bpm
}
