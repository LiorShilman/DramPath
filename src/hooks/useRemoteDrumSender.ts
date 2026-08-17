import { useCallback, useEffect, useRef, useState } from 'react'
import { buildProductionRelayWsUrl, parseRemoteRelayMessage } from '../lib/visual-trainer/remote-drum-protocol'
import type { ExerciseListItem, RoutineListItem, TransportCommandAction } from '../lib/visual-trainer/remote-drum-protocol'
import type { DrumInstrument, ExtraHitEvent, HitGrade, InteractiveExercise } from '../domain'

export type RemoteDrumSenderStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

/** The desktop's currently-playing notation, mirrored here (explicit user
 * request — hands on a real e-kit, not the keyboard, so the phone becomes
 * the display instead of the computer screen) — undefined whenever nothing
 * is being mirrored right now (no session, or one this feature doesn't
 * cover; see useVisualTrainer's own gating on the sending side). */
export interface RemoteNotationState {
  exercise: InteractiveExercise
  playbackProgress: { bpm: number; sessionId: number; startOffsetMs?: number }
  paused: boolean
  gradedEventIds: Record<string, HitGrade>
  /** Per-note actual strike time (ms), keyed by DrumNoteEvent id — see
   * remote-drum-protocol.ts's own doc comment on the wire field. */
  hitTimingByEventId: Record<string, number>
  /** Every hit this run that matched no pending event — see
   * remote-drum-protocol.ts's own doc comment on the wire field. */
  extraHits: ExtraHitEvent[]
  /** Live running accuracy (0-100) — see remote-drum-protocol.ts's own doc
   * comment on the wire field. */
  liveAccuracyPercent: number
}

/** Mirrors the desktop's unconditional session status (unlike
 * RemoteNotationState, which only ever arrives for a real, non-demo run
 * with MIDI enabled — see useVisualTrainer's own gating on the sending
 * side) — drives the transport buttons regardless of display mode. undefined
 * before the first playback_status ever arrives (or after disconnect);
 * once received it's never cleared back to undefined, only its own `phase`
 * field goes to 'none' — same reasoning notationState doesn't apply here:
 * a 'none' status is itself meaningful information ("nothing is loaded"),
 * not "no data yet". */
export interface RemotePlaybackStatus {
  exerciseId: string | null
  title: string | null
  bpm: number | null
  phase: 'idle' | 'count-in' | 'running' | 'paused' | 'finished' | 'none'
  /** Present only while the desktop is running a practice routine — drives
   * the phone's "skip" button and step indicator. */
  routineProgress?: { stepIndex: number; stepCount: number }
  /** Present only when phase is 'finished' — mirrors SessionResults' core
   * numbers (explicit user request: with no access to the computer, the
   * phone needs to show what the run actually looked like, not just that it
   * ended). */
  resultsSummary?: {
    accuracyPercent: number
    gradeCounts: { perfect: number; early: number; late: number; miss: number; extra: number }
  }
}

/** PedalDisciplinePage's own mirror — a completely separate screen from the
 * notation/exercise flow above (no InteractiveExercise), see
 * remote-drum-protocol.ts's pedal_discipline_state for field meaning.
 * undefined whenever that screen isn't open on the desktop right now. */
export interface RemotePedalDisciplineState {
  isRunning: boolean
  streak: number
  bestStreak: number
  totalHits: number
  closedHits: number
  elapsedSeconds: number
  lastHit?: 'closed' | 'open'
}

export interface UseRemoteDrumSenderResult {
  status: RemoteDrumSenderStatus
  /** relayUrl (a LAN "host:port", dev-mode only) is optional — omit it to
   * auto-connect to the fixed always-on production relay instead (ADR
   * 0007), which is what this page does whenever it was itself loaded over
   * https (the deployed site). */
  connect: (relayUrl?: string) => void
  disconnect: () => void
  sendHit: (instrument: DrumInstrument) => void
  notationState: RemoteNotationState | undefined
  /** Full remote control (browse/select/play/pause/resume/stop) — see
   * remote-host-context.tsx for the desktop side. */
  exerciseList: ExerciseListItem[] | undefined
  routineList: RoutineListItem[] | undefined
  playbackStatus: RemotePlaybackStatus | undefined
  pedalDisciplineState: RemotePedalDisciplineState | undefined
  requestExerciseList: () => void
  selectExercise: (exerciseId: string) => void
  selectRoutine: (routineId: string) => void
  sendTransportCommand: (action: TransportCommandAction) => void
}

/** Where the phone's remembered relay address (desktop LAN host:port,
 * e.g. "192.168.1.59:8001") is persisted — this codebase's first use of
 * localStorage (confirmed via search: everything else durable goes through
 * Dexie repositories), a deliberate exception since this is a UI/session
 * preference specific to this device, not domain data. */
export const REMOTE_RELAY_URL_STORAGE_KEY = 'drumpath.remoteRelayUrl'

const RETRY_INTERVAL_MS = 2000
const MAX_QUIET_RETRIES = 3

/** Phone/"controller" side of the phone-as-remote-controller feature (ADR
 * 0007) — mirrors useTouchDrumPlayback's playHit shape, just sending over a
 * WebSocket to server/remote-drum-relay instead of playing local audio.
 * Two ways to connect: pass a relayUrl (dev mode only — the phone is a
 * genuinely different machine than whatever's running the local relay, so
 * needs a manually-typed LAN address there) or call connect() with no
 * argument, which auto-derives the fixed always-on production relay address
 * (this is what TouchDrumKitPage does whenever it was itself loaded over
 * https — the deployed site). Retry policy is deliberately conservative in
 * both cases: a first connection attempt that never succeeds (wrong IP,
 * relay not running/reachable) goes straight to 'error' with no auto-retry,
 * since silently spinning would hide an ambiguous, likely-user-fixable
 * problem. Only a connection that HAD been established gets a small number
 * of quiet retries (a Wi-Fi hiccup is worth smoothing over automatically). */
export function useRemoteDrumSender(): UseRemoteDrumSenderResult {
  const [status, setStatus] = useState<RemoteDrumSenderStatus>('disconnected')
  const [notationState, setNotationState] = useState<RemoteNotationState | undefined>(undefined)
  const [exerciseList, setExerciseList] = useState<ExerciseListItem[] | undefined>(undefined)
  const [routineList, setRoutineList] = useState<RoutineListItem[] | undefined>(undefined)
  const [playbackStatus, setPlaybackStatus] = useState<RemotePlaybackStatus | undefined>(undefined)
  const [pedalDisciplineState, setPedalDisciplineState] = useState<RemotePedalDisciplineState | undefined>(undefined)
  const socketRef = useRef<WebSocket | undefined>(undefined)
  const retryTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hasConnectedOnceRef = useRef(false)
  const retryCountRef = useRef(0)

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutIdRef.current !== undefined) {
      clearTimeout(retryTimeoutIdRef.current)
      retryTimeoutIdRef.current = undefined
    }
  }, [])

  // A quiet retry needs to call openSocket again, from inside openSocket's
  // own onclose handler — a direct recursive reference to the `const
  // openSocket` being defined below would access it before its declaration
  // finishes, which the React Compiler's linter flags. Routing the
  // self-call through a ref sidesteps that: the ref already exists (empty)
  // by the time openSocket's body runs, and is filled in right after.
  const openSocketRef = useRef<(wsUrl: string) => void>(() => {})

  const openSocket = useCallback((wsUrl: string) => {
    setStatus('connecting')
    const socket = new WebSocket(wsUrl)
    socketRef.current = socket

    socket.onopen = () => {
      hasConnectedOnceRef.current = true
      retryCountRef.current = 0
      setStatus('connected')
    }

    // Receive side of the host->controller notation-mirroring direction —
    // this hook was write-only (sendHit) before. notation_clear (or any
    // other/malformed frame) resets to undefined rather than leaving a
    // stale exercise showing.
    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return
      const message = parseRemoteRelayMessage(event.data)
      if (message?.type === 'notation_state') {
        setNotationState({
          exercise: message.exercise,
          playbackProgress: message.playbackProgress,
          paused: message.paused,
          gradedEventIds: message.gradedEventIds,
          hitTimingByEventId: message.hitTimingByEventId,
          extraHits: message.extraHits,
          liveAccuracyPercent: message.liveAccuracyPercent,
        })
      } else if (message?.type === 'notation_clear') {
        setNotationState(undefined)
      } else if (message?.type === 'exercise_list') {
        setExerciseList(message.exercises)
        setRoutineList(message.routines)
      } else if (message?.type === 'playback_status') {
        setPlaybackStatus({
          exerciseId: message.exerciseId,
          title: message.title,
          bpm: message.bpm,
          phase: message.phase,
          routineProgress: message.routineProgress,
          resultsSummary: message.resultsSummary,
        })
      } else if (message?.type === 'pedal_discipline_state') {
        setPedalDisciplineState({
          isRunning: message.isRunning,
          streak: message.streak,
          bestStreak: message.bestStreak,
          totalHits: message.totalHits,
          closedHits: message.closedHits,
          elapsedSeconds: message.elapsedSeconds,
          lastHit: message.lastHit,
        })
      } else if (message?.type === 'pedal_discipline_clear') {
        setPedalDisciplineState(undefined)
      }
    }

    socket.onclose = () => {
      if (socketRef.current !== socket) return // superseded by a newer connect()/disconnect()
      if (hasConnectedOnceRef.current && retryCountRef.current < MAX_QUIET_RETRIES) {
        retryCountRef.current += 1
        setStatus('connecting')
        retryTimeoutIdRef.current = setTimeout(() => openSocketRef.current(wsUrl), RETRY_INTERVAL_MS)
      } else {
        setStatus('error')
      }
    }
  }, [])

  useEffect(() => {
    openSocketRef.current = openSocket
  }, [openSocket])

  const connect = useCallback(
    (relayUrl?: string) => {
      clearRetryTimeout()
      hasConnectedOnceRef.current = false
      retryCountRef.current = 0
      if (relayUrl) {
        localStorage.setItem(REMOTE_RELAY_URL_STORAGE_KEY, relayUrl)
        openSocket(`ws://${relayUrl}/ws/controller`)
      } else {
        openSocket(buildProductionRelayWsUrl('controller'))
      }
    },
    [clearRetryTimeout, openSocket],
  )

  const disconnect = useCallback(() => {
    clearRetryTimeout()
    socketRef.current?.close()
    socketRef.current = undefined
    setStatus('disconnected')
    // A manual disconnect shouldn't leave a stale previous session's
    // notation/list/status showing if this phone reconnects later.
    setNotationState(undefined)
    setExerciseList(undefined)
    setRoutineList(undefined)
    setPlaybackStatus(undefined)
    setPedalDisciplineState(undefined)
  }, [clearRetryTimeout])

  const sendHit = useCallback((instrument: DrumInstrument) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: 'hit', instrument }))
  }, [])

  const requestExerciseList = useCallback(() => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: 'request_exercise_list' }))
  }, [])

  const selectExercise = useCallback((exerciseId: string) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: 'select_exercise', exerciseId }))
  }, [])

  const selectRoutine = useCallback((routineId: string) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: 'select_routine', routineId }))
  }, [])

  const sendTransportCommand = useCallback((action: TransportCommandAction) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: 'transport_command', action }))
  }, [])

  return {
    status,
    connect,
    disconnect,
    sendHit,
    notationState,
    exerciseList,
    routineList,
    playbackStatus,
    pedalDisciplineState,
    requestExerciseList,
    selectExercise,
    selectRoutine,
    sendTransportCommand,
  }
}
