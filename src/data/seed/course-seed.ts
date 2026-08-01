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

// The real course curriculum (eggrolldrums.com "ללמוד תופים מהבית"), keyed
// by lesson number — used in place of the auto-generated placeholder title,
// and as the only source of Lesson.description. Source data has its own
// 5-section grouping that doesn't map onto WEEK_PLAN's 12-week structure;
// only the flattened title/description per lesson number is used here.
const LESSON_CONTENT: Record<number, { title: string; description: string }> = {
  1: {
    title: 'מתחילים ממש בהתחלה',
    description: 'הכרת מערכת התופים: שמות התופים והמצילות, מה מיוחד בסנר, ההבדל בין מצילות שונות ועוד.',
  },
  2: {
    title: 'סידור ומיקום מערכת התופים',
    description: 'איך לסדר ולמקם את מערכת התופים כך שתהיה נוחה ויעילה: גובה הכיסא, מיקום הסנר, היי־האט, טמטמים ומצילות.',
  },
  3: {
    title: 'טכניקה בידיים',
    description: 'אחיזה נכונה של המקלות, נקודת משען, תנועת המקל ופיתוח טכניקה מומלצת לנגינה.',
  },
  4: {
    title: 'תרגול טכניקת ידיים על פד',
    description: 'תרגילי טכניקה על פד אימונים, כולל קובץ תווים מצורף לתרגול.',
  },
  5: {
    title: 'טכניקה ברגל על פדל הבס',
    description: 'שתי שיטות לנגינה מהירה, נוחה ויעילה על תוף הבס, לשיפור שליטה וקצב ברגל.',
  },
  6: {
    title: 'מושגי יסוד בקצב',
    description: 'הגדרה והסבר של קצב, מקצב, תיבה ורבע, והקשר ביניהם לנגינה על תופים.',
  },
  7: {
    title: 'לימוד וקריאת תווים לתופים',
    description: 'היכרות עם כתיבת תווים לתופים וקריאתם, כדי להבין טוב יותר את הנגינה ולא להסתמך רק על זיכרון.',
  },
  8: {
    title: 'היכרות עם המטרונום',
    description: 'שימוש במטרונום לשמירת קצב ומהירות קבועים, ותרגול נגינה איתו.',
  },
  9: {
    title: 'תרגילי קואורדינציה לגפיים',
    description: 'תרגילי קואורדינציה לשתי הידיים ושתי הרגליים, כולל קובץ תווים לתרגול.',
  },
  10: {
    title: 'מקצב פשוט המבוסס על רבעים',
    description: 'לימוד מקצב בסיסי שבו כל גפה מנגנת תפקיד נפרד, עם חלוקה לרבעים.',
  },
  11: {
    title: 'היכרות עם תווי שמיניות',
    description: 'הרחבת הידע מתווי רבעים לשמיניות ותרגול חיבור ביניהם, כולל קובץ תווים.',
  },
  12: {
    title: 'שמיניות בתוך מקצבים',
    description: 'שילוב תווי שמיניות בתוך מקצבים וקריאה שלהם כפי שנכתבים בדרך כלל.',
  },
  13: {
    title: 'תרגול מקצבים במהירות מאוד נמוכה',
    description: 'תרגול 10 מקצבים שונים במהירות נמוכה, עם קובץ תווים של כל המקצבים.',
  },
  14: {
    title: 'תרגול מקצבים במהירות נמוכה כפולה',
    description: 'אותם מקצבים כמו בשיעור הקודם, אך במהירות נמוכה כפולה, לשיפור יציבות ושליטה.',
  },
  15: {
    title: 'תרגול מקצבים במהירות בינונית',
    description: 'תרגול המקצבים במהירות בינונית שבה הם כבר נשמעים כמו חלק משיר; מומלץ לחזור על כל מקצב פעמים רבות.',
  },
  16: {
    title: 'תרגול מקצבים במהירות גבוהה',
    description: 'תרגול המקצבים במהירות גבוהה, תוך הקפדה על דיוק וחזרה על כל מקצב 16 פעמים; אם קשה – לחזור למהירות נמוכה יותר.',
  },
  17: {
    title: 'היכרות עם מעברי תופים',
    description: 'הסבר מהו מעבר תופים, מבוסס מעבר מהסנר לטמטמים והבנת הרעיון מאחורי מעברים.',
  },
  18: {
    title: 'מעברים מרבעים ושמיניות – מהירות נמוכה',
    description: 'תרגול מעברים בנויים מרבעים ושמיניות במהירות נמוכה, עם דגש על תנועה חלקה ופגיעה במרכז התוף.',
  },
  19: {
    title: 'מעברים מרבעים ושמיניות – מהירות גבוהה יותר',
    description: 'אותם מעברים כמו בשיעור הקודם, אך במהירות גבוהה יותר, תוך שמירה על נגינה מדויקת.',
  },
  20: {
    title: 'היכרות עם תווי שש־עשריות',
    description: 'הסבר על תווי שש־עשריות ושילובם בתוך המעברים, להרחבת אפשרויות החלוקה הקצבית.',
  },
  21: {
    title: 'מעברים עם רבעים, שמיניות ושש־עשריות – מהירות נמוכה',
    description: 'תרגול מעברים המכילים רבעים, שמיניות ושש־עשריות במהירות נמוכה, להבנת המעבר בין חלוקות שונות.',
  },
  22: {
    title: 'מעברים מהירים עם שש־עשריות',
    description: 'תרגול מעברים במהירות גבוהה יותר, עם הקפדה על ארבע מכות בכל שש־עשרית ופגיעה במרכז התוף.',
  },
  23: {
    title: 'מעברים במהירות גבוהה',
    description: 'תרגול מעברים במהירות גבוהה מאוד, כולל המלצה לחזור למהירויות נמוכות אם הנגינה נשמעת מבולגנת.',
  },
  24: {
    title: 'חיבור מעברים למקצבים',
    description: 'תרגול חיבור מעברים למקצבים, כולל מעבר משולב של רבעים, שמיניות ושש־עשריות.',
  },
  25: {
    title: 'חיבור מעברים למקצב עם מצילת קראש',
    description: 'הוספת מצילת קראש למעבר, הבנת מיקום המעבר בשיר וסימון תיבות שחוזרות על עצמן.',
  },
  26: {
    title: 'תרגול מקצבים ומעברים – מהירות נמוכה',
    description: 'תרגול מקצבים ומעברים יחד במהירות נמוכה, כולל קובץ תווים של כל המעברים.',
  },
  27: {
    title: 'תרגול מקצבים ומעברים – מהירות גבוהה יותר',
    description: 'תרגול אותם מקצבים ומעברים במהירות גבוהה יותר, עם דגש על יציאה נקייה למעבר וחזרה חלקה למקצב.',
  },
  28: {
    title: 'תרגול במהירות מאתגרת',
    description: 'תרגול מקצבים ומעברים במהירות עוד יותר גבוהה, עם הקפדה על פגיעה במרכז התופים ונגינה קלה ומשוחררת.',
  },
  29: {
    title: 'איך לתרגל תופים בלי מערכת',
    description: 'דרכים לתרגל קואורדינציה, קריאת תווים, טכניקה ואפילו נגינת מקצבים גם בלי מערכת תופים זמינה.',
  },
  30: {
    title: 'שיעור טכניקה על פד – RUDIMENTS',
    description: 'שיעור טכניקה על פד (וידאו ביוטיוב) עם תרגול סינגל סטרוק, דבל סטרוק ופרדידלים; מומלץ לתרגל לפחות 5 דקות ביום.',
  },
  31: {
    title: 'זיהוי מקצבים בשירים ונגינה איתם',
    description: 'לימוד איך לזהות מקצבים בתוך שירים, נגינה איתם ותרגול לפי רשימת שירים עם ציון המקצב שלהם.',
  },
  32: {
    title: 'סיכום הקורס',
    description: 'שיעור סיכום לקורס "ללמוד תופים מהבית", סקירת הדרך שעברת והמלצות להמשך והתפתחות בנגינת תופים.',
  },
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
  // Extended from [26, 30] — the real curriculum has 32 lessons, not 30;
  // the 2 bonus/summary lessons (31-32) fold into these same two weeks
  // alongside the existing "חיבור מעברים ושירים" content.
  { weeks: [11, 12], lessonRange: [26, 32], focus: 'חיבור מעברים ושירים', category: ['fill', 'song'] },
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
  description: string
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
        const content = LESSON_CONTENT[lessonNumber]

        lessons.push({
          order: lessonNumber,
          title: content?.title ?? `שיעור ${lessonNumber} — ${row.focus}`,
          description: content?.description ?? '',
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
