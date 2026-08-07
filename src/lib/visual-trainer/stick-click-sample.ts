import { withBaseUrl } from '../asset-url'

// Same idea as drum-samples.ts, but for the single count-in "stick click"
// sound (not a DrumInstrument — it's never scored/hit, just a count-in
// audio+visual cue) — kept as its own tiny module instead of folding into
// drum-samples.ts's DrumInstrument-keyed cache, which would misrepresent it
// as a playable/scorable kit piece. Drop stick_click.wav/.mp3 into
// public/audio/drums/ and it's picked up automatically, same as any other
// sample; missing file is expected until then, not an error (see
// exercise-playback-engine.ts's playStickClick synthesized fallback).
const SAMPLE_EXTENSIONS = ['wav', 'mp3'] as const

function candidatePaths(): string[] {
  return SAMPLE_EXTENSIONS.map((extension) => withBaseUrl(`audio/drums/stick_click.${extension}`))
}

const sampleCache = new WeakMap<AudioContext, AudioBuffer>()
const loadingStarted = new WeakSet<AudioContext>()

async function loadSample(audioContext: AudioContext): Promise<void> {
  for (const path of candidatePaths()) {
    try {
      const response = await fetch(path)
      if (!response.ok) continue
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      sampleCache.set(audioContext, audioBuffer)
      return
    } catch {
      // Network error, decode failure, etc. — try the next extension, or
      // fall through and keep the synthesized fallback click.
    }
  }
}

// Fire-and-forget, idempotent per AudioContext (safe to call on every count-in).
export function ensureStickClickSampleLoading(audioContext: AudioContext): void {
  if (loadingStarted.has(audioContext)) return
  loadingStarted.add(audioContext)
  void loadSample(audioContext)
}

export function getStickClickSample(audioContext: AudioContext): AudioBuffer | undefined {
  return sampleCache.get(audioContext)
}
