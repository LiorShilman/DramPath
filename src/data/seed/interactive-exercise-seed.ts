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

// Transcribed from "אלף כבאים" (דודה, eggrolldrums.com drum chart) —
// structured as 4 sections (matching the chart's own Intro/A/B/C labels),
// same approach as "מילה טובה". The A-section kick/snare skeleton was
// confirmed explicitly with the user at the eighth-note level: kick on
// beat 1, snare on beat 2, kick on the "and" of 2, kick on beat 3, snare on
// beat 4 — nothing on the "and" of 1, 3, or 4. B and C are the author's own
// reading of the chart, NOT independently confirmed with the user the way
// A was — per the user's direction, this is a best-effort transcription
// they'll correct directly in the exercise builder UI if anything is off.
// Both are deliberately made to sound distinct from A (not just an A copy
// with a cosmetic hi-hat swap): B adds the chart's extra note on the "and"
// of beat 3 (a busier, more syncopated read of that section's notation);
// C reads as a simpler, more open-sounding section (the chart marks it
// "H.H. half open"), represented here as continuous open hi-hat over a
// plain beat-1/beat-3 kick, beat-2/beat-4 snare backbeat. The domain model
// only supports one subdivision per exercise, so C's faster (sixteenth-
// note-grouped) notation is adapted to the same eighth-note grid as A/B
// rather than reproduced literally. The chart's D.S. al Coda ending
// (ride bell, sixteenth-note fills, ritardando) is a one-time ending, not
// loop material, so it's deliberately left out of this repeatable practice
// exercise.
//   bar 1      Intro: quarter-note hi-hat only, no kick/snare
//   bars 2-9   A:     the confirmed groove, 2 reps
//   bars 10-17 B:     A's skeleton plus an extra kick on the "and" of beat
//                     3, hi-hat open accent (chart's "o" marks) on the
//                     "and" of beat 4
//   bars 18-21 C:     continuous open hi-hat, kick on beats 1 and 3, snare
//                     on beats 2 and 4 — simpler and more open than A/B
//   bar 22     turnaround fill: kick on 1, snare on 3 and 4, no hi-hat
function buildElefKabaimGroove(): InteractiveExerciseSeedInput {
  const events: DrumNoteEvent[] = []

  // Intro (bar 1): hi-hat pickup only.
  for (let beat = 1; beat <= 4; beat += 1) {
    events.push({ id: crypto.randomUUID(), bar: 1, beat, subdivisionIndex: 0, instrument: 'hihat_closed', velocity: 70 })
  }

  // A (bars 2-9): the confirmed groove.
  for (let bar = 2; bar <= 9; bar += 1) {
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

  // B (bars 10-17): A's skeleton, plus an extra kick on the "and" of 3,
  // plus a hi-hat open accent on the "and" of 4 — genuinely busier than A.
  for (let bar = 10; bar <= 17; bar += 1) {
    for (let beat = 1; beat <= 4; beat += 1) {
      events.push({ id: crypto.randomUUID(), bar, beat, subdivisionIndex: 0, instrument: 'hihat_closed', velocity: 80 })
      const isTurnaroundAccent = beat === 4
      events.push({
        id: crypto.randomUUID(),
        bar,
        beat,
        subdivisionIndex: 1,
        instrument: isTurnaroundAccent ? 'hihat_open' : 'hihat_closed',
        velocity: 65,
      })
    }
    events.push({ id: crypto.randomUUID(), bar, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 110 })
    events.push({ id: crypto.randomUUID(), bar, beat: 2, subdivisionIndex: 0, instrument: 'snare', velocity: 110 })
    events.push({ id: crypto.randomUUID(), bar, beat: 2, subdivisionIndex: 1, instrument: 'kick', velocity: 100 })
    events.push({ id: crypto.randomUUID(), bar, beat: 3, subdivisionIndex: 0, instrument: 'kick', velocity: 105 })
    events.push({ id: crypto.randomUUID(), bar, beat: 3, subdivisionIndex: 1, instrument: 'kick', velocity: 95 })
    events.push({ id: crypto.randomUUID(), bar, beat: 4, subdivisionIndex: 0, instrument: 'snare', velocity: 110 })
  }

  // C (bars 18-21): simpler, more open — continuous open hi-hat, plain
  // kick-on-1&3 / snare-on-2&4 backbeat.
  for (let bar = 18; bar <= 21; bar += 1) {
    for (let beat = 1; beat <= 4; beat += 1) {
      events.push({ id: crypto.randomUUID(), bar, beat, subdivisionIndex: 0, instrument: 'hihat_open', velocity: 75 })
      events.push({ id: crypto.randomUUID(), bar, beat, subdivisionIndex: 1, instrument: 'hihat_open', velocity: 60 })
      if (beat === 1 || beat === 3) {
        events.push({ id: crypto.randomUUID(), bar, beat, subdivisionIndex: 0, instrument: 'kick', velocity: 105 })
      } else {
        events.push({ id: crypto.randomUUID(), bar, beat, subdivisionIndex: 0, instrument: 'snare', velocity: 110 })
      }
    }
  }

  // Turnaround fill (bar 22).
  events.push({ id: crypto.randomUUID(), bar: 22, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 110 })
  events.push({ id: crypto.randomUUID(), bar: 22, beat: 3, subdivisionIndex: 0, instrument: 'snare', velocity: 110 })
  events.push({ id: crypto.randomUUID(), bar: 22, beat: 4, subdivisionIndex: 0, instrument: 'snare', velocity: 110 })

  return {
    title: 'אלף כבאים — Intro/A/B/C',
    difficulty: 'intermediate',
    bpm: 126,
    minBpm: 96,
    maxBpm: 176,
    timeSignature: { numerator: 4, denominator: 4 },
    subdivision: 'eighth',
    bars: 22,
    loopCount: 1,
    displayMode: 'note_highway',
    events,
  }
}

// Single source of truth reused by both seed-runner.ts (fresh installs)
// and database.ts's version-7+ migrations (existing installs) — same
// reasoning as course-seed.ts's buildLessonSeed().
export function buildInteractiveExerciseSeed(): InteractiveExerciseSeedInput[] {
  return [buildAhavaSheliGroove(), buildMilaTovaGroove(), buildElefKabaimGroove()]
}
