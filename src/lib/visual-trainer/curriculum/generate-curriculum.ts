import { createId } from '../../../domain'
import type { DrumNoteEvent, InteractiveExercise, Lesson } from '../../../domain'
import { CURRICULUM_STAGES } from './curriculum-stages'
import { CURRICULUM_PATTERNS } from './pattern-library'

// A generated pair's bar count — pattern.bars' variants cycle across all 8
// bars (e.g. a 2-variant pattern plays ABABABAB, not a plain AAAAAAAA loop —
// see CurriculumPattern's own doc comment for why), giving a substantially
// longer, less monotonous practice pass than a single bar without needing
// loopCount > 1. Per user request: spans more than one notation row
// (ExerciseNotationSheet wraps at BARS_PER_ROW=4 bars), i.e. "double" a
// single row's worth. loopCount is always kept at 1, matching
// ExerciseBuilderPage's own fixed convention: the grid/notation preview and
// NoteHighway's falling-note animation only ever show a single playthrough,
// so a loopCount > 1 there previously caused a real scoring bug (see
// database.ts's v5 migration comment) — this generator avoids that class of
// bug entirely by never relying on loopCount.
const BARS = 8
const NOTE_VELOCITY = 100

export interface GeneratedCurriculumItem {
  lesson: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt' | 'order'>
  interactiveExercise: Omit<InteractiveExercise, 'id' | 'createdAt' | 'updatedAt' | 'lessonId'>
}

// Pure, no IO — deterministic in every field except each DrumNoteEvent's own
// `id` (createId() is a fresh UUID per call, same as every other write path
// in this codebase; nothing downstream needs it stable across two separate
// generations). `order` is deliberately omitted from the lesson draft: it
// depends on how many lessons already exist at persistence time, which is
// the generate-curriculum-track use-case's job, not this pure function's.
export function generateCurriculumTrack(): GeneratedCurriculumItem[] {
  const items: GeneratedCurriculumItem[] = []

  for (const stage of CURRICULUM_STAGES) {
    const patterns = CURRICULUM_PATTERNS[stage.order] ?? []
    for (const pattern of patterns) {
      const events: DrumNoteEvent[] = []
      for (let bar = 1; bar <= BARS; bar += 1) {
        const barVariant = pattern.bars[(bar - 1) % pattern.bars.length]!
        for (const step of barVariant) {
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

      items.push({
        lesson: {
          title: `${stage.title} — ${pattern.title}`,
          description: `${stage.explanation}\n\n${stage.guide}`,
          category: 'groove',
          resourceIds: [],
          exerciseIds: [],
          tags: ['generated-track'],
          status: 'not_started',
        },
        interactiveExercise: {
          title: `${stage.title} — ${pattern.title}`,
          difficulty: stage.difficulty,
          bpm: stage.bpm.target,
          minBpm: stage.bpm.min,
          maxBpm: stage.bpm.max,
          timeSignature: stage.timeSignature,
          subdivision: stage.subdivision,
          bars: BARS,
          loopCount: 1,
          displayMode: 'note_highway',
          events,
        },
      })
    }
  }

  return items
}
