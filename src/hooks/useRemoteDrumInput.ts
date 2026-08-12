import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_RELAY_PORT,
  SUPERSEDED_CLOSE_CODE,
  buildProductionRelayWsUrl,
  parseRemoteRelayMessage,
} from '../lib/visual-trainer/remote-drum-protocol'
import type { ExerciseListItem, TransportCommandAction } from '../lib/visual-trainer/remote-drum-protocol'
import type { DrumInstrument, InteractiveExercise } from '../domain'

function hostRelayWsUrl(): string {
  // The deployed IIS site is https — connect to the always-on production
  // relay (PM2, its own TLS, fixed address, see ADR 0007) instead of a dev
  // localhost that doesn't exist there. Dev mode (plain http) keeps using
  // the local relay unchanged.
  return location.protocol === 'https:' ? buildProductionRelayWsUrl('host') : `ws://localhost:${DEFAULT_RELAY_PORT}/ws/host`
}

export type RemoteDrumInputStatus = 'disabled' | 'connecting' | 'waiting-for-phone' | 'connected' | 'superseded'

export interface UseRemoteDrumInputOptions {
  enabled: boolean
  onHit: (instrument: DrumInstrument, hitTimeMs: number) => void
  /** Full remote control (browse/select/play/pause/resume/stop from the
   * phone) — all three optional, and all three are only ever wired up by
   * RemoteHostProvider (the one place this hook is called from now), not by
   * useVisualTrainer directly. See remote-host-context.tsx. */
  onRequestExerciseList?: () => void
  onSelectExercise?: (exerciseId: string) => void
  onTransportCommand?: (action: TransportCommandAction) => void
}

/** A null payload clears whatever notation the phone was showing (session
 * paused/finished/exited, or switched to a mode this feature doesn't cover
 * — see useVisualTrainer's own gating). */
export interface NotationStatePayload {
  exercise: InteractiveExercise
  playbackProgress: { bpm: number; sessionId: number; startOffsetMs?: number }
  paused: boolean
  /** Per-note hit/miss, keyed by DrumNoteEvent id — mirrors
   * ExerciseNotationSheet's own gradedEventIds prop, plain-object form
   * (see remote-drum-protocol.ts's own doc comment on why not a Map). */
  gradedEventIds: Record<string, 'hit' | 'miss'>
}

/** Unconditional session status (unlike NotationStatePayload, which only
 * ever gets sent for staff_cursor+MIDI runs) — exerciseId/title/bpm are all
 * null together exactly when phase is 'none' (nothing loaded on the
 * desktop). Mirrors remote-drum-protocol.ts's playback_status message. */
export interface PlaybackStatusPayload {
  exerciseId: string | null
  title: string | null
  bpm: number | null
  phase: 'idle' | 'count-in' | 'running' | 'paused' | 'finished' | 'none'
}

export interface UseRemoteDrumInputResult {
  status: RemoteDrumInputStatus
  /** Pushes the desktop's currently-playing notation to every connected
   * controller (a phone propped next to a real e-kit, explicit user
   * request) — see remote-drum-protocol.ts's notation_state/notation_clear
   * and useRemoteDrumSender.ts for the receiving side. Same no-queueing
   * stance as everything else in this feature (ADR 0007): silently no-ops
   * if nothing is connected right now, rather than buffering for later. */
  sendNotationState: (state: NotationStatePayload | null) => void
  /** Full remote control (RemoteHostProvider) — the exercise catalog, sent
   * in response to a request_exercise_list message. */
  sendExerciseList: (exercises: ExerciseListItem[]) => void
  /** Full remote control (RemoteHostProvider) — see PlaybackStatusPayload. */
  sendPlaybackStatus: (status: PlaybackStatusPayload) => void
}

const RECONNECT_INTERVAL_MS = 3000

/** Desktop/"host" side of the phone-as-remote-controller feature (ADR 0007)
 * — mirrors useKeyboardDrums's role (detect a hit, call onHit), just over a
 * WebSocket to server/remote-drum-relay instead of window keydown events.
 * Never needs a manually-configured address: in dev it connects to its own
 * localhost (the relay runs on this same machine, a separate local
 * terminal, same as drum-import-service); over the deployed https site it
 * connects to the fixed always-on production relay instead (see
 * hostRelayWsUrl / buildProductionRelayWsUrl, ADR 0007) — either way there's
 * nothing to configure here. Only the phone (a genuinely different machine,
 * in dev mode) ever needs an address typed in, see useRemoteDrumSender.
 *
 * Deliberately does NOT stamp hitTimeMs from anything the phone sends —
 * performance.now() is read the instant a message arrives, since a phone's
 * clock isn't synchronized with the desktop's own AudioContext clock (see
 * remote-drum-protocol.ts's doc comment). Network latency becomes the hit's
 * timing error, which is fine for this use case.
 *
 * Connection lifecycle is intentionally decoupled from the exercise's own
 * running/paused phase (unlike useKeyboardDrums's `enabled`) — a WS
 * connection isn't free to open/close on every phase change the way a
 * keydown listener is, and the user needs to see "phone connected" before
 * pressing start, not just during a run. The caller (useVisualTrainer) is
 * responsible for only forwarding onHit's calls into scoring during the
 * phases where a keyboard hit would count too.
 *
 * Also the SEND side of a second, host->controller direction (notation
 * mirroring, exercise list, playback status) — the socket lives in a ref
 * (not a connect()-local variable) specifically so sendNotationState/
 * sendExerciseList/sendPlaybackStatus can reach whatever connection is
 * currently live from outside the connect effect.
 *
 * Called from exactly one place now: RemoteHostProvider
 * (src/features/visual-trainer/remote-host-context.tsx), not from
 * useVisualTrainer directly — the connection has to survive navigation
 * between exercises (and exist even before any exercise is open, for
 * exercise-list browsing), so it's owned by a provider mounted at the app
 * shell level instead of a per-exercise hook instance. useVisualTrainer
 * consumes it via useRemoteHost() and registers itself as the "active
 * session" the provider forwards hits/transport commands into.
 */
export function useRemoteDrumInput({
  enabled,
  onHit,
  onRequestExerciseList,
  onSelectExercise,
  onTransportCommand,
}: UseRemoteDrumInputOptions): UseRemoteDrumInputResult {
  // 'disabled' is a pure derived value (see the return statement below),
  // never set here directly — this state only ever tracks the connection's
  // own lifecycle while enabled is true. Calling setState synchronously
  // inside an effect body just to represent "disabled" would trigger
  // react-hooks/set-state-in-effect for no real benefit.
  const [connectionStatus, setConnectionStatus] = useState<Exclude<RemoteDrumInputStatus, 'disabled'>>('connecting')
  const onHitRef = useRef(onHit)
  const onRequestExerciseListRef = useRef(onRequestExerciseList)
  const onSelectExerciseRef = useRef(onSelectExercise)
  const onTransportCommandRef = useRef(onTransportCommand)
  const socketRef = useRef<WebSocket | undefined>(undefined)

  useEffect(() => {
    onHitRef.current = onHit
  }, [onHit])
  useEffect(() => {
    onRequestExerciseListRef.current = onRequestExerciseList
  }, [onRequestExerciseList])
  useEffect(() => {
    onSelectExerciseRef.current = onSelectExercise
  }, [onSelectExercise])
  useEffect(() => {
    onTransportCommandRef.current = onTransportCommand
  }, [onTransportCommand])

  useEffect(() => {
    if (!enabled) return undefined

    let reconnectTimeoutId: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    function connect() {
      if (stopped) return
      setConnectionStatus('connecting')
      const socket = new WebSocket(hostRelayWsUrl())
      socketRef.current = socket

      socket.onmessage = (event) => {
        if (typeof event.data !== 'string') return
        const message = parseRemoteRelayMessage(event.data)
        if (!message) return
        if (message.type === 'hit') {
          onHitRef.current(message.instrument, performance.now())
        } else if (message.type === 'controller_status') {
          setConnectionStatus(message.count > 0 ? 'connected' : 'waiting-for-phone')
        } else if (message.type === 'request_exercise_list') {
          onRequestExerciseListRef.current?.()
        } else if (message.type === 'select_exercise') {
          onSelectExerciseRef.current?.(message.exerciseId)
        } else if (message.type === 'transport_command') {
          onTransportCommandRef.current?.(message.action)
        }
      }

      socket.onclose = (event) => {
        if (socketRef.current === socket) socketRef.current = undefined
        if (stopped) return
        if (event.code === SUPERSEDED_CLOSE_CODE) {
          // A second desktop tab took over — reconnecting here would just
          // supersede it right back, an infinite fight between two tabs.
          setConnectionStatus('superseded')
          return
        }
        setConnectionStatus('connecting')
        reconnectTimeoutId = setTimeout(connect, RECONNECT_INTERVAL_MS)
      }
    }

    connect()

    return () => {
      stopped = true
      if (reconnectTimeoutId !== undefined) clearTimeout(reconnectTimeoutId)
      socketRef.current?.close()
      socketRef.current = undefined
    }
  }, [enabled])

  const sendNotationState = useCallback((state: NotationStatePayload | null) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify(state ? { type: 'notation_state', ...state } : { type: 'notation_clear' }))
  }, [])

  const sendExerciseList = useCallback((exercises: ExerciseListItem[]) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: 'exercise_list', exercises }))
  }, [])

  const sendPlaybackStatus = useCallback((status: PlaybackStatusPayload) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: 'playback_status', ...status }))
  }, [])

  return { status: enabled ? connectionStatus : 'disabled', sendNotationState, sendExerciseList, sendPlaybackStatus }
}
