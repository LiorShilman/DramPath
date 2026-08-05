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
  /** Which subdivision within the current beat is playing right now (0 =
   * the beat itself) — finer-grained than beatIndex, which only updates on
   * the first subdivision of each beat. null whenever beatIndex is null. */
  subdivisionIndex: number | null
  /** Increments on every subdivision tick, even when subdivisionIndex
   * repeats the same value (e.g. quarters only ever have one subdivision
   * position) — React bails out of re-rendering on an unchanged primitive,
   * so a consumer that wants to visibly pulse on every tick (not just when
   * the index actually changes) needs this as a always-fresh key/dependency. */
  subTickCount: number
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
  const [subdivisionIndex, setSubdivisionIndex] = useState<number | null>(null)
  const [subTickCount, setSubTickCount] = useState(0)
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
      onSubTick: (_beat, subdivision) => {
        setSubdivisionIndex(subdivision)
        setSubTickCount((count) => count + 1)
      },
    })
    setIsPlaying(true)
  }, [])

  const stop = useCallback(() => {
    engineRef.current?.stop()
    setIsPlaying(false)
    setBeatIndex(null)
    setSubdivisionIndex(null)
    setSubTickCount(0)
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
    subdivisionIndex,
    subTickCount,
    isCountIn,
    start,
    stop,
    updateBpm,
    updateSubdivision,
    updateAccentFirstBeat,
  }
}
