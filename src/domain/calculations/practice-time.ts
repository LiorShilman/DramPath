import type { PracticeEntry } from '../practice-entry'

// §21: "זמן אימון כולל = סכום PracticeEntry.durationSeconds, ולא הפרש
// גולמי בין פתיחה לסיום." Never derive this from session start/end times.
export function sumDurationSeconds(entries: PracticeEntry[]): number {
  return entries.reduce((total, entry) => total + entry.durationSeconds, 0)
}
