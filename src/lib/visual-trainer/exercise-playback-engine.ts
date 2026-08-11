import { calculateBarDurationMs } from '../../domain/calculations/event-timing'
import { resolveEventScheduleMs, resolveMetronomeBeatScheduleMs } from '../../domain/calculations/exercise-schedule'
import { playDrumSound } from './drum-synth'
import { ensureStickClickSampleLoading, getStickClickSample } from './stick-click-sample'
import type { DrumNoteEvent, InteractiveExercise } from '../../domain'

const SCHEDULER_INTERVAL_MS = 25
const LOOKAHEAD_SECONDS = 0.1
const CLICK_DURATION_SECONDS = 0.03

export interface ExercisePlaybackStartOptions {
  countInBars?: number
  /** Fires as each drum event is actually scheduled — lets a later hit-matching stage correlate a HitResult with real audio timing. */
  onEventScheduled?: (event: DrumNoteEvent, audioTimeSeconds: number) => void
  /** Fires as each count-in beat (not a regular exercise beat) is actually
   * scheduled — lets a caller drive a "sticks clicking together" visual cue
   * in sync with the real audio, same lookahead-compensation pattern as
   * onEventScheduled above. Never fires when countInBars is 0. */
  onCountInBeatScheduled?: (audioTimeSeconds: number) => void
  /** Seek: skip straight to this point in the timeline (ms from the very
   * start, including any count-in) instead of always starting at 0 — beats/
   * events before it are simply never scheduled. Lets a caller (e.g. a
   * builder preview's clickable ruler) jump playback to an arbitrary point. */
  startOffsetMs?: number
  /** Whether the exercise's own drum notes play back on their own schedule
   * (the metronome click always does, regardless of this flag). Defaults to
   * true — every existing caller (demo runs, the builder/lesson preview)
   * wants the reference track playing itself. A real (manual) practice run
   * sets this false so the drums stay silent until the player actually
   * strikes them (see ExercisePlaybackEngine.playHitNow) — explicit user
   * request: hearing the exercise play itself made manual mode feel no
   * different from watching a demo. */
  playDrumEvents?: boolean
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
  // Kept separate from beatQueue (not just tagged) — count-in beats get a
  // distinct "sticks clicking together" sound/visual cue instead of the
  // regular metronome click, so tick() needs to tell the two apart.
  private countInBeatQueue: number[] = []
  private nextEventIndex = 0
  private nextBeatIndex = 0
  private nextCountInBeatIndex = 0
  private onEventScheduled?: (event: DrumNoteEvent, audioTimeSeconds: number) => void
  private onCountInBeatScheduled?: (audioTimeSeconds: number) => void

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

  /** Plays one drum hit right now, through the same drumGain node (and thus
   * the same volume/mixing) as the scheduled reference track — used for a
   * real player's own strikes when playDrumEvents is false, so pressing the
   * key is what produces the sound instead of the exercise's own timeline.
   * Velocity 100, no accent: matches every other user-triggered hit
   * elsewhere in the app (useFreeDrumPlayback, useTouchDrumPlayback) —
   * this isn't reproducing the original note's own velocity/accent, just
   * an immediate, consistent response to the player's strike. */
  playHitNow(instrument: DrumNoteEvent['instrument']): void {
    playDrumSound(this.audioContext, this.drumGain, this.audioContext.currentTime, instrument, 100)
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
    this.onCountInBeatScheduled = options.onCountInBeatScheduled
    ensureStickClickSampleLoading(this.audioContext)

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
    this.countInBeatQueue = countInBeatTimesMs
      .filter((timeMs) => timeMs >= startOffsetMs)
      .sort((a, b) => a - b)
      .map((timeMs) => this.startAudioTime + (timeMs - startOffsetMs) / 1000)
    this.beatQueue = exerciseBeatTimesMs
      .filter((timeMs) => timeMs >= startOffsetMs)
      .sort((a, b) => a - b)
      .map((timeMs) => this.startAudioTime + (timeMs - startOffsetMs) / 1000)
    this.eventQueue =
      options.playDrumEvents === false
        ? []
        : exerciseEventSchedule
            .filter(({ timeMs }) => timeMs >= startOffsetMs)
            .sort((a, b) => a.timeMs - b.timeMs)
            .map(({ event, timeMs }) => ({
              event,
              audioTimeSeconds: this.startAudioTime + (timeMs - startOffsetMs) / 1000,
            }))
    this.nextEventIndex = 0
    this.nextBeatIndex = 0
    this.nextCountInBeatIndex = 0

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

    while (
      this.nextCountInBeatIndex < this.countInBeatQueue.length &&
      this.countInBeatQueue[this.nextCountInBeatIndex]! < scheduleUntil
    ) {
      const audioTimeSeconds = this.countInBeatQueue[this.nextCountInBeatIndex]!
      this.playStickClick(audioTimeSeconds)
      this.onCountInBeatScheduled?.(audioTimeSeconds)
      this.nextCountInBeatIndex += 1
    }

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
    if (
      this.nextCountInBeatIndex >= this.countInBeatQueue.length &&
      this.nextBeatIndex >= this.beatQueue.length &&
      this.nextEventIndex >= this.eventQueue.length
    ) {
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

  // Count-in only (never the exercise's own beats) — a real recorded
  // stick-click sample (public/audio/drums/stick_click.wav, same
  // load-and-cache pattern as drum-samples.ts) when one's been added, same
  // "prefer sample, fall back to synthesis" contract as playDrumSound so
  // this never breaks before that file exists. The synthesized fallback is
  // a short high-passed noise knock — percussive and wood-like, deliberately
  // distinct from playMetronomeClick's sine tone so a click and a stick
  // click are never confused even without a real sample.
  private playStickClick(time: number): void {
    const sample = getStickClickSample(this.audioContext)
    if (sample) {
      const source = this.audioContext.createBufferSource()
      const gain = this.audioContext.createGain()
      source.buffer = sample
      gain.gain.setValueAtTime(1, time)
      source.connect(gain)
      gain.connect(this.metronomeGain)
      source.start(time)
      return
    }

    const durationSeconds = 0.05
    const source = this.audioContext.createBufferSource()
    const filter = this.audioContext.createBiquadFilter()
    const gain = this.audioContext.createGain()

    source.buffer = this.getOrCreateNoiseBuffer()
    filter.type = 'highpass'
    filter.frequency.value = 3000
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(1, time + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + durationSeconds)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.metronomeGain)
    source.start(time)
    source.stop(time + durationSeconds + 0.01)
  }

  // Reused across every synthesized stick-click hit (a source node is
  // single-use, but the underlying buffer data isn't) — same idea as
  // drum-synth.ts's own module-level noise buffer, kept private to this
  // class instead since it's the only synthesized sound this class needs
  // noise for.
  private noiseBuffer: AudioBuffer | null = null

  private getOrCreateNoiseBuffer(): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer
    const durationSeconds = 0.2
    const buffer = this.audioContext.createBuffer(
      1,
      this.audioContext.sampleRate * durationSeconds,
      this.audioContext.sampleRate,
    )
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1
    }
    this.noiseBuffer = buffer
    return buffer
  }
}
