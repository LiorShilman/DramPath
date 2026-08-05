import type { DrumInstrument } from '../../../domain'

export interface PatternStep {
  beat: number
  subdivisionIndex: number
  instrument: DrumInstrument
  accent?: boolean
}

export interface CurriculumPattern {
  title: string
  // One 4/4 bar's worth of hits — generate-curriculum.ts repeats this same
  // bar across the exercise's `bars` count. Curated by hand (not randomly
  // generated) so every pattern is musically sensible without needing a
  // human or AI to judge quality — see the plan's "explicitly not building"
  // section for why random generation is deferred.
  steps: PatternStep[]
}

// Keyed by CurriculumStage.order. Exactly 2 curated patterns per stage —
// every step's instrument must be one of that stage's CURRICULUM_STAGES
// entry's `instruments` (enforced by pattern-library.test.ts).
export const CURRICULUM_PATTERNS: Record<number, CurriculumPattern[]> = {
  1: [
    {
      title: 'פעימה בסיסית',
      steps: [
        { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 3, subdivisionIndex: 0, instrument: 'snare' },
      ],
    },
    {
      title: 'בק-ביט',
      steps: [
        { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
        { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
      ],
    },
  ],
  2: [
    {
      title: 'היי-הט על כל שמינית',
      steps: [
        { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 1, subdivisionIndex: 1, instrument: 'hihat_closed' },
        { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 2, subdivisionIndex: 1, instrument: 'hihat_closed' },
        { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 3, subdivisionIndex: 1, instrument: 'hihat_closed' },
        { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 4, subdivisionIndex: 1, instrument: 'hihat_closed' },
        { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 3, subdivisionIndex: 0, instrument: 'snare' },
      ],
    },
    {
      title: 'רוק קלאסי',
      steps: [
        { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 1, subdivisionIndex: 1, instrument: 'hihat_closed' },
        { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 2, subdivisionIndex: 1, instrument: 'hihat_closed' },
        { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 3, subdivisionIndex: 1, instrument: 'hihat_closed' },
        { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 4, subdivisionIndex: 1, instrument: 'hihat_closed' },
        { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
        { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
      ],
    },
  ],
  3: [
    {
      title: 'פתיחת קראש',
      steps: [
        { beat: 1, subdivisionIndex: 0, instrument: 'crash', accent: true },
        { beat: 1, subdivisionIndex: 1, instrument: 'hihat_closed' },
        { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 2, subdivisionIndex: 1, instrument: 'hihat_closed' },
        { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 3, subdivisionIndex: 1, instrument: 'hihat_closed' },
        { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 4, subdivisionIndex: 1, instrument: 'hihat_open' },
        { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
        { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
      ],
    },
    {
      title: 'היי-הט פתוח סינקופה',
      steps: [
        { beat: 1, subdivisionIndex: 0, instrument: 'crash', accent: true },
        { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 1, subdivisionIndex: 1, instrument: 'hihat_open' },
        { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 2, subdivisionIndex: 1, instrument: 'hihat_open' },
        { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 3, subdivisionIndex: 1, instrument: 'hihat_open' },
        { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 4, subdivisionIndex: 1, instrument: 'hihat_open' },
        { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
        { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
      ],
    },
  ],
  4: [
    {
      title: 'מילוי טומים בסיסי',
      steps: [
        { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 1, subdivisionIndex: 1, instrument: 'hihat_closed' },
        { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 2, subdivisionIndex: 1, instrument: 'hihat_closed' },
        { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 3, subdivisionIndex: 1, instrument: 'hihat_closed' },
        { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
        { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 4, subdivisionIndex: 0, instrument: 'tom_high' },
        { beat: 4, subdivisionIndex: 1, instrument: 'tom_floor' },
      ],
    },
    {
      title: 'קראש וטומים',
      steps: [
        { beat: 1, subdivisionIndex: 0, instrument: 'crash', accent: true },
        { beat: 1, subdivisionIndex: 1, instrument: 'hihat_closed' },
        { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 2, subdivisionIndex: 1, instrument: 'hihat_closed' },
        { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 3, subdivisionIndex: 1, instrument: 'hihat_closed' },
        { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
        { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 4, subdivisionIndex: 0, instrument: 'tom_mid' },
        { beat: 4, subdivisionIndex: 1, instrument: 'tom_floor' },
      ],
    },
  ],
  5: [
    {
      title: '16 בסיסי',
      steps: [
        { beat: 1, subdivisionIndex: 0, instrument: 'crash', accent: true },
        { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 1, subdivisionIndex: 2, instrument: 'hihat_closed' },
        { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 2, subdivisionIndex: 2, instrument: 'hihat_closed' },
        { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 3, subdivisionIndex: 2, instrument: 'hihat_closed' },
        { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 4, subdivisionIndex: 2, instrument: 'hihat_closed' },
        { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 3, subdivisionIndex: 2, instrument: 'kick' },
        { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
        { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
      ],
    },
    {
      title: 'רייד גרוב',
      steps: [
        { beat: 1, subdivisionIndex: 0, instrument: 'ride' },
        { beat: 1, subdivisionIndex: 2, instrument: 'ride' },
        { beat: 2, subdivisionIndex: 0, instrument: 'ride' },
        { beat: 2, subdivisionIndex: 2, instrument: 'ride' },
        { beat: 3, subdivisionIndex: 0, instrument: 'ride' },
        { beat: 3, subdivisionIndex: 2, instrument: 'ride' },
        { beat: 4, subdivisionIndex: 0, instrument: 'ride' },
        { beat: 4, subdivisionIndex: 2, instrument: 'ride' },
        { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
        { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
        { beat: 4, subdivisionIndex: 3, instrument: 'hihat_open', accent: true },
      ],
    },
  ],
  6: [
    {
      title: 'סינקופציה עם קיק',
      steps: [
        { beat: 1, subdivisionIndex: 0, instrument: 'crash', accent: true },
        { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 1, subdivisionIndex: 2, instrument: 'hihat_closed' },
        { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 2, subdivisionIndex: 2, instrument: 'hihat_closed' },
        { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 3, subdivisionIndex: 2, instrument: 'hihat_closed' },
        { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 4, subdivisionIndex: 2, instrument: 'hihat_closed' },
        { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 2, subdivisionIndex: 3, instrument: 'kick' },
        { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
        { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
      ],
    },
    {
      title: 'גרוב מתקדם',
      steps: [
        { beat: 1, subdivisionIndex: 0, instrument: 'crash', accent: true },
        { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 1, subdivisionIndex: 2, instrument: 'hihat_closed' },
        { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 2, subdivisionIndex: 2, instrument: 'hihat_closed' },
        { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 3, subdivisionIndex: 2, instrument: 'hihat_closed' },
        { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
        { beat: 4, subdivisionIndex: 2, instrument: 'hihat_open', accent: true },
        { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 1, subdivisionIndex: 3, instrument: 'kick' },
        { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
        { beat: 3, subdivisionIndex: 1, instrument: 'kick' },
        { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
        { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
        { beat: 4, subdivisionIndex: 3, instrument: 'tom_floor' },
      ],
    },
  ],
}
