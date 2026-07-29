import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { runSeedIfNeeded } from '../../data/seed/seed-runner'
import { settingsRepository } from '../../data/repositories'
import { Button, PageHeader } from '../../components/ui'

type SeedStatus = 'idle' | 'loading' | 'done'

export function SetupWizard() {
  const navigate = useNavigate()
  const [seedStatus, setSeedStatus] = useState<SeedStatus>('idle')
  const [weeklyGoalMinutes, setWeeklyGoalMinutes] = useState(150)

  useEffect(() => {
    void settingsRepository.getSettings().then((settings) => {
      setWeeklyGoalMinutes(settings.weeklyGoalMinutes)
    })
  }, [])

  async function handleSeed() {
    setSeedStatus('loading')
    await runSeedIfNeeded()
    setSeedStatus('done')
  }

  async function handleFinish() {
    await settingsRepository.updateSettings({ weeklyGoalMinutes })
    void navigate('/')
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <PageHeader
        title="אשף הפעלה"
        subtitle="נטען את מסלול ה-12 השבועות, השיעורים והתרגילים הראשוניים. תוכלו לערוך הכול בהמשך."
      />

      <p className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text-muted)]">
        בהמשך תוכלו להעלות קובצי PDF ותמונות לספריית הקבצים. יש להעלות רק קבצים שאתם רשאים לשמור
        לשימושכם האישי — המערכת אינה מציעה שיתוף או קישור ציבורי, והקבצים נשמרים במכשיר בלבד.
      </p>

      <Button onClick={() => void handleSeed()} disabled={seedStatus !== 'idle'}>
        {seedStatus === 'done' ? 'נתוני הפתיחה נטענו ✓' : 'טען נתוני התחלה'}
      </Button>

      <label className="flex flex-col gap-1 text-sm">
        יעד דקות אימון שבועי
        <input
          type="number"
          min={1}
          value={weeklyGoalMinutes}
          onChange={(event) => setWeeklyGoalMinutes(Number(event.target.value))}
          className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
        />
      </label>

      <Button variant="secondary" onClick={() => void handleFinish()}>
        סיום
      </Button>
    </div>
  )
}
