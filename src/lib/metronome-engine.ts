import type { Subdivision } from '../domain'
import { NOTES_PER_BEAT, subdivisionIntervalSeconds } from './metronome-math'

const SCHEDULER_INTERVAL_MS = 25
const LOOKAHEAD_SECONDS = 0.1
const CLICK_DURATION_SECONDS = 0.03
const BEATS_PER_BAR = 4 // §16: 4/4 only for now; 3/4, 6/8 are future work.

export interface MetronomeStartOptions {
  bpm: number
  subdivision: Subdivision
  accentFirstBeat: boolean
  countInBars: number
  /** Fires once per beat (not per subdivision tick), timed to the audio clock. */
  onBeat?: (beatIndexInBar: number, isCountIn: boolean) => void
  /** Fires on every scheduled click, including the "and" subdivisions
   * onBeat skips — e.g. a sticking-pattern display that needs to know
   * which subdivision within the beat is playing right now, not just which
   * beat. subdivisionIndexInBeat matches DrumNoteEvent's own convention
   * (0-indexed, 0 = the beat itself). */
  onSubTick?: (beatIndexInBar: number, subdivisionIndexInBeat: number, isCountIn: boolean) => void
}

/**
 * §16 quality bar: scheduling goes through AudioContext.currentTime with a
 * lookahead window, not bare setInterval — the polling interval's jitter
 * never reaches the actual click timing. Not unit-tested (jsdom has no Web
 * Audio implementation); verified manually against a real browser.
 */
export class MetronomeEngine {
  private schedulerId: ReturnType<typeof setInterval> | null = null
  private nextNoteTime = 0
  private subTickIndex = 0
  private countInTicks = 0

  private bpm = 80
  private subdivision: Subdivision = 'quarter'
  private accentFirstBeat = true
  private onBeat?: (beatIndexInBar: number, isCountIn: boolean) => void
  private onSubTick?: (beatIndexInBar: number, subdivisionIndexInBeat: number, isCountIn: boolean) => void
  private readonly audioContext: AudioContext

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
  }

  start(options: MetronomeStartOptions): void {
    this.stop()
    this.bpm = options.bpm
    this.subdivision = options.subdivision
    this.accentFirstBeat = options.accentFirstBeat
    this.onBeat = options.onBeat
    this.onSubTick = options.onSubTick
    this.subTickIndex = 0
    this.countInTicks = options.countInBars * BEATS_PER_BAR * NOTES_PER_BEAT[options.subdivision]
    this.nextNoteTime = this.audioContext.currentTime + 0.05
    this.schedulerId = setInterval(() => this.tick(), SCHEDULER_INTERVAL_MS)
  }

  updateBpm(bpm: number): void {
    this.bpm = bpm
  }

  updateSubdivision(subdivision: Subdivision): void {
    this.subdivision = subdivision
  }

  updateAccentFirstBeat(accentFirstBeat: boolean): void {
    this.accentFirstBeat = accentFirstBeat
  }

  get isRunning(): boolean {
    return this.schedulerId !== null
  }

  stop(): void {
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId)
      this.schedulerId = null
    }
  }

  dispose(): void {
    this.stop()
  }

  private tick(): void {
    while (this.nextNoteTime < this.audioContext.currentTime + LOOKAHEAD_SECONDS) {
      this.scheduleNote(this.nextNoteTime, this.subTickIndex)
      this.nextNoteTime += subdivisionIntervalSeconds(this.bpm, this.subdivision)
      this.subTickIndex += 1
    }
  }

  private scheduleNote(time: number, subTickIndex: number): void {
    const notesPerBeat = NOTES_PER_BEAT[this.subdivision]
    const beatIndexInBar = Math.floor(subTickIndex / notesPerBeat) % BEATS_PER_BAR
    const isFirstSubTickOfBeat = subTickIndex % notesPerBeat === 0
    const isCountIn = subTickIndex < this.countInTicks
    const isAccent = this.accentFirstBeat && isFirstSubTickOfBeat && beatIndexInBar === 0

    this.playClick(time, isAccent)

    const delayMs = Math.max(0, (time - this.audioContext.currentTime) * 1000)

    if (isFirstSubTickOfBeat && this.onBeat) {
      const onBeat = this.onBeat
      setTimeout(() => onBeat(beatIndexInBar, isCountIn), delayMs)
    }

    if (this.onSubTick) {
      const subdivisionIndexInBeat = subTickIndex % notesPerBeat
      const onSubTick = this.onSubTick
      setTimeout(() => onSubTick(beatIndexInBar, subdivisionIndexInBeat, isCountIn), delayMs)
    }
  }

  // Synthesized click (§16: no network-dependent audio file) — a short
  // oscillator burst, higher-pitched for the accented first beat.
  private playClick(time: number, accent: boolean): void {
    const oscillator = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()

    oscillator.frequency.value = accent ? 1500 : 900
    gain.gain.setValueAtTime(0.001, time)
    gain.gain.exponentialRampToValueAtTime(accent ? 0.9 : 0.6, time + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, time + CLICK_DURATION_SECONDS)

    oscillator.connect(gain)
    gain.connect(this.audioContext.destination)
    oscillator.start(time)
    oscillator.stop(time + CLICK_DURATION_SECONDS + 0.01)
  }
}
