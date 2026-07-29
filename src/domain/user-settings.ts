import { z } from 'zod'
import { isoDateTimeSchema } from './shared'
import { subdivisionSchema } from './exercise'

export const themeSchema = z.enum(['light', 'dark', 'system'])
export type Theme = z.infer<typeof themeSchema>

export const metronomeDefaultsSchema = z.object({
  bpm: z.number().int().min(30).max(240),
  subdivision: subdivisionSchema,
  accentFirstBeat: z.boolean(),
  countInBars: z.number().int().min(0).max(2),
})
export type MetronomeDefaults = z.infer<typeof metronomeDefaultsSchema>

export const practiceRulesSchema = z.object({
  cleanRepsToMaster: z.number().int().positive(),
  sessionsToMaster: z.number().int().positive(),
  bpmStep: z.number().int().positive(),
  needsWorkStreakForDecrease: z.number().int().positive(),
})
export type PracticeRules = z.infer<typeof practiceRulesSchema>

// ADR 0004: singleton row in the generic `settings` key-value store.
export const userSettingsSchema = z.object({
  key: z.literal('user-settings'),
  theme: themeSchema,
  metronomeDefaults: metronomeDefaultsSchema,
  practiceRules: practiceRulesSchema,
  inactivityTimeoutSeconds: z.number().int().positive(),
  maxResourceFileSizeMB: z.number().int().positive(),
  weeklyGoalMinutes: z.number().int().positive(),
  // §29: "תזכורת לגיבוי לאחר 14 יום ללא ייצוא" — stamped on every
  // successful backup export; undefined means never exported yet.
  lastBackupExportAt: isoDateTimeSchema.optional(),
  updatedAt: isoDateTimeSchema,
})

export type UserSettings = z.infer<typeof userSettingsSchema>

export const defaultUserSettings: Omit<UserSettings, 'updatedAt'> = {
  key: 'user-settings',
  theme: 'system',
  metronomeDefaults: {
    bpm: 80,
    subdivision: 'quarter',
    accentFirstBeat: true,
    countInBars: 1,
  },
  practiceRules: {
    cleanRepsToMaster: 3,
    sessionsToMaster: 2,
    bpmStep: 5,
    needsWorkStreakForDecrease: 2,
  },
  inactivityTimeoutSeconds: 120,
  maxResourceFileSizeMB: 25,
  weeklyGoalMinutes: 150,
}
