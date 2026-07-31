import { useEffect, useRef, useState } from 'react'
import { useKeyboardDrums } from './useKeyboardDrums'
import { playDrumSound } from '../lib/visual-trainer/drum-synth'
import type { DrumInstrument } from '../domain'

/** Free (ungraded) keyboard drum playback — no exercise timeline, just
 * "press a mapped key, hear the matching drum, see the kit react." Used by
 * the free notation-practice mode, where the notes come from a photo the
 * player is reading, not a scored DrumNoteEvent[]. Keyed by instrument
 * (not a single value) so two instruments hit at (near-)the same time both
 * get their own entry instead of one overwriting the other. */
export function useFreeDrumPlayback(): { activeHits: Partial<Record<DrumInstrument, string>> } {
  const audioContextRef = useRef<AudioContext | null>(null)
  const outputNodeRef = useRef<GainNode | null>(null)
  const [activeHits, setActiveHits] = useState<Partial<Record<DrumInstrument, string>>>({})

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
      setActiveHits((prev) => ({ ...prev, [instrument]: crypto.randomUUID() }))
    },
  })

  return { activeHits }
}
