import type { DrumInstrument } from '../../domain'
import { ensureDrumSamplesLoading, getDrumSample } from './drum-samples'

// VISUAL_DRUM_TRAINER_SPEC.md §10 asks for real sample files (kick.wav,
// snare.wav, ...). None shipped with the project originally, so every drum
// sound was synthesized in code instead — oscillators and filtered noise
// bursts shaped by a short gain envelope, same technique the project's
// existing metronome click already uses (MetronomeEngine.playClick,
// src/lib/metronome-engine.ts). drum-samples.ts now checks for real files
// under public/audio/drums/ per instrument; playDrumSound below prefers a
// loaded sample and only falls back to synthesis when one isn't available,
// so this still works with zero files present (today's state) and starts
// sounding more realistic the moment real samples are added — no other
// code changes needed.

// A short white-noise buffer, cached per AudioContext (a new context needs
// its own buffer; AudioBuffers aren't portable across contexts) and reused
// by every noise-based hit's own AudioBufferSourceNode (source nodes are
// single-use, but the underlying buffer data can be read by many of them).
const noiseBufferCache = new WeakMap<AudioContext, AudioBuffer>()

function getNoiseBuffer(audioContext: AudioContext): AudioBuffer {
  const cached = noiseBufferCache.get(audioContext)
  if (cached) return cached

  const durationSeconds = 1
  const buffer = audioContext.createBuffer(1, audioContext.sampleRate * durationSeconds, audioContext.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1
  }
  noiseBufferCache.set(audioContext, buffer)
  return buffer
}

// Exponential ramps can't target/start at exactly 0, so envelopes bottom
// out at a small positive floor instead of true silence.
const GAIN_FLOOR = 0.0001

function scheduleGainEnvelope(gain: GainNode, time: number, peakGain: number, durationSeconds: number): void {
  const attackSeconds = Math.min(0.005, durationSeconds / 4)
  gain.gain.setValueAtTime(GAIN_FLOOR, time)
  gain.gain.exponentialRampToValueAtTime(Math.max(peakGain, GAIN_FLOOR), time + attackSeconds)
  gain.gain.exponentialRampToValueAtTime(GAIN_FLOOR, time + durationSeconds)
}

function playPitchedHit(
  audioContext: AudioContext,
  outputNode: AudioNode,
  time: number,
  startFrequency: number,
  endFrequency: number,
  durationSeconds: number,
  peakGain: number,
  oscillatorType: OscillatorType = 'sine',
): void {
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()

  oscillator.type = oscillatorType
  oscillator.frequency.setValueAtTime(startFrequency, time)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(endFrequency, 1), time + durationSeconds * 0.6)
  scheduleGainEnvelope(gain, time, peakGain, durationSeconds)

  oscillator.connect(gain)
  gain.connect(outputNode)
  oscillator.start(time)
  oscillator.stop(time + durationSeconds + 0.02)
}

function playSampleHit(
  audioContext: AudioContext,
  outputNode: AudioNode,
  time: number,
  buffer: AudioBuffer,
  peakGain: number,
): void {
  const source = audioContext.createBufferSource()
  const gain = audioContext.createGain()

  source.buffer = buffer
  gain.gain.setValueAtTime(Math.max(peakGain, GAIN_FLOOR), time)

  source.connect(gain)
  gain.connect(outputNode)
  source.start(time)
}

function playNoiseHit(
  audioContext: AudioContext,
  outputNode: AudioNode,
  time: number,
  durationSeconds: number,
  peakGain: number,
  filterType: BiquadFilterType,
  filterFrequency: number,
  filterQ = 1,
): void {
  const source = audioContext.createBufferSource()
  const filter = audioContext.createBiquadFilter()
  const gain = audioContext.createGain()

  source.buffer = getNoiseBuffer(audioContext)
  filter.type = filterType
  filter.frequency.value = filterFrequency
  filter.Q.value = filterQ
  scheduleGainEnvelope(gain, time, peakGain, durationSeconds)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(outputNode)
  source.start(time)
  source.stop(time + durationSeconds + 0.02)
}

/**
 * Schedules one drum hit at `time` (AudioContext.currentTime-relative).
 * `velocity` is MIDI-style (0-127); `accent` gives a further gain boost.
 */
export function playDrumSound(
  audioContext: AudioContext,
  outputNode: AudioNode,
  time: number,
  instrument: DrumInstrument,
  velocity: number,
  accent = false,
): void {
  ensureDrumSamplesLoading(audioContext)

  const peakGain = Math.min(1, (velocity / 127) * (accent ? 1.2 : 1))

  const sample = getDrumSample(audioContext, instrument)
  if (sample) {
    playSampleHit(audioContext, outputNode, time, sample, peakGain)
    return
  }

  switch (instrument) {
    case 'kick':
      playPitchedHit(audioContext, outputNode, time, 150, 50, 0.15, peakGain, 'sine')
      return
    case 'snare':
      playNoiseHit(audioContext, outputNode, time, 0.12, peakGain, 'bandpass', 1800, 1)
      playPitchedHit(audioContext, outputNode, time, 180, 120, 0.08, peakGain * 0.6, 'triangle')
      return
    case 'hihat_closed':
      playNoiseHit(audioContext, outputNode, time, 0.04, peakGain * 0.8, 'highpass', 7000)
      return
    case 'hihat_open':
      playNoiseHit(audioContext, outputNode, time, 0.25, peakGain * 0.8, 'highpass', 6000)
      return
    case 'ride':
      playNoiseHit(audioContext, outputNode, time, 0.4, peakGain * 0.7, 'bandpass', 5000, 2)
      return
    case 'crash':
      playNoiseHit(audioContext, outputNode, time, 0.8, peakGain, 'highpass', 4000)
      return
    case 'tom_high':
      playPitchedHit(audioContext, outputNode, time, 300, 180, 0.2, peakGain, 'sine')
      return
    case 'tom_mid':
      playPitchedHit(audioContext, outputNode, time, 200, 120, 0.25, peakGain, 'sine')
      return
    case 'tom_floor':
      playPitchedHit(audioContext, outputNode, time, 120, 70, 0.3, peakGain, 'sine')
      return
  }
}
