import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { ExercisePlaybackEngine } from '../lib/visual-trainer/exercise-playback-engine'
import { convertHitTimeToExerciseElapsedMs } from '../lib/visual-trainer/clock-sync-math'
import { calculateBarDurationMs } from '../domain/calculations/event-timing'
import { resolveEventScheduleMs } from '../domain/calculations/exercise-schedule'
import { GRADING_THRESHOLDS, detectMissedEvents, findMatchingEvent, gradeTimingError } from '../domain/calculations/hit-matcher'
import type { PendingDrumEvent } from '../domain/calculations/hit-matcher'
import { summarizeScoring } from '../domain/calculations/scoring-engine'
import { useKeyboardDrums } from './useKeyboardDrums'
import { useRemoteDrumInput } from './useRemoteDrumInput'
import type { RemoteDrumInputStatus } from './useRemoteDrumInput'
import { useMidiDrumInput } from './useMidiDrumInput'
import type { MidiDrumInputStatus } from './useMidiDrumInput'
import { createId } from '../domain'
import type { DisplayMode, DrumInstrument, ExtraHitEvent, HitGrade, HitResult, InteractiveExercise, ScoringSummary } from '../domain'
import type { NoteHighwayHandle } from '../components/visual-trainer/NoteHighway'

export type VisualTrainerPhase = 'idle' | 'count-in' | 'running' | 'paused' | 'finished'

export interface GradeCounts {
  perfect: number
  early: number
  late: number
  miss: number
  extra: number
}

export interface UseVisualTrainerResult {
  phase: VisualTrainerPhase
  /** True for a run started via startDemo() — the exercise plays itself
   * (audio + drum kit + keyboard-key flashes, all off the same activeHits
   * the UI already renders for a real run), no keyboard input accepted, and
   * every note auto-resolves as a 'perfect' hit rather than being graded
   * against real keypresses. */
  isDemo: boolean
  scoring: ScoringSummary
  gradeCounts: GradeCounts
  lastGrade: HitGrade | 'extra' | undefined
  activeHits: Partial<Record<DrumInstrument, string>>
  /** A fresh id on every count-in beat — feeds DrumKit's "sticks clicking
   * together" count-off animation, same remount-per-token pattern as
   * activeHits. undefined outside of an active count-in. */
  stickClickToken: string | undefined
  /** Per-event grading result, for displayMode 'staff_cursor' — the
   * ExerciseNotationSheet equivalent of NoteHighway's own imperative
   * markResult flash, since that component is driven by props/state, not a
   * ref. Updated alongside (not instead of) the NoteHighway ref calls below
   * — both are cheap to keep current regardless of which display is
   * actually mounted. */
  gradedEventIds: ReadonlyMap<string, 'hit' | 'miss'>
  /** Bumped on every beginPlayback — feeds ExerciseNotationSheet's own
   * playbackProgress.sessionId so its CSS fill/cursor animations restart
   * on a new run instead of no-oping on an unchanged style, same idea as
   * useExercisePreviewPlayback's playSessionId. */
  playSessionId: number
  /** ms of count-in before the exercise's own bar 1 in the *current* run
   * (0 once a count-in was skipped, e.g. after a seek). Negate this into
   * ExerciseNotationSheet's playbackProgress.startOffsetMs so its
   * animation-delay accounts for the count-in the same way NoteHighway's
   * own elapsedMs already does. */
  countInDurationMs: number
  /** ms offset the current run actually started/seeked to (0 for a normal
   * start from bar 1). Combine with countInDurationMs into
   * ExerciseNotationSheet's playbackProgress.startOffsetMs
   * (seekOffsetMs - countInDurationMs) so a seek moves the notation
   * cursor/fill in lockstep with the audio and scoring, not just the count-in. */
  seekOffsetMs: number
  currentBar: number
  currentBeat: number
  /** ms elapsed since the exercise itself started (count-in excluded, same
   * as currentBar/currentBeat) — clamped to 0, updated on the same
   * BAR_UPDATE_INTERVAL_MS cadence as the bar/beat indicators. */
  elapsedMs: number
  start: () => void
  startDemo: () => void
  /** Jumps a running demo to an arbitrary point in the exercise (ms from
   * its own start, count-in excluded) — skips any count-in and starts
   * playing immediately from there. Demo-only — always restarts as a demo
   * regardless of what was running before; use `seek` to jump the
   * currently-active run (demo or real) instead. */
  seekDemo: (offsetMs: number) => void
  /** Jumps whichever run is currently active (demo or real) to an arbitrary
   * point — see its own doc comment above `seek`'s definition for the
   * scoring tradeoff a mid-real-run seek accepts. */
  seek: (offsetMs: number) => void
  pause: () => void
  resume: () => void
  restart: () => void
  exit: () => void
  /** Phone-as-remote-controller (ADR 0007) — off by default, persisted
   * across sessions since it's a standing setup choice, not per-run state. */
  isPhoneControlEnabled: boolean
  togglePhoneControl: () => void
  remoteStatus: RemoteDrumInputStatus
  /** Real e-kit input over Web MIDI (see useMidiDrumInput/midi-drum-map.ts)
   * — off by default, persisted across sessions, same reasoning as
   * isPhoneControlEnabled. A MIDI hit is graded and sounded exactly like a
   * keyboard hit (explicit user request — hearing it only through the
   * e-kit's own module felt inconsistent with every other input method). */
  isMidiControlEnabled: boolean
  toggleMidiControl: () => void
  midiStatus: MidiDrumInputStatus
  /** Off by default, persisted across sessions — mutes only the click
   * track, not the exercise's own drum-note sounds. Explicit user request:
   * no way to silence the metronome during practice. */
  isMetronomeMuted: boolean
  toggleMetronomeMute: () => void
}

const PHONE_CONTROL_ENABLED_STORAGE_KEY = 'drumpath.isPhoneControlEnabled'
const MIDI_CONTROL_ENABLED_STORAGE_KEY = 'drumpath.isMidiControlEnabled'
const METRONOME_MUTED_STORAGE_KEY = 'drumpath.isMetronomeMuted'

const COUNT_IN_BARS = 1
const BAR_UPDATE_INTERVAL_MS = 200

// staff_cursor-only grading correction (explicit user request/investigation,
// retuned after live testing). Two layers, both making the *grading* target
// earlier than the raw audio-schedule time — the visuals themselves are
// untouched, only which moment counts as "on time":
// - BASE applies to every instrument: reported directly, a hit needs to land
//   a little before the cursor visually reaches the note or it reads as a
//   miss, for every instrument, not just kick — most likely the CSS
//   animation's own paint lagging a step behind the AudioContext clock it's
//   timed against, not any one note's geometry.
// - An extra FEET_EXTRA on top for kick specifically: kick's own notehead is
//   drawn to the *right* of its stem (real drum-notation convention — feet
//   voice stems down-and-left of the circle; see ExerciseNotationSheet's
//   voiceOf/stemDirection), so the cursor's left-to-right sweep reaches a
//   kick note's stem before its true rhythmic x — confirmed against the
//   app's own early/late feedback (kick read "early" more than other
//   instruments). Kick is currently the only 'feet'-voice instrument
//   (DrumInstrument's other members are all 'hands'), so a direct instrument
//   check is equivalent to a voice check without importing
//   ExerciseNotationSheet's own classification into a hook.
// NoteHighway has no equivalent visual (falling rectangles, no cursor/stem),
// so none of this applies outside staff_cursor. Starting magnitudes, not
// derived from exact pixel/frame-timing measurement — expect further
// retuning from live feedback.
const STAFF_CURSOR_BASE_TIMING_BIAS_MS = 25
const STAFF_CURSOR_FEET_EXTRA_TIMING_BIAS_MS = 15

function applyStaffCursorTimingBias(instrument: DrumInstrument, expectedTimeMs: number, displayMode: DisplayMode): number {
  if (displayMode !== 'staff_cursor') return expectedTimeMs
  const bias = STAFF_CURSOR_BASE_TIMING_BIAS_MS + (instrument === 'kick' ? STAFF_CURSOR_FEET_EXTRA_TIMING_BIAS_MS : 0)
  return expectedTimeMs - bias
}
const EMPTY_SCORING: ScoringSummary = {
  accuracyPercent: 0,
  currentCombo: 0,
  bestCombo: 0,
  averageTimingErrorMs: undefined,
}
const EMPTY_GRADE_COUNTS: GradeCounts = { perfect: 0, early: 0, late: 0, miss: 0, extra: 0 }

function countGrades(hitResults: HitResult[], extraHits: ExtraHitEvent[]): GradeCounts {
  const counts: GradeCounts = { perfect: 0, early: 0, late: 0, miss: 0, extra: 0 }
  for (const result of hitResults) counts[result.grade] += 1
  counts.extra = extraHits.length
  return counts
}

/**
 * VISUAL_DRUM_TRAINER_SPEC.md §14's ExerciseRunner/useVisualTrainer —
 * orchestrates one InteractiveExercise run: audio playback (Stage 2),
 * keyboard input (Stage 3), hit matching + scoring (Stage 1), and driving
 * NoteHighway's imperative render() (Stage 4), without persisting anything
 * (that's Stage 6). Hit-matching/miss-detection decisions are pure
 * function calls into the already-tested Stage 1 modules; this hook's own
 * job is state/lifecycle orchestration around them.
 */
export function useVisualTrainer(
  exercise: InteractiveExercise,
  noteHighwayRef: RefObject<NoteHighwayHandle | null>,
  // The screen's own runtime display-mode choice (VisualTrainerPage's
  // selectedDisplayMode) — can differ from exercise.displayMode now that the
  // picker applies to real practice too, and grading needs to know which
  // visual is actually on screen for applyStaffCursorTimingBias above.
  // Defaults to the exercise's own saved value for any other caller.
  displayMode: DisplayMode = exercise.displayMode,
): UseVisualTrainerResult {
  const [phase, setPhase] = useState<VisualTrainerPhase>('idle')
  const [isDemo, setIsDemo] = useState(false)
  const [isPhoneControlEnabled, setIsPhoneControlEnabled] = useState(
    () => localStorage.getItem(PHONE_CONTROL_ENABLED_STORAGE_KEY) === 'true',
  )
  const [isMidiControlEnabled, setIsMidiControlEnabled] = useState(
    () => localStorage.getItem(MIDI_CONTROL_ENABLED_STORAGE_KEY) === 'true',
  )
  const [scoring, setScoring] = useState<ScoringSummary>(EMPTY_SCORING)
  const [gradeCounts, setGradeCounts] = useState<GradeCounts>(EMPTY_GRADE_COUNTS)
  const [lastGrade, setLastGrade] = useState<HitGrade | 'extra' | undefined>(undefined)
  // Keyed by instrument, not a single value — otherwise two instruments hit
  // at (near-)the same time would just overwrite each other's entry and
  // only one drum piece would ever visually react.
  const [activeHits, setActiveHits] = useState<Partial<Record<DrumInstrument, string>>>({})
  const [stickClickToken, setStickClickToken] = useState<string | undefined>(undefined)
  const [gradedEventIds, setGradedEventIds] = useState<ReadonlyMap<string, 'hit' | 'miss'>>(new Map())
  const [isMetronomeMuted, setIsMetronomeMuted] = useState(
    () => localStorage.getItem(METRONOME_MUTED_STORAGE_KEY) === 'true',
  )
  // Mirrors isMetronomeMuted for beginPlayback to read without needing it in
  // its own dependency array (same reasoning as every other *Ref mirror in
  // this hook) — applied to a freshly-created engine on every run, since a
  // brand new ExercisePlaybackEngine always starts at its own default
  // (unmuted) gain otherwise.
  const isMetronomeMutedRef = useRef(isMetronomeMuted)
  const [playSessionId, setPlaySessionId] = useState(0)
  // Mirrors countInDurationMsRef as real state — NoteHighway never needed
  // this exposed (it reads elapsedMs, which is already count-in-adjusted),
  // but ExerciseNotationSheet's CSS-animation-driven fill/cursor (displayMode
  // 'staff_cursor') needs it as a real prop value: its animation-delay is
  // computed once from playbackProgress.startOffsetMs, not from a per-frame
  // elapsedMs, so without this the fill/cursor started moving the instant
  // the session began instead of waiting through the count-in bar — a fixed
  // "runs ahead of the real audio by one bar" desync (reported directly).
  const [countInDurationMs, setCountInDurationMs] = useState(0)
  // Mirrors startOffsetMsRef as real state, same reasoning as
  // countInDurationMs above — ExerciseNotationSheet's playbackProgress needs
  // the actual seek target (0 for a fresh start) combined with
  // countInDurationMs to compute its animation-delay correctly; without this
  // a seek moved the real audio/scoring but left the notation cursor
  // animating from wherever the count-in math alone implied.
  const [seekOffsetMs, setSeekOffsetMs] = useState(0)
  const [currentBar, setCurrentBar] = useState(1)
  const [currentBeat, setCurrentBeat] = useState(1)
  const [elapsedMs, setElapsedMs] = useState(0)

  const audioContextRef = useRef<AudioContext | null>(null)
  const engineRef = useRef<ExercisePlaybackEngine | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const barIntervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Each count-in beat's DrumKit cue is its own setTimeout (see
  // onCountInBeatScheduled in beginPlayback below), same lookahead-delay
  // pattern as useExercisePreviewPlayback's own hit flashes — must all be
  // cleared on every restart/exit/unmount, or a stale one could still fire
  // stickClickToken after a new run (or no run) has started.
  const stickClickTimeoutIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  const clearStickClickTimeouts = useCallback(() => {
    for (const timeoutId of stickClickTimeoutIdsRef.current) clearTimeout(timeoutId)
    stickClickTimeoutIdsRef.current.clear()
  }, [])

  const pendingRef = useRef<PendingDrumEvent[]>([])
  const hitResultsRef = useRef<HitResult[]>([])
  const extraHitsRef = useRef<ExtraHitEvent[]>([])
  const totalExpectedEventsRef = useRef(0)

  const clockOffsetMsRef = useRef(0)
  const countInDurationMsRef = useRef(0)
  // Set when a session starts mid-exercise (seekDemo) — added back into
  // every elapsedMs computation below, since the engine's own
  // startAudioTimeSeconds only anchors "0 = when this session started
  // playing," not "0 = the exercise's own bar 1."
  const startOffsetMsRef = useRef(0)
  const barDurationMsRef = useRef(0)
  const beatDurationMsRef = useRef(0)
  const beatsPerBarRef = useRef(4)
  const phaseRef = useRef<VisualTrainerPhase>('idle')
  const prePausePhaseRef = useRef<VisualTrainerPhase>('idle')
  // Mirrors isDemo state — tick() reads this ref directly (like phaseRef)
  // so it doesn't need isDemo in its own dependency array.
  const isDemoRef = useRef(false)

  const thresholds = GRADING_THRESHOLDS[exercise.difficulty]

  const setPhaseBoth = useCallback((next: VisualTrainerPhase) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  const stopLoops = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    if (barIntervalIdRef.current !== null) {
      clearInterval(barIntervalIdRef.current)
      barIntervalIdRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      stopLoops()
      clearStickClickTimeouts()
      engineRef.current?.dispose()
      void audioContextRef.current?.close()
    }
  }, [clearStickClickTimeouts, stopLoops])

  const recomputeScoring = useCallback(() => {
    setScoring(summarizeScoring(hitResultsRef.current, extraHitsRef.current, totalExpectedEventsRef.current))
    setGradeCounts(countGrades(hitResultsRef.current, extraHitsRef.current))
  }, [])

  const startBarInterval = useCallback(() => {
    barIntervalIdRef.current = setInterval(() => {
      const audioContext = audioContextRef.current
      const engine = engineRef.current
      if (!audioContext || !engine) return
      const rawElapsedMs = (audioContext.currentTime - engine.startAudioTimeSeconds) * 1000

      // The beat pulse runs off raw elapsed time (from the very start of
      // count-in), not time-since-count-in — a count-in is meant to visibly
      // tick through its own bar too, not sit frozen on beat 1 until the
      // real exercise begins. startOffsetMsRef keeps this phase continuous
      // across a seek (rawElapsedMs alone resets to ~0 at the seek point,
      // but the exercise's own beat phase should pick up from where the
      // seek landed, not from beat 1).
      if (rawElapsedMs >= 0) {
        const beatIndexInBar = Math.floor(
          ((rawElapsedMs + startOffsetMsRef.current) % barDurationMsRef.current) / beatDurationMsRef.current,
        )
        setCurrentBeat(Math.min(beatsPerBarRef.current, beatIndexInBar + 1))
      }

      const elapsedMs = rawElapsedMs - countInDurationMsRef.current + startOffsetMsRef.current
      setElapsedMs(Math.max(0, elapsedMs))
      if (elapsedMs < 0) return
      setCurrentBar(Math.max(1, Math.floor(elapsedMs / barDurationMsRef.current) + 1))
    }, BAR_UPDATE_INTERVAL_MS)
  }, [])

  const tickRef = useRef<() => void>(() => {})

  // Demo mode's stand-in for a real keypress: fires the instant an event's
  // own expectedTimeMs arrives, so it's consumed before detectMissedEvents
  // (skipped entirely in demo — see tick() below) would ever see it as
  // overdue. Reuses the same hitResultsRef/NoteHighway-marking/scoring path
  // a real handleHit takes, just always graded 'perfect' with zero timing
  // error, since it's synthetic-by-definition on-time.
  const autoHit = useCallback(
    (event: PendingDrumEvent) => {
      pendingRef.current = pendingRef.current.filter((pending) => pending.eventId !== event.eventId)
      setActiveHits((prev) => ({ ...prev, [event.instrument]: createId() }))
      hitResultsRef.current.push({
        id: createId(),
        expectedEventId: event.eventId,
        instrument: event.instrument,
        expectedTimeMs: event.expectedTimeMs,
        actualTimeMs: event.expectedTimeMs,
        timingErrorMs: 0,
        grade: 'perfect',
      })
      noteHighwayRef.current?.markResult(event.eventId, 'hit')
      setGradedEventIds((prev) => new Map(prev).set(event.eventId, 'hit'))
      setLastGrade('perfect')
      recomputeScoring()
    },
    [noteHighwayRef, recomputeScoring],
  )

  const tick = useCallback(() => {
    const audioContext = audioContextRef.current
    const engine = engineRef.current
    if (!audioContext || !engine) return

    const elapsedMs =
      (audioContext.currentTime - engine.startAudioTimeSeconds) * 1000 -
      countInDurationMsRef.current +
      startOffsetMsRef.current

    // During count-in, elapsedMs is already negative (that's how count-in is
    // detected below) — but not negative enough to keep every note hidden
    // whenever the count-in bar is shorter than NoteHighway's own lookahead
    // window (common at faster tempos), so the first notes could start
    // falling mid-count-in, competing with the stick count-off for
    // attention (explicit user request: the count-off should have the
    // screen to itself). -Infinity keeps every note's computed progress
    // below isNoteVisible's threshold regardless of the real elapsedMs.
    noteHighwayRef.current?.render(phaseRef.current === 'count-in' ? -Infinity : elapsedMs)

    if (phaseRef.current === 'count-in' && elapsedMs >= 0) {
      setPhaseBoth('running')
    }

    if (isDemoRef.current) {
      const due = pendingRef.current.filter((event) => event.expectedTimeMs <= elapsedMs)
      for (const event of due) autoHit(event)
    } else {
      const missed = detectMissedEvents(pendingRef.current, elapsedMs, thresholds)
      if (missed.length > 0) {
        const missedIds = new Set(missed.map((event) => event.eventId))
        pendingRef.current = pendingRef.current.filter((event) => !missedIds.has(event.eventId))
        for (const event of missed) {
          hitResultsRef.current.push({
            id: createId(),
            expectedEventId: event.eventId,
            instrument: event.instrument,
            expectedTimeMs: event.expectedTimeMs,
            grade: 'miss',
          })
          noteHighwayRef.current?.markResult(event.eventId, 'miss')
        }
        setGradedEventIds((prev) => {
          const next = new Map(prev)
          for (const event of missed) next.set(event.eventId, 'miss')
          return next
        })
        setLastGrade('miss')
        recomputeScoring()
      }
    }

    if (pendingRef.current.length === 0 && phaseRef.current !== 'finished' && phaseRef.current !== 'idle') {
      setPhaseBoth('finished')
      stopLoops()
      // All notes are resolved, but the playback engine's own click schedule
      // covers the whole declared exercise length independent of the notes
      // — without this, the metronome keeps ticking through the rest of its
      // queue (up to a bar or two) after the last note has already resolved.
      engineRef.current?.stop()
      return
    }

    rafIdRef.current = requestAnimationFrame(() => tickRef.current())
  }, [autoHit, noteHighwayRef, recomputeScoring, setPhaseBoth, stopLoops, thresholds])

  useEffect(() => {
    tickRef.current = tick
  }, [tick])

  const handleHit = useCallback(
    (instrument: DrumInstrument, hitTimeMs: number) => {
      const engine = engineRef.current
      if (!engine) return

      const elapsedMs = convertHitTimeToExerciseElapsedMs(
        hitTimeMs,
        clockOffsetMsRef.current,
        engine.startAudioTimeSeconds,
        countInDurationMsRef.current,
      )

      // handleHit fires for every real (non-demo) hit source — keyboard,
      // phone, and MIDI alike (see handleRemoteHit/handleMidiHit below) —
      // and always plays the hit itself through DrumPath, even for MIDI:
      // explicit user request, hearing it only through the e-kit's own
      // module (headphones plugged into the module, not the computer) felt
      // inconsistent with every other input method already playing sound
      // through the computer.
      engine.playHitNow(instrument)
      setActiveHits((prev) => ({ ...prev, [instrument]: createId() }))

      const match = findMatchingEvent(pendingRef.current, instrument, elapsedMs, thresholds)
      if (match) {
        pendingRef.current = pendingRef.current.filter((event) => event.eventId !== match.eventId)
        const grade = gradeTimingError(match.timingErrorMs, thresholds)
        hitResultsRef.current.push({
          id: createId(),
          expectedEventId: match.eventId,
          instrument,
          expectedTimeMs: elapsedMs - match.timingErrorMs,
          actualTimeMs: elapsedMs,
          timingErrorMs: match.timingErrorMs,
          grade,
        })
        noteHighwayRef.current?.markResult(match.eventId, 'hit')
        setGradedEventIds((prev) => new Map(prev).set(match.eventId, 'hit'))
        setLastGrade(grade)
      } else {
        extraHitsRef.current.push({ id: createId(), instrument, hitTimeMs: elapsedMs })
        setLastGrade('extra')
      }
      recomputeScoring()
    },
    [noteHighwayRef, recomputeScoring, thresholds],
  )

  useKeyboardDrums({ enabled: (phase === 'running' || phase === 'count-in') && !isDemo, onHit: handleHit })

  const togglePhoneControl = useCallback(() => {
    setIsPhoneControlEnabled((prev) => {
      const next = !prev
      localStorage.setItem(PHONE_CONTROL_ENABLED_STORAGE_KEY, String(next))
      return next
    })
  }, [])

  const toggleMidiControl = useCallback(() => {
    setIsMidiControlEnabled((prev) => {
      const next = !prev
      localStorage.setItem(MIDI_CONTROL_ENABLED_STORAGE_KEY, String(next))
      return next
    })
  }, [])

  const toggleMetronomeMute = useCallback(() => {
    setIsMetronomeMuted((prev) => {
      const next = !prev
      isMetronomeMutedRef.current = next
      localStorage.setItem(METRONOME_MUTED_STORAGE_KEY, String(next))
      // Applied immediately too, not just on the next beginPlayback — muting
      // mid-run should take effect right away, same as any other live
      // volume control.
      engineRef.current?.setMetronomeVolume(next ? 0 : 1)
      return next
    })
  }, [])

  // A small wrapper around handleHit, not handleHit itself: the remote
  // connection's own lifecycle is deliberately decoupled from `phase` (see
  // useRemoteDrumInput's doc comment — the user needs to see "phone
  // connected" before pressing start, not just during a run), so this reads
  // the same phaseRef/isDemoRef tick() already reads for this exact reason
  // to only forward hits into scoring during running/count-in, keeping
  // remote-hit grading semantics identical to keyboard input.
  const handleRemoteHit = useCallback(
    (instrument: DrumInstrument, hitTimeMs: number) => {
      if (isDemoRef.current) return
      if (phaseRef.current !== 'running' && phaseRef.current !== 'count-in') return
      handleHit(instrument, hitTimeMs)
    },
    [handleHit],
  )

  const remoteStatus = useRemoteDrumInput({ enabled: isPhoneControlEnabled, onHit: handleRemoteHit })

  // Same phase/demo gating as handleRemoteHit, and the same reasoning for
  // why (useMidiDrumInput's own connection lifecycle is decoupled from
  // `phase` too).
  const handleMidiHit = useCallback(
    (instrument: DrumInstrument, hitTimeMs: number) => {
      if (isDemoRef.current) return
      if (phaseRef.current !== 'running' && phaseRef.current !== 'count-in') return
      handleHit(instrument, hitTimeMs)
    },
    [handleHit],
  )

  const midiStatus = useMidiDrumInput({ enabled: isMidiControlEnabled, onHit: handleMidiHit })

  const beginPlayback = useCallback(
    async (demo: boolean, options: { startOffsetMs?: number } = {}) => {
      const startOffsetMs = Math.max(0, options.startOffsetMs ?? 0)
      // Seeking mid-exercise skips the count-in entirely — waiting through
      // a full bar of click before resuming would defeat the point of
      // jumping straight to a spot in the song.
      const countInBars = startOffsetMs > 0 ? 0 : COUNT_IN_BARS

      if (!audioContextRef.current) audioContextRef.current = new AudioContext()
      if (!engineRef.current) {
        engineRef.current = new ExercisePlaybackEngine(audioContextRef.current)
        // A freshly-created engine always starts at its own default
        // (unmuted) metronome gain — apply the user's existing preference
        // right away, or the very first run of a session would briefly
        // ignore an already-muted setting.
        engineRef.current.setMetronomeVolume(isMetronomeMutedRef.current ? 0 : 1)
      }
      const audioContext = audioContextRef.current
      const engine = engineRef.current
      // Awaited, not fire-and-forget: AudioContext.currentTime stays frozen
      // while the context is 'suspended' (the browser's own state right
      // after `new AudioContext()`, until a real user gesture resumes it —
      // often the very first Start press of a session, when there's real
      // hardware-startup latency). engine.start() below anchors every
      // count-in/exercise beat time to currentTime at the moment it runs —
      // calling it before resume() actually settles freezes that anchor at
      // a stale value, so once currentTime finally starts advancing, several
      // beats already inside the engine's lookahead window all fire in one
      // burst instead of evenly spaced (reported as "sticks count-off");
      // waiting here removes the race entirely.
      await audioContext.resume()
      stopLoops()
      clearStickClickTimeouts()

      isDemoRef.current = demo
      setIsDemo(demo)

      // Events before the seek point are dropped, not just left pending —
      // otherwise the first tick would see all of them as "due" at once
      // (their expectedTimeMs already <= the post-seek elapsedMs) and
      // auto-hit every one of them in an instant burst.
      pendingRef.current = resolveEventScheduleMs(exercise)
        .filter(({ timeMs }) => timeMs >= startOffsetMs)
        .map(({ event, timeMs }) => ({
          eventId: event.id,
          instrument: event.instrument,
          expectedTimeMs: applyStaffCursorTimingBias(event.instrument, timeMs, displayMode),
        }))
      hitResultsRef.current = []
      extraHitsRef.current = []
      totalExpectedEventsRef.current = pendingRef.current.length

      barDurationMsRef.current = calculateBarDurationMs(exercise.bpm, exercise.timeSignature)
      beatDurationMsRef.current = barDurationMsRef.current / exercise.timeSignature.numerator
      beatsPerBarRef.current = exercise.timeSignature.numerator
      countInDurationMsRef.current = countInBars * barDurationMsRef.current
      setCountInDurationMs(countInDurationMsRef.current)
      startOffsetMsRef.current = startOffsetMs
      setSeekOffsetMs(startOffsetMs)
      clockOffsetMsRef.current = performance.now() - audioContext.currentTime * 1000

      engine.start(exercise, {
        countInBars,
        startOffsetMs,
        // Demo plays the exercise's own drums as a reference track; a real
        // run stays silent until the player actually strikes something
        // (handleHit calls engine.playHitNow itself) — explicit user
        // request, manual mode felt indistinguishable from watching a demo
        // otherwise.
        playDrumEvents: demo,
        // Fires ahead of the actual sound (inside the engine's own
        // lookahead window) — schedule the DrumKit cue for the real moment
        // the click plays, not the moment it was merely queued, same
        // distinction onEventScheduled callers elsewhere in the codebase
        // already rely on (see useExercisePreviewPlayback.ts).
        onCountInBeatScheduled: (audioTimeSeconds) => {
          const delayMs = Math.max(0, (audioTimeSeconds - audioContext.currentTime) * 1000)
          const timeoutId = setTimeout(() => {
            stickClickTimeoutIdsRef.current.delete(timeoutId)
            setStickClickToken(createId())
          }, delayMs)
          stickClickTimeoutIdsRef.current.add(timeoutId)
        },
      })

      setScoring(EMPTY_SCORING)
      setGradeCounts(EMPTY_GRADE_COUNTS)
      setLastGrade(undefined)
      setActiveHits({})
      setStickClickToken(undefined)
      setGradedEventIds(new Map())
      setPlaySessionId((current) => current + 1)
      setCurrentBar(Math.max(1, Math.floor(startOffsetMs / barDurationMsRef.current) + 1))
      setCurrentBeat(1)
      setElapsedMs(startOffsetMs)
      noteHighwayRef.current?.reset()
      setPhaseBoth(countInBars > 0 ? 'count-in' : 'running')

      rafIdRef.current = requestAnimationFrame(tick)
      startBarInterval()
    },
    [clearStickClickTimeouts, displayMode, exercise, noteHighwayRef, setPhaseBoth, startBarInterval, stopLoops, tick],
  )

  const start = useCallback(() => beginPlayback(false), [beginPlayback])
  const startDemo = useCallback(() => beginPlayback(true), [beginPlayback])
  const seekDemo = useCallback((offsetMs: number) => beginPlayback(true, { startOffsetMs: offsetMs }), [beginPlayback])
  // General seek — jumps whichever kind of run is currently active (demo or
  // real) to offsetMs, instead of always forcing demo like seekDemo. A real
  // run's scoring only ends up counting notes from the seek point onward
  // (beginPlayback already drops earlier pendingRef entries and sizes
  // totalExpectedEventsRef off whatever's left) — accepted tradeoff, same
  // one seeking already made for demo, just now available outside it too
  // (explicit user request: no way to skip ahead in a real practice run).
  const seek = useCallback(
    (offsetMs: number) => beginPlayback(isDemoRef.current, { startOffsetMs: offsetMs }),
    [beginPlayback],
  )

  const pause = useCallback(() => {
    if (phaseRef.current !== 'running' && phaseRef.current !== 'count-in') return
    prePausePhaseRef.current = phaseRef.current
    engineRef.current?.pause()
    stopLoops()
    setPhaseBoth('paused')
  }, [setPhaseBoth, stopLoops])

  const resume = useCallback(() => {
    if (phaseRef.current !== 'paused') return
    engineRef.current?.resumeFromPause()
    setPhaseBoth(prePausePhaseRef.current)
    rafIdRef.current = requestAnimationFrame(tick)
    startBarInterval()
  }, [setPhaseBoth, startBarInterval, tick])

  const restart = useCallback(() => {
    beginPlayback(isDemoRef.current)
  }, [beginPlayback])

  const exit = useCallback(() => {
    engineRef.current?.stop()
    stopLoops()
    clearStickClickTimeouts()
    setPhaseBoth('idle')
  }, [clearStickClickTimeouts, setPhaseBoth, stopLoops])

  return {
    phase,
    isDemo,
    scoring,
    gradeCounts,
    lastGrade,
    activeHits,
    stickClickToken,
    gradedEventIds,
    playSessionId,
    countInDurationMs,
    seekOffsetMs,
    currentBar,
    currentBeat,
    elapsedMs,
    start,
    startDemo,
    seekDemo,
    seek,
    pause,
    resume,
    restart,
    exit,
    isPhoneControlEnabled,
    togglePhoneControl,
    remoteStatus,
    isMidiControlEnabled,
    toggleMidiControl,
    midiStatus,
    isMetronomeMuted,
    toggleMetronomeMute,
  }
}
