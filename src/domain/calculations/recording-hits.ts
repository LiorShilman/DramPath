import type { HitResult, ExtraHitEvent } from '../hit-result'
import type { DrumInstrument } from '../interactive-exercise'

export interface RecordingHit {
  instrument: DrumInstrument
  timeMs: number
  velocity: number
}

// Keyboard/phone hits carry no real MIDI velocity (HitResult.actualVelocity/
// ExtraHitEvent.velocity are both undefined there) — falls back to the same
// flat NOTE_VELOCITY every authored note in this app already uses (see
// ExerciseBuilderPage.tsx/generate-curriculum.ts), so a recording made from
// a non-MIDI run still has a sensible, consistent loudness.
const DEFAULT_VELOCITY = 100

// Builds the flat, chronological hit list render-recording.ts replays into
// an OfflineAudioContext — every hit that actually made a sound during the
// run, real and extra alike. A miss never does (HitResult.actualTimeMs is
// only set when a real keypress was matched), so those are naturally
// excluded just by filtering on actualTimeMs being defined.
export function buildRecordingHits(hitResults: HitResult[], extraHits: ExtraHitEvent[]): RecordingHit[] {
  const fromResults: RecordingHit[] = hitResults
    .filter((result): result is HitResult & { actualTimeMs: number } => result.actualTimeMs !== undefined)
    .map((result) => ({
      instrument: result.instrument,
      timeMs: result.actualTimeMs,
      velocity: result.actualVelocity ?? DEFAULT_VELOCITY,
    }))
  const fromExtras: RecordingHit[] = extraHits.map((extraHit) => ({
    instrument: extraHit.instrument,
    timeMs: extraHit.hitTimeMs,
    velocity: extraHit.velocity ?? DEFAULT_VELOCITY,
  }))
  return [...fromResults, ...fromExtras].sort((a, b) => a.timeMs - b.timeMs)
}
