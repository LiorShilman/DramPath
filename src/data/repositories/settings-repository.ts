import { db } from '../db'
import {
  userSettingsSchema,
  defaultUserSettings,
  nowIso,
  type UserSettings,
} from '../../domain'

export const settingsRepository = {
  async getSettings(): Promise<UserSettings> {
    const existing = await db.settings.get('user-settings')
    if (existing) return existing
    return userSettingsSchema.parse({
      ...defaultUserSettings,
      updatedAt: nowIso(),
    })
  },
  async updateSettings(
    patch: Partial<Omit<UserSettings, 'key' | 'updatedAt'>>,
  ): Promise<UserSettings> {
    const current = await settingsRepository.getSettings()
    const updated = userSettingsSchema.parse({
      ...current,
      ...patch,
      updatedAt: nowIso(),
    })
    await db.settings.put(updated)
    return updated
  },
}
