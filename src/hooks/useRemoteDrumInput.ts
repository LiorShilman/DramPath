import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_RELAY_PORT,
  SUPERSEDED_CLOSE_CODE,
  buildProductionRelayWsUrl,
  parseRemoteRelayMessage,
} from '../lib/visual-trainer/remote-drum-protocol'
import type { DrumInstrument } from '../domain'

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
 */
export function useRemoteDrumInput({ enabled, onHit }: UseRemoteDrumInputOptions): RemoteDrumInputStatus {
  // 'disabled' is a pure derived value (see the return statement below),
  // never set here directly — this state only ever tracks the connection's
  // own lifecycle while enabled is true. Calling setState synchronously
  // inside an effect body just to represent "disabled" would trigger
  // react-hooks/set-state-in-effect for no real benefit.
  const [connectionStatus, setConnectionStatus] = useState<Exclude<RemoteDrumInputStatus, 'disabled'>>('connecting')
  const onHitRef = useRef(onHit)

  useEffect(() => {
    onHitRef.current = onHit
  }, [onHit])

  useEffect(() => {
    if (!enabled) return undefined

    let socket: WebSocket | undefined
    let reconnectTimeoutId: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    function connect() {
      if (stopped) return
      setConnectionStatus('connecting')
      socket = new WebSocket(hostRelayWsUrl())

      socket.onmessage = (event) => {
        if (typeof event.data !== 'string') return
        const message = parseRemoteRelayMessage(event.data)
        if (!message) return
        if (message.type === 'hit') {
          onHitRef.current(message.instrument, performance.now())
        } else if (message.type === 'controller_status') {
          setConnectionStatus(message.count > 0 ? 'connected' : 'waiting-for-phone')
        }
      }

      socket.onclose = (event) => {
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
      socket?.close()
    }
  }, [enabled])

  return enabled ? connectionStatus : 'disabled'
}
