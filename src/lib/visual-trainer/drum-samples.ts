import type { DrumInstrument } from '../../domain'
import { withBaseUrl } from '../asset-url'

// Preparation for real drum samples (VISUAL_DRUM_TRAINER_SPEC.md §10's
// original ask, deferred in drum-synth.ts because no sample files existed
// in the project). Drop .wav/.mp3 files into public/audio/drums/ named
// after the instrument (kick.wav, snare.wav, hihat_closed.wav, ...) — see
// public/audio/drums/README.md — and they're picked up automatically, no
// code changes needed. A missing file is not an error: it's the expected
// state until real samples are added, and drum-synth.ts's synthesized
// sound keeps covering that instrument.
const SAMPLE_EXTENSIONS = ['wav', 'mp3'] as const

function candidatePaths(instrument: DrumInstrument): string[] {
  return SAMPLE_EXTENSIONS.map((extension) => withBaseUrl(`audio/drums/${instrument}.${extension}`))
}

// BaseAudioContext (not AudioContext) so an OfflineAudioContext — used by
// render-recording.ts to render a finished run's real hits back to audio —
// can share this exact same loading/caching path, not a parallel one.
const sampleCache = new WeakMap<BaseAudioContext, Map<DrumInstrument, AudioBuffer>>()
const loadingStarted = new WeakSet<BaseAudioContext>()

function getCacheFor(audioContext: BaseAudioContext): Map<DrumInstrument, AudioBuffer> {
  let cache = sampleCache.get(audioContext)
  if (!cache) {
    cache = new Map()
    sampleCache.set(audioContext, cache)
  }
  return cache
}

async function loadSample(audioContext: BaseAudioContext, instrument: DrumInstrument): Promise<void> {
  for (const path of candidatePaths(instrument)) {
    try {
      const response = await fetch(path)
      if (!response.ok) continue
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      getCacheFor(audioContext).set(instrument, audioBuffer)
      return
    } catch {
      // Network error, decode failure, etc. — try the next extension, or
      // fall through and keep this instrument on the synthesized sound.
    }
  }
}

const ALL_INSTRUMENTS: DrumInstrument[] = [
  'kick',
  'snare',
  'hihat_closed',
  'hihat_open',
  'ride',
  'crash',
  'tom_high',
  'tom_mid',
  'tom_floor',
]

async function loadAllSamples(audioContext: BaseAudioContext): Promise<void> {
  await Promise.all(ALL_INSTRUMENTS.map((instrument) => loadSample(audioContext, instrument)))
}

// Fire-and-forget, idempotent per AudioContext (safe to call on every hit).
// Instruments whose file appears later — after this has already run — are
// not retried; reload the page to pick up newly-added sample files.
export function ensureDrumSamplesLoading(audioContext: BaseAudioContext): void {
  if (loadingStarted.has(audioContext)) return
  loadingStarted.add(audioContext)
  void loadAllSamples(audioContext)
}

// Offline rendering (render-recording.ts) can't rely on the live-playback
// fire-and-forget + synchronous-fallback-to-synthesis path — every sample
// must be fully decoded before any hit is scheduled into the
// OfflineAudioContext, since there's no "wait for the network" luxury once
// startRendering() has been called. Shares loadingStarted with
// ensureDrumSamplesLoading so a later live-style call on the same context
// (playDrumSound calls it unconditionally) becomes a no-op instead of a
// redundant re-fetch.
export async function loadDrumSamplesEagerly(audioContext: BaseAudioContext): Promise<void> {
  if (loadingStarted.has(audioContext)) return
  loadingStarted.add(audioContext)
  await loadAllSamples(audioContext)
}

export function getDrumSample(audioContext: BaseAudioContext, instrument: DrumInstrument): AudioBuffer | undefined {
  return sampleCache.get(audioContext)?.get(instrument)
}
