import { Link, useNavigate } from 'react-router'
import { useDashboardData } from './useDashboardData'
import { Card, StatTile, buttonClassName } from '../../components/ui'

const REMINDER_THRESHOLD_DAYS = 3
const BACKUP_REMINDER_THRESHOLD_DAYS = 14

function formatMinutes(seconds: number): number {
  return Math.round(seconds / 60)
}

function formatPercent(fraction: number): number {
  return Math.round(fraction * 100)
}

export function Dashboard() {
  const { data } = useDashboardData()
  const navigate = useNavigate()

  if (data.status === 'loading') {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  if (data.status === 'empty') {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <h2 className="text-2xl font-semibold">ברוכים הבאים ל-DrumPath</h2>
        <p className="text-[var(--color-text-muted)]">
          עדיין אין מסלול לימוד טעון. התחילו באשף ההפעלה כדי לטעון נתוני פתיחה.
        </p>
        <Link to="/setup" className={buttonClassName('primary', 'lg')}>
          לאשף ההפעלה
        </Link>
      </div>
    )
  }

  const {
    activeWeek,
    weekCompletion,
    streakDays,
    weeklyPracticeSeconds,
    weeklyGoalMinutes,
    activeExercises,
    latestAchievement,
    daysSinceLastSession,
    daysSinceLastBackup,
  } = data

  // TodayPage's own load() is now the single place that finds-or-creates
  // today's draft session — creating one here too used to mint a brand-new
  // EMPTY draft on every single click regardless of whether one already
  // existed, leaving orphaned drafts behind and (combined with TodayPage
  // picking "most recent draft") repeatedly resurfacing a stale empty plan.
  function handleStartPractice() {
    void navigate('/today')
  }

  return (
    <div className="flex flex-col gap-4">
      {daysSinceLastSession !== undefined && daysSinceLastSession >= REMINDER_THRESHOLD_DAYS && (
        <Card padding="sm" border="warning" className="text-sm">
          לא התאמנת כבר {daysSinceLastSession} ימים — כשתהיה מוכן/ה, אנחנו כאן.
        </Card>
      )}

      {daysSinceLastBackup >= BACKUP_REMINDER_THRESHOLD_DAYS && (
        <Card
          padding="sm"
          border="warning"
          className="flex flex-wrap items-center justify-between gap-2 text-sm"
        >
          <span>לא בוצע גיבוי כבר {daysSinceLastBackup} ימים — הנתונים נשמרים רק במכשיר הזה.</span>
          <Link to="/settings" className="font-semibold text-[var(--color-primary-text)]">
            לגיבוי עכשיו
          </Link>
        </Card>
      )}

      <section className="rounded-[var(--radius-card)] bg-[var(--color-primary)] p-6 text-white [box-shadow:var(--shadow-card)]">
        <h2 className="text-lg font-semibold">האימון הבא</h2>
        <button
          type="button"
          onClick={handleStartPractice}
          className="mt-3 min-h-11 rounded-[var(--radius-card)] bg-white px-4 py-2 font-semibold text-[var(--color-primary)] transition-opacity hover:opacity-90"
        >
          התחל אימון
        </button>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="שבוע נוכחי"
          value={activeWeek ? activeWeek.title : '—'}
          hint={activeWeek ? `${formatPercent(weekCompletion)}% הושלם` : 'אין שבוע פעיל'}
        />
        <StatTile label="רצף" value={`${streakDays} ימים`} />
        <StatTile
          label="זמן אימון השבוע"
          value={`${formatMinutes(weeklyPracticeSeconds)} / ${weeklyGoalMinutes}`}
          hint="דקות"
        />
      </div>

      <Card>
        <h3 className="mb-2 text-sm text-[var(--color-text-muted)]">תרגילים פעילים</h3>
        {activeExercises.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">אין תרגילים פעילים כרגע</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activeExercises.map(({ exercise, currentBpm }) => (
              <li key={exercise.id} className="flex items-center justify-between text-sm">
                <span>{exercise.name}</span>
                <span className="tabular-nums text-[var(--color-text-muted)]">
                  {currentBpm ?? '—'} / {exercise.targetBpm} BPM
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="text-sm text-[var(--color-text-muted)]">הישג אחרון</h3>
        <p className="text-lg">{latestAchievement ? latestAchievement.title : 'עדיין אין הישגים'}</p>
      </Card>
    </div>
  )
}
