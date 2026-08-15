import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  List,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { DrumKit } from '../../components/visual-trainer/DrumKit'
import { ExerciseNotationSheet } from '../../components/visual-trainer/ExerciseNotationSheet'
import { LiveAccuracyMeter } from '../../components/visual-trainer/LiveAccuracyMeter'
import { StickingPatternGuide } from '../../components/visual-trainer/StickingPatternGuide'
import { useTouchDrumPlayback } from '../../hooks/useTouchDrumPlayback'
import { useFullscreen } from '../../hooks/useFullscreen'
import { useFitSize } from '../../hooks/useFitSize'
import {
  REMOTE_RELAY_URL_STORAGE_KEY,
  useRemoteDrumSender,
} from '../../hooks/useRemoteDrumSender'
import type { RemotePlaybackStatus } from '../../hooks/useRemoteDrumSender'
import type {
  ExerciseListItem,
  RoutineListItem,
  TransportCommandAction,
} from '../../lib/visual-trainer/remote-drum-protocol'
import { useMetronome } from '../practice-session/useMetronome'
import { withBaseUrl } from '../../lib/asset-url'
import { SUBDIVISION_LABELS } from '../exercises/exercise-labels'
import type { Subdivision } from '../../domain'

const DEFAULT_BPM = 90
const BPM_STEP = 5
const MIN_BPM = 30
const MAX_BPM = 300
const BEATS_PER_BAR = [0, 1, 2, 3]

// DrumKit's own root is aspect-[4/3] w-full — it derives its height from
// whatever width it's given. The 5%/15% left/right padding added around it
// below (to keep the ride/crash cymbals' deliberate overflow on-screen,
// see the kit wrapper's own comment) eats into that width without adding
// any vertical padding, so the box actually presented to useFitSize is
// wider, relative to its height, than a plain 4:3 box — (4/3) / 0.8 = 5/3
// accounts for that so the fit calculation matches what's actually
// rendered instead of running a little large.
const KIT_WRAPPER_ASPECT_RATIO = 4 / 3 / 0.8

// A page loaded over https (the deployed IIS site) auto-connects to the
// fixed always-on production relay (ADR 0007, no address to type in) —
// wss:// isn't mixed content, unlike a plain ws://, which is why this ISN'T
// a "blocked" branch. Dev mode (plain http, no relay at a fixed address)
// keeps the manual host:port entry. Checked once at module load rather than
// per-render since location.protocol can't change without a full page
// navigation anyway.
const IS_PRODUCTION_ORIGIN =
  typeof location !== 'undefined' && location.protocol === 'https:'

const REMOTE_STATUS_LABELS: Record<
  ReturnType<typeof useRemoteDrumSender>['status'],
  string
> = {
  disconnected: 'לא מחובר',
  connecting: 'מתחבר…',
  connected: 'מחובר',
  error: 'שגיאת חיבור',
}

/** Full remote control's status/browse/transport bar — a single component
 * rendered from exactly ONE call site (not duplicated per view), so the kit
 * view and the full-screen notation view can never end up disagreeing about
 * whether it's shown. Always visible the instant the phone is connected
 * (explicit user request: this should be the primary "operate via phone"
 * surface, not something tucked away in a toolbar icon) — the exercise
 * browse button works with or without a loaded session; the transport
 * buttons only appear once playbackStatus reports something other than
 * 'none' (nothing loaded on the desktop yet). */
function RemoteControlBar({
  playbackStatus,
  onBrowse,
  onAction,
}: {
  playbackStatus: RemotePlaybackStatus | undefined
  onBrowse: () => void
  onAction: (action: TransportCommandAction) => void
}) {
  const hasSession =
    playbackStatus !== undefined && playbackStatus.phase !== 'none'
  const isRunning =
    playbackStatus?.phase === 'running' || playbackStatus?.phase === 'count-in'
  const isPaused = playbackStatus?.phase === 'paused'
  const canStart =
    playbackStatus?.phase === 'idle' || playbackStatus?.phase === 'finished'
  return (
    <div className="flex flex-col gap-2">
      <div className="z-20 flex shrink-0 items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-primary)] bg-[var(--color-surface)] px-3 py-2 [box-shadow:var(--shadow-card)]">
      <button
        type="button"
        onClick={onBrowse}
        className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-card)] bg-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-white"
      >
        <List className="h-4 w-4" aria-hidden="true" />
        בחירת תרגיל
      </button>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
        {hasSession ? playbackStatus.title : 'לא נבחר תרגיל'}
        {playbackStatus?.routineProgress && (
          <span className="ms-1 text-xs font-normal text-[var(--color-text-muted)]">
            ({playbackStatus.routineProgress.stepIndex + 1}/{playbackStatus.routineProgress.stepCount})
          </span>
        )}
      </span>
      {hasSession && (
        <>
          {canStart && (
            <button
              type="button"
              onClick={() => onAction('start')}
              aria-label="נגן"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-success)] text-white"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {isRunning && (
            <button
              type="button"
              onClick={() => onAction('pause')}
              aria-label="השהה"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-success)] text-white"
            >
              <Pause className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {isPaused && (
            <button
              type="button"
              onClick={() => onAction('resume')}
              aria-label="המשך"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-success)] text-white"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onAction('stop')}
            aria-label="עצור"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-text-muted)] text-white"
          >
            <Square className="h-4 w-4" aria-hidden="true" />
          </button>
          {/* Only meaningful while running a practice routine, and only once
              a step back exists — explicit user request: redo/revisit an
              earlier step without needing the (possibly unreachable)
              desktop. Absent on the routine's own first step. */}
          {playbackStatus?.routineProgress && playbackStatus.routineProgress.stepIndex > 0 && (
            <button
              type="button"
              onClick={() => onAction('previous')}
              aria-label="חזרה לתרגיל הקודם ברצף"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-text-muted)] text-white"
            >
              <SkipBack className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {/* Only meaningful while running a practice routine — advances
              to the next step. Absent from a plain single-exercise run. */}
          {playbackStatus?.routineProgress && (
            <button
              type="button"
              onClick={() => onAction('skip')}
              aria-label="דלג לתרגיל הבא ברצף"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-text-muted)] text-white"
            >
              <SkipForward className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </>
      )}
      </div>
      {/* Explicit user request: practice can be driven entirely from the
          phone, with no access to the computer — the results dialog
          (VisualTrainerRunner's own SessionResults) is desktop-only, so the
          phone needs its own view of the same numbers once a step finishes,
          not just a bare "finished" status with nothing to read. */}
      {playbackStatus?.phase === 'finished' && playbackStatus.resultsSummary && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm [box-shadow:var(--shadow-card)]">
          <span className="font-semibold">
            דיוק: {Math.round(playbackStatus.resultsSummary.accuracyPercent)}%
          </span>
          <span className="text-[var(--color-success-text)]">
            מושלם {playbackStatus.resultsSummary.gradeCounts.perfect}
          </span>
          <span className="text-[var(--color-warning-text)]">
            מוקדם {playbackStatus.resultsSummary.gradeCounts.early}
          </span>
          <span className="text-[var(--color-warning-text)]">
            מאוחר {playbackStatus.resultsSummary.gradeCounts.late}
          </span>
          <span className="text-[var(--color-danger-text)]">
            פספוסים {playbackStatus.resultsSummary.gradeCounts.miss}
          </span>
        </div>
      )}
    </div>
  )
}

/** Full remote control's exercise/routine picker — a fixed-overlay list
 * (same role="dialog"/inset-0/bg-black-40 pattern VisualTrainerPage's own
 * finished-session modal already uses), not a dedicated Sheet primitive
 * (this UI library doesn't have one). exercises/routines are each undefined
 * while the request is still in flight, and an empty array once resolved
 * to nothing. */
function ExerciseBrowserSheet({
  exercises,
  routines,
  onSelectExercise,
  onSelectRoutine,
  onClose,
}: {
  exercises: ExerciseListItem[] | undefined
  routines: RoutineListItem[] | undefined
  onSelectExercise: (exerciseId: string) => void
  onSelectRoutine: (routineId: string) => void
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="בחירת תרגיל"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex max-h-[80vh] w-full max-w-sm flex-col gap-3 overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)] p-3 [box-shadow:var(--shadow-card)]">
        <div className="flex items-center justify-between">
          <span className="font-semibold">בחירת תרגיל</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-muted)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto">
          {routines !== undefined && routines.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">רצפי תרגול</span>
              <ul className="flex flex-col gap-1">
                {routines.map((routine) => (
                  <li key={routine.id}>
                    <button
                      type="button"
                      onClick={() => onSelectRoutine(routine.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-card)] border border-[var(--color-primary)] p-2 text-start"
                    >
                      <span className="truncate">{routine.title}</span>
                      <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{routine.exerciseCount} תרגילים</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-col gap-1">
            {routines !== undefined && routines.length > 0 && (
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">תרגילים</span>
            )}
            <ul className="flex flex-col gap-1">
              {exercises === undefined ? (
                <li className="p-2 text-sm text-[var(--color-text-muted)]">טוען…</li>
              ) : exercises.length === 0 ? (
                <li className="p-2 text-sm text-[var(--color-text-muted)]">לא נמצאו תרגילים</li>
              ) : (
                exercises.map((exercise) => (
                  <li key={exercise.id}>
                    <button
                      type="button"
                      onClick={() => onSelectExercise(exercise.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] p-2 text-start"
                    >
                      <span className="truncate">{exercise.title}</span>
                      <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{exercise.bpm} BPM</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Standalone, chrome-free touch practice screen. Mounted two ways: as
 * routes.tsx's top-level /practice/touch (client-side nav from within the
 * main app), and as touch-main.tsx's whole-page root for touch.html — a
 * second real HTML document with its own manifest/start_url, so "Add to
 * Home Screen" on it launches straight here instead of the main app's
 * dashboard (a single shared manifest's start_url otherwise always wins,
 * regardless of which page you installed from). A plain <a>, not
 * react-router's Link, since the touch.html mount has no Router context.
 *
 * Second version: can now also control the DESKTOP's own VisualTrainerPage
 * session live over the LAN (ADR 0007, server/remote-drum-relay) — taps
 * still play local sound/flash exactly as before (unaffected, additive),
 * and ALSO get sent to the desktop when connected. The original v1 doc
 * comment here said networking was out of scope for "its first version" —
 * this is that anticipated next version. */
export function TouchDrumKitPage() {
  const { activeHits, playHit } = useTouchDrumPlayback()
  const { isFullscreen, toggleFullscreen } = useFullscreen()
  const metronome = useMetronome()
  const remoteSender = useRemoteDrumSender()
  const [bpm, setBpm] = useState(DEFAULT_BPM)
  const [subdivision, setSubdivision] = useState<Subdivision>('quarter')
  const [relayUrlInput, setRelayUrlInput] = useState(
    () => localStorage.getItem(REMOTE_RELAY_URL_STORAGE_KEY) ?? '',
  )
  // Off by default — most solo practice still wants to hear the phone
  // itself. Meant for when connected to the desktop (so it's not sounding
  // twice), but left independently toggleable rather than tied to
  // remoteSender.status: a silent tap still flashes the kit, which is also
  // useful stand-alone (e.g. practicing quietly).
  const [isLocalSoundMuted, setIsLocalSoundMuted] = useState(false)
  const { containerRef: kitAreaRef, width: fitWidth } =
    useFitSize<HTMLDivElement>(KIT_WRAPPER_ASPECT_RATIO)
  // A manual "back to kit" (below) only hides the current notation view
  // locally — it doesn't disconnect or tell the desktop anything. Reset to
  // false whenever a genuinely NEW notation push arrives (a fresh
  // sessionId), so the next practice run auto-shows again even if the
  // previous one was dismissed; identity-compared on sessionId rather than
  // just "notationState went from undefined to defined", since pause/resume
  // resend the same run's payload and shouldn't undo a dismissal.
  const [dismissedSessionId, setDismissedSessionId] = useState<
    number | undefined
  >(undefined)
  // Full remote control's exercise-picker sheet — local UI state, not tied
  // to the connection itself. requestExerciseList() is fired fresh every
  // time it opens (no caching): the desktop is the source of truth and this
  // is cheap enough to just re-ask.
  const [isBrowsingExercises, setIsBrowsingExercises] = useState(false)
  // ExerciseNotationSheet wants a Map (its own established prop shape);
  // the wire format is a plain object (Map isn't JSON-serializable, see
  // remote-drum-protocol.ts) — converted once per actual change, not
  // rebuilt every render, so a same-value re-render doesn't remount the
  // colored noteheads for no reason.
  const remoteGradedEventIds = useMemo(
    () =>
      new Map(Object.entries(remoteSender.notationState?.gradedEventIds ?? {})),
    [remoteSender.notationState?.gradedEventIds],
  )
  const remoteHitTimingByEventId = useMemo(
    () =>
      new Map(Object.entries(remoteSender.notationState?.hitTimingByEventId ?? {})),
    [remoteSender.notationState?.hitTimingByEventId],
  )

  function adjustBpm(delta: number) {
    const next = Math.min(MAX_BPM, Math.max(MIN_BPM, bpm + delta))
    setBpm(next)
    if (metronome.isPlaying) metronome.updateBpm(next)
  }

  function handlePieceHit(instrument: Parameters<typeof playHit>[0]) {
    playHit(instrument, { silent: isLocalSoundMuted })
    if (remoteSender.status === 'connected') remoteSender.sendHit(instrument)
  }

  function handleToggleRemoteConnection() {
    if (
      remoteSender.status === 'connected' ||
      remoteSender.status === 'connecting'
    ) {
      remoteSender.disconnect()
      return
    }
    if (IS_PRODUCTION_ORIGIN) {
      remoteSender.connect()
    } else if (relayUrlInput.trim()) {
      remoteSender.connect(relayUrlInput.trim())
    }
  }

  function handleOpenExerciseBrowser() {
    remoteSender.requestExerciseList()
    setIsBrowsingExercises(true)
  }

  function handleSelectExercise(exerciseId: string) {
    remoteSender.selectExercise(exerciseId)
    setIsBrowsingExercises(false)
  }

  function handleSelectRoutine(routineId: string) {
    remoteSender.selectRoutine(routineId)
    setIsBrowsingExercises(false)
  }

  function handleToggleMetronome() {
    if (metronome.isPlaying) {
      metronome.stop()
      return
    }
    metronome.start({ bpm, subdivision, accentFirstBeat: true, countInBars: 0 })
  }

  // Computed once, rendered from a single call site in BOTH the kit view and
  // the notation view below (interpolated as the same element, not two
  // separate JSX calls) — the two views can never disagree about whether
  // it's shown, unlike the earlier version where each view had its own
  // (subtly different) conditional block. Explicit user request: this
  // should be the primary "operate via phone" surface, visible the instant
  // the phone is connected, not something buried in a toolbar icon.
  const remoteControlBar =
    remoteSender.status === 'connected' ? (
      <RemoteControlBar
        playbackStatus={remoteSender.playbackStatus}
        onBrowse={handleOpenExerciseBrowser}
        onAction={remoteSender.sendTransportCommand}
      />
    ) : null

  function handleSubdivisionChange(next: Subdivision) {
    setSubdivision(next)
    if (metronome.isPlaying) metronome.updateSubdivision(next)
  }

  // Mirrors the desktop's own currently-playing notation (explicit user
  // request — hands on a real e-kit, not the keyboard, so the phone becomes
  // the display instead of the computer screen). Replaces the whole
  // kit/metronome UI below rather than sharing the screen with it — this is
  // a read-only companion display while a real session is running, not
  // something the player needs to also tap during. sessionId (not just
  // "notationState is defined") is what dismissal compares against, so
  // pause/resume resending the same run's payload doesn't un-dismiss it,
  // but a genuinely new practice run does.
  const notationState = remoteSender.notationState
  if (
    notationState &&
    notationState.playbackProgress.sessionId !== dismissedSessionId
  ) {
    return (
      <div
        className="relative flex h-svh w-full flex-col overflow-hidden bg-[var(--color-bg)] p-2 landscape:p-3"
        // Explicit user request + confirmed via a real-device screenshot:
        // even with ExerciseNotationSheet's own small internal edge padding,
        // a phone's front-camera cutout (landscape, left edge) still sat
        // over the notation. env(safe-area-inset-left) is this exact
        // device's own reported unsafe-area width (0 on a device without
        // one) — a plain inline style, not a Tailwind class, so it can't
        // lose a cascade-order fight against the p-2/landscape:p-3 padding
        // shorthand already on this element (both would set padding-left).
        style={{ paddingLeft: `calc(env(safe-area-inset-left) + 0.5rem)` }}
      >
        <button
          type="button"
          onClick={() =>
            setDismissedSessionId(notationState.playbackProgress.sessionId)
          }
          aria-label="חזרה לתצוגת הקיט"
          className="absolute start-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-text-muted)] text-white shadow-[var(--shadow-card)]"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'צא ממסך מלא' : 'מסך מלא'}
          className="absolute end-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-warning)] text-white shadow-[var(--shadow-card)]"
        >
          {isFullscreen ? (
            <Minimize2 className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Maximize2 className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
        {/* Full remote control — this view otherwise has zero controls, and
            it's exactly the "phone propped next to the real kit" scenario
            where reaching for the desktop isn't an option. pt-14 clears the
            absolute X/fullscreen buttons above. */}
        <div className="shrink-0 pt-14">{remoteControlBar}</div>
        {/* Explicit user request: see accuracy live during the run, not
            just at the end — hidden once 'finished' since RemoteControlBar's
            own resultsSummary badge already covers that moment. */}
        {remoteSender.playbackStatus?.phase !== 'finished' && (
          <div className="flex shrink-0 justify-end px-1 pb-1">
            <LiveAccuracyMeter accuracyPercent={notationState.liveAccuracyPercent} />
          </div>
        )}
        <div className="flex flex-1 items-center overflow-y-auto">
          <ExerciseNotationSheet
            exercise={notationState.exercise}
            playbackProgress={notationState.playbackProgress}
            paused={notationState.paused}
            gradedEventIds={remoteGradedEventIds}
            hitTimingByEventId={remoteHitTimingByEventId}
            extraHits={notationState.extraHits}
            showFill={false}
            showBeatLabels
            showNextUpHint
            rowBreakBars={notationState.exercise.rowBreakBars}
          />
        </div>
        {isBrowsingExercises && (
          <ExerciseBrowserSheet
            exercises={remoteSender.exerciseList}
            routines={remoteSender.routineList}
            onSelectExercise={handleSelectExercise}
            onSelectRoutine={handleSelectRoutine}
            onClose={() => setIsBrowsingExercises(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div
      className="relative flex h-svh flex-col items-center gap-2 overflow-hidden bg-[var(--color-bg)] px-3 pb-3 pt-14"
      // Same safe-area accommodation as the notation view's own root above —
      // a plain inline style so it can't lose a cascade-order fight against
      // the px-3 padding shorthand already on this element.
      style={{ paddingLeft: `calc(env(safe-area-inset-left) + 0.75rem)` }}
    >
      <a
        href={withBaseUrl('')}
        aria-label="חזרה ל-DrumPath"
        className="absolute start-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-[var(--shadow-card)]"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </a>
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? 'צא ממסך מלא' : 'מסך מלא'}
        className="absolute end-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-warning)] text-white shadow-[var(--shadow-card)]"
      >
        {isFullscreen ? (
          <Minimize2 className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Maximize2 className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      {/* Full remote control — always the first thing shown once connected
          (explicit user request), full width, above the toolbar/kit split
          below (which still gets its own landscape:flex-row). */}
      {remoteControlBar && (
        <div className="w-full shrink-0">{remoteControlBar}</div>
      )}

      <div className="flex w-full flex-1 flex-col items-center gap-2 overflow-hidden landscape:flex-row landscape:items-stretch">
        {/* Compact metronome toolbar — a phone screen has no room for the
          full controls FreeNotationPracticePage offers (tap-tempo), so this
          sticks to what a touch-only practice session actually needs:
          start/stop, tempo, subdivision, and which hand is due right now
          (StickingPatternGuide). No manual kit-size control — the kit below
          always fills whatever space is left, measured directly rather
          than guessed via CSS (see useFitSize's own comment for why).
          shrink-0: this row/column keeps its natural size so the kit area
          reliably gets whatever's left, instead of the two fighting over
          space. In landscape it becomes a side column instead of a top row
          — stacking the two vertically was wasting all the spare
          horizontal room a wide-but-short screen actually has, leaving the
          kit stuck small even though there was plenty of space beside it.
          Widened (w-64, not w-40) and still flex-wrap (not forced
          flex-col/flex-nowrap) — a single-file column of every control
          stacked one-per-row was reported as excessive vertical scrolling;
          wrapping lets pairs of controls share a row instead, roughly
          halving the column's height. content-start packs wrapped rows
          against the top instead of spreading them across the full height;
          overflow-y-auto stays as a safety net for a narrow-but-short
          phone that still can't fit everything. */}
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 [box-shadow:var(--shadow-card)] landscape:h-full landscape:w-64 landscape:content-start landscape:overflow-y-auto">
          <button
            type="button"
            onClick={handleToggleMetronome}
            aria-label={metronome.isPlaying ? 'עצור מטרונום' : 'הפעל מטרונום'}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)] text-white"
          >
            {metronome.isPlaying ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => adjustBpm(-BPM_STEP)}
            aria-label="הפחת BPM"
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] text-lg"
          >
            −
          </button>
          <span className="min-w-10 text-center text-lg font-bold tabular-nums">
            {bpm}
          </span>
          <button
            type="button"
            onClick={() => adjustBpm(BPM_STEP)}
            aria-label="הגבר BPM"
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] text-lg"
          >
            +
          </button>
          <div className="flex items-center gap-1 px-1" aria-hidden="true">
            {BEATS_PER_BAR.map((beat) => (
              <span
                key={beat}
                className={`h-2.5 w-2.5 rounded-full border border-[var(--color-border)] ${
                  metronome.isPlaying && metronome.beatIndex === beat
                    ? 'bg-[var(--color-primary)]'
                    : 'bg-[var(--color-text-muted)]/40'
                }`}
              />
            ))}
          </div>
          <select
            value={subdivision}
            onChange={(event) =>
              handleSubdivisionChange(event.target.value as Subdivision)
            }
            aria-label="חלוקה"
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1 text-sm"
          >
            {Object.entries(SUBDIVISION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <StickingPatternGuide
            subdivision={subdivision}
            activeSubdivisionIndex={
              metronome.isPlaying ? metronome.subdivisionIndex : undefined
            }
            activeTick={metronome.subTickCount}
            showCaption={false}
          />
          <span
            className="h-6 w-px bg-[var(--color-border)] landscape:h-px landscape:w-6"
            aria-hidden="true"
          />
          {/* Connect-to-computer (ADR 0007). Over the deployed https site
            there's a fixed always-on relay address — nothing to type in,
            just a toggle. Dev mode (plain http) has no such fixed address,
            so keeps the manual host:port entry. */}
          <div className="flex flex-col items-center gap-1">
            {!IS_PRODUCTION_ORIGIN && (
              <input
                type="text"
                inputMode="url"
                value={relayUrlInput}
                onChange={(event) => setRelayUrlInput(event.target.value)}
                disabled={
                  remoteSender.status === 'connected' ||
                  remoteSender.status === 'connecting'
                }
                placeholder="192.168.1.x:8001"
                aria-label="כתובת המחשב ברשת המקומית"
                className="w-28 rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1 text-center text-xs"
              />
            )}
            {/* Connect + mute share one row (not stacked) — this toolbar
              becomes a narrow, tall, non-wrapping column in landscape (see
              this block's own w-40/flex-col/overflow-y-auto above), so every
              extra row directly eats into the vertical room a short
              landscape phone screen actually has; pairing these two related
              controls avoids adding a whole new row for the mute button. */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleRemoteConnection}
                aria-label={
                  remoteSender.status === 'connected'
                    ? 'התנתק מהמחשב'
                    : 'התחבר למחשב'
                }
                className={`flex h-9 w-9 items-center justify-center rounded-full text-white ${
                  remoteSender.status === 'connected'
                    ? 'bg-[var(--color-success)]'
                    : 'bg-[var(--color-text-muted)]'
                }`}
              >
                {remoteSender.status === 'connected' ? (
                  <Wifi className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <WifiOff className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              {/* Mutes only this phone's own sound — taps still flash the kit
                and still get sent to the desktop when connected, so it stays
                a fully usable remote controller, just silent (avoids hearing
                the hit twice — once here, once from the desktop it's
                controlling). */}
              <button
                type="button"
                onClick={() => setIsLocalSoundMuted((current) => !current)}
                aria-label={
                  isLocalSoundMuted
                    ? 'בטל השתקת קול בפלאפון'
                    : 'השתק קול בפלאפון'
                }
                className={`flex h-9 w-9 items-center justify-center rounded-full text-white ${
                  isLocalSoundMuted
                    ? 'bg-[var(--color-warning)]'
                    : 'bg-[var(--color-text-muted)]'
                }`}
              >
                {isLocalSoundMuted ? (
                  <VolumeX className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {REMOTE_STATUS_LABELS[remoteSender.status]}
            </span>
          </div>
        </div>

        {/* flex-1 + min-h-0/min-w-0: takes exactly whatever space is left
          after the toolbar above (min-h-0 in portrait, min-w-0 in
          landscape — whichever axis flexbox is distributing along is the
          one that needs the explicit 0 to actually let this item shrink
          below its content size; without it, it refuses to shrink and
          forces the page to scroll instead, which was the actual earlier
          bug). useFitSize measures this element directly and returns the
          largest width the kit can use while still fitting on both axes —
          a pure-CSS attempt at the same thing (percentage height +
          aspect-ratio) silently collapsed the kit to nothing whenever an
          ancestor's height wasn't fully definite, which turned out to be a
          real, not just theoretical, failure mode here. */}
        <div
          ref={kitAreaRef}
          className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden landscape:min-w-0"
        >
          {/* DrumKit's own piece layout deliberately lets the ride/crash
            cymbals and hihat stand hang a little past the kit's own box (a
            real kit's silhouette isn't a rectangle), so physical (not
            logical/RTL) padding stays here to keep that from running past
            the screen edge — see KIT_WRAPPER_ASPECT_RATIO's comment for how
            that padding factors into the fit calculation above. Falls back
            to a fixed width before the first ResizeObserver measurement
            lands, so there's no first-paint flash of a collapsed kit. */}
          <div
            style={{
              width: fitWidth ?? 300,
              paddingLeft: '5%',
              paddingRight: '15%',
              boxSizing: 'border-box',
            }}
          >
            <DrumKit activeHits={activeHits} onPieceHit={handlePieceHit} />
          </div>
        </div>
      </div>

      {isBrowsingExercises && (
        <ExerciseBrowserSheet
          exercises={remoteSender.exerciseList}
          routines={remoteSender.routineList}
          onSelectExercise={handleSelectExercise}
          onSelectRoutine={handleSelectRoutine}
          onClose={() => setIsBrowsingExercises(false)}
        />
      )}
    </div>
  )
}
