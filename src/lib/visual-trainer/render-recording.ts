import { playDrumSound } from './drum-synth'
import { loadDrumSamplesEagerly } from './drum-samples'
import type { RecordingHit } from '../../domain/calculations/recording-hits'

const SAMPLE_RATE = 44100
// Headroom past the last scheduled hit so a long-decay sample (crash/ride/
// open hihat, which routinely ring 1-3s — see public/audio/drums/README.md)
// isn't cut off mid-ring by the render buffer simply ending.
const TAIL_SECONDS = 2

// Replays a finished run's own real hits (real timing, real velocity, same
// drum sounds as live playback) through an OfflineAudioContext — renders
// far faster than real-time and produces a deterministic AudioBuffer ready
// for encode-mp3.ts. Reuses playDrumSound/loadDrumSamplesEagerly verbatim
// (both were widened from AudioContext to BaseAudioContext for exactly this
// reuse) rather than a parallel offline-only synthesis path.
export async function renderRecording(hits: RecordingHit[], durationMs: number): Promise<AudioBuffer> {
  const durationSeconds = durationMs / 1000 + TAIL_SECONDS
  const frameCount = Math.max(1, Math.ceil(SAMPLE_RATE * durationSeconds))
  const offlineContext = new OfflineAudioContext(1, frameCount, SAMPLE_RATE)

  await loadDrumSamplesEagerly(offlineContext)

  const masterGain = offlineContext.createGain()
  masterGain.connect(offlineContext.destination)

  for (const hit of hits) {
    playDrumSound(offlineContext, masterGain, hit.timeMs / 1000, hit.instrument, hit.velocity)
  }

  return offlineContext.startRendering()
}
