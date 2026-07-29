import { db } from '../db'
import { exerciseSchema, type Exercise } from '../../domain'
import { createTimestampedRepository } from './base-repository'
import { lessonRepository } from './lesson-repository'
import { songRepository } from './song-repository'

const base = createTimestampedRepository<Exercise>(db.exercises, exerciseSchema)

export const exerciseRepository = {
  ...base,
  // Mirrors ADR 0003: deleting an exercise must also drop it from every
  // Lesson.exerciseIds that references it — lessonRepository.patch already
  // re-syncs the lessonExercises join table whenever exerciseIds changes,
  // so routing the cleanup through it keeps both in sync for free. Also
  // drops it from any Song.exerciseIds (no join table there — see the same
  // full-scan reasoning as resourceRepository.removeAndUnlink).
  async removeAndUnlink(id: string): Promise<void> {
    await db.transaction(
      'rw',
      db.exercises,
      db.lessons,
      db.lessonExercises,
      db.songs,
      async () => {
        const links = await db.lessonExercises.where('exerciseId').equals(id).toArray()

        for (const link of links) {
          const lesson = await db.lessons.get(link.lessonId)
          if (lesson) {
            await lessonRepository.patch(lesson.id, {
              exerciseIds: lesson.exerciseIds.filter((exerciseId) => exerciseId !== id),
            })
          }
        }

        const songs = await db.songs.toArray()
        for (const song of songs) {
          if (song.exerciseIds.includes(id)) {
            await songRepository.patch(song.id, {
              exerciseIds: song.exerciseIds.filter((exerciseId) => exerciseId !== id),
            })
          }
        }

        await base.remove(id)
      },
    )
  },
}
