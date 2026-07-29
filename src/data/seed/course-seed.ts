import type { LessonCategory } from '../../domain/lesson'
import type { WeekStatus } from '../../domain/week'

// Structural seed only — mirrors the 12-week table in SPEC.md §9. Lesson
// titles are placeholders the user edits; no course content is included.
interface WeekPlanRow {
  weeks: number[]
  lessonRange: [number, number]
  focus: string
  category: LessonCategory | [LessonCategory, LessonCategory]
}

// ADR 0005: §9 groups some weeks together with one combined lesson range
// (e.g. weeks 4-5 share lessons 10-16). Lessons are split as evenly as
// possible across the grouped weeks (front-loaded when uneven), and when a
// row's focus spans two topics the lesson range is split in half between
// the two LessonCategory values.
const WEEK_PLAN: WeekPlanRow[] = [
  { weeks: [1], lessonRange: [1, 4], focus: 'היכרות, אחיזה, ישיבה וטכניקה', category: 'technique' },
  { weeks: [2], lessonRange: [5, 7], focus: 'טכניקה עם מטרונום', category: 'technique' },
  { weeks: [3], lessonRange: [8, 9], focus: 'קואורדינציה בסיסית', category: 'coordination' },
  { weeks: [4, 5], lessonRange: [10, 16], focus: 'קריאה ומקצבי שמיניות', category: ['reading', 'groove'] },
  { weeks: [6, 7], lessonRange: [17, 19], focus: 'מעברים ברבעים ושמיניות', category: 'fill' },
  { weeks: [8, 9, 10], lessonRange: [20, 25], focus: 'שש-עשריות ומעברים', category: 'fill' },
  { weeks: [11, 12], lessonRange: [26, 30], focus: 'חיבור מעברים ושירים', category: ['fill', 'song'] },
]

function splitEvenly(count: number, buckets: number): number[] {
  const base = Math.floor(count / buckets)
  const remainder = count % buckets
  return Array.from({ length: buckets }, (_, i) => base + (i < remainder ? 1 : 0))
}

export interface WeekSeedInput {
  order: number
  title: string
  focus: string
  status: WeekStatus
}

export interface LessonSeedInput {
  order: number
  title: string
  weekOrder: number
  category: LessonCategory
  status: 'not_started'
  resourceIds: string[]
  exerciseIds: string[]
  tags: string[]
}

export function buildWeekSeed(): WeekSeedInput[] {
  return WEEK_PLAN.flatMap((row) =>
    row.weeks.map((weekNumber) => ({
      order: weekNumber,
      title: `שבוע ${weekNumber}`,
      focus: row.focus,
      // Week 1 starts active — a fresh course has to open somewhere
      // (§26: weeks otherwise open manually / after the previous week).
      status: (weekNumber === 1 ? 'active' : 'locked') as WeekStatus,
    })),
  )
}

export function buildLessonSeed(): LessonSeedInput[] {
  const lessons: LessonSeedInput[] = []

  for (const row of WEEK_PLAN) {
    const [start, end] = row.lessonRange
    const totalLessons = end - start + 1
    const counts = splitEvenly(totalLessons, row.weeks.length)

    const categories = Array.isArray(row.category)
      ? row.category
      : [row.category, row.category]
    const categoryCounts = splitEvenly(totalLessons, categories.length)

    let lessonNumber = start
    let categoryIndex = 0
    let remainingInCategory = categoryCounts[0] ?? totalLessons

    row.weeks.forEach((weekNumber, weekIndex) => {
      const countForWeek = counts[weekIndex] ?? 0
      for (let i = 0; i < countForWeek; i += 1) {
        while (remainingInCategory === 0 && categoryIndex < categories.length - 1) {
          categoryIndex += 1
          remainingInCategory = categoryCounts[categoryIndex] ?? 0
        }
        const category = categories[categoryIndex] ?? categories[0]

        lessons.push({
          order: lessonNumber,
          title: `שיעור ${lessonNumber} — ${row.focus}`,
          weekOrder: weekNumber,
          category: category as LessonCategory,
          status: 'not_started',
          resourceIds: [],
          exerciseIds: [],
          tags: [category as LessonCategory],
        })

        lessonNumber += 1
        remainingInCategory -= 1
      }
    })
  }

  return lessons
}
