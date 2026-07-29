import { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  practiceSessionRepository,
  practiceEntryRepository,
  exerciseRepository,
  achievementRepository,
} from '../../data/repositories'
import {
  calculateStreakDays,
  sumDurationSeconds,
  sumDurationSecondsByCategory,
  getExercisesNotPracticedRecently,
  calculateExerciseMastery,
  type ExerciseMastery,
} from '../../domain/calculations'
import { groupSessionsByPeriod } from '../journal/group-sessions'
import { EXERCISE_CATEGORY_LABELS } from '../exercises/exercise-labels'
import { Card, PageHeader, StatTile } from '../../components/ui'
import type { Achievement, Exercise, PracticeEntry, PracticeSession } from '../../domain'

const STALE_THRESHOLD_DAYS = 14
const WEEKS_TO_SHOW = 8

const MASTERY_LABELS: Record<ExerciseMastery, string> = {
  new: 'חדש',
  learning: 'בלמידה',
  stable: 'יציב',
  mastered: 'נשלט',
}

function formatMinutes(seconds: number): number {
  return Math.round(seconds / 60)
}

export function AnalyticsPage() {
  const [sessions, setSessions] = useState<PracticeSession[]>([])
  const [entries, setEntries] = useState<PracticeEntry[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [allSessions, allEntries, allExercises, allAchievements] = await Promise.all([
        practiceSessionRepository.getAll(),
        practiceEntryRepository.getAll(),
        exerciseRepository.getAll(),
        achievementRepository.getAll(),
      ])
      setSessions(allSessions)
      setEntries(allEntries)
      setExercises(allExercises.sort((a, b) => a.name.localeCompare(b.name)))
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

  const categoryTotals = useMemo(
    () => sumDurationSecondsByCategory(entries, exercises),
    [entries, exercises],
  )

  const staleExercises = useMemo(
    () => getExercisesNotPracticedRecently(exercises, entries, STALE_THRESHOLD_DAYS),
    [exercises, entries],
  )

  const bpmChartData = useMemo(() => {
    if (!selectedExerciseId) return []
    return entries
      .filter(
        (entry) =>
          entry.exerciseId === selectedExerciseId && entry.result === 'clean' && entry.bpm !== undefined,
      )
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      .map((entry) => ({
        date: new Date(entry.startedAt).toLocaleDateString('he-IL', { month: 'short', day: 'numeric' }),
        bpm: entry.bpm,
      }))
  }, [entries, selectedExerciseId])

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
        <h3 className="mb-2 font-semibold">התקדמות BPM לפי תרגיל</h3>
        <select
          aria-label="בחירת תרגיל להתקדמות BPM"
          value={selectedExerciseId}
          onChange={(event) => setSelectedExerciseId(event.target.value)}
          className="mb-2 rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1.5 text-sm"
        >
          <option value="">בחרו תרגיל...</option>
          {exercises.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name} ({MASTERY_LABELS[calculateExerciseMastery(entries, exercise)]})
            </option>
          ))}
        </select>
        {selectedExerciseId && bpmChartData.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)]">אין עדיין רשומות נקיות לתרגיל זה.</p>
        )}
        {bpmChartData.length > 0 && (
          <Card>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={bpmChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="bpm" stroke="var(--color-primary-text)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </section>

      <section>
        <h3 className="mb-2 font-semibold">זמן לפי קטגוריה</h3>
        <Card padding="sm">
          <ul className="flex flex-col gap-1 text-sm">
            {Object.entries(categoryTotals)
              .filter(([, seconds]) => seconds > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([category, seconds]) => (
                <li key={category} className="flex items-center justify-between">
                  <span>
                    {EXERCISE_CATEGORY_LABELS[category as keyof typeof EXERCISE_CATEGORY_LABELS]}
                  </span>
                  <span className="tabular-nums text-[var(--color-text-muted)]">
                    {formatMinutes(seconds)} דק׳
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      </section>

      <section>
        <h3 className="mb-2 font-semibold">תרגילים שלא תורגלו לאחרונה</h3>
        {staleExercises.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">כל התרגילים תורגלו לאחרונה.</p>
        ) : (
          <Card padding="sm">
            <ul className="flex flex-col gap-1 text-sm">
              {staleExercises.slice(0, 10).map(({ exercise, lastPracticedAt }) => (
                <li key={exercise.id} className="flex items-center justify-between">
                  <span>{exercise.name}</span>
                  <span className="text-[var(--color-text-muted)]">
                    {lastPracticedAt
                      ? new Date(lastPracticedAt).toLocaleDateString('he-IL')
                      : 'מעולם לא תורגל'}
                  </span>
                </li>
              ))}
            </ul>
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
