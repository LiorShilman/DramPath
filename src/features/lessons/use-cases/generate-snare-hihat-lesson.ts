import { db } from '../../../data/db'
import { lessonRepository, interactiveExerciseRepository } from '../../../data/repositories'
import { createId } from '../../../domain'
import type { DrumInstrument, DrumNoteEvent } from '../../../domain'

export const CUSTOM_LESSON_TAG = 'custom-lesson'

// One-off, hand-authored lesson (not part of the curriculum generator/its
// own reset flow — deliberately a different tag, CUSTOM_LESSON_TAG, so
// reset-curriculum-track.ts's GENERATED_TRACK_TAG sweep never touches it).
// Snare + hi-hat only. Every bar shares the same sixteenth-note grid (the
// exercise has one subdivision, not a per-bar one), but a first version that
// varied only *sticking pattern* while filling every single sixteenth in
// every bar still felt uniformly "at peak intensity" from bar 1 (explicit
// user feedback) — real progression needs *density* to ramp up too, not
// just which hand hits what. So difficulty now climbs on two axes at once:
// bars 1-2 hit only on the beat (quarter-note pace, mostly rest), 3-4 double
// that to the "and"s (eighth-note pace), 5-6 fill every sixteenth (the
// original pure-alternation drill), and 7-8 add true two-limb independence
// (a static hi-hat ostinato under a rhythmically different snare part) — the
// hardest bar and the lesson's musical payoff. 2 bars per level, not
// interleaved/cycled, so each level gets real repetition before advancing.
const BARS = 8
const BARS_PER_LEVEL = 2
const NOTE_VELOCITY = 100
const HIHAT: DrumInstrument = 'hihat_closed'
const SNARE: DrumInstrument = 'snare'

interface Step {
  beat: number
  subdivisionIndex: number
  instrument: DrumInstrument
  accent?: boolean
}

// Level 1 — quarter-note-pace alternation: one hit per beat, hi-hat/snare
// alternating. Mostly rest (3 of every 4 sixteenth slots silent) — an actual
// warm-up, not just "the same drill starting hand".
const LEVEL_1_QUARTER_ALTERNATION: Step[] = [1, 2, 3, 4].map((beat) => ({
  beat,
  subdivisionIndex: 0,
  instrument: beat % 2 === 1 ? HIHAT : SNARE,
  accent: true,
}))

// Level 2 — eighth-note-pace alternation: two hits per beat (on the beat and
// its "and"), doubling level 1's density while keeping the same simple
// alternation.
const LEVEL_2_EIGHTH_ALTERNATION: Step[] = [1, 2, 3, 4].flatMap((beat, beatIndex) => [
  { beat, subdivisionIndex: 0, instrument: beatIndex % 2 === 0 ? HIHAT : SNARE, accent: true },
  { beat, subdivisionIndex: 2, instrument: beatIndex % 2 === 0 ? SNARE : HIHAT },
])

// Level 3 — full sixteenth-note linear alternation: hands never double up,
// strictly hi-hat/snare/hi-hat/snare on every sixteenth. The first version's
// "easiest" bar — genuinely intermediate once levels 1-2 exist below it.
const LEVEL_3_SIXTEENTH_ALTERNATION: Step[] = [1, 2, 3, 4].flatMap((beat) => [
  { beat, subdivisionIndex: 0, instrument: HIHAT, accent: true },
  { beat, subdivisionIndex: 1, instrument: SNARE },
  { beat, subdivisionIndex: 2, instrument: HIHAT },
  { beat, subdivisionIndex: 3, instrument: SNARE },
])

// Level 4 — true two-limb independence: hi-hat holds a steady sixteenth-note
// ostinato (right hand never stops) while the snare adds the backbeat (2 &
// 4) plus two syncopated accents off the grid — a categorically harder skill
// than any single alternating stream, and the actual musical payoff.
const LEVEL_4_INDEPENDENCE: Step[] = [
  ...[1, 2, 3, 4].flatMap((beat) => [0, 1, 2, 3].map((subdivisionIndex) => ({ beat, subdivisionIndex, instrument: HIHAT }))),
  { beat: 2, subdivisionIndex: 0, instrument: SNARE, accent: true },
  { beat: 4, subdivisionIndex: 0, instrument: SNARE, accent: true },
  { beat: 1, subdivisionIndex: 3, instrument: SNARE, accent: true },
  { beat: 3, subdivisionIndex: 2, instrument: SNARE, accent: true },
]

const LEVELS: Step[][] = [
  LEVEL_1_QUARTER_ALTERNATION,
  LEVEL_2_EIGHTH_ALTERNATION,
  LEVEL_3_SIXTEENTH_ALTERNATION,
  LEVEL_4_INDEPENDENCE,
]

function buildEvents(): DrumNoteEvent[] {
  const events: DrumNoteEvent[] = []
  for (let bar = 1; bar <= BARS; bar += 1) {
    const level = LEVELS[Math.floor((bar - 1) / BARS_PER_LEVEL) % LEVELS.length]!
    for (const step of level) {
      events.push({
        id: createId(),
        bar,
        beat: step.beat,
        subdivisionIndex: step.subdivisionIndex,
        instrument: step.instrument,
        velocity: NOTE_VELOCITY,
        accent: step.accent,
      })
    }
  }
  return events
}

export interface GenerateSnareHihatLessonResult {
  lessonId: string
}

// Same transactional write path as generate-curriculum-track.ts's own use
// case — a Lesson + its linked InteractiveExercise land together or not at
// all.
export async function generateSnareHihatLessonUseCase(): Promise<GenerateSnareHihatLessonResult> {
  const existingLessons = await lessonRepository.getAll()
  const order = existingLessons.length > 0 ? Math.max(...existingLessons.map((lesson) => lesson.order)) + 1 : 1

  return db.transaction('rw', db.lessons, db.lessonExercises, db.interactiveExercises, async () => {
    const lesson = await lessonRepository.create({
      order,
      title: 'סנר והיי-הט — עצמאות ידיים מתקדמת',
      description:
        'שיעור ממוקד סנר + היי-הט בלבד, ברמה עולה — גם בסבך ההדבקה וגם בצפיפות: ' +
        '(1-2) אלטרנציה בקצב רבעים, בעיקר מנוחה. ' +
        '(3-4) אלטרנציה בקצב שמיניות, כפול צפוף. ' +
        '(5-6) אלטרנציה מלאה על כל שש-עשרה. ' +
        '(7-8) עצמאות אמיתית: היי-הט מחזיק אוסטינטו קבוע בזמן שהסנר מוסיף סינקופציה.',
      category: 'coordination',
      resourceIds: [],
      exerciseIds: [],
      tags: [CUSTOM_LESSON_TAG],
      status: 'not_started',
    })

    await interactiveExerciseRepository.create({
      title: lesson.title,
      difficulty: 'advanced',
      bpm: 104,
      minBpm: 70,
      maxBpm: 150,
      timeSignature: { numerator: 4, denominator: 4 },
      subdivision: 'sixteenth',
      bars: BARS,
      loopCount: 1,
      displayMode: 'note_highway',
      events: buildEvents(),
      lessonId: lesson.id,
    })

    return { lessonId: lesson.id }
  })
}
