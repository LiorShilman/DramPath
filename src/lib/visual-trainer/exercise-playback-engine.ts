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
  /** Seek: skip straight to this point in the timeline (ms from the very
   * start, including any count-in) instead of always starting at 0 — beats/
   * events before it are simply never scheduled. Lets a caller (e.g. a
   * builder preview's clickable ruler) jump playback to an arbitrary point. */
  startOffsetMs?: number
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
  private paused = false
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

  get isPaused(): boolean {
    return this.paused
  }

  /** AudioContext.currentTime the current playback's timeline is anchored
   * to — lets a caller's own visual rAF loop (e.g. NoteHighway's render
   * clock) stay exactly in sync with the audio, instead of separately
   * approximating the same "+0.05" lead time. */
  get startAudioTimeSeconds(): number {
    return this.startAudioTime
  }

  start(exercise: InteractiveExercise, options: ExercisePlaybackStartOptions = {}): void {
    this.stop()
    this.paused = false
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

    const startOffsetMs = Math.max(0, options.startOffsetMs ?? 0)

    this.startAudioTime = this.audioContext.currentTime + 0.05
    this.beatQueue = [...countInBeatTimesMs, ...exerciseBeatTimesMs]
      .filter((timeMs) => timeMs >= startOffsetMs)
      .sort((a, b) => a - b)
      .map((timeMs) => this.startAudioTime + (timeMs - startOffsetMs) / 1000)
    this.eventQueue = exerciseEventSchedule
      .filter(({ timeMs }) => timeMs >= startOffsetMs)
      .sort((a, b) => a.timeMs - b.timeMs)
      .map(({ event, timeMs }) => ({ event, audioTimeSeconds: this.startAudioTime + (timeMs - startOffsetMs) / 1000 }))
    this.nextEventIndex = 0
    this.nextBeatIndex = 0

    this.schedulerId = setInterval(() => this.tick(), SCHEDULER_INTERVAL_MS)
  }

  stop(): void {
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId)
      this.schedulerId = null
    }
    this.paused = false
  }

  dispose(): void {
    this.stop()
  }

  /** True pause: AudioContext.suspend() freezes currentTime itself, so
   * every sound already scheduled (oscillator/buffer-source start times
   * set against the audio clock) simply waits rather than needing to be
   * rescheduled — resume() continues exactly where it left off. The JS
   * poller is also stopped so it doesn't spin uselessly while frozen. */
  pause(): void {
    if (this.schedulerId === null || this.paused) return
    this.paused = true
    clearInterval(this.schedulerId)
    this.schedulerId = null
    void this.audioContext.suspend()
  }

  resumeFromPause(): void {
    if (!this.paused) return
    this.paused = false
    void this.audioContext.resume()
    this.schedulerId = setInterval(() => this.tick(), SCHEDULER_INTERVAL_MS)
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
  // unrelated, already-shipped class — but boosted well past that original
  // click's own gain/pitch (0.6 peak @ 900Hz). Unlike the standalone
  // metronome (which always plays alone), this one has to be heard *under*
  // real recorded drum-sample WAVs (public/audio/drums/) that frequently
  // land on the exact same beat (e.g. hihat covering every subdivision from
  // stage 2 onward) — a thin sine tone at a modest peak gain was getting
  // completely buried under that far richer/louder material (confirmed by
  // the user: no lesson had an audibly distinguishable click). A higher,
  // sharper pitch cuts through a mix better than a soft tone, and a gain
  // past 1.0 is safe for a ~30ms transient (GainNode isn't destructive-clip
  // limited the way analog gear is) — the same deliberate "let a short
  // click distort a little for attack" trick real click generators use.
  private playMetronomeClick(time: number): void {
    const oscillator = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()

    oscillator.frequency.value = 1400
    gain.gain.setValueAtTime(0.001, time)
    gain.gain.exponentialRampToValueAtTime(1.5, time + 0.003)
    gain.gain.exponentialRampToValueAtTime(0.001, time + CLICK_DURATION_SECONDS)

    oscillator.connect(gain)
    gain.connect(this.metronomeGain)
    oscillator.start(time)
    oscillator.stop(time + CLICK_DURATION_SECONDS + 0.01)
  }
}
