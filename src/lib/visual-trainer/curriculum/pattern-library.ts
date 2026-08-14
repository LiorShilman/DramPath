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
  // NEW — pure hand-to-hand work, one instrument (snare) stands in for
  // both hands (DrumPath has no separate "which hand" concept — the guide
  // text on curriculum-stages.ts's own stage 1 instructs alternation).
  // Variation comes from which quarter-beats are hit, not from a second
  // instrument or a finer subdivision (both would violate the stage's own
  // quarter-note-only, snare-only scope).
  1: [
    {
      title: 'פעימה אחידה',
      bars: [
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
        ],
        // B halves the density — same hands, more room between hits.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'snare' },
        ],
      ],
    },
    {
      title: 'מרווחים בין הידיים',
      bars: [
        [
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
        ],
        // B is a genuinely different 3-hit shape, not just A plus/minus one note.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'snare' },
        ],
      ],
    },
  ],
  // NEW — right hand (hihat_closed) holds a constant quarter pulse every
  // single bar/variant here (never rests) — that constancy IS the point:
  // it's the "steady hand" the left hand's own varying snare rhythm plays
  // against.
  2: [
    {
      title: 'היי-הט קבוע, סנר על 2 ו-4',
      bars: [
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
        ],
        // B moves the snare to 1 & 3 — same steady hihat pulse, a genuinely
        // different left-hand rhythm against it.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
        ],
      ],
    },
    {
      title: 'היי-הט קבוע, סנר משתנה',
      bars: [
        // Both hands together on every beat — real coordination, not just alternation.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
        ],
        // B sparsens the left hand to a single hit — the steady right hand
        // has to keep going through the gap on its own.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
        ],
      ],
    },
  ],
  3: [
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
  4: [
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
  // Hand technique/independence: the instrument set stays identical to
  // stage 4 (rudiment work doesn't need new kit pieces), the focus shift is
  // purely rhythmic. Each pattern's 2nd bar variant is a full-bar single-
  // or double-stroke roll on the snare alone, alternating with a normal
  // groove bar — the generator's A/B/A/B cycling turns that into "groove,
  // roll, groove, roll…" across the 8 generated bars.
  5: [
    {
      title: 'רול יחיד לאורך התיבה',
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
        // A full bar of single strokes on the snare alone — no kick/hihat,
        // hands carry it entirely.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 1, subdivisionIndex: 1, instrument: 'snare' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 2, subdivisionIndex: 1, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 1, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 1, instrument: 'snare' },
        ],
      ],
    },
    {
      title: 'רול כפול עם דגש',
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
        // A full bar of double-stroke-style snare, accented on the downbeat
        // — teaches accent control inside a rudiment, not just raw speed.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'snare', accent: true },
          { beat: 1, subdivisionIndex: 1, instrument: 'snare' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 2, subdivisionIndex: 1, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 1, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 1, instrument: 'snare' },
        ],
      ],
    },
  ],
  // Kick variations under a held backbeat: same instrument set as stage 5,
  // focus moves from the hands to the feet.
  6: [
    {
      title: 'קיק סינקופטי בסיסי',
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
        // B pushes a syncopated kick onto the "and" of beat 2.
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
          { beat: 2, subdivisionIndex: 1, instrument: 'kick' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
        ],
      ],
    },
    {
      title: 'דחיפת קיק מתקדמת',
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
          { beat: 3, subdivisionIndex: 1, instrument: 'kick' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
        ],
        // B adds kick pickups both before beat 1 and after the closing snare.
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
          { beat: 1, subdivisionIndex: 1, instrument: 'kick' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 1, instrument: 'kick' },
        ],
      ],
    },
  ],
  7: [
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
  8: [
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
  // Dynamics/ghost notes: same instrument set as stage 8. The backbeat is
  // marked accent:true (graded for real against the player's own MIDI
  // strike velocity — see hit-matcher.ts's gradeDynamics), and extra
  // unaccented snare notes fall between backbeats as ghost notes — the app
  // doesn't grade "softness" specifically, but hitting the notated accent
  // noticeably harder than its neighbors is the whole skill this stage
  // teaches.
  9: [
    {
      title: 'אקסנט על הבק-ביט',
      bars: [
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare', accent: true },
          { beat: 2, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 1, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare', accent: true },
          { beat: 4, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 4, subdivisionIndex: 1, instrument: 'snare' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
        ],
        // B moves the ghost notes to just BEFORE each accent instead of
        // just after — a genuinely different placement, not a crash-drop.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 1, instrument: 'snare' },
          { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare', accent: true },
          { beat: 2, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 1, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare', accent: true },
          { beat: 4, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
        ],
      ],
    },
    {
      title: 'גרוב עם גוסט כפול',
      bars: [
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'crash', accent: true },
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare', accent: true },
          { beat: 2, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 1, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 1, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare', accent: true },
          { beat: 4, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
        ],
        // B drops the opening crash, and adds one more ghost note (beat 1's
        // "and") — a real content change, not just a crash removal.
        [
          { beat: 1, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 1, instrument: 'snare' },
          { beat: 2, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 0, instrument: 'snare', accent: true },
          { beat: 2, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 2, subdivisionIndex: 1, instrument: 'snare' },
          { beat: 3, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 3, subdivisionIndex: 1, instrument: 'snare' },
          { beat: 4, subdivisionIndex: 0, instrument: 'hihat_closed' },
          { beat: 4, subdivisionIndex: 0, instrument: 'snare', accent: true },
          { beat: 4, subdivisionIndex: 1, instrument: 'hihat_closed' },
          { beat: 1, subdivisionIndex: 0, instrument: 'kick' },
          { beat: 3, subdivisionIndex: 0, instrument: 'kick' },
        ],
      ],
    },
  ],
  10: [
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
  11: [
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
  12: [
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
  13: [
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
