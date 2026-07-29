import type { Exercise, ExerciseCategory, Subdivision } from '../../domain/exercise'

export type ExerciseSeedInput = Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>

interface ExerciseTemplate {
  name: string
  category: ExerciseCategory
  instructions: string
  startBpm: number
  targetBpm: number
  minBpm: number
  maxBpm: number
  durationSeconds: number
  repetitionsTarget: number
  subdivision: Subdivision
  difficulty: 1 | 2 | 3 | 4 | 5
  tags: string[]
}

function toSeedInput(template: ExerciseTemplate): ExerciseSeedInput {
  return { ...template, isArchived: false }
}

// Structural seed only, matching the counts in SPEC.md §24 — generated from
// templates rather than hand-written, since these are placeholder drills.
export function buildExerciseSeed(): ExerciseSeedInput[] {
  const exercises: ExerciseTemplate[] = []

  // תרגילי טכניקה: יד ימין / יד שמאל, 8/4/2/1/3/10 מכות לכל יד.
  const strokeCounts = [8, 4, 2, 1, 3, 10]
  for (const hand of ['יד ימין', 'יד שמאל']) {
    for (const strokes of strokeCounts) {
      exercises.push({
        name: `טכניקה - ${hand} - ${strokes} מכות`,
        category: 'technique',
        instructions: `תרגול טכניקה עם ${hand}, ${strokes} מכות ברצף.`,
        startBpm: 60,
        targetBpm: 100,
        minBpm: 40,
        maxBpm: 160,
        durationSeconds: 60,
        repetitionsTarget: strokes,
        subdivision: 'quarter',
        difficulty: strokes >= 8 ? 3 : 2,
        tags: ['טכניקה', hand],
      })
    }
  }

  // 10 תרגילי קואורדינציה Two Way.
  for (let i = 1; i <= 10; i += 1) {
    exercises.push({
      name: `קואורדינציה Two Way #${i}`,
      category: 'coordination',
      instructions: 'תרגיל קואורדינציה דו-כיווני בין הידיים.',
      startBpm: 60,
      targetBpm: 90,
      minBpm: 40,
      maxBpm: 140,
      durationSeconds: 90,
      repetitionsTarget: 8,
      subdivision: 'eighth',
      difficulty: 2,
      tags: ['קואורדינציה'],
    })
  }

  // 7 תרגילי קריאת רבעים ושמיניות.
  for (let i = 1; i <= 7; i += 1) {
    exercises.push({
      name: `קריאת קצב - רבעים ושמיניות #${i}`,
      category: 'reading',
      instructions: 'קריאת תווים ברבעים ושמיניות.',
      startBpm: 70,
      targetBpm: 100,
      minBpm: 50,
      maxBpm: 140,
      durationSeconds: 90,
      repetitionsTarget: 8,
      subdivision: 'eighth',
      difficulty: 2,
      tags: ['קריאת קצב'],
    })
  }

  // 10 מקצבי שמיניות.
  for (let i = 1; i <= 10; i += 1) {
    exercises.push({
      name: `מקצב שמיניות #${i}`,
      category: 'groove',
      instructions: 'נגינת מקצב שמיניות עם הצ׳ארלסטון, סנר ובאס.',
      startBpm: 80,
      targetBpm: 110,
      minBpm: 50,
      maxBpm: 160,
      durationSeconds: 120,
      repetitionsTarget: 8,
      subdivision: 'eighth',
      difficulty: 3,
      tags: ['מקצב'],
    })
  }

  // 8 מעברים ברבעים ושמיניות.
  for (let i = 1; i <= 8; i += 1) {
    exercises.push({
      name: `מעבר ברבעים ושמיניות #${i}`,
      category: 'fill',
      instructions: 'מעבר קצר ברבעים ושמיניות בין תופי הסט.',
      startBpm: 70,
      targetBpm: 100,
      minBpm: 50,
      maxBpm: 150,
      durationSeconds: 90,
      repetitionsTarget: 8,
      subdivision: 'eighth',
      difficulty: 3,
      tags: ['מעבר'],
    })
  }

  // 10 מעברים עם שש-עשריות.
  for (let i = 1; i <= 10; i += 1) {
    exercises.push({
      name: `מעבר בשש-עשריות #${i}`,
      category: 'fill',
      instructions: 'מעבר עם תבניות שש-עשריות.',
      startBpm: 60,
      targetBpm: 90,
      minBpm: 40,
      maxBpm: 140,
      durationSeconds: 90,
      repetitionsTarget: 8,
      subdivision: 'sixteenth',
      difficulty: 4,
      tags: ['מעבר', 'שש-עשריות'],
    })
  }

  // 8 שילובים של מקצב ומעבר.
  for (let i = 1; i <= 8; i += 1) {
    exercises.push({
      name: `שילוב מקצב ומעבר #${i}`,
      category: 'combo',
      instructions: 'חיבור בין מקצב קבוע למעבר בסוף התבנית.',
      startBpm: 70,
      targetBpm: 100,
      minBpm: 40,
      maxBpm: 150,
      durationSeconds: 120,
      repetitionsTarget: 8,
      subdivision: 'sixteenth',
      difficulty: 4,
      tags: ['שילוב'],
    })
  }

  return exercises.map(toSeedInput)
}
