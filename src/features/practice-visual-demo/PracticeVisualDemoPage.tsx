import { useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader, Button } from '../../components/ui'
import { createId, nowIso } from '../../domain'
import { calculateBarDurationMs } from '../../domain/calculations/event-timing'
import { DrumKitSvg } from '../../components/visual-trainer/DrumKitSvg'
import { NoteHighway } from '../../components/visual-trainer/NoteHighway'
import { ExercisePlaybackEngine } from '../../lib/visual-trainer/exercise-playback-engine'
import { useKeyboardDrums } from '../../hooks/useKeyboardDrums'
import type { NoteHighwayHandle } from '../../components/visual-trainer/NoteHighway'
import type { DrumInstrument, DrumNoteEvent, InteractiveExercise } from '../../domain'

const COUNT_IN_BARS = 1

// VISUAL_DRUM_TRAINER_SPEC.md §17's own suggested seed content #5 ("מקצב
// Rock בסיסי") — not persisted, not real seed data (that's Stage 6), just a
// local demo exercise for this temporary verification page.
function buildDemoExercise(): InteractiveExercise {
  const events: DrumNoteEvent[] = []
  for (let bar = 1; bar <= 2; bar += 1) {
    for (let beat = 1; beat <= 4; beat += 1) {
      if (beat === 1 || beat === 3) {
        events.push({ id: createId(), bar, beat, subdivisionIndex: 0, instrument: 'kick', velocity: 110 })
      }
      if (beat === 2 || beat === 4) {
        events.push({ id: createId(), bar, beat, subdivisionIndex: 0, instrument: 'snare', velocity: 110 })
      }
      events.push({ id: createId(), bar, beat, subdivisionIndex: 0, instrument: 'hihat_closed', velocity: 80 })
      events.push({ id: createId(), bar, beat, subdivisionIndex: 1, instrument: 'hihat_closed', velocity: 65 })
    }
  }
  const now = nowIso()
  return {
    id: createId(),
    title: 'מקצב Rock בסיסי',
    difficulty: 'beginner',
    bpm: 90,
    minBpm: 60,
    maxBpm: 140,
    timeSignature: { numerator: 4, denominator: 4 },
    subdivision: 'eighth',
    bars: 2,
    loopCount: 2,
    displayMode: 'note_highway',
    events,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Temporary Stage 4 verification page — wires the audio engine (Stage 2),
 * keyboard input (Stage 3), and the new SVG kit + note highway together for
 * the first true end-to-end look-and-listen check. Not linked from
 * navigation (reached by direct URL only, same precedent as
 * /practice/session). Deleted in Stage 5 once the real exercise-runner
 * flow (§15's /practice/visual/:exerciseId) replaces it.
 */
export function PracticeVisualDemoPage() {
  const exercise = useMemo(() => buildDemoExercise(), [])
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeHit, setActiveHit] = useState<{ instrument: DrumInstrument; hitToken: string } | undefined>()

  const audioContextRef = useRef<AudioContext | null>(null)
  const engineRef = useRef<ExercisePlaybackEngine | null>(null)
  const highwayRef = useRef<NoteHighwayHandle>(null)
  const rafIdRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
      engineRef.current?.dispose()
      void audioContextRef.current?.close()
    }
  }, [])

  function handleStart() {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext()
    if (!engineRef.current) engineRef.current = new ExercisePlaybackEngine(audioContextRef.current)
    const audioContext = audioContextRef.current
    const engine = engineRef.current
    void audioContext.resume()

    engine.setMasterVolume(0.8)
    engine.setDrumVolume(0.9)
    engine.setMetronomeVolume(0.5)
    engine.start(exercise, { countInBars: COUNT_IN_BARS })
    setIsPlaying(true)

    const countInDurationMs = COUNT_IN_BARS * calculateBarDurationMs(exercise.bpm, exercise.timeSignature)

    function tick() {
      const elapsedMs = (audioContext.currentTime - engine.startAudioTimeSeconds) * 1000 - countInDurationMs
      highwayRef.current?.render(elapsedMs)
      rafIdRef.current = requestAnimationFrame(tick)
    }
    rafIdRef.current = requestAnimationFrame(tick)
  }

  function handleStop() {
    engineRef.current?.stop()
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    setIsPlaying(false)
  }

  useKeyboardDrums({
    onHit: (instrument) => {
      setActiveHit({ instrument, hitToken: createId() })
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={`דף הדגמה זמני (שלב 4) — ${exercise.title}`} />
      <p className="text-sm text-[var(--color-text-muted)]">
        לחצו F / J / D / E / R / T / U / I / O כדי להכות בתופים. מסך זמני לאימות שלב 4 — יוחלף במסך האמיתי
        בשלב 5.
      </p>
      <div className="flex gap-2">
        {isPlaying ? (
          <Button variant="danger-outline" onClick={handleStop}>
            עצור
          </Button>
        ) : (
          <Button onClick={handleStart}>נגן</Button>
        )}
      </div>
      <NoteHighway ref={highwayRef} events={exercise.events} exercise={exercise} />
      <div className="mx-auto w-full max-w-md">
        <DrumKitSvg activeHit={activeHit} />
      </div>
    </div>
  )
}
