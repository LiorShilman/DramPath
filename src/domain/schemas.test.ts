import { describe, expect, it } from 'vitest'
import { createId, nowIso } from './shared'
import { coursePlanSchema } from './course-plan'
import { weekSchema } from './week'
import { lessonSchema } from './lesson'
import { exerciseSchema } from './exercise'
import { songSchema } from './song'
import { resourceSchema } from './resource'
import { practiceSessionSchema } from './practice-session'
import { practiceEntrySchema } from './practice-entry'
import { userSettingsSchema, defaultUserSettings } from './user-settings'
import { achievementSchema } from './achievement'

const now = nowIso()

describe('domain schemas', () => {
  it('accepts a valid CoursePlan and rejects a missing name', () => {
    const valid = { id: createId(), name: 'תוכנית', isActive: true, createdAt: now, updatedAt: now }
    expect(coursePlanSchema.safeParse(valid).success).toBe(true)
    expect(coursePlanSchema.safeParse({ ...valid, name: '' }).success).toBe(false)
  })

  it('accepts a valid Week and rejects a bad status', () => {
    const valid = {
      id: createId(),
      coursePlanId: createId(),
      order: 1,
      title: 'שבוע 1',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }
    expect(weekSchema.safeParse(valid).success).toBe(true)
    expect(weekSchema.safeParse({ ...valid, status: 'unknown' }).success).toBe(false)
  })

  it('accepts a valid Lesson and rejects a bad category', () => {
    const valid = {
      id: createId(),
      order: 1,
      title: 'שיעור 1',
      category: 'technique',
      resourceIds: [],
      exerciseIds: [],
      tags: [],
      status: 'not_started',
      createdAt: now,
      updatedAt: now,
    }
    expect(lessonSchema.safeParse(valid).success).toBe(true)
    expect(lessonSchema.safeParse({ ...valid, category: 'invalid' }).success).toBe(false)
    // coverImageResourceId is optional (a record without it is still valid —
    // matters because Lessons persisted before this field existed shouldn't
    // suddenly become invalid) but must be a real UUID when present.
    expect(
      lessonSchema.safeParse({ ...valid, coverImageResourceId: createId() }).success,
    ).toBe(true)
    expect(
      lessonSchema.safeParse({ ...valid, coverImageResourceId: 'not-a-uuid' }).success,
    ).toBe(false)
  })

  it('accepts a valid Exercise and rejects minBpm > maxBpm', () => {
    const valid = {
      id: createId(),
      name: 'תרגיל',
      category: 'technique',
      instructions: 'הוראות',
      startBpm: 60,
      targetBpm: 100,
      minBpm: 40,
      maxBpm: 160,
      durationSeconds: 60,
      repetitionsTarget: 8,
      subdivision: 'quarter',
      difficulty: 3,
      tags: [],
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    }
    expect(exerciseSchema.safeParse(valid).success).toBe(true)
    expect(exerciseSchema.safeParse({ ...valid, minBpm: 200 }).success).toBe(false)
  })

  it('accepts a valid Song and rejects a bad status', () => {
    const valid = {
      id: createId(),
      title: 'שיר',
      exerciseIds: [],
      sections: [],
      status: 'new',
      createdAt: now,
      updatedAt: now,
    }
    expect(songSchema.safeParse(valid).success).toBe(true)
    expect(songSchema.safeParse({ ...valid, status: 'unknown' }).success).toBe(false)
  })

  it('accepts a valid Resource and rejects a non-Blob value', () => {
    const valid = {
      id: createId(),
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
      checksum: 'abc',
      blob: new Blob(['x']),
      tags: [],
      createdAt: now,
    }
    expect(resourceSchema.safeParse(valid).success).toBe(true)
    expect(resourceSchema.safeParse({ ...valid, blob: 'not-a-blob' }).success).toBe(false)
  })

  it('accepts a link-sourceType Resource with a fileHandle instead of a blob', () => {
    const fakeHandle = { kind: 'file', name: 'video.mp4', getFile: async () => new File([], 'video.mp4') }
    const linked = {
      id: createId(),
      fileName: 'video.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 300_000_000,
      sourceType: 'link' as const,
      fileHandle: fakeHandle,
      tags: [],
      createdAt: now,
    }
    expect(resourceSchema.safeParse(linked).success).toBe(true)
    // link without a fileHandle, or blob without an actual blob, must fail.
    expect(resourceSchema.safeParse({ ...linked, fileHandle: undefined }).success).toBe(false)
    expect(
      resourceSchema.safeParse({ ...linked, sourceType: 'blob', blob: undefined }).success,
    ).toBe(false)
  })

  it('accepts a valid PracticeSession and rejects a bad status', () => {
    const valid = {
      id: createId(),
      startedAt: now,
      status: 'draft',
      plannedDurationMinutes: 20,
      actualDurationSeconds: 0,
      plannedExerciseIds: [],
      currentExerciseIndex: 0,
      createdAt: now,
      updatedAt: now,
    }
    expect(practiceSessionSchema.safeParse(valid).success).toBe(true)
    expect(practiceSessionSchema.safeParse({ ...valid, status: 'unknown' }).success).toBe(false)
  })

  it('accepts a valid PracticeEntry and rejects a bad result', () => {
    const valid = {
      id: createId(),
      sessionId: createId(),
      exerciseId: createId(),
      startedAt: now,
      durationSeconds: 30,
      cleanRepetitions: 3,
      result: 'clean',
    }
    expect(practiceEntrySchema.safeParse(valid).success).toBe(true)
    expect(practiceEntrySchema.safeParse({ ...valid, result: 'unknown' }).success).toBe(false)
  })

  it('accepts default UserSettings and rejects a wrong key literal', () => {
    const valid = { ...defaultUserSettings, updatedAt: now }
    expect(userSettingsSchema.safeParse(valid).success).toBe(true)
    expect(userSettingsSchema.safeParse({ ...valid, key: 'wrong' }).success).toBe(false)
  })

  it('accepts a valid Achievement and rejects a bad type', () => {
    const valid = { id: createId(), type: 'streak', title: 'רצף 7 ימים', achievedAt: now }
    expect(achievementSchema.safeParse(valid).success).toBe(true)
    expect(achievementSchema.safeParse({ ...valid, type: 'unknown' }).success).toBe(false)
  })
})
