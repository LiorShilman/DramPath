import type { DrumNoteEvent, InteractiveExercise } from '../../domain'

export type InteractiveExerciseSeedInput = Omit<InteractiveExercise, 'id' | 'createdAt' | 'updatedAt'>

// Transcribed from "האהבה שלי היא לא האהבה שלו" (יצחק קלפטר), the song's
// recurring "A" section groove (eggrolldrums.com drum chart, C:\קורסים\
// קורס טופים\תווים) — confirmed against the source chart with the user
// across several rounds. The final, explicit confirmation (all 8
// eighth-note slots per bar, enumerated one by one): kick on beat 1
// (on-beat), snare on beat 2 (on-beat), kick on the "and" of beat 2, kick
// on beat 3 (on-beat), snare on beat 4 (on-beat) — nothing on beat 1's
// "and", beat 3's "and", or beat 4's "and". Straight eighth-note hi-hat
// throughout. Earlier rounds had hits landing only on off-beats, which was
// wrong — the pattern actually mixes on-beat and off-beat hits. Written
// out over 4 bars. A real, editable exercise (unlike demo-exercises.ts's
// DEMO_EXERCISES catalog, which is hardcoded in-memory with no edit path
// through the UI).
function buildAhavaSheliGroove(): InteractiveExerciseSeedInput {
  const events: DrumNoteEvent[] = []
  for (let bar = 1; bar <= 4; bar += 1) {
    for (let beat = 1; beat <= 4; beat += 1) {
      events.push({ id: crypto.randomUUID(), bar, beat, subdivisionIndex: 0, instrument: 'hihat_closed', velocity: 80 })
      events.push({ id: crypto.randomUUID(), bar, beat, subdivisionIndex: 1, instrument: 'hihat_closed', velocity: 65 })
    }
    events.push({ id: crypto.randomUUID(), bar, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 110 })
    events.push({ id: crypto.randomUUID(), bar, beat: 2, subdivisionIndex: 0, instrument: 'snare', velocity: 110 })
    events.push({ id: crypto.randomUUID(), bar, beat: 2, subdivisionIndex: 1, instrument: 'kick', velocity: 100 })
    events.push({ id: crypto.randomUUID(), bar, beat: 3, subdivisionIndex: 0, instrument: 'kick', velocity: 105 })
    events.push({ id: crypto.randomUUID(), bar, beat: 4, subdivisionIndex: 0, instrument: 'snare', velocity: 110 })
  }
  return {
    title: 'האהבה שלי היא לא האהבה שלו — גרוב ראשי',
    difficulty: 'intermediate',
    bpm: 145,
    minBpm: 115,
    maxBpm: 195,
    timeSignature: { numerator: 4, denominator: 4 },
    subdivision: 'eighth',
    bars: 4,
    loopCount: 1,
    displayMode: 'note_highway',
    events,
  }
}

// Transcribed from "מילה טובה" (eggrolldrums.com drum chart) — structured
// as 3 consecutive sections (matching the chart's own labels) rather than
// one repeating groove, per the user's request for something closer to the
// song's actual arrangement:
//   bars 1-4  Intro: quarter-note hi-hat only, no kick/snare
//   bars 5-8  A:     kick on beats 2 and 4 — confirmed explicitly with the
//                    user, position by position
//   bars 9-12 B:     kick on beats 1 and 3 — read by the author using the
//                    kick/snare height convention calibrated against
//                    "האהבה שלי"'s already-confirmed pattern (same notehead
//                    height in both dots = same instrument, i.e. kick-only
//                    here too, just shifted to the other two beats), NOT
//                    independently confirmed with the user the way A was —
//                    flag for a listen-through check.
// Quarter-note grid throughout (not eighth-note like the other song), no
// snare anywhere in this excerpt.
function buildMilaTovaGroove(): InteractiveExerciseSeedInput {
  const events: DrumNoteEvent[] = []
  for (let bar = 1; bar <= 12; bar += 1) {
    for (let beat = 1; beat <= 4; beat += 1) {
      events.push({ id: crypto.randomUUID(), bar, beat, subdivisionIndex: 0, instrument: 'hihat_closed', velocity: 80 })
    }
    if (bar >= 5 && bar <= 8) {
      // A section.
      events.push({ id: crypto.randomUUID(), bar, beat: 2, subdivisionIndex: 0, instrument: 'kick', velocity: 110 })
      events.push({ id: crypto.randomUUID(), bar, beat: 4, subdivisionIndex: 0, instrument: 'kick', velocity: 105 })
    } else if (bar >= 9) {
      // B section.
      events.push({ id: crypto.randomUUID(), bar, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 110 })
      events.push({ id: crypto.randomUUID(), bar, beat: 3, subdivisionIndex: 0, instrument: 'kick', velocity: 105 })
    }
    // bars 1-4 (Intro): hi-hat only, no kick/snare added.
  }
  return {
    title: 'מילה טובה — Intro/A/B',
    difficulty: 'beginner',
    bpm: 85,
    minBpm: 55,
    maxBpm: 135,
    timeSignature: { numerator: 4, denominator: 4 },
    subdivision: 'quarter',
    bars: 12,
    loopCount: 1,
    displayMode: 'note_highway',
    events,
  }
}

// Single source of truth reused by both seed-runner.ts (fresh installs)
// and database.ts's version-7+ migrations (existing installs) — same
// reasoning as course-seed.ts's buildLessonSeed().
export function buildInteractiveExerciseSeed(): InteractiveExerciseSeedInput[] {
  return [buildAhavaSheliGroove(), buildMilaTovaGroove()]
}
