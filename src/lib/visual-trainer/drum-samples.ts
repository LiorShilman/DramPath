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

const sampleCache = new WeakMap<AudioContext, Map<DrumInstrument, AudioBuffer>>()
const loadingStarted = new WeakSet<AudioContext>()

function getCacheFor(audioContext: AudioContext): Map<DrumInstrument, AudioBuffer> {
  let cache = sampleCache.get(audioContext)
  if (!cache) {
    cache = new Map()
    sampleCache.set(audioContext, cache)
  }
  return cache
}

async function loadSample(audioContext: AudioContext, instrument: DrumInstrument): Promise<void> {
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

// Fire-and-forget, idempotent per AudioContext (safe to call on every hit).
// Instruments whose file appears later — after this has already run — are
// not retried; reload the page to pick up newly-added sample files.
export function ensureDrumSamplesLoading(audioContext: AudioContext): void {
  if (loadingStarted.has(audioContext)) return
  loadingStarted.add(audioContext)
  for (const instrument of ALL_INSTRUMENTS) {
    void loadSample(audioContext, instrument)
  }
}

export function getDrumSample(audioContext: AudioContext, instrument: DrumInstrument): AudioBuffer | undefined {
  return sampleCache.get(audioContext)?.get(instrument)
}
