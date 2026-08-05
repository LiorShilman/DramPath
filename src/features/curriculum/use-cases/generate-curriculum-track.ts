import { db } from '../../../data/db'
import { lessonRepository, interactiveExerciseRepository } from '../../../data/repositories'
import { generateCurriculumTrack as buildCurriculumTrack } from '../../../lib/visual-trainer/curriculum/generate-curriculum'

export const GENERATED_TRACK_TAG = 'generated-track'

export interface GenerateCurriculumTrackResult {
  lessonIds: string[]
}

export async function hasGeneratedCurriculumTrack(): Promise<boolean> {
  const lessons = await lessonRepository.getAll()
  return lessons.some((lesson) => lesson.tags.includes(GENERATED_TRACK_TAG))
}

// The only write path from the pure generator into Dexie — same
// established pattern as approveDrumImport: every Lesson+InteractiveExercise
// pair lands together in one transaction, all or none. Guards against
// double-generation (the UI is expected to check hasGeneratedCurriculumTrack
// first and offer "reset" instead, but this is the actual safety net).
export async function generateCurriculumTrackUseCase(): Promise<GenerateCurriculumTrackResult> {
  if (await hasGeneratedCurriculumTrack()) {
    throw new Error('Curriculum track already generated — reset it first before regenerating.')
  }

  const items = buildCurriculumTrack()
  const existingLessons = await lessonRepository.getAll()
  const baseOrder = existingLessons.length > 0 ? Math.max(...existingLessons.map((lesson) => lesson.order)) : 0

  return db.transaction('rw', db.lessons, db.lessonExercises, db.interactiveExercises, async () => {
    const lessonIds: string[] = []
    for (const [index, item] of items.entries()) {
      const lesson = await lessonRepository.create({ ...item.lesson, order: baseOrder + index + 1 })
      await interactiveExerciseRepository.create({ ...item.interactiveExercise, lessonId: lesson.id })
      lessonIds.push(lesson.id)
    }
    return { lessonIds }
  })
}
