import type { PracticeSession } from '../practice-session'

const MIN_QUALIFYING_SECONDS = 5 * 60

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * §21: "רצף ימים = מספר ימים קלנדריים רצופים עם Session completed של
 * לפחות 5 דקות". This is the *current* streak ending at `referenceDate`
 * (defaults to now): a qualifying session yesterday still counts as an
 * unbroken streak if today hasn't happened yet (grace day), but the streak
 * is 0 once a full day is skipped entirely.
 */
export function calculateStreakDays(
  sessions: PracticeSession[],
  referenceDate: Date = new Date(),
): number {
  const qualifyingDates = new Set(
    sessions
      .filter(
        (session) =>
          session.status === 'completed' &&
          session.actualDurationSeconds >= MIN_QUALIFYING_SECONDS,
      )
      .map((session) => toDateKey(new Date(session.startedAt))),
  )

  const cursor = new Date(referenceDate)
  cursor.setHours(0, 0, 0, 0)

  if (!qualifyingDates.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!qualifyingDates.has(toDateKey(cursor))) {
      return 0
    }
  }

  let streak = 0
  while (qualifyingDates.has(toDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}
