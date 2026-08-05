import { useEffect, useRef, useState } from 'react'
import { calculateBarDurationMs } from '../domain/calculations/event-timing'
import { ExercisePlaybackEngine } from '../lib/visual-trainer/exercise-playback-engine'
import { createId } from '../domain'
import type { DrumInstrument, InteractiveExercise } from '../domain'

export interface ExercisePreviewPlayback {
  isPlaying: boolean
  /** Bump on every play() — feeds ExerciseNotationSheet's playbackProgress
   * sessionId so restarting playback restarts its fill animation. */
  playSessionId: number
  /** Keyed by instrument, same shape as useVisualTrainer's own activeHits —
   * feeds DrumKit's hit-flash animation directly. */
  activeHits: Partial<Record<DrumInstrument, string>>
  play: () => void
  stop: () => void
}

/**
 * A minimal "hear and see the pattern" preview: one playthrough, no
 * count-in, no scoring, no seek/ruler/grid. Extracted from
 * ExerciseBuilderPage's own startPlayback/stopPlayback (which keeps its
 * richer seek-capable version for its own grid-editing UI) so a read-only
 * consumer like LessonDetailPage can drive both ExerciseNotationSheet's
 * playbackProgress prop and DrumKit's activeHits without owning an
 * AudioContext/ExercisePlaybackEngine itself.
 */
export function useExercisePreviewPlayback(exercise: InteractiveExercise | undefined): ExercisePreviewPlayback {
  const [isPlaying, setIsPlaying] = useState(false)
  const [playSessionId, setPlaySessionId] = useState(0)
  const [activeHits, setActiveHits] = useState<Partial<Record<DrumInstrument, string>>>({})
  const audioContextRef = useRef<AudioContext | null>(null)
  const playbackEngineRef = useRef<ExercisePlaybackEngine | null>(null)
  const stopTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Every event's own DrumKit-flash is scheduled as its own setTimeout (see
  // play() below) — these must all be cleared on stop(), same as the
  // playthrough's own stop timeout, or a hit flash from a stopped/replaced
  // playthrough could still fire late.
  const hitTimeoutIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  function stop() {
    if (stopTimeoutIdRef.current !== null) {
      clearTimeout(stopTimeoutIdRef.current)
      stopTimeoutIdRef.current = null
    }
    for (const timeoutId of hitTimeoutIdsRef.current) clearTimeout(timeoutId)
    hitTimeoutIdsRef.current.clear()
    playbackEngineRef.current?.stop()
    setIsPlaying(false)
    setActiveHits({})
  }

  useEffect(() => stop, [])

  function play() {
    if (!exercise || exercise.events.length === 0) return
    stop()

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    const audioContext = audioContextRef.current
    void audioContext.resume()

    if (!playbackEngineRef.current) playbackEngineRef.current = new ExercisePlaybackEngine(audioContext)
    playbackEngineRef.current.start(exercise, {
      countInBars: 0,
      // Fires ahead of the actual sound (inside the engine's own lookahead
      // window) — schedule the DrumKit flash for the real moment the sound
      // plays, not the moment it was merely queued, same distinction
      // useVisualTrainer's own comment on this callback describes.
      onEventScheduled: (event, audioTimeSeconds) => {
        const delayMs = Math.max(0, (audioTimeSeconds - audioContext.currentTime) * 1000)
        const timeoutId = setTimeout(() => {
          hitTimeoutIdsRef.current.delete(timeoutId)
          setActiveHits((current) => ({ ...current, [event.instrument]: createId() }))
        }, delayMs)
        hitTimeoutIdsRef.current.add(timeoutId)
      },
    })

    setIsPlaying(true)
    setPlaySessionId((current) => current + 1)

    const durationMs = calculateBarDurationMs(exercise.bpm, exercise.timeSignature) * exercise.bars
    stopTimeoutIdRef.current = setTimeout(stop, durationMs)
  }

  return { isPlaying, playSessionId, activeHits, play, stop }
}
