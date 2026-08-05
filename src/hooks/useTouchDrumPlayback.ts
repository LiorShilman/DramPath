import { useCallback, useEffect, useRef, useState } from 'react'
import { playDrumSound } from '../lib/visual-trainer/drum-synth'
import type { DrumInstrument } from '../domain'

export interface UseTouchDrumPlaybackResult {
  activeHits: Partial<Record<DrumInstrument, string>>
  playHit: (instrument: DrumInstrument) => void
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

  return { activeHits, playHit }
}
