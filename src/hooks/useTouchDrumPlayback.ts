import { useCallback, useEffect, useRef, useState } from 'react'
import { playDrumSound } from '../lib/visual-trainer/drum-synth'
import { markHit } from '../lib/visual-trainer/active-hits'
import type { DrumInstrument } from '../domain'

export interface PlayHitOptions {
  /** Skips the actual sound, still flashes the piece — for a phone acting
   * as a silent remote controller (see TouchDrumKitPage's mute toggle),
   * where the desktop it's connected to is already the one making sound
   * and hearing both at once is the whole problem being solved. */
  silent?: boolean
}

export interface UseTouchDrumPlaybackResult {
  activeHits: Partial<Record<DrumInstrument, string>>
  playHit: (instrument: DrumInstrument, options?: PlayHitOptions) => void
}

/** Touch-driven counterpart to useFreeDrumPlayback — same lazy AudioContext
 * (must be created on a user gesture; a tap qualifies) and activeHits
 * tracking, just exposed as a direct playHit(instrument) call for a tap
 * handler to invoke, instead of wiring to a global keydown listener. */
export function useTouchDrumPlayback(): UseTouchDrumPlaybackResult {
  const audioContextRef = useRef<AudioContext | null>(null)
  const outputNodeRef = useRef<GainNode | null>(null)
  const [activeHits, setActiveHits] = useState<Partial<Record<DrumInstrument, string>>>({})

  useEffect(() => {
    return () => {
      void audioContextRef.current?.close()
    }
  }, [])

  const playHit = useCallback((instrument: DrumInstrument, options?: PlayHitOptions) => {
    if (!options?.silent) {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
        outputNodeRef.current = audioContextRef.current.createGain()
        outputNodeRef.current.connect(audioContextRef.current.destination)
      }
      void audioContextRef.current.resume()
      playDrumSound(audioContextRef.current, outputNodeRef.current!, audioContextRef.current.currentTime, instrument, 100)
    }
    setActiveHits((prev) => markHit(prev, instrument, crypto.randomUUID()))
  }, [])

  return { activeHits, playHit }
}
