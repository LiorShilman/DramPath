import { useEffect, useRef, useState } from 'react'
import { calculateBarDurationMs } from '../domain/calculations/event-timing'
import { ExercisePlaybackEngine } from '../lib/visual-trainer/exercise-playback-engine'
import { playDrumSound } from '../lib/visual-trainer/drum-synth'
import { markHit } from '../lib/visual-trainer/active-hits'
import { useRemoteDrumInput } from './useRemoteDrumInput'
import type { RemoteDrumInputStatus } from './useRemoteDrumInput'
import { createId } from '../domain'
import type { DrumInstrument, InteractiveExercise } from '../domain'

const PHONE_CONTROL_ENABLED_STORAGE_KEY = 'drumpath.lessonPreview.isPhoneControlEnabled'
const PHONE_HIT_VELOCITY = 100
// How long a single note stays highlighted in the notation after it plays —
// same brief-flash feel as DrumKit's own HIT_FLASH_MS, just for the
// notehead instead of the kit piece.
const NOTE_HIGHLIGHT_DURATION_MS = 150

export interface ExercisePreviewPlayback {
  isPlaying: boolean
  /** Bump on every play() — feeds ExerciseNotationSheet's playbackProgress
   * sessionId so restarting playback restarts its fill animation. */
  playSessionId: number
  /** Keyed by instrument, same shape as useVisualTrainer's own activeHits —
   * feeds DrumKit's hit-flash animation directly. Merges both the pattern
   * playback's own scheduled hits and any live phone hits below, so one
   * DrumKit reacts to either source. */
  activeHits: Partial<Record<DrumInstrument, string>>
  /** Which notation noteheads to draw in the highlight color right now —
   * same idea as ExerciseBuilderPage's own playingStepEventIds, just driven
   * by real audio-scheduling time (onEventScheduled below) instead of a
   * polled cursor position. Each id is added the instant its sound actually
   * plays and removed again after NOTE_HIGHLIGHT_DURATION_MS — a brief
   * flash per note, not a lingering one. */
  highlightedEventIds: ReadonlySet<string>
  play: () => void
  stop: () => void
  /** Phone-as-remote-controller (ADR 0007) — same opt-in/persisted pattern
   * as useVisualTrainer/useFreeDrumPlayback, scoped to this lesson-preview
   * context (its own storage key) since it's meant for "try the pattern
   * yourself" here, independent of those pages' own toggles. Deliberately
   * doesn't also wire the keyboard (unlike useFreeDrumPlayback) — this page
   * is full of text inputs the user actively types into, and only phone
   * control was asked for here. */
  isPhoneControlEnabled: boolean
  togglePhoneControl: () => void
  remoteStatus: RemoteDrumInputStatus
}

/**
 * A minimal "hear and see the pattern, then try it yourself" preview: one
 * playthrough on demand (no count-in, no scoring, no seek/ruler/grid) plus
 * an opt-in phone-controller input that plays a real drum sound and flashes
 * DrumKit immediately on each hit. Extracted from ExerciseBuilderPage's own
 * startPlayback/stopPlayback (which keeps its richer seek-capable version
 * for its own grid-editing UI) so a read-only consumer like LessonDetailPage
 * can drive ExerciseNotationSheet's playbackProgress and DrumKit's
 * activeHits without owning an AudioContext/ExercisePlaybackEngine itself.
 */
export function useExercisePreviewPlayback(exercise: InteractiveExercise | undefined): ExercisePreviewPlayback {
  const [isPlaying, setIsPlaying] = useState(false)
  const [playSessionId, setPlaySessionId] = useState(0)
  const [activeHits, setActiveHits] = useState<Partial<Record<DrumInstrument, string>>>({})
  const [highlightedEventIds, setHighlightedEventIds] = useState<Set<string>>(new Set())
  const audioContextRef = useRef<AudioContext | null>(null)
  const outputNodeRef = useRef<GainNode | null>(null)
  const playbackEngineRef = useRef<ExercisePlaybackEngine | null>(null)
  const stopTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Every event's own DrumKit-flash is scheduled as its own setTimeout (see
  // play() below) — these must all be cleared on stop(), same as the
  // playthrough's own stop timeout, or a hit flash from a stopped/replaced
  // playthrough could still fire late.
  const hitTimeoutIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const [isPhoneControlEnabled, setIsPhoneControlEnabled] = useState(
    () => localStorage.getItem(PHONE_CONTROL_ENABLED_STORAGE_KEY) === 'true',
  )

  function ensureAudio(): { audioContext: AudioContext; outputNode: GainNode } {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
      outputNodeRef.current = audioContextRef.current.createGain()
      outputNodeRef.current.connect(audioContextRef.current.destination)
    }
    void audioContextRef.current.resume()
    return { audioContext: audioContextRef.current, outputNode: outputNodeRef.current! }
  }

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
    setHighlightedEventIds(new Set())
  }

  useEffect(() => stop, [])

  function play() {
    if (!exercise || exercise.events.length === 0) return
    stop()

    const { audioContext } = ensureAudio()

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
          setActiveHits((current) => markHit(current, event.instrument, createId()))
          setHighlightedEventIds((current) => new Set(current).add(event.id))

          const unhighlightTimeoutId = setTimeout(() => {
            hitTimeoutIdsRef.current.delete(unhighlightTimeoutId)
            setHighlightedEventIds((current) => {
              const next = new Set(current)
              next.delete(event.id)
              return next
            })
          }, NOTE_HIGHLIGHT_DURATION_MS)
          hitTimeoutIdsRef.current.add(unhighlightTimeoutId)
        }, delayMs)
        hitTimeoutIdsRef.current.add(timeoutId)
      },
    })

    setIsPlaying(true)
    setPlaySessionId((current) => current + 1)

    const durationMs = calculateBarDurationMs(exercise.bpm, exercise.timeSignature) * exercise.bars
    stopTimeoutIdRef.current = setTimeout(stop, durationMs)
  }

  function handlePhoneHit(instrument: DrumInstrument) {
    const { audioContext, outputNode } = ensureAudio()
    playDrumSound(audioContext, outputNode, audioContext.currentTime, instrument, PHONE_HIT_VELOCITY)
    setActiveHits((current) => markHit(current, instrument, createId()))
  }

  const { status: remoteStatus } = useRemoteDrumInput({ enabled: isPhoneControlEnabled, onHit: handlePhoneHit })

  function togglePhoneControl() {
    setIsPhoneControlEnabled((current) => {
      const next = !current
      localStorage.setItem(PHONE_CONTROL_ENABLED_STORAGE_KEY, String(next))
      return next
    })
  }

  return {
    isPlaying,
    playSessionId,
    activeHits,
    highlightedEventIds,
    play,
    stop,
    isPhoneControlEnabled,
    togglePhoneControl,
    remoteStatus,
  }
}
