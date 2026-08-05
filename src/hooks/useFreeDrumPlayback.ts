import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeyboardDrums } from './useKeyboardDrums'
import { useRemoteDrumInput } from './useRemoteDrumInput'
import type { RemoteDrumInputStatus } from './useRemoteDrumInput'
import { playDrumSound } from '../lib/visual-trainer/drum-synth'
import type { DrumInstrument } from '../domain'

export interface UseFreeDrumPlaybackResult {
  activeHits: Partial<Record<DrumInstrument, string>>
  /** Phone-as-remote-controller (ADR 0007) — this ungraded mode has no
   * running/paused phase to gate on the way useVisualTrainer does, so a
   * phone hit here plays immediately whenever the toggle is on, exactly
   * like a keyboard hit. Off by default, persisted since it's a standing
   * setup choice, not per-session state (same key convention as
   * useVisualTrainer's isPhoneControlEnabled). */
  isPhoneControlEnabled: boolean
  togglePhoneControl: () => void
  remoteStatus: RemoteDrumInputStatus
}

const PHONE_CONTROL_ENABLED_STORAGE_KEY = 'drumpath.freePractice.isPhoneControlEnabled'

/** Free (ungraded) drum playback — no exercise timeline, just "trigger a
 * mapped instrument, hear the matching drum, see the kit react." Used by
 * the free notation-practice mode, where the notes come from a photo the
 * player is reading, not a scored DrumNoteEvent[]. Keyed by instrument
 * (not a single value) so two instruments hit at (near-)the same time both
 * get their own entry instead of one overwriting the other. Two input
 * sources feed the same playHit: the keyboard (useKeyboardDrums, always on)
 * and the phone (useRemoteDrumInput, opt-in) — mirrors useVisualTrainer's
 * own dual-wiring of the same two hooks. */
export function useFreeDrumPlayback(): UseFreeDrumPlaybackResult {
  const audioContextRef = useRef<AudioContext | null>(null)
  const outputNodeRef = useRef<GainNode | null>(null)
  const [activeHits, setActiveHits] = useState<Partial<Record<DrumInstrument, string>>>({})
  const [isPhoneControlEnabled, setIsPhoneControlEnabled] = useState(
    () => localStorage.getItem(PHONE_CONTROL_ENABLED_STORAGE_KEY) === 'true',
  )

  useEffect(() => {
    return () => {
      void audioContextRef.current?.close()
    }
  }, [])

  const playHit = useCallback((instrument: DrumInstrument) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
      outputNodeRef.current = audioContextRef.current.createGain()
      outputNodeRef.current.connect(audioContextRef.current.destination)
    }
    void audioContextRef.current.resume()
    playDrumSound(audioContextRef.current, outputNodeRef.current!, audioContextRef.current.currentTime, instrument, 100)
    setActiveHits((prev) => ({ ...prev, [instrument]: crypto.randomUUID() }))
  }, [])

  useKeyboardDrums({ onHit: playHit })
  const remoteStatus = useRemoteDrumInput({ enabled: isPhoneControlEnabled, onHit: playHit })

  const togglePhoneControl = useCallback(() => {
    setIsPhoneControlEnabled((prev) => {
      const next = !prev
      localStorage.setItem(PHONE_CONTROL_ENABLED_STORAGE_KEY, String(next))
      return next
    })
  }, [])

  return { activeHits, isPhoneControlEnabled, togglePhoneControl, remoteStatus }
}
