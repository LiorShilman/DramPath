import { useEffect, useRef, useState } from 'react'
import { calculateBarDurationMs } from '../domain/calculations/event-timing'
import { ExercisePlaybackEngine } from '../lib/visual-trainer/exercise-playback-engine'
import type { InteractiveExercise } from '../domain'

export interface ExercisePreviewPlayback {
  isPlaying: boolean
  /** Bump on every play() — feeds ExerciseNotationSheet's playbackProgress
   * sessionId so restarting playback restarts its fill animation. */
  playSessionId: number
  play: () => void
  stop: () => void
}

/**
 * A minimal "hear the pattern" preview: one playthrough, no count-in, no
 * scoring, no seek/ruler/grid. Extracted from ExerciseBuilderPage's own
 * startPlayback/stopPlayback (which keeps its richer seek-capable version
 * for its own grid-editing UI) so a read-only consumer like LessonDetailPage
 * can drive ExerciseNotationSheet's playbackProgress prop without owning an
 * AudioContext/ExercisePlaybackEngine itself.
 */
export function useExercisePreviewPlayback(exercise: InteractiveExercise | undefined): ExercisePreviewPlayback {
  const [isPlaying, setIsPlaying] = useState(false)
  const [playSessionId, setPlaySessionId] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const playbackEngineRef = useRef<ExercisePlaybackEngine | null>(null)
  const stopTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function stop() {
    if (stopTimeoutIdRef.current !== null) {
      clearTimeout(stopTimeoutIdRef.current)
      stopTimeoutIdRef.current = null
    }
    playbackEngineRef.current?.stop()
    setIsPlaying(false)
  }

  useEffect(() => stop, [])

  function play() {
    if (!exercise || exercise.events.length === 0) return
    stop()

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    void audioContextRef.current.resume()

    if (!playbackEngineRef.current) playbackEngineRef.current = new ExercisePlaybackEngine(audioContextRef.current)
    playbackEngineRef.current.start(exercise, { countInBars: 0 })

    setIsPlaying(true)
    setPlaySessionId((current) => current + 1)

    const durationMs = calculateBarDurationMs(exercise.bpm, exercise.timeSignature) * exercise.bars
    stopTimeoutIdRef.current = setTimeout(stop, durationMs)
  }

  return { isPlaying, playSessionId, play, stop }
}
