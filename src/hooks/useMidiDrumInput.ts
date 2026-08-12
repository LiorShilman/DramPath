import { useEffect, useRef, useState } from 'react'
import { MIDI_NOTE_TO_INSTRUMENT } from '../lib/visual-trainer/midi-drum-map'
import type { DrumInstrument } from '../domain'

export type MidiDrumInputStatus = 'disabled' | 'unsupported' | 'requesting' | 'no-device' | 'connected'

export interface UseMidiDrumInputOptions {
  enabled: boolean
  /** velocity is the real MIDI byte (1-127, 0 is filtered out as a
   * note-off — see handleMessage below) — the only input source in this
   * app with genuine per-hit strike force, used for dynamics/accent
   * grading (see hit-matcher.ts's gradeDynamics). */
  onHit: (instrument: DrumInstrument, hitTimeMs: number, velocity: number) => void
}

const NOTE_ON = 0x90

// Static per browser (doesn't change during a page's lifetime) — a plain
// function rather than a cached module-level constant, so it reads the
// real navigator.requestMIDIAccess at call time (needed for tests to stub
// navigator per-test; a value computed once at import time would never see
// a later stub).
function isMidiSupported(): boolean {
  return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
}

/** Real e-kit input over Web MIDI — mirrors useRemoteDrumInput's role
 * (detect a hit, call onHit), just over navigator.requestMIDIAccess()
 * instead of the phone relay's WebSocket (ADR 0007). Chrome/Edge only (Web
 * MIDI isn't implemented in Firefox/Safari as of this writing) —
 * 'unsupported' lets a caller show a clear message instead of a silent
 * no-op. Note-to-instrument mapping lives in midi-drum-map.ts, reverse
 * engineered against the user's own Lemon T550 via tools/midi-inspector.html
 * — an unrecognized note number is simply ignored (e.g. a pad zone not yet
 * mapped), not treated as an error.
 *
 * A Note On message with velocity 0 is the MIDI convention for note-off
 * (same as a real Note Off status byte) — only a genuine velocity>0 Note On
 * counts as a hit.
 *
 * Deliberately does NOT stamp hitTimeMs from anything the device sends —
 * same reasoning as useRemoteDrumInput: performance.now() is read the
 * instant the message arrives, since the message itself carries no
 * timestamp synchronized with the desktop's own AudioContext clock.
 */
export function useMidiDrumInput({ enabled, onHit }: UseMidiDrumInputOptions): MidiDrumInputStatus {
  // 'disabled'/'unsupported' are pure derived values (see the return
  // statement below), same pattern as useRemoteDrumInput's connectionStatus
  // — this state only ever tracks the connection's own lifecycle once
  // enabled and supported are both already known to be true.
  const [status, setStatus] = useState<Exclude<MidiDrumInputStatus, 'disabled' | 'unsupported'>>('requesting')
  const onHitRef = useRef(onHit)

  useEffect(() => {
    onHitRef.current = onHit
  }, [onHit])

  useEffect(() => {
    if (!enabled || !isMidiSupported()) return undefined

    let cancelled = false
    let attachedInputs: MIDIInput[] = []

    function handleMessage(event: MIDIMessageEvent) {
      const data = event.data
      if (!data || data.length < 3) return
      const statusByte = data[0]! & 0xf0
      const note = data[1]!
      const velocity = data[2]!
      if (statusByte !== NOTE_ON || velocity === 0) return

      const instrument = MIDI_NOTE_TO_INSTRUMENT[note]
      if (!instrument) return
      onHitRef.current(instrument, performance.now(), velocity)
    }

    function attach(access: MIDIAccess) {
      if (cancelled) return
      for (const input of attachedInputs) input.onmidimessage = null
      attachedInputs = [...access.inputs.values()]
      for (const input of attachedInputs) input.onmidimessage = handleMessage
      setStatus(attachedInputs.length > 0 ? 'connected' : 'no-device')
    }

    // No synchronous setStatus('requesting') here — the state's own
    // useState default already starts at 'requesting' for a fresh mount,
    // and re-enabling after a previous connected/no-device keeps showing
    // that last-known status for the brief moment until this request
    // resolves, rather than a synchronous setState directly in the effect
    // body (flagged by react-hooks/set-state-in-effect — every other
    // status update here already happens inside a callback, matching the
    // rule's own recommended pattern).
    navigator
      .requestMIDIAccess()
      .then((access) => {
        if (cancelled) return
        attach(access)
        // Covers a device plugged in (or unplugged) after access was
        // already granted — same "re-render the current device list on
        // every change" approach as tools/midi-inspector.html.
        access.onstatechange = () => attach(access)
      })
      .catch(() => {
        if (!cancelled) setStatus('no-device')
      })

    return () => {
      cancelled = true
      for (const input of attachedInputs) input.onmidimessage = null
    }
  }, [enabled])

  if (!enabled) return 'disabled'
  if (!isMidiSupported()) return 'unsupported'
  return status
}
