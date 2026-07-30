import { calculateBarDurationMs } from '../../domain/calculations/event-timing'
import { resolveEventScheduleMs, resolveMetronomeBeatScheduleMs } from '../../domain/calculations/exercise-schedule'
import { playDrumSound } from './drum-synth'
import type { DrumNoteEvent, InteractiveExercise } from '../../domain'

const SCHEDULER_INTERVAL_MS = 25
const LOOKAHEAD_SECONDS = 0.1
const CLICK_DURATION_SECONDS = 0.03

export interface ExercisePlaybackStartOptions {
  countInBars?: number
  /** Fires as each drum event is actually scheduled — lets a later hit-matching stage correlate a HitResult with real audio timing. */
  onEventScheduled?: (event: DrumNoteEvent, audioTimeSeconds: number) => void
}

interface QueuedEvent {
  event: DrumNoteEvent
  audioTimeSeconds: number
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * Plays one InteractiveExercise: a metronome click track (including an
 * optional count-in) plus a synthesized drum sound for every DrumNoteEvent,
 * scheduled against AudioContext.currentTime with a lookahead window — same
 * pattern as MetronomeEngine (src/lib/metronome-engine.ts), which stays
 * untouched and keeps serving the unrelated existing practice-session
 * metronome. Not unit-tested (jsdom has no Web Audio implementation, same
 * documented limitation as MetronomeEngine) — the scheduling *decisions*
 * this class acts on live in the fully-tested pure functions it calls
 * (resolveEventScheduleMs / resolveMetronomeBeatScheduleMs).
 */
export class ExercisePlaybackEngine {
  private readonly audioContext: AudioContext
  private readonly masterGain: GainNode
  private readonly drumGain: GainNode
  private readonly metronomeGain: GainNode

  private schedulerId: ReturnType<typeof setInterval> | null = null
  private startAudioTime = 0
  private eventQueue: QueuedEvent[] = []
  private beatQueue: number[] = []
  private nextEventIndex = 0
  private nextBeatIndex = 0
  private onEventScheduled?: (event: DrumNoteEvent, audioTimeSeconds: number) => void

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
    this.masterGain = audioContext.createGain()
    this.drumGain = audioContext.createGain()
    this.metronomeGain = audioContext.createGain()
    this.drumGain.connect(this.masterGain)
    this.metronomeGain.connect(this.masterGain)
    this.masterGain.connect(audioContext.destination)
  }

  setMasterVolume(volume: number): void {
    this.masterGain.gain.value = clamp01(volume)
  }

  setDrumVolume(volume: number): void {
    this.drumGain.gain.value = clamp01(volume)
  }

  setMetronomeVolume(volume: number): void {
    this.metronomeGain.gain.value = clamp01(volume)
  }

  get isRunning(): boolean {
    return this.schedulerId !== null
  }

  start(exercise: InteractiveExercise, options: ExercisePlaybackStartOptions = {}): void {
    this.stop()
    this.onEventScheduled = options.onEventScheduled

    const countInBars = options.countInBars ?? 0
    const barDurationMs = calculateBarDurationMs(exercise.bpm, exercise.timeSignature)
    const beatDurationMs = barDurationMs / exercise.timeSignature.numerator
    const countInDurationMs = countInBars * barDurationMs

    const countInBeatTimesMs: number[] = []
    for (let bar = 0; bar < countInBars; bar += 1) {
      for (let beat = 0; beat < exercise.timeSignature.numerator; beat += 1) {
        countInBeatTimesMs.push(bar * barDurationMs + beat * beatDurationMs)
      }
    }

    const exerciseBeatTimesMs = resolveMetronomeBeatScheduleMs(exercise).map((timeMs) => timeMs + countInDurationMs)
    const exerciseEventSchedule = resolveEventScheduleMs(exercise).map(({ event, timeMs }) => ({
      event,
      timeMs: timeMs + countInDurationMs,
    }))

    this.startAudioTime = this.audioContext.currentTime + 0.05
    this.beatQueue = [...countInBeatTimesMs, ...exerciseBeatTimesMs]
      .sort((a, b) => a - b)
      .map((timeMs) => this.startAudioTime + timeMs / 1000)
    this.eventQueue = exerciseEventSchedule
      .sort((a, b) => a.timeMs - b.timeMs)
      .map(({ event, timeMs }) => ({ event, audioTimeSeconds: this.startAudioTime + timeMs / 1000 }))
    this.nextEventIndex = 0
    this.nextBeatIndex = 0

    this.schedulerId = setInterval(() => this.tick(), SCHEDULER_INTERVAL_MS)
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
    const scheduleUntil = this.audioContext.currentTime + LOOKAHEAD_SECONDS

    while (this.nextBeatIndex < this.beatQueue.length && this.beatQueue[this.nextBeatIndex]! < scheduleUntil) {
      this.playMetronomeClick(this.beatQueue[this.nextBeatIndex]!)
      this.nextBeatIndex += 1
    }

    while (
      this.nextEventIndex < this.eventQueue.length &&
      this.eventQueue[this.nextEventIndex]!.audioTimeSeconds < scheduleUntil
    ) {
      const { event, audioTimeSeconds } = this.eventQueue[this.nextEventIndex]!
      playDrumSound(this.audioContext, this.drumGain, audioTimeSeconds, event.instrument, event.velocity, event.accent)
      this.onEventScheduled?.(event, audioTimeSeconds)
      this.nextEventIndex += 1
    }

    // Every beat/event has been handed off to the Web Audio scheduler —
    // nothing left for this JS-side poller to do (already-scheduled sounds
    // keep playing on their own; this only stops us from looking for more).
    if (this.nextBeatIndex >= this.beatQueue.length && this.nextEventIndex >= this.eventQueue.length) {
      this.stop()
    }
  }

  // Same synthesis technique as MetronomeEngine.playClick (src/lib/metronome-engine.ts),
  // duplicated in miniature rather than exporting a private method from that
  // unrelated, already-shipped class.
  private playMetronomeClick(time: number): void {
    const oscillator = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()

    oscillator.frequency.value = 900
    gain.gain.setValueAtTime(0.001, time)
    gain.gain.exponentialRampToValueAtTime(0.6, time + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, time + CLICK_DURATION_SECONDS)

    oscillator.connect(gain)
    gain.connect(this.metronomeGain)
    oscillator.start(time)
    oscillator.stop(time + CLICK_DURATION_SECONDS + 0.01)
  }
}
