import { useCallback, useEffect, useRef, useState } from 'react'
import { MetronomeEngine } from '../../lib/metronome-engine'
import type { Subdivision } from '../../domain'

export interface MetronomeStartArgs {
  bpm: number
  subdivision: Subdivision
  accentFirstBeat: boolean
  countInBars: number
}

export interface UseMetronomeResult {
  isPlaying: boolean
  beatIndex: number | null
  isCountIn: boolean
  start: (args: MetronomeStartArgs) => void
  stop: () => void
  updateBpm: (bpm: number) => void
  updateSubdivision: (subdivision: Subdivision) => void
  updateAccentFirstBeat: (accentFirstBeat: boolean) => void
}

/** React lifecycle wrapper around MetronomeEngine — the AudioContext is
 * created lazily on the first `start()` call (must happen on a user
 * gesture) and disposed on unmount. */
export function useMetronome(): UseMetronomeResult {
  const audioContextRef = useRef<AudioContext | null>(null)
  const engineRef = useRef<MetronomeEngine | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [beatIndex, setBeatIndex] = useState<number | null>(null)
  const [isCountIn, setIsCountIn] = useState(false)

  useEffect(() => {
    return () => {
      engineRef.current?.dispose()
      void audioContextRef.current?.close()
    }
  }, [])

  const start = useCallback((args: MetronomeStartArgs) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    if (!engineRef.current) {
      engineRef.current = new MetronomeEngine(audioContextRef.current)
    }
    void audioContextRef.current.resume()

    engineRef.current.start({
      ...args,
      onBeat: (beat, countIn) => {
        setBeatIndex(beat)
        setIsCountIn(countIn)
      },
    })
    setIsPlaying(true)
  }, [])

  const stop = useCallback(() => {
    engineRef.current?.stop()
    setIsPlaying(false)
    setBeatIndex(null)
    setIsCountIn(false)
  }, [])

  const updateBpm = useCallback((bpm: number) => {
    engineRef.current?.updateBpm(bpm)
  }, [])

  const updateSubdivision = useCallback((subdivision: Subdivision) => {
    engineRef.current?.updateSubdivision(subdivision)
  }, [])

  const updateAccentFirstBeat = useCallback((accentFirstBeat: boolean) => {
    engineRef.current?.updateAccentFirstBeat(accentFirstBeat)
  }, [])

  return {
    isPlaying,
    beatIndex,
    isCountIn,
    start,
    stop,
    updateBpm,
    updateSubdivision,
    updateAccentFirstBeat,
  }
}
