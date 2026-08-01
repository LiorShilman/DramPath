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

// Single source of truth reused by both seed-runner.ts (fresh installs)
// and database.ts's version-7 migration (existing installs) — same
// reasoning as course-seed.ts's buildLessonSeed().
export function buildInteractiveExerciseSeed(): InteractiveExerciseSeedInput[] {
  return [buildAhavaSheliGroove()]
}
