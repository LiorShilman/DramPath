import { describe, expect, it } from 'vitest'
import { generateCurriculumTrack } from './generate-curriculum'
import { interactiveExerciseSchema, lessonSchema, createId, nowIso } from '../../../domain'
import { CURRICULUM_STAGES } from './curriculum-stages'
import { CURRICULUM_PATTERNS } from './pattern-library'

describe('generateCurriculumTrack', () => {
  it('produces one lesson+exercise pair per curated pattern', () => {
    const expectedCount = CURRICULUM_STAGES.reduce(
      (sum, stage) => sum + (CURRICULUM_PATTERNS[stage.order]?.length ?? 0),
      0,
    )
    expect(generateCurriculumTrack()).toHaveLength(expectedCount)
  })

  it('produces InteractiveExercise drafts that satisfy the real schema', () => {
    const now = nowIso()
    for (const item of generateCurriculumTrack()) {
      const candidate = { ...item.interactiveExercise, id: createId(), createdAt: now, updatedAt: now }
      const result = interactiveExerciseSchema.safeParse(candidate)
      expect(result.success).toBe(true)
    }
  })

  it('produces Lesson drafts that satisfy the real schema once order/id/timestamps are filled in', () => {
    const now = nowIso()
    generateCurriculumTrack().forEach((item, index) => {
      const candidate = { ...item.lesson, id: createId(), order: index + 1, createdAt: now, updatedAt: now }
      const result = lessonSchema.safeParse(candidate)
      expect(result.success).toBe(true)
    })
  })

  it('tags every generated lesson with generated-track and leaves it week-less', () => {
    for (const item of generateCurriculumTrack()) {
      expect(item.lesson.tags).toContain('generated-track')
      expect(item.lesson.weekId).toBeUndefined()
      expect(item.lesson.category).toBe('groove')
    }
  })

  it('is deterministic in content (titles, bpm, subdivision, event shape) across calls', () => {
    const first = generateCurriculumTrack()
    const second = generateCurriculumTrack()
    expect(first.map((item) => item.lesson.title)).toEqual(second.map((item) => item.lesson.title))
    expect(first.map((item) => item.interactiveExercise.bpm)).toEqual(
      second.map((item) => item.interactiveExercise.bpm),
    )
    const stripIds = (item: ReturnType<typeof generateCurriculumTrack>[number]) =>
      item.interactiveExercise.events.map((event) => ({
        bar: event.bar,
        beat: event.beat,
        subdivisionIndex: event.subdivisionIndex,
        instrument: event.instrument,
        velocity: event.velocity,
        accent: event.accent,
      }))
    expect(first.map(stripIds)).toEqual(second.map(stripIds))
  })

  it('gives every generated exercise a unique event id', () => {
    for (const item of generateCurriculumTrack()) {
      const ids = item.interactiveExercise.events.map((event) => event.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})
