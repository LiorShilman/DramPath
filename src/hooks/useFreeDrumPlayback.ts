import { useEffect, useRef, useState } from 'react'
import { useKeyboardDrums } from './useKeyboardDrums'
import { playDrumSound } from '../lib/visual-trainer/drum-synth'
import type { DrumInstrument } from '../domain'

export interface ActiveHit {
  instrument: DrumInstrument
  hitToken: string
}

/** Free (ungraded) keyboard drum playback — no exercise timeline, just
 * "press a mapped key, hear the matching drum, see the kit react." Used by
 * the free notation-practice mode, where the notes come from a photo the
 * player is reading, not a scored DrumNoteEvent[]. */
export function useFreeDrumPlayback(): { activeHit: ActiveHit | undefined } {
  const audioContextRef = useRef<AudioContext | null>(null)
  const outputNodeRef = useRef<GainNode | null>(null)
  const [activeHit, setActiveHit] = useState<ActiveHit | undefined>(undefined)

  useEffect(() => {
    return () => {
      void audioContextRef.current?.close()
    }
  }, [])

  useKeyboardDrums({
    onHit: (instrument: DrumInstrument) => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
        outputNodeRef.current = audioContextRef.current.createGain()
        outputNodeRef.current.connect(audioContextRef.current.destination)
      }
      void audioContextRef.current.resume()
      playDrumSound(audioContextRef.current, outputNodeRef.current!, audioContextRef.current.currentTime, instrument, 100)
      setActiveHit({ instrument, hitToken: crypto.randomUUID() })
    },
  })

  return { activeHit }
}
