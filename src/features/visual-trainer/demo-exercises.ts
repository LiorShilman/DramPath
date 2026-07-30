import { createId, nowIso } from '../../domain'
import type { DrumNoteEvent, InteractiveExercise, Subdivision } from '../../domain'

// A small in-memory catalog spanning the 3 difficulties, standing in for
// real persisted exercises until Stage 6 wires up IndexedDB/repositories.
// Content follows VISUAL_DRUM_TRAINER_SPEC.md §17's own suggested seed
// patterns (basic rock beat, two-way coordination, sixteenth-note fill).

function buildBasicRockBeat(): InteractiveExercise {
  const events: DrumNoteEvent[] = []
  for (let bar = 1; bar <= 2; bar += 1) {
    for (let beat = 1; beat <= 4; beat += 1) {
      if (beat === 1 || beat === 3) {
        events.push({ id: createId(), bar, beat, subdivisionIndex: 0, instrument: 'kick', velocity: 110 })
      }
      if (beat === 2 || beat === 4) {
        events.push({ id: createId(), bar, beat, subdivisionIndex: 0, instrument: 'snare', velocity: 110 })
      }
      events.push({ id: createId(), bar, beat, subdivisionIndex: 0, instrument: 'hihat_closed', velocity: 80 })
      events.push({ id: createId(), bar, beat, subdivisionIndex: 1, instrument: 'hihat_closed', velocity: 65 })
    }
  }
  return buildExercise({
    title: 'מקצב Rock בסיסי',
    difficulty: 'beginner',
    bpm: 90,
    subdivision: 'eighth',
    bars: 2,
    events,
  })
}

// §17 item 6: Two Way Coordination — hi-hat (right hand) runs steadily
// while the kick (right foot) plays an independent, syncopated pattern.
function buildTwoWayCoordination(): InteractiveExercise {
  const events: DrumNoteEvent[] = []
  const kickBeats: Array<{ beat: number; subdivisionIndex: number }> = [
    { beat: 1, subdivisionIndex: 0 },
    { beat: 2, subdivisionIndex: 1 },
    { beat: 3, subdivisionIndex: 0 },
    { beat: 4, subdivisionIndex: 1 },
  ]
  for (let bar = 1; bar <= 2; bar += 1) {
    for (const { beat, subdivisionIndex } of kickBeats) {
      events.push({ id: createId(), bar, beat, subdivisionIndex, instrument: 'kick', velocity: 105 })
    }
    events.push({ id: createId(), bar, beat: 2, subdivisionIndex: 0, instrument: 'snare', velocity: 110 })
    events.push({ id: createId(), bar, beat: 4, subdivisionIndex: 0, instrument: 'snare', velocity: 110 })
    for (let beat = 1; beat <= 4; beat += 1) {
      events.push({ id: createId(), bar, beat, subdivisionIndex: 0, instrument: 'hihat_closed', velocity: 75 })
      events.push({ id: createId(), bar, beat, subdivisionIndex: 1, instrument: 'hihat_closed', velocity: 60 })
    }
  }
  return buildExercise({
    title: 'Two Way Coordination',
    difficulty: 'intermediate',
    bpm: 100,
    subdivision: 'eighth',
    bars: 2,
    events,
  })
}

// §17 item 9: a sixteenth-note groove with a tom fill closing out the phrase.
function buildSixteenthNoteFill(): InteractiveExercise {
  const events: DrumNoteEvent[] = []
  for (let bar = 1; bar <= 2; bar += 1) {
    for (let beat = 1; beat <= 4; beat += 1) {
      if (beat === 1 || beat === 3) {
        events.push({ id: createId(), bar, beat, subdivisionIndex: 0, instrument: 'kick', velocity: 115 })
      }
      if (beat === 2 || beat === 4) {
        events.push({ id: createId(), bar, beat, subdivisionIndex: 0, instrument: 'snare', velocity: 115 })
      }
      const isFillBeat = bar === 2 && beat === 4
      for (let subdivisionIndex = 0; subdivisionIndex < 4; subdivisionIndex += 1) {
        if (isFillBeat) {
          const fillInstruments = ['tom_high', 'tom_mid', 'tom_floor', 'tom_floor'] as const
          events.push({
            id: createId(),
            bar,
            beat,
            subdivisionIndex,
            instrument: fillInstruments[subdivisionIndex]!,
            velocity: 100,
          })
        } else {
          events.push({
            id: createId(),
            bar,
            beat,
            subdivisionIndex,
            instrument: 'hihat_closed',
            velocity: subdivisionIndex === 0 ? 85 : 60,
          })
        }
      }
    }
  }
  return buildExercise({
    title: 'מעבר שש-עשריות',
    difficulty: 'advanced',
    bpm: 130,
    subdivision: 'sixteenth',
    bars: 2,
    events,
  })
}

function buildExercise(input: {
  title: string
  difficulty: InteractiveExercise['difficulty']
  bpm: number
  subdivision: Subdivision
  bars: number
  events: DrumNoteEvent[]
}): InteractiveExercise {
  const now = nowIso()
  return {
    id: createId(),
    title: input.title,
    difficulty: input.difficulty,
    bpm: input.bpm,
    minBpm: Math.max(40, input.bpm - 30),
    maxBpm: input.bpm + 50,
    timeSignature: { numerator: 4, denominator: 4 },
    subdivision: input.subdivision,
    bars: input.bars,
    loopCount: 2,
    displayMode: 'note_highway',
    events: input.events,
    createdAt: now,
    updatedAt: now,
  }
}

export const DEMO_EXERCISES: InteractiveExercise[] = [
  buildBasicRockBeat(),
  buildTwoWayCoordination(),
  buildSixteenthNoteFill(),
]

export function findDemoExercise(exerciseId: string): InteractiveExercise | undefined {
  return DEMO_EXERCISES.find((exercise) => exercise.id === exerciseId)
}
