import { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { practiceSessionRepository, practiceEntryRepository, achievementRepository } from '../../data/repositories'
import { calculateStreakDays, sumDurationSeconds } from '../../domain/calculations'
import { groupSessionsByPeriod } from '../journal/group-sessions'
import { Card, PageHeader, StatTile } from '../../components/ui'
import type { Achievement, PracticeEntry, PracticeSession } from '../../domain'

const WEEKS_TO_SHOW = 8

function formatMinutes(seconds: number): number {
  return Math.round(seconds / 60)
}

export function AnalyticsPage() {
  const [sessions, setSessions] = useState<PracticeSession[]>([])
  const [entries, setEntries] = useState<PracticeEntry[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [allSessions, allEntries, allAchievements] = await Promise.all([
        practiceSessionRepository.getAll(),
        practiceEntryRepository.getAll(),
        achievementRepository.getAll(),
      ])
      setSessions(allSessions)
      setEntries(allEntries)
      setAchievements(
        allAchievements.sort((a, b) => b.achievedAt.localeCompare(a.achievedAt)),
      )
      setLoading(false)
    }
    void load()
  }, [])

  const entriesBySessionId = useMemo(() => {
    const map = new Map<string, PracticeEntry[]>()
    for (const entry of entries) {
      const list = map.get(entry.sessionId) ?? []
      list.push(entry)
      map.set(entry.sessionId, list)
    }
    return map
  }, [entries])

  const weeklyChartData = useMemo(() => {
    const groups = groupSessionsByPeriod(
      sessions.filter((session) => session.status === 'completed'),
      'week',
    ).slice(0, WEEKS_TO_SHOW)

    return groups
      .map((group) => {
        const groupEntries = group.sessions.flatMap(
          (session) => entriesBySessionId.get(session.id) ?? [],
        )
        return {
          week: new Date(group.key).toLocaleDateString('he-IL', { month: 'short', day: 'numeric' }),
          minutes: formatMinutes(sumDurationSeconds(groupEntries)),
        }
      })
      .reverse()
  }, [sessions, entriesBySessionId])

  const streakDays = calculateStreakDays(sessions)
  const totalMinutesAllTime = formatMinutes(sumDurationSeconds(entries))
  const completedSessionsCount = sessions.filter((session) => session.status === 'completed').length

  if (loading) {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="ניתוח התקדמות" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="רצף נוכחי" value={`${streakDays} ימים`} />
        <StatTile label="זמן אימון כולל" value={`${totalMinutesAllTime} דק׳`} />
        <StatTile label="אימונים שהושלמו" value={completedSessionsCount} />
      </div>

      <section>
        <h3 className="mb-2 font-semibold">זמן אימון שבועי</h3>
        {weeklyChartData.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">אין עדיין נתוני אימון.</p>
        ) : (
          <Card className="[&_.recharts-cartesian-axis-tick_text]:fill-[var(--color-text-muted)]">
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={weeklyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="minutes" fill="var(--color-primary-text)" name="דקות" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </section>

      <section>
        <h3 className="mb-2 font-semibold">הישגים</h3>
        {achievements.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">עדיין אין הישגים.</p>
        ) : (
          <Card padding="sm">
            <ul className="flex flex-col gap-1 text-sm">
              {achievements.map((achievement) => (
                <li key={achievement.id} className="flex items-center justify-between">
                  <span>{achievement.title}</span>
                  <span className="text-[var(--color-text-muted)]">
                    {new Date(achievement.achievedAt).toLocaleDateString('he-IL')}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  )
}
