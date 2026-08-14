import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { settingsRepository } from '../../data/repositories'
import { subdivisionSchema, type UserSettings } from '../../domain'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { SUBDIVISION_LABELS } from '../exercises/exercise-labels'
import { BackupSection } from './BackupSection'
import { Card, PageHeader } from '../../components/ui'

const settingsFormSchema = z.object({
  defaultBpm: z.coerce.number().int().min(30).max(240),
  subdivision: subdivisionSchema,
  accentFirstBeat: z.boolean(),
  countInBars: z.coerce.number().int().min(0).max(2),
  bpmStep: z.coerce.number().int().positive(),
})
type SettingsFormValues = z.infer<typeof settingsFormSchema>
type SettingsFormInput = z.input<typeof settingsFormSchema>

export function SettingsPage() {
  const loadedSettingsRef = useRef<UserSettings | null>(null)

  const {
    register,
    watch,
    formState: { errors },
  } = useForm<SettingsFormInput>({
    resolver: zodResolver(settingsFormSchema),
    // Async defaultValues (RHF-native) rather than load-then-reset() in an
    // effect: reset() racing a user's in-progress edit would silently
    // clobber it back to the loaded value.
    defaultValues: async () => {
      const settings = await settingsRepository.getSettings()
      loadedSettingsRef.current = settings
      return {
        defaultBpm: settings.metronomeDefaults.bpm,
        subdivision: settings.metronomeDefaults.subdivision,
        accentFirstBeat: settings.metronomeDefaults.accentFirstBeat,
        countInBars: settings.metronomeDefaults.countInBars,
        bpmStep: settings.practiceRules.bpmStep,
      }
    },
  })

  const debouncedSave = useDebouncedCallback(async (values: SettingsFormValues) => {
    const previous = loadedSettingsRef.current
    const updated = await settingsRepository.updateSettings({
      metronomeDefaults: {
        bpm: values.defaultBpm,
        subdivision: values.subdivision,
        accentFirstBeat: values.accentFirstBeat,
        countInBars: values.countInBars,
      },
      practiceRules: {
        ...previous?.practiceRules,
        cleanRepsToMaster: previous?.practiceRules.cleanRepsToMaster ?? 3,
        sessionsToMaster: previous?.practiceRules.sessionsToMaster ?? 2,
        needsWorkStreakForDecrease: previous?.practiceRules.needsWorkStreakForDecrease ?? 2,
        bpmStep: values.bpmStep,
      },
    })
    loadedSettingsRef.current = updated
  }, 500)

  useEffect(() => {
    const subscription = watch((formValues) => {
      const parsed = settingsFormSchema.safeParse(formValues)
      if (parsed.success) debouncedSave(parsed.data)
    })
    return () => subscription.unsubscribe()
  }, [watch, debouncedSave])

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <PageHeader title="הגדרות" />

      <form className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4 [box-shadow:var(--shadow-card)]">
        <h3 className="font-semibold">ברירות מחדל למטרונום</h3>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            BPM התחלתי
            <input
              type="number"
              {...register('defaultBpm')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
            {errors.defaultBpm && (
              <span className="text-sm text-[var(--color-danger-text)]">
                {errors.defaultBpm.message}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            חלוקה
            <select
              {...register('subdivision')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-2"
            >
              {Object.entries(SUBDIVISION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Count-in (תיבות)
            <input
              type="number"
              min={0}
              max={2}
              {...register('countInBars')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            קפיצת BPM להצעות
            <input
              type="number"
              {...register('bpmStep')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('accentFirstBeat')} />
          הדגשת פעימה ראשונה כברירת מחדל
        </label>
      </form>

      <BackupSection />

      <Card>
        <h3 className="font-semibold">ערכת נושא</h3>
        <p className="text-sm text-[var(--color-text-muted)]">בקרוב.</p>
      </Card>

      <Card>
        <h3 className="font-semibold">מודול תופים</h3>
        <p className="mb-2 text-sm text-[var(--color-text-muted)]">רשימת ה-Kit-ים של מודול ה-Z11D.</p>
        <Link to="/settings/module-kits" className="text-sm text-[var(--color-primary-text)] hover:underline">
          מודול תופים — קיטים ←
        </Link>
      </Card>
    </div>
  )
}
