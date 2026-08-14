import type { DrumInstrument, InteractiveExerciseDifficulty, Subdivision, TimeSignature } from '../../../domain'

export interface CurriculumStage {
  order: number
  title: string
  instruments: DrumInstrument[]
  subdivision: Subdivision
  bpm: { min: number; target: number; max: number }
  difficulty: InteractiveExerciseDifficulty
  explanation: string
  guide: string
  timeSignature: TimeSignature
}

const FOUR_FOUR: TimeSignature = { numerator: 4, denominator: 4 }
const THREE_FOUR: TimeSignature = { numerator: 3, denominator: 4 }

// The "private teacher" standalone track's fixed progression — instruments,
// subdivision and BPM only ever grow/advance from one stage to the next
// (enforced by curriculum-stages.test.ts), so working straight through in
// order always gets harder, never easier.
//
// v3 of this track: two new stages (1-2) added in front of everything else
// — explicit user request/professional point: real drum method books (Stick
// Control, etc.) start with pure hand-to-hand coordination (right/left,
// quarter notes, one surface) before ever bringing in the foot, and this
// track used to skip straight to kick+snare. DrumPath has no "which hand"
// concept in its data model (grading is per-instrument, from MIDI note
// number, not per-limb) — stage 1 uses a single instrument (snare) for both
// hands, relying on the guide text to instruct alternation; stage 2
// introduces a second instrument (hihat_closed) specifically so "right hand
// keeps a steady pulse, left hand plays its own rhythm" becomes visible/
// gradable as two distinct instrument streams, still with no foot involved.
// Both stay at 'quarter' subdivision (can't go higher — subdivision is
// forced non-decreasing across the whole array, and the very next stage is
// also 'quarter') and both stay comfortably under old stage 1's own
// 50/60/70 BPM. Old stage 1 ("קיק וסנר") keeps hihat_closed in its own
// instrument set even though its actual patterns don't use it — required by
// the instrument-set-only-grows invariant once stage 2 has already
// introduced it, same "declare the cumulative palette, not just what this
// stage's patterns literally use" convention already established for
// stages 3/4 reusing stage 2's own set below.
//
// v2 of this track (replacing the original 8-stage/16-lesson version):
// the original jumped straight from "which kit piece joins next" to the
// next, with no dedicated stage for hand technique (rudiments/independence)
// or dynamics (ghost notes/accents) — both standard pillars of a real
// private-lesson curriculum. Three new stages (now 5, 6, 9) close that gap
// without breaking the instrument-growth invariant: 5-6 reuse 4's exact
// instrument set (kick/snare/hihat_closed) since rudiment and kick-variation
// work doesn't need new kit pieces, and 9 reuses 8's set (dynamics work
// needs no new instruments either, just accent placement). Stages 7/8/10/11/
// 12/13 carry over the original track's stages 3-8 unchanged in content
// (already tested, already sound), renumbered.
export const CURRICULUM_STAGES: CurriculumStage[] = [
  {
    order: 1,
    title: 'שלב 1 — עבודת ידיים: ימין ושמאל בסנר',
    instruments: ['snare'],
    subdivision: 'quarter',
    bpm: { min: 40, target: 48, max: 56 },
    difficulty: 'beginner',
    explanation:
      'השלב הכי בסיסי מכולם: לפני שמוסיפים כלי נוסף, בונים תיאום טהור בין יד ימין ליד שמאל — הכל על הסנר בלבד, ברבעים איטיים.',
    guide: 'נגנו לסירוגין יד ימין-שמאל-ימין-שמאל על כל הקשה, גם כשיש הפסקה קצרה — עקביות בין הידיים היא הבסיס לכל מה שיבוא אחר כך.',
    timeSignature: FOUR_FOUR,
  },
  {
    order: 2,
    title: 'שלב 2 — עבודת ידיים: היי-הט קבוע מול סנר',
    instruments: ['snare', 'hihat_closed'],
    subdivision: 'quarter',
    bpm: { min: 45, target: 54, max: 63 },
    difficulty: 'beginner',
    explanation:
      'יד ימין שומרת פעימה קבועה על ההיי-הט הסגור, בזמן שיד שמאל מנגנת קצב משלה על הסנר — עצמאות אמיתית בין הידיים, עוד לפני שהרגל בכלל מצטרפת.',
    guide: 'שמרו על יד ימין קבועה כמו שעון על ההיי-הט — היא לא זזה בגלל מה שיד שמאל עושה. יד שמאל היא זו שמשתנה בין החזרות.',
    timeSignature: FOUR_FOUR,
  },
  {
    order: 3,
    title: 'שלב 3 — קיק וסנר',
    instruments: ['kick', 'snare', 'hihat_closed'],
    subdivision: 'quarter',
    bpm: { min: 50, target: 60, max: 70 },
    difficulty: 'beginner',
    explanation: 'הרגל מצטרפת לראשונה: רק בס דראם (קיק) וסנר, ברבעים איטיים.',
    guide: 'התמקדו בעקביות הזמן לפני מהירות — כל פעימה צריכה להישמע באותו מרחק זמן בדיוק.',
    timeSignature: FOUR_FOUR,
  },
  {
    order: 4,
    title: 'שלב 4 — הצטרפות ההיי-הט',
    instruments: ['kick', 'snare', 'hihat_closed'],
    subdivision: 'eighth',
    bpm: { min: 60, target: 75, max: 90 },
    difficulty: 'beginner',
    explanation: 'ההיי-הט הסגור מצטרף וממלא כל שמינית, בזמן שהקיק והסנר ממשיכים לשמור את הבק-ביט.',
    guide: 'שמרו על יד ההיי-הט רפויה וזורמת — היא זו שמייצרת את תחושת הזרימה של המקצב.',
    timeSignature: FOUR_FOUR,
  },
  {
    order: 5,
    title: 'שלב 5 — רודימנטים ובניית עצמאות',
    instruments: ['kick', 'snare', 'hihat_closed'],
    subdivision: 'eighth',
    bpm: { min: 65, target: 80, max: 95 },
    difficulty: 'beginner',
    explanation:
      'לפני שממשיכים להוסיף כלים, עוצרים לחזק את הידיים: רולים של מכות יחידות וכפולות על הסנר, על גבי דופק קיק/היי-הט יציב.',
    guide: 'שמרו על הרגל דולקת בזמן שהידיים "מתפוצצות" — זו בדיוק העצמאות שכל מקצב מתקדם יותר יבנה עליה.',
    timeSignature: FOUR_FOUR,
  },
  {
    order: 6,
    title: 'שלב 6 — וריאציות קיק תחת בק-ביט',
    instruments: ['kick', 'snare', 'hihat_closed'],
    subdivision: 'eighth',
    bpm: { min: 75, target: 90, max: 105 },
    difficulty: 'beginner',
    explanation: 'הסנר חוזר לבק-ביט הפשוט, וכל התרגול עובר לרגל: קיקים סינקופיים על ה"אנד" של הפעימות.',
    guide: 'נגנו את דפוס הקיק לבד על הרגל בלבד עד שהוא אוטומטי, ואז החזירו את ההיי-הט והסנר מסביבו.',
    timeSignature: FOUR_FOUR,
  },
  {
    order: 7,
    title: 'שלב 7 — קראש והיי-הט פתוח',
    instruments: ['kick', 'snare', 'hihat_closed', 'hihat_open', 'crash'],
    subdivision: 'eighth',
    bpm: { min: 90, target: 100, max: 115 },
    difficulty: 'intermediate',
    explanation: 'קראש בפתיחת הקטע וגיוון בין היי-הט סגור לפתוח מוסיפים דינמיקה למקצב.',
    guide: 'שימו לב להבדל הצלילי בין היי-הט סגור לפתוח — זה מה שנותן למקצב "נשימה".',
    timeSignature: FOUR_FOUR,
  },
  {
    order: 8,
    title: 'שלב 8 — הצטרפות הטומים',
    instruments: ['kick', 'snare', 'hihat_closed', 'hihat_open', 'crash', 'tom_high', 'tom_mid', 'tom_floor'],
    subdivision: 'eighth',
    bpm: { min: 95, target: 105, max: 120 },
    difficulty: 'intermediate',
    explanation: 'מילויים קצרים בטומים בסוף כל תיבה מוסיפים תנועה בין חזרות המקצב.',
    guide: 'תרגלו את המילוי לאט בנפרד לפני שמחברים אותו חזרה לתוך הגרוב המלא.',
    timeSignature: FOUR_FOUR,
  },
  {
    order: 9,
    title: 'שלב 9 — דינמיקה וגוסט נוטס',
    instruments: ['kick', 'snare', 'hihat_closed', 'hihat_open', 'crash', 'tom_high', 'tom_mid', 'tom_floor'],
    subdivision: 'eighth',
    bpm: { min: 100, target: 110, max: 125 },
    difficulty: 'intermediate',
    explanation:
      'אותם כלים, פוקוס חדש: הבק-ביט מסומן כאקסנט (ומדורג בפועל לפי עוצמת ההקשה האמיתית שלכם), וסביבו נופלות מכות "גוסט" שקטות בהרבה.',
    guide: 'הגזימו בהתחלה — הכו את האקסנט חזק מאוד ואת הגוסטים חלש מאוד, ורק אז תקרבו אותם למרחק טבעי.',
    timeSignature: FOUR_FOUR,
  },
  {
    order: 10,
    title: 'שלב 10 — הסט המלא בשש-עשריות',
    instruments: ['kick', 'snare', 'hihat_closed', 'hihat_open', 'ride', 'crash', 'tom_high', 'tom_mid', 'tom_floor'],
    subdivision: 'sixteenth',
    bpm: { min: 105, target: 115, max: 130 },
    difficulty: 'advanced',
    explanation: 'כל כלי הסט זמינים כעת, כולל הרייד, בחלוקת זמן עדינה יותר של שש-עשריות.',
    guide: 'התחילו מהקצב האיטי בטווח והעלו בהדרגה רק לאחר שהמקצב יציב לגמרי.',
    timeSignature: FOUR_FOUR,
  },
  {
    order: 11,
    title: 'שלב 11 — סינקופציה',
    instruments: ['kick', 'snare', 'hihat_closed', 'hihat_open', 'ride', 'crash', 'tom_high', 'tom_mid', 'tom_floor'],
    subdivision: 'sixteenth',
    bpm: { min: 110, target: 125, max: 140 },
    difficulty: 'advanced',
    explanation: 'מכות קיק וטום סינקופיות שיוצאות מהפעימה הרגילה.',
    guide: 'ספרו בקול את השש-עשריות (1-א-ו-א) כדי לאתר בדיוק היכן נופלת כל מכה סינקופית.',
    timeSignature: FOUR_FOUR,
  },
  {
    order: 12,
    title: 'שלב 12 — אוצר מילויים',
    instruments: ['kick', 'snare', 'hihat_closed', 'hihat_open', 'ride', 'crash', 'tom_high', 'tom_mid', 'tom_floor'],
    subdivision: 'sixteenth',
    bpm: { min: 115, target: 130, max: 145 },
    difficulty: 'advanced',
    explanation: 'מעברים אמיתיים בין חזרות המקצב — הגרוב נשמר לאורך רוב התיבה, ומסתיים במילוי טומים לפני החזרה.',
    guide: 'תרגלו את המילוי לבד באיטיות, ואז חברו אותו חזרה לגרוב בקצב מלא רק כשהוא בטוח.',
    timeSignature: FOUR_FOUR,
  },
  {
    order: 13,
    title: 'שלב 13 — משקל 3/4',
    instruments: ['kick', 'snare', 'hihat_closed', 'hihat_open', 'ride', 'crash', 'tom_high', 'tom_mid', 'tom_floor'],
    subdivision: 'sixteenth',
    bpm: { min: 120, target: 130, max: 150 },
    difficulty: 'advanced',
    explanation: 'שינוי משקל מ-4/4 ל-3/4 (וואלס) — כל תיבה סופרת רק עד 3, לא 4.',
    guide: 'ספרו בקול "1 2 3, 1 2 3" בזמן הנגינה — הדגישו את פעימה 1 כדי לא לאבד את מקום התיבה.',
    timeSignature: THREE_FOUR,
  },
]
