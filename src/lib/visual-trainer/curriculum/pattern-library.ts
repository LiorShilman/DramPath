import type { DrumInstrument } from '../../../domain'

export interface PatternStep {
  beat: number
  subdivisionIndex: number
  instrument: DrumInstrument
  accent?: boolean
}

export interface CurriculumPattern {
  title: string
  // One or more 4/4-bar variants — generate-curriculum.ts cycles through
  // them (bar 1 = variant 0, bar 2 = variant 1, bar 3 = variant 0, …) across
  // the exercise's `bars` count, instead of repeating one bar identically.
  // A single-variant pattern (bars.length === 1) still just repeats as
  // before. Two variants (A/B) is the norm here: B is A with a small,
  // deliberate difference (usually the crash accent dropped, since a real
  // crash marks a phrase start rather than repeating every bar) so the
  // exercise isn't a dead-identical loop — see the pattern generator's own
  // comment on why hand-curated content over random generation.
  bars: PatternStep[][]
}

// Keyed by CurriculumStage.order. Exactly 2 curated patterns per stage —
// every step's instrument must be one of that stage's CURRICULUM_STAGES
// entry's `instruments` (enforced by pattern-library.test.ts).
export const CURRICULUM_PATTERNS: Record<number, CurriculumPattern[]> = {
  1: [
    {
      title: 'פעימה בסיסית',
      bars: [
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 3, subdivisionIndex: 0, instrument: 'snare' },
        ],
        // B adds a closing kick — a small "answer" instead of an identical repeat.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 3, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 0, instrument: 'kick' },
        ],
      ],
    },
    {
      title: 'בק-ביט',
      bars: [
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
        ],
        // B adds a kick under the closing snare (a unison hit) instead of
        // just swapping instruments on the same single note — a one-note
        // substitution between two similar-looking noteheads read as
        // "the same bar" at a glance (confirmed against a real screenshot);
        // an extra notehead stacked on the beat is unambiguous.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 0, instrument: 'kick' },
        ],
      ],
    },
  ],
  2: [
    {
      title: 'היי-הט על כל שמינית',
      bars: [
        [
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
        // B adds a syncopated kick pickup on the "and" of beat 2.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 4, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 1, instrument: 'kick' },
          { beat: 3, subdivisionIndex: 0, instrument: 'snare' },
        ],
      ],
    },
    {
      title: 'רוק קלאסי',
      bars: [
        [
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
        // B adds a pickup kick right after the closing snare, leading into the loop.
        [
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
          { beat: 4, subdivisionIndex: 1, instrument: 'kick' },
        ],
      ],
    },
  ],
  3: [
    {
      title: 'פתיחת קראש',
      bars: [
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'crash', accent: true },
          { beat: 1, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 1, instrument: 'hihat_closed' },
          // Beat 3's hihat rests entirely (kick alone carries it) — a real
          // gap before the closing hihat_open, not just "no notes left to add".
          { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 4, subdivisionIndex: 1, instrument: 'hihat_open' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
        ],
        // B drops the crash — a real crash marks the phrase start, not every bar.
        [
          { beat: 1, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 4, subdivisionIndex: 1, instrument: 'hihat_open' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
        ],
      ],
    },
    {
      title: 'היי-הט פתוח סינקופה',
      bars: [
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'crash', accent: true },
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 1, instrument: 'hihat_open' },
          { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 1, instrument: 'hihat_open' },
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 1, instrument: 'hihat_open' },
          // Beat 4's hihat rests entirely — just the closing snare, a breath
          // before the bar loops back to the crash.
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
        ],
        // B drops the crash.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 1, instrument: 'hihat_open' },
          { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 1, instrument: 'hihat_open' },
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 1, instrument: 'hihat_open' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
        ],
      ],
    },
  ],
  4: [
    {
      title: 'מילוי טומים בסיסי',
      bars: [
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 1, instrument: 'hihat_closed' },
          // Beat 2's hihat rests — just the snare backbeat alone.
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 4, subdivisionIndex: 0, instrument: 'tom_high' },
          { beat: 4, subdivisionIndex: 1, instrument: 'tom_floor' },
        ],
        // B fills beat 2's hihat rest instead of swapping the closing fill's
        // tom voicing (tom_high->tom_mid) — a same-position instrument swap
        // between two adjacent, similar-looking toms read as "the same bar"
        // at a glance (confirmed against a real screenshot); a new notehead
        // appearing where there was silence is unambiguous.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 4, subdivisionIndex: 0, instrument: 'tom_high' },
          { beat: 4, subdivisionIndex: 1, instrument: 'tom_floor' },
        ],
      ],
    },
    {
      title: 'קראש וטומים',
      bars: [
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'crash', accent: true },
          { beat: 1, subdivisionIndex: 1, instrument: 'hihat_closed' },
          // Beat 2's hihat rests — just the snare backbeat alone.
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 4, subdivisionIndex: 0, instrument: 'tom_mid' },
          { beat: 4, subdivisionIndex: 1, instrument: 'tom_floor' },
        ],
        // B drops the crash.
        [
          { beat: 1, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 4, subdivisionIndex: 0, instrument: 'tom_mid' },
          { beat: 4, subdivisionIndex: 1, instrument: 'tom_floor' },
        ],
      ],
    },
  ],
  5: [
    {
      title: '16 בסיסי',
      bars: [
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'crash', accent: true },
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 2, instrument: 'hihat_closed' },
          // Beat 4's hihat rests entirely — just the closing snare backbeat.
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 3, subdivisionIndex: 2, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
        ],
        // B drops the crash.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 3, subdivisionIndex: 2, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
        ],
      ],
    },
    {
      title: 'רייד גרוב',
      bars: [
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'ride' },
          { beat: 1, subdivisionIndex: 2, instrument: 'ride' },
          { beat: 2, subdivisionIndex: 0, instrument: 'ride' },
          { beat: 2, subdivisionIndex: 2, instrument: 'ride' },
          { beat: 3, subdivisionIndex: 0, instrument: 'ride' },
          { beat: 3, subdivisionIndex: 2, instrument: 'ride' },
          // Beat 4's ride rests — makes the closing accented hihat_open
          // stand out on its own instead of blending into a continuous ride.
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 3, instrument: 'hihat_open', accent: true },
        ],
        // B fills beat 4 with ride instead of holding back for the open-hihat
        // accent — a fuller "answer" bar contrasting with A's spacious one.
        [
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
        ],
      ],
    },
  ],
  6: [
    {
      title: 'סינקופציה עם קיק',
      bars: [
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'crash', accent: true },
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 2, instrument: 'hihat_closed' },
          // Beat 3's hihat rests — the syncopated kick carries it alone.
          { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 4, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 3, instrument: 'kick' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
        ],
        // B drops the crash.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 4, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 3, instrument: 'kick' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
        ],
      ],
    },
    {
      title: 'גרוב מתקדם',
      bars: [
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'crash', accent: true },
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 2, instrument: 'hihat_closed' },
          // Beat 2's hihat rests — just the snare backbeat alone.
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
        // B drops the opening crash — the closing accented hihat_open and
        // tom_floor fill still give this bar its own ending character.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 2, instrument: 'hihat_closed' },
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
      ],
    },
  ],
  7: [
    {
      title: 'מילוי טומים מלא',
      bars: [
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'crash', accent: true },
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 2, instrument: 'hihat_closed' },
          // Beat 2's hihat rests — just the snare backbeat alone.
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 0, instrument: 'tom_high' },
          { beat: 4, subdivisionIndex: 1, instrument: 'tom_mid' },
          { beat: 4, subdivisionIndex: 2, instrument: 'tom_floor' },
          { beat: 4, subdivisionIndex: 3, instrument: 'snare' },
        ],
        // B drops the crash — the tom fill on beat 4 stays every bar, since
        // that's the whole point of a "fills" stage.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 0, instrument: 'tom_high' },
          { beat: 4, subdivisionIndex: 1, instrument: 'tom_mid' },
          { beat: 4, subdivisionIndex: 2, instrument: 'tom_floor' },
          { beat: 4, subdivisionIndex: 3, instrument: 'snare' },
        ],
      ],
    },
    {
      title: 'מילוי מתקדם',
      bars: [
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'crash', accent: true },
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 2, instrument: 'hihat_closed' },
          // Beat 2's hihat rests too — silence right before the tom cascade
          // that fills beats 3-4 makes the fill's entrance land harder.
          { beat: 1, subdivisionIndex: 3, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'tom_high' },
          { beat: 3, subdivisionIndex: 1, instrument: 'tom_high' },
          { beat: 3, subdivisionIndex: 2, instrument: 'tom_mid' },
          { beat: 3, subdivisionIndex: 3, instrument: 'tom_mid' },
          { beat: 4, subdivisionIndex: 0, instrument: 'tom_floor' },
          { beat: 4, subdivisionIndex: 1, instrument: 'tom_floor' },
          { beat: 4, subdivisionIndex: 2, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 3, instrument: 'crash', accent: true },
        ],
        // B drops the opening crash — the closing crash stays, it's the
        // fill's own climax, not a redundant phrase marker.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 3, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'tom_high' },
          { beat: 3, subdivisionIndex: 1, instrument: 'tom_high' },
          { beat: 3, subdivisionIndex: 2, instrument: 'tom_mid' },
          { beat: 3, subdivisionIndex: 3, instrument: 'tom_mid' },
          { beat: 4, subdivisionIndex: 0, instrument: 'tom_floor' },
          { beat: 4, subdivisionIndex: 1, instrument: 'tom_floor' },
          { beat: 4, subdivisionIndex: 2, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 3, instrument: 'crash', accent: true },
        ],
      ],
    },
  ],
  8: [
    {
      title: 'וואלס בסיסי',
      bars: [
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'crash', accent: true },
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 2, instrument: 'hihat_closed' },
          // Beat 2's hihat rests — classic waltz "boom-CHICK", the snare
          // stands alone instead of being buried under continuous hihat.
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
        ],
        // B drops the crash.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
        ],
      ],
    },
    {
      title: 'וואלס עם סינקופה',
      bars: [
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'crash', accent: true },
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 2, instrument: 'hihat_closed' },
          // Beat 2's hihat rests — same "boom-CHICK" breath as the first
          // waltz pattern.
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 1, subdivisionIndex: 3, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 3, subdivisionIndex: 2, instrument: 'kick' },
        ],
        // B drops the crash.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 2, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 1, subdivisionIndex: 3, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 3, subdivisionIndex: 2, instrument: 'kick' },
        ],
      ],
    },
  ],
}
