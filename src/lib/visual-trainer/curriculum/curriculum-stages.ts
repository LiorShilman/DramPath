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
// order always gets harder, never easier. Two tiers per InteractiveExercise
// difficulty (beginner/intermediate/advanced) through stage 6; stages 7-8
// stay 'advanced' too (the enum has no higher tier) but introduce two more
// real skills — fills and a meter change — rather than only raw speed.
export const CURRICULUM_STAGES: CurriculumStage[] = [
  {
    order: 1,
    title: 'שלב 1 — קיק וסנר',
    instruments: ['kick', 'snare'],
    subdivision: 'quarter',
    bpm: { min: 50, target: 60, max: 70 },
    difficulty: 'beginner',
    explanation: 'השלב הראשון בונה את הבסיס: רק בס דראם (קיק) וסנר, ברבעים איטיים.',
    guide: 'התמקדו בעקביות הזמן לפני מהירות — כל פעימה צריכה להישמע באותו מרחק זמן בדיוק.',
    timeSignature: FOUR_FOUR,
  },
  {
    order: 2,
    title: 'שלב 2 — הצטרפות ההיי-הט',
    instruments: ['kick', 'snare', 'hihat_closed'],
    subdivision: 'eighth',
    bpm: { min: 60, target: 75, max: 90 },
    difficulty: 'beginner',
    explanation: 'ההיי-הט הסגור מצטרף וממלא כל שמינית, בזמן שהקיק והסנר ממשיכים לשמור את הבק-ביט.',
    guide: 'שמרו על יד ההיי-הט רפויה וזורמת — היא זו שמייצרת את תחושת הזרימה של המקצב.',
    timeSignature: FOUR_FOUR,
  },
  {
    order: 3,
    title: 'שלב 3 — קראש והיי-הט פתוח',
    instruments: ['kick', 'snare', 'hihat_closed', 'hihat_open', 'crash'],
    subdivision: 'eighth',
    bpm: { min: 80, target: 95, max: 110 },
    difficulty: 'intermediate',
    explanation: 'קראש בפתיחת הקטע וגיוון בין היי-הט סגור לפתוח מוסיפים דינמיקה למקצב.',
    guide: 'שימו לב להבדל הצלילי בין היי-הט סגור לפתוח — זה מה שנותן למקצב "נשימה".',
    timeSignature: FOUR_FOUR,
  },
  {
    order: 4,
    title: 'שלב 4 — הצטרפות הטומים',
    instruments: ['kick', 'snare', 'hihat_closed', 'hihat_open', 'crash', 'tom_high', 'tom_mid', 'tom_floor'],
    subdivision: 'eighth',
    bpm: { min: 85, target: 100, max: 115 },
    difficulty: 'intermediate',
    explanation: 'מילויים קצרים בטומים בסוף כל תיבה מוסיפים תנועה בין חזרות המקצב.',
    guide: 'תרגלו את המילוי לאט בנפרד לפני שמחברים אותו חזרה לתוך הגרוב המלא.',
    timeSignature: FOUR_FOUR,
  },
  {
    order: 5,
    title: 'שלב 5 — הסט המלא בשש-עשריות',
    instruments: ['kick', 'snare', 'hihat_closed', 'hihat_open', 'ride', 'crash', 'tom_high', 'tom_mid', 'tom_floor'],
    subdivision: 'sixteenth',
    bpm: { min: 100, target: 115, max: 130 },
    difficulty: 'advanced',
    explanation: 'כל כלי הסט זמינים כעת, כולל הרייד, בחלוקת זמן עדינה יותר של שש-עשריות.',
    guide: 'התחילו מהקצב האיטי בטווח והעלו בהדרגה רק לאחר שהמקצב יציב לגמרי.',
    timeSignature: FOUR_FOUR,
  },
  {
    order: 6,
    title: 'שלב 6 — סינקופציה',
    instruments: ['kick', 'snare', 'hihat_closed', 'hihat_open', 'ride', 'crash', 'tom_high', 'tom_mid', 'tom_floor'],
    subdivision: 'sixteenth',
    bpm: { min: 110, target: 130, max: 150 },
    difficulty: 'advanced',
    explanation: 'מכות קיק וטום סינקופיות שיוצאות מהפעימה הרגילה, בקצב המהיר ביותר במסלול.',
    guide: 'ספרו בקול את השש-עשריות (1-א-ו-א) כדי לאתר בדיוק היכן נופלת כל מכה סינקופית.',
    timeSignature: FOUR_FOUR,
  },
  {
    order: 7,
    title: 'שלב 7 — מילויים',
    instruments: ['kick', 'snare', 'hihat_closed', 'hihat_open', 'ride', 'crash', 'tom_high', 'tom_mid', 'tom_floor'],
    subdivision: 'sixteenth',
    bpm: { min: 110, target: 130, max: 150 },
    difficulty: 'advanced',
    explanation: 'מעברים אמיתיים בין חזרות המקצב — הגרוב נשמר לאורך רוב התיבה, ומסתיים במילוי טומים לפני החזרה.',
    guide: 'תרגלו את המילוי לבד באיטיות, ואז חברו אותו חזרה לגרוב בקצב מלא רק כשהוא בטוח.',
    timeSignature: FOUR_FOUR,
  },
  {
    order: 8,
    title: 'שלב 8 — משקל 3/4',
    instruments: ['kick', 'snare', 'hihat_closed', 'hihat_open', 'ride', 'crash', 'tom_high', 'tom_mid', 'tom_floor'],
    subdivision: 'sixteenth',
    bpm: { min: 120, target: 130, max: 150 },
    difficulty: 'advanced',
    explanation: 'שינוי משקל מ-4/4 ל-3/4 (וואלס) — כל תיבה סופרת רק עד 3, לא 4.',
    guide: 'ספרו בקול "1 2 3, 1 2 3" בזמן הנגינה — הדגישו את פעימה 1 כדי לא לאבד את מקום התיבה.',
    timeSignature: THREE_FOUR,
  },
]
