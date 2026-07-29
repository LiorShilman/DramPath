import type { PracticeSession } from '../../domain'

export type JournalGrouping = 'day' | 'week' | 'month'

export interface SessionGroup {
  key: string
  sessions: PracticeSession[]
}

// Local calendar terms throughout — no toISOString() round-trip, which
// would silently reclassify a late-evening session into the UTC "next day"
// for users west of UTC.
function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfWeekKey(date: Date): string {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay())
  return dayKey(start)
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

/** §18: day/week/month journal views — buckets sessions, newest group first. */
export function groupSessionsByPeriod(
  sessions: PracticeSession[],
  grouping: JournalGrouping,
): SessionGroup[] {
  const groups = new Map<string, PracticeSession[]>()

  for (const session of sessions) {
    const date = new Date(session.startedAt)
    const key =
      grouping === 'day' ? dayKey(date) : grouping === 'week' ? startOfWeekKey(date) : monthKey(date)

    const group = groups.get(key) ?? []
    group.push(session)
    groups.set(key, group)
  }

  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, groupSessions]) => ({
      key,
      sessions: [...groupSessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    }))
}
