import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { ExercisePlaybackEngine } from '../lib/visual-trainer/exercise-playback-engine'
import { convertHitTimeToExerciseElapsedMs } from '../lib/visual-trainer/clock-sync-math'
import { calculateBarDurationMs } from '../domain/calculations/event-timing'
import { resolveEventScheduleMs } from '../domain/calculations/exercise-schedule'
import { GRADING_THRESHOLDS, detectMissedEvents, findMatchingEvent, gradeDynamics, gradeTimingError } from '../domain/calculations/hit-matcher'
import type { PendingDrumEvent } from '../domain/calculations/hit-matcher'
import { calculateAccuracy, summarizeScoring, summarizeDynamics } from '../domain/calculations/scoring-engine'
import type { DynamicsSummary } from '../domain/calculations/scoring-engine'
import { markHit } from '../lib/visual-trainer/active-hits'
import { useKeyboardDrums } from './useKeyboardDrums'
import type { NotationStatePayload, PlaybackStatusPayload, RemoteDrumInputStatus } from './useRemoteDrumInput'
import { useRemoteHost } from '../features/visual-trainer/remote-host-context'
import { useMidiDrumInput } from './useMidiDrumInput'
import type { MidiDrumInputStatus } from './useMidiDrumInput'
import { createId } from '../domain'
import type {
  DisplayMode,
  DrumInstrument,
  DynamicsGrade,
  ExtraHitEvent,
  HitGrade,
  HitResult,
  InteractiveExercise,
  ScoringSummary,
} from '../domain'
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
  /** Whether the last hit that matched an *accented* event was struck
   * hard enough (see hit-matcher.ts's gradeDynamics) — undefined whenever
   * there's nothing to report: no hit yet, the matched event wasn't
   * accented, or the hit came from a source with no real velocity
   * (keyboard/phone, only MIDI has genuine per-hit strike force). */
  lastDynamicsGrade: DynamicsGrade | undefined
  /** Every hit this run that carried real MIDI velocity data, in order —
   * the post-session velocity-consistency graph's data source. Empty for
   * any run with no MIDI hits (keyboard/phone-only, or demo). */
  dynamicsSummary: DynamicsSummary
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
  gradedEventIds: ReadonlyMap<string, HitGrade>
  /** Per-event actual strike time (ms elapsed since the exercise's own bar 1,
   * same clock expectedTimeMs is measured against) — explicit user request:
   * seeing WHERE a hit actually landed relative to its note, not just
   * hit/miss, is what lets a player calibrate their own timing instead of
   * guessing. Only ever set for a genuinely matched event (never a miss, and
   * never in demo mode, where every "hit" is synthetic-by-definition
   * on-time) — ExerciseNotationSheet draws a small marker at this time's own
   * x position, right beside the note's. */
  hitTimingByEventId: ReadonlyMap<string, number>
  /** Every hit this run that matched no pending event (wrong instrument, or
   * outside every event's own hit window) — explicit user request: shown as
   * its own marker on the notation, at the hit's real elapsed time, so an
   * "extra hit" in the results (which lowers accuracy — see
   * calculateAccuracy) has something to point at on screen instead of
   * looking like a mismatch between the numbers and an all-green sheet. */
  extraHits: readonly ExtraHitEvent[]
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
   * across sessions since it's a standing setup choice, not per-run state.
   * A thin pass-through to RemoteHostProvider's context now (see
   * remote-host-context.tsx) — the connection itself is owned there, not by
   * this hook, so it survives navigation between exercises. */
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

const MIDI_CONTROL_ENABLED_STORAGE_KEY = 'drumpath.isMidiControlEnabled'
const METRONOME_MUTED_STORAGE_KEY = 'drumpath.isMetronomeMuted'

const COUNT_IN_BARS = 1
const BAR_UPDATE_INTERVAL_MS = 200
// How often the phone's mirrored state gets a full resync while a run is
// active, piggybacked on the bar-update interval's own tick — see
// startBarInterval's own doc comment on why this exists.
const REMOTE_HEARTBEAT_INTERVAL_TICKS = Math.round(2000 / BAR_UPDATE_INTERVAL_MS)
// Two kick hits that both land outside the exercise's own pattern (graded
// 'extra', not matched to any scheduled note) within this window count as a
// deliberate "jump to start" gesture — gating on 'extra' specifically is
// what lets this coexist with genuine fast double-kick patterns in the
// curriculum, whose hits match real events and are graded normally instead.
const DOUBLE_KICK_RESTART_WINDOW_MS = 350

// staff_cursor-only grading correction (explicit user request/investigation).
// Used to also carry a per-instrument "kick reads early" extra (removed) —
// that turned out to be a misdiagnosis of a real ExerciseNotationSheet
// rendering bug (fixed there, see noteX's own comment there for the full
// history): notes used to be inset per bar (barline breathing room) while
// the cursor swept uniformly with no such inset, so the cursor reached each
// note's on-screen x strictly LATER than its true instant, worse the
// earlier a note fell in its bar — and kick disproportionately lands on
// downbeats (worst case) while snare tends to land on backbeats (roughly
// half that), which is what actually made kick read "worse". Fixed at the
// root (ExerciseNotationSheet's notes are no longer inset — pure
// proportional positioning, exactly matching the cursor's own uniform
// sweep), not by tuning this number further — that whole per-instrument
// correction is gone. This BASE remainder is a small, genuinely
// instrument-independent residual — reported directly, a hit still needs to
// land a hair before the cursor visually reaches the note, most likely the
// CSS animation's own paint lag behind the AudioContext clock it's timed
// against, unrelated to any note's geometry. Starting magnitude, not
// derived from exact frame-timing measurement — expect further retuning
// from live feedback.
// NoteHighway has no equivalent visual (falling rectangles, no cursor/stem),
// so none of this applies outside staff_cursor.
const STAFF_CURSOR_BASE_TIMING_BIAS_MS = 25

function applyStaffCursorTimingBias(expectedTimeMs: number, displayMode: DisplayMode): number {
  if (displayMode !== 'staff_cursor') return expectedTimeMs
  return expectedTimeMs - STAFF_CURSOR_BASE_TIMING_BIAS_MS
}
const EMPTY_SCORING: ScoringSummary = {
  // Matches calculateAccuracy's own "nothing to judge yet" convention.
  accuracyPercent: 100,
  currentCombo: 0,
  bestCombo: 0,
  averageTimingErrorMs: undefined,
}
const EMPTY_GRADE_COUNTS: GradeCounts = { perfect: 0, early: 0, late: 0, miss: 0, extra: 0 }
const EMPTY_DYNAMICS_SUMMARY: DynamicsSummary = { points: [] }

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
export interface UseVisualTrainerOptions {
  /** Only ever supplied by RoutinePlayerPage — advances to the next step of
   * a practice routine. Wired into the registered RemoteSession's own
   * `skip`, so a remote 'skip' transport_command reaches it too. Absent for
   * a plain single-exercise run. */
  onSkip?: () => void
  /** Only ever supplied by RoutinePlayerPage (and only once a step back
   * exists) — wired into the registered RemoteSession's own `previous`, so
   * a remote 'previous' transport_command reaches it too. Absent for a
   * plain single-exercise run, or for a routine's own first step. */
  onPrevious?: () => void
  /** Only ever supplied by RoutinePlayerPage — rides along on every
   * sendPlaybackStatus call (see routineProgressRef below) so the phone's
   * "skip" button/step indicator stays in sync with every phase transition
   * instead of racing a separate message. */
  routineProgress?: { stepIndex: number; stepCount: number }
}

export function useVisualTrainer(
  exercise: InteractiveExercise,
  noteHighwayRef: RefObject<NoteHighwayHandle | null>,
  // The screen's own runtime display-mode choice (VisualTrainerPage's
  // selectedDisplayMode) — can differ from exercise.displayMode now that the
  // picker applies to real practice too, and grading needs to know which
  // visual is actually on screen for applyStaffCursorTimingBias above.
  // Defaults to the exercise's own saved value for any other caller.
  displayMode: DisplayMode = exercise.displayMode,
  options?: UseVisualTrainerOptions,
): UseVisualTrainerResult {
  const [phase, setPhase] = useState<VisualTrainerPhase>('idle')
  const [isDemo, setIsDemo] = useState(false)
  const [isMidiControlEnabled, setIsMidiControlEnabled] = useState(
    () => localStorage.getItem(MIDI_CONTROL_ENABLED_STORAGE_KEY) === 'true',
  )
  // Mirrors isMidiControlEnabled for beginPlayback to read without needing
  // it in its own dependency array (same reasoning as isMetronomeMutedRef)
  // — gates whether a staff_cursor run's notation gets pushed to the phone
  // (see sendNotationState below).
  const isMidiControlEnabledRef = useRef(isMidiControlEnabled)
  const [scoring, setScoring] = useState<ScoringSummary>(EMPTY_SCORING)
  const [gradeCounts, setGradeCounts] = useState<GradeCounts>(EMPTY_GRADE_COUNTS)
  const [lastGrade, setLastGrade] = useState<HitGrade | 'extra' | undefined>(undefined)
  const [lastDynamicsGrade, setLastDynamicsGrade] = useState<DynamicsGrade | undefined>(undefined)
  const [dynamicsSummary, setDynamicsSummary] = useState<DynamicsSummary>(EMPTY_DYNAMICS_SUMMARY)
  // Keyed by instrument, not a single value — otherwise two instruments hit
  // at (near-)the same time would just overwrite each other's entry and
  // only one drum piece would ever visually react.
  const [activeHits, setActiveHits] = useState<Partial<Record<DrumInstrument, string>>>({})
  const [stickClickToken, setStickClickToken] = useState<string | undefined>(undefined)
  const [gradedEventIds, setGradedEventIds] = useState<ReadonlyMap<string, HitGrade>>(new Map())
  const [hitTimingByEventId, setHitTimingByEventId] = useState<ReadonlyMap<string, number>>(new Map())
  const [extraHits, setExtraHits] = useState<readonly ExtraHitEvent[]>([])
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
  // The last full payload pushed to the phone (see sendNotationState below)
  // — null whenever nothing is being mirrored. Mutated in place (not
  // replaced) by pause()/resume() (flip `paused`) and by handleHit/tick's
  // own grading (add one gradedEventIds entry) so each only has to resend,
  // never recompute, the parts it didn't change.
  const lastNotationPayloadRef = useRef<NotationStatePayload | null>(null)
  // tick() (below) is declared before useRemoteHost's own call (further down
  // this function, since it needs handleRemoteHit which needs handleHit
  // which needs tick to already exist) — referencing sendNotationState/
  // sendPlaybackStatus directly inside tick would read them before their own
  // declaration. Refs, synced via an effect right after that call, sidestep
  // the ordering entirely: tick only ever reads .current, which is always up
  // to date by the time tick actually runs (async, well after the render
  // that declared it).
  const sendNotationStateRef = useRef<(state: NotationStatePayload | null) => void>(() => {})
  const sendPlaybackStatusRef = useRef<(status: PlaybackStatusPayload) => void>(() => {})
  // Mirrors options?.routineProgress — read from every sendPlaybackStatus
  // call site below (tick/beginPlayback/pause/resume/the registration
  // effect) so a routine step's progress always rides on the SAME message
  // as every phase transition, never a separate one that could race it
  // (useRemoteDrumSender's playbackStatus is a full replace, not a merge).
  const routineProgressRef = useRef(options?.routineProgress)
  // Fixed once per run (set in beginPlayback below) — calculateAccuracy's
  // own baseline denominator, so the live accuracy number stays anchored to
  // the whole piece instead of swinging on a small resolved-so-far sample.
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
  // handleMidiHit (below) needs to call start()/restart() on a kick gesture
  // while idle/finished or mid-run — same declaration-order problem
  // sendNotationStateRef etc. already solve: start/restart aren't declared
  // until well after this point in the hook.
  const startRef = useRef<() => void>(() => {})
  const restartRef = useRef<() => void>(() => {})
  // Timestamp (performance.now()) of the last kick hit that counted toward
  // a "jump to start" double-click gesture — see DOUBLE_KICK_RESTART_WINDOW_MS.
  const lastExtraKickAtRef = useRef<number | null>(null)
  // Direct user report: a fast double-kick used to START an idle exercise
  // (not restart a running one — see the double-click-restart branch of
  // handleMidiHit below, which is unaffected) could land its 2nd press
  // while phaseRef.current STILL read 'idle' — beginPlayback is async
  // (awaits audioContext.resume()), so phaseRef.current doesn't actually
  // become 'count-in' until after that resolves, leaving a real (if
  // usually short) window where phase alone can't tell "already starting"
  // apart from "still idle". Without this guard, a 2nd kick landing in that
  // window called beginPlayback again while the 1st call was still
  // in-flight, and the two overlapping runs left inconsistent state behind
  // (whichever's async continuation happened to finish last "won", but not
  // necessarily consistently across pendingRef/lastNotationPayloadRef/the
  // engine itself) — reported directly as the phone's grading mirror
  // breaking specifically after a double-kick start, never a clean single
  // kick. Set the instant a kick-triggered start fires, cleared once
  // beginPlayback's own async work has actually caught up (right where it
  // sets the real starting phase) — not derived from phaseRef itself, since
  // that's exactly the value with the lag this guards against.
  const kickStartInFlightRef = useRef(false)

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

  // Synchronous read of the same accuracy number recomputeScoring's own
  // setScoring will land on — needed at every lastNotationPayloadRef mutation
  // site below, which run inside the same synchronous handler as the ref
  // mutations that feed it, before React would ever flush the `scoring`
  // state update itself.
  const currentLiveAccuracyPercent = () =>
    calculateAccuracy(hitResultsRef.current, extraHitsRef.current, totalExpectedEventsRef.current)

  // Grading/lifecycle logic (count-in->running, miss detection, finished) is
  // invoked through this ref from BOTH the rAF-driven tick() below AND
  // startBarInterval's own setInterval right below — see runGradingTick's
  // own doc comment (declared later, after autoHit) for why a second,
  // interval-driven cadence is needed at all. A ref (not a direct call),
  // same "declared later in this hook, referenced before that point"
  // situation tickRef already solves — this closure runs long after the
  // real function is assigned, never before.
  const runGradingTickRef = useRef<(elapsedMs: number) => void>(() => {})

  const startBarInterval = useCallback(() => {
    let heartbeatTickCount = 0
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
      runGradingTickRef.current(elapsedMs)

      // Periodic full resync to the phone — explicit user report: the
      // relay's "no queueing" design (ADR 0007) means a single dropped
      // notation_state/playback_status frame (a WiFi blip near the kit, or
      // just bad luck) leaves the phone stuck on stale data for the rest of
      // the run, with nothing to prompt a retry since nothing on the phone
      // itself errors. This isn't a queue (no history is buffered/replayed)
      // — just re-sending the CURRENT state often enough that any one lost
      // frame self-corrects within one heartbeat instead of staying wrong
      // until the next real grading event happens to fire (which, for a
      // sparse pattern or a phone that missed the very FIRST message,
      // could be a very long time — or never, if that miss silently drops
      // the one message that would've told the player anything changed).
      heartbeatTickCount += 1
      if (heartbeatTickCount % REMOTE_HEARTBEAT_INTERVAL_TICKS === 0) {
        if (lastNotationPayloadRef.current) sendNotationStateRef.current(lastNotationPayloadRef.current)
        sendPlaybackStatusRef.current({
          exerciseId: exercise.id,
          title: exercise.title,
          bpm: exercise.bpm,
          phase: phaseRef.current,
          routineProgress: routineProgressRef.current,
        })
      }

      if (elapsedMs < 0) return
      setCurrentBar(Math.max(1, Math.floor(elapsedMs / barDurationMsRef.current) + 1))
    }, BAR_UPDATE_INTERVAL_MS)
  }, [exercise])

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
      setActiveHits((prev) => markHit(prev, event.instrument, createId()))
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
      setGradedEventIds((prev) => new Map(prev).set(event.eventId, 'perfect'))
      setLastGrade('perfect')
      recomputeScoring()
    },
    [noteHighwayRef, recomputeScoring],
  )

  // Grading + lifecycle transitions (count-in -> running, miss detection,
  // finished) — split out from the rAF-driven tick() below so startBarInterval
  // can invoke it too, on its own independent ~200ms setInterval cadence, not
  // just from rAF. Browsers suspend/heavily throttle requestAnimationFrame
  // once a tab is hidden or the whole window loses focus (screen locked/off,
  // another app in front) — exactly the state the desktop is expected to be
  // in during phone-only practice (explicit user scenario: kit + phone, "no
  // access to the computer"). A real MIDI hit still gets graded instantly
  // either way (a direct hardware-event callback, not tied to rAF), but a
  // MISSED note relies on this function actually running to get flagged —
  // rAF alone left it stuck "ungraded" (never colored red, on the desktop OR
  // the phone's mirrored view) for the rest of the run whenever the desktop
  // tab wasn't visible. setInterval is throttled far less aggressively
  // (clamped, not suspended) in a background tab, so this closes that gap.
  // Every branch below re-checks its own guard against the current
  // phaseRef/pendingRef state, so an overlapping call from the second loop
  // is always a safe no-op, never double-grades a hit or a miss.
  const runGradingTick = useCallback(
    (elapsedMs: number) => {
      if (phaseRef.current === 'count-in' && elapsedMs >= 0) {
        setPhaseBoth('running')
        sendPlaybackStatusRef.current({
          exerciseId: exercise.id,
          title: exercise.title,
          bpm: exercise.bpm,
          phase: 'running',
          routineProgress: routineProgressRef.current,
        })
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
          if (lastNotationPayloadRef.current) {
            for (const event of missed) lastNotationPayloadRef.current.gradedEventIds[event.eventId] = 'miss'
            lastNotationPayloadRef.current.liveAccuracyPercent = currentLiveAccuracyPercent()
            sendNotationStateRef.current(lastNotationPayloadRef.current)
          }
          setLastGrade('miss')
          recomputeScoring()
        }
      }

      if (pendingRef.current.length === 0 && phaseRef.current !== 'finished' && phaseRef.current !== 'idle') {
        setPhaseBoth('finished')
        setDynamicsSummary(summarizeDynamics(hitResultsRef.current))
        // Deliberately NOT cleared here (unlike exit()/beginPlayback's own
        // 'not staff_cursor+MIDI' branch below) — explicit user request: the
        // fully-graded notation (every note's color, every hit-position X)
        // should stay visible, on the phone and the desktop alike, for as
        // long as this same run's results are still on screen. The next
        // beginPlayback (restart, or a routine's next/previous step)
        // naturally overwrites it with a fresh payload; nothing here needs
        // its own separate "now clear it" path.
        sendPlaybackStatusRef.current({
          exerciseId: exercise.id,
          title: exercise.title,
          bpm: exercise.bpm,
          phase: 'finished',
          routineProgress: routineProgressRef.current,
          resultsSummary: {
            accuracyPercent: summarizeScoring(hitResultsRef.current, extraHitsRef.current, totalExpectedEventsRef.current)
              .accuracyPercent,
            gradeCounts: countGrades(hitResultsRef.current, extraHitsRef.current),
          },
        })
        stopLoops()
        // All notes are resolved, but the playback engine's own click schedule
        // covers the whole declared exercise length independent of the notes
        // — without this, the metronome keeps ticking through the rest of its
        // queue (up to a bar or two) after the last note has already resolved.
        engineRef.current?.stop()
      }
    },
    [autoHit, exercise.bpm, exercise.id, exercise.title, noteHighwayRef, recomputeScoring, setPhaseBoth, stopLoops, thresholds],
  )

  useEffect(() => {
    runGradingTickRef.current = runGradingTick
  }, [runGradingTick])

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

    runGradingTick(elapsedMs)

    if (phaseRef.current === 'finished') return

    rafIdRef.current = requestAnimationFrame(() => tickRef.current())
  }, [noteHighwayRef, runGradingTick])

  useEffect(() => {
    tickRef.current = tick
  }, [tick])

  const handleHit = useCallback(
    // velocity is only ever real for a MIDI hit (handleMidiHit below) —
    // keyboard (useKeyboardDrums) and phone (handleRemoteHit) both call
    // this with no 3rd argument, so it's undefined there, which is the
    // single gate dynamics grading needs (see below): no per-input-source
    // special-casing anywhere else in this function.
    // Return value (the grade just assigned) exists purely for
    // handleMidiHit's double-kick "jump to start" detection below — every
    // other caller (useKeyboardDrums, handleRemoteHit) ignores it.
    (instrument: DrumInstrument, hitTimeMs: number, velocity?: number): HitGrade | 'extra' | undefined => {
      const engine = engineRef.current
      if (!engine) return undefined

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
      setActiveHits((prev) => markHit(prev, instrument, createId()))

      const match = findMatchingEvent(pendingRef.current, instrument, elapsedMs, thresholds)
      if (match) {
        pendingRef.current = pendingRef.current.filter((event) => event.eventId !== match.eventId)
        const grade = gradeTimingError(match.timingErrorMs, thresholds)
        // Only meaningful (and only computed) when the matched event was
        // actually accented AND this hit carried real velocity data —
        // undefined otherwise, which is exactly what a non-accented note
        // or a keyboard/phone hit should report (nothing to grade).
        const dynamicsGrade = match.accent && velocity !== undefined ? gradeDynamics(match.velocity, velocity) : undefined
        hitResultsRef.current.push({
          id: createId(),
          expectedEventId: match.eventId,
          instrument,
          expectedTimeMs: elapsedMs - match.timingErrorMs,
          actualTimeMs: elapsedMs,
          timingErrorMs: match.timingErrorMs,
          grade,
          actualVelocity: velocity,
          dynamicsGrade,
        })
        noteHighwayRef.current?.markResult(match.eventId, 'hit')
        setGradedEventIds((prev) => new Map(prev).set(match.eventId, grade))
        setHitTimingByEventId((prev) => new Map(prev).set(match.eventId, elapsedMs))
        if (lastNotationPayloadRef.current) {
          lastNotationPayloadRef.current.gradedEventIds[match.eventId] = grade
          lastNotationPayloadRef.current.hitTimingByEventId[match.eventId] = elapsedMs
          lastNotationPayloadRef.current.liveAccuracyPercent = currentLiveAccuracyPercent()
          sendNotationStateRef.current(lastNotationPayloadRef.current)
        }
        setLastGrade(grade)
        setLastDynamicsGrade(dynamicsGrade)
        recomputeScoring()
        return grade
      }
      const extraHit: ExtraHitEvent = { id: createId(), instrument, hitTimeMs: elapsedMs }
      extraHitsRef.current.push(extraHit)
      setExtraHits((prev) => [...prev, extraHit])
      if (lastNotationPayloadRef.current) {
        // An 'extra' hit has no eventId to key gradedEventIds/hitTimingByEventId
        // by, but it still moves the denominator (see calculateAccuracy) —
        // the phone's own live accuracy needs this update just as much as a
        // graded hit's does. extraHits itself (see NotationStatePayload's
        // own doc comment) is what lets the phone draw the same marker for
        // it the desktop does, instead of a mismatch between "5 extra hits"
        // in the results and an all-green sheet showing nothing wrong.
        lastNotationPayloadRef.current.extraHits = [...lastNotationPayloadRef.current.extraHits, extraHit]
        lastNotationPayloadRef.current.liveAccuracyPercent = currentLiveAccuracyPercent()
        sendNotationStateRef.current(lastNotationPayloadRef.current)
      }
      setLastGrade('extra')
      setLastDynamicsGrade(undefined)
      recomputeScoring()
      return 'extra'
    },
    [noteHighwayRef, recomputeScoring, thresholds],
  )

  useKeyboardDrums({ enabled: (phase === 'running' || phase === 'count-in') && !isDemo, onHit: handleHit })

  const toggleMidiControl = useCallback(() => {
    setIsMidiControlEnabled((prev) => {
      const next = !prev
      isMidiControlEnabledRef.current = next
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

  // Full remote control (RemoteHostProvider, src/features/visual-trainer/
  // remote-host-context.tsx) — owns the single desktop/"host" relay
  // connection for the whole app (not just while this exercise's page is
  // mounted), and forwards phone hits/transport commands into whichever
  // useVisualTrainer instance is currently registered as the active
  // session. See the registration effect further down, placed after start/
  // pause/resume/exit are all declared.
  const remoteHost = useRemoteHost()
  const {
    status: remoteStatus,
    isEnabled: isPhoneControlEnabled,
    toggleEnabled: togglePhoneControl,
    sendNotationState,
    sendPlaybackStatus,
    registerSession,
  } = remoteHost

  useEffect(() => {
    sendNotationStateRef.current = sendNotationState
  }, [sendNotationState])
  useEffect(() => {
    sendPlaybackStatusRef.current = sendPlaybackStatus
  }, [sendPlaybackStatus])
  useEffect(() => {
    routineProgressRef.current = options?.routineProgress
  }, [options?.routineProgress])

  // Same phase/demo gating as handleRemoteHit, and the same reasoning for
  // why (useMidiDrumInput's own connection lifecycle is decoupled from
  // `phase` too).
  // Explicit user report: a kick-triggered start/restart fires the instant
  // the pedal is hit — no network round trip, often faster than anything a
  // phone-driven Play/transport press could ever manage — and occasionally
  // faster than this session's own async work (fresh-mount settling for a
  // start, or whatever else) has actually caught up, leaving the phone's
  // notation_state/playback_status stuck stale even though the exercise
  // plays correctly on the desktop. Confirmed directly: never reproduces
  // via the phone's own Play button, and waiting a couple of seconds
  // before kicking avoids it too — a phone-driven action always gets that
  // same couple of seconds of round-trip time "for free". A one-shot
  // delayed catch-up resend gives whatever needs to settle the same head
  // start, without waiting for the regular 2s heartbeat (startBarInterval)
  // to get there on its own. Reuses stickClickTimeoutIdsRef's own
  // cleanup lifecycle (cleared on unmount/exit/beginPlayback) rather than
  // a dedicated ref, since it's just "a pending timeout tied to this run".
  const scheduleRemoteCatchupResend = useCallback(() => {
    const timeoutId = setTimeout(() => {
      stickClickTimeoutIdsRef.current.delete(timeoutId)
      if (lastNotationPayloadRef.current) sendNotationStateRef.current(lastNotationPayloadRef.current)
      sendPlaybackStatusRef.current({
        exerciseId: exercise.id,
        title: exercise.title,
        bpm: exercise.bpm,
        phase: phaseRef.current,
        routineProgress: routineProgressRef.current,
      })
    }, 500)
    stickClickTimeoutIdsRef.current.add(timeoutId)
  }, [exercise])

  const handleMidiHit = useCallback(
    (instrument: DrumInstrument, hitTimeMs: number, velocity: number) => {
      if (isDemoRef.current) return
      if (phaseRef.current !== 'running' && phaseRef.current !== 'count-in') {
        // Explicit user request: hands are on the real kit, not the phone
        // or keyboard — a kick hit while nothing's playing (idle, or the
        // previous run just finished) starts/restarts THIS exercise, same
        // as pressing Play, so a set of reps never needs reaching for
        // anything else. Only the foot-voice instrument (kick) triggers
        // this, and only from idle/finished — not mid-pause (resuming a
        // pause is a deliberate, different action, not "play again"), and
        // every other pad still does nothing outside a real run, same as
        // before.
        if (
          instrument === 'kick' &&
          (phaseRef.current === 'idle' || phaseRef.current === 'finished') &&
          !kickStartInFlightRef.current
        ) {
          kickStartInFlightRef.current = true
          startRef.current()
          scheduleRemoteCatchupResend()
        }
        return
      }
      const grade = handleHit(instrument, hitTimeMs, velocity)
      if (instrument !== 'kick') return
      if (grade !== 'extra') {
        // A kick that matched a real scheduled note breaks any pending
        // double-click — two legitimate pattern hits should never chain
        // into an accidental restart later.
        lastExtraKickAtRef.current = null
        return
      }
      // Explicit user request: two kick hits that both miss the pattern
      // (graded 'extra' — not matched to any scheduled note) close together
      // read as a deliberate "jump to start" gesture, mirroring the
      // idle/finished kick-to-start above but for mid-run restarts. Gating
      // on 'extra' (rather than any kick) is what lets this coexist with
      // genuine fast double-kick patterns in the curriculum, whose hits
      // match real events and are graded normally instead.
      const now = performance.now()
      const lastExtraKickAt = lastExtraKickAtRef.current
      lastExtraKickAtRef.current = now
      if (lastExtraKickAt !== null && now - lastExtraKickAt <= DOUBLE_KICK_RESTART_WINDOW_MS) {
        lastExtraKickAtRef.current = null
        restartRef.current()
        scheduleRemoteCatchupResend()
      }
    },
    [handleHit, scheduleRemoteCatchupResend],
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
          expectedTimeMs: applyStaffCursorTimingBias(timeMs, displayMode),
          velocity: event.velocity,
          accent: event.accent ?? false,
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
      setLastDynamicsGrade(undefined)
      setDynamicsSummary(EMPTY_DYNAMICS_SUMMARY)

      // Mirror this run's notation to the phone (explicit user request) —
      // scoped to exactly the scenario it's for: a real (non-demo) run with
      // a real e-kit connected, so the phone becomes a companion display
      // while the player's hands stay on the kit. Sent for every
      // displayMode, not just staff_cursor — the phone's own
      // ExerciseNotationSheet is a generic rows-of-notation view that works
      // for any exercise, including the regular note_highway curriculum
      // lessons the desktop itself still shows as a scrolling highway; only
      // the *desktop's* rendering choice is staff_cursor-gated (see
      // effectiveDisplayMode in VisualTrainerPage.tsx). Anything else (demo,
      // or MIDI not enabled) explicitly clears whatever the phone was
      // showing, so switching modes/input never leaves it stale. sessionId
      // is Date.now(), not playSessionId state — the phone's own
      // ExerciseNotationSheet only needs *some* value that changes per run
      // to remount its CSS animation, not one numerically matching the
      // desktop's own React state.
      if (!demo && isMidiControlEnabledRef.current) {
        const notationPayload: NotationStatePayload = {
          exercise,
          playbackProgress: { bpm: exercise.bpm, sessionId: Date.now(), startOffsetMs: startOffsetMs - countInDurationMsRef.current },
          paused: false,
          gradedEventIds: {},
          hitTimingByEventId: {},
          extraHits: [],
          // Matches EMPTY_SCORING.accuracyPercent — nothing graded yet at
          // the very start of a run.
          liveAccuracyPercent: 100,
        }
        lastNotationPayloadRef.current = notationPayload
        sendNotationState(notationPayload)
      } else {
        lastNotationPayloadRef.current = null
        sendNotationState(null)
      }

      setActiveHits({})
      setStickClickToken(undefined)
      setGradedEventIds(new Map())
      setHitTimingByEventId(new Map())
      setExtraHits([])
      setPlaySessionId((current) => current + 1)
      setCurrentBar(Math.max(1, Math.floor(startOffsetMs / barDurationMsRef.current) + 1))
      setCurrentBeat(1)
      setElapsedMs(startOffsetMs)
      noteHighwayRef.current?.reset()
      const startingPhase = countInBars > 0 ? 'count-in' : 'running'
      setPhaseBoth(startingPhase)
      // See kickStartInFlightRef's own doc comment — phase has now actually
      // caught up, so a kick landing from here on reads the real phase
      // again instead of a stale 'idle'.
      kickStartInFlightRef.current = false
      // Unconditional, unlike the notation_state block above (staff_cursor+
      // MIDI only) — this is what drives the phone's transport buttons
      // regardless of display mode, so it always fires.
      sendPlaybackStatus({
        exerciseId: exercise.id,
        title: exercise.title,
        bpm: exercise.bpm,
        phase: startingPhase,
        routineProgress: routineProgressRef.current,
      })

      rafIdRef.current = requestAnimationFrame(tick)
      startBarInterval()
    },
    [clearStickClickTimeouts, displayMode, exercise, noteHighwayRef, sendNotationState, sendPlaybackStatus, setPhaseBoth, startBarInterval, stopLoops, tick],
  )

  const start = useCallback(() => beginPlayback(false), [beginPlayback])
  useEffect(() => {
    startRef.current = start
  }, [start])
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
    sendPlaybackStatus({
      exerciseId: exercise.id,
      title: exercise.title,
      bpm: exercise.bpm,
      phase: 'paused',
      routineProgress: routineProgressRef.current,
    })
    if (lastNotationPayloadRef.current) {
      lastNotationPayloadRef.current.paused = true
      sendNotationState(lastNotationPayloadRef.current)
    }
  }, [exercise, sendNotationState, sendPlaybackStatus, setPhaseBoth, stopLoops])

  const resume = useCallback(() => {
    if (phaseRef.current !== 'paused') return
    engineRef.current?.resumeFromPause()
    setPhaseBoth(prePausePhaseRef.current)
    rafIdRef.current = requestAnimationFrame(tick)
    startBarInterval()
    sendPlaybackStatus({
      exerciseId: exercise.id,
      title: exercise.title,
      bpm: exercise.bpm,
      phase: prePausePhaseRef.current,
      routineProgress: routineProgressRef.current,
    })
    if (lastNotationPayloadRef.current) {
      lastNotationPayloadRef.current.paused = false
      sendNotationState(lastNotationPayloadRef.current)
    }
  }, [exercise, sendNotationState, sendPlaybackStatus, setPhaseBoth, startBarInterval, tick])

  const restart = useCallback(() => {
    beginPlayback(isDemoRef.current)
  }, [beginPlayback])
  useEffect(() => {
    restartRef.current = restart
  }, [restart])

  const exit = useCallback(() => {
    engineRef.current?.stop()
    stopLoops()
    clearStickClickTimeouts()
    setPhaseBoth('idle')
    lastNotationPayloadRef.current = null
    sendNotationState(null)
    sendPlaybackStatus({ exerciseId: null, title: null, bpm: null, phase: 'none' })
  }, [clearStickClickTimeouts, sendNotationState, sendPlaybackStatus, setPhaseBoth, stopLoops])

  // Re-asserts THIS session's real current status (and, if a real MIDI run
  // is mirroring notation, its current notation too) on demand — not the
  // registration effect's own mount-time 'idle' snapshot below, which would
  // be wrong once the run has actually moved past idle (running/paused/
  // finished). Exists for two cases with the same underlying shape:
  // RemoteHostProvider's "re-selecting whatever's already the current
  // route" (navigate() to an unchanged location is a no-op, nothing
  // remounts), and a controller (re)connecting mid-run (see
  // onControllerCountChange — a fresh/returning phone has no way to learn
  // the desktop's current state otherwise, short of the next thing that
  // happens to change it). Reads phaseRef (the live value tick()/
  // handleHit() themselves already trust), not the `phase` state closed
  // over at whatever render defined this callback.
  const resendStatus = useCallback(() => {
    sendPlaybackStatus({
      exerciseId: exercise.id,
      title: exercise.title,
      bpm: exercise.bpm,
      phase: phaseRef.current,
      routineProgress: routineProgressRef.current,
    })
    if (lastNotationPayloadRef.current) sendNotationState(lastNotationPayloadRef.current)
  }, [exercise, sendNotationState, sendPlaybackStatus])

  // Registers this instance as RemoteHostProvider's "active session" — a
  // phone hit or transport_command reaches whichever useVisualTrainer
  // instance is currently registered (only one VisualTrainerRunner is ever
  // mounted at a time, see VisualTrainerPage.tsx's key={exercise.id}).
  // Placed after start/pause/resume/exit/handleRemoteHit are all declared,
  // so it can reference them directly (no ref-mirror needed here, unlike
  // tick()/handleHit() further up). Also reports the initial 'idle' status
  // on mount and 'none' on unmount, since a phone that was already browsing
  // when this exercise loads (or that navigates away while it's still open)
  // needs to know either way.
  useEffect(() => {
    sendPlaybackStatus({
      exerciseId: exercise.id,
      title: exercise.title,
      bpm: exercise.bpm,
      phase: 'idle',
      routineProgress: routineProgressRef.current,
    })
    const unregister = registerSession({
      handleHit: handleRemoteHit,
      start,
      pause,
      resume,
      stop: exit,
      skip: options?.onSkip,
      previous: options?.onPrevious,
      resendStatus,
    })
    return () => {
      unregister()
      sendPlaybackStatus({ exerciseId: null, title: null, bpm: null, phase: 'none' })
    }
  }, [
    exercise,
    handleRemoteHit,
    options?.onSkip,
    options?.onPrevious,
    pause,
    registerSession,
    resendStatus,
    resume,
    sendPlaybackStatus,
    start,
    exit,
  ])

  return {
    phase,
    isDemo,
    scoring,
    gradeCounts,
    lastGrade,
    lastDynamicsGrade,
    dynamicsSummary,
    activeHits,
    stickClickToken,
    gradedEventIds,
    hitTimingByEventId,
    extraHits,
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
