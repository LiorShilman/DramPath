import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { ExercisePlaybackEngine } from '../lib/visual-trainer/exercise-playback-engine'
import { convertHitTimeToExerciseElapsedMs } from '../lib/visual-trainer/clock-sync-math'
import { calculateBarDurationMs } from '../domain/calculations/event-timing'
import { resolveEventScheduleMs } from '../domain/calculations/exercise-schedule'
import { GRADING_THRESHOLDS, detectMissedEvents, findMatchingEvent, gradeTimingError } from '../domain/calculations/hit-matcher'
import type { PendingDrumEvent } from '../domain/calculations/hit-matcher'
import { summarizeScoring } from '../domain/calculations/scoring-engine'
import { useKeyboardDrums } from './useKeyboardDrums'
import { createId } from '../domain'
import type { DrumInstrument, ExtraHitEvent, HitGrade, HitResult, InteractiveExercise, ScoringSummary } from '../domain'
import type { NoteHighwayHandle } from '../components/visual-trainer/NoteHighway'

export type VisualTrainerPhase = 'idle' | 'count-in' | 'running' | 'paused' | 'finished'

export interface GradeCounts {
  perfect: number
  early: number
  late: number
  miss: number
  extra: number
}

export interface UseVisualTrainerResult {
  phase: VisualTrainerPhase
  scoring: ScoringSummary
  gradeCounts: GradeCounts
  lastGrade: HitGrade | 'extra' | undefined
  activeHit: { instrument: DrumInstrument; hitToken: string } | undefined
  currentBar: number
  start: () => void
  pause: () => void
  resume: () => void
  restart: () => void
  exit: () => void
}

const COUNT_IN_BARS = 1
const BAR_UPDATE_INTERVAL_MS = 200
const EMPTY_SCORING: ScoringSummary = {
  accuracyPercent: 0,
  currentCombo: 0,
  bestCombo: 0,
  averageTimingErrorMs: undefined,
}
const EMPTY_GRADE_COUNTS: GradeCounts = { perfect: 0, early: 0, late: 0, miss: 0, extra: 0 }

function countGrades(hitResults: HitResult[], extraHits: ExtraHitEvent[]): GradeCounts {
  const counts: GradeCounts = { perfect: 0, early: 0, late: 0, miss: 0, extra: 0 }
  for (const result of hitResults) counts[result.grade] += 1
  counts.extra = extraHits.length
  return counts
}

/**
 * VISUAL_DRUM_TRAINER_SPEC.md §14's ExerciseRunner/useVisualTrainer —
 * orchestrates one InteractiveExercise run: audio playback (Stage 2),
 * keyboard input (Stage 3), hit matching + scoring (Stage 1), and driving
 * NoteHighway's imperative render() (Stage 4), without persisting anything
 * (that's Stage 6). Hit-matching/miss-detection decisions are pure
 * function calls into the already-tested Stage 1 modules; this hook's own
 * job is state/lifecycle orchestration around them.
 */
export function useVisualTrainer(
  exercise: InteractiveExercise,
  noteHighwayRef: RefObject<NoteHighwayHandle | null>,
): UseVisualTrainerResult {
  const [phase, setPhase] = useState<VisualTrainerPhase>('idle')
  const [scoring, setScoring] = useState<ScoringSummary>(EMPTY_SCORING)
  const [gradeCounts, setGradeCounts] = useState<GradeCounts>(EMPTY_GRADE_COUNTS)
  const [lastGrade, setLastGrade] = useState<HitGrade | 'extra' | undefined>(undefined)
  const [activeHit, setActiveHit] = useState<{ instrument: DrumInstrument; hitToken: string } | undefined>(
    undefined,
  )
  const [currentBar, setCurrentBar] = useState(1)

  const audioContextRef = useRef<AudioContext | null>(null)
  const engineRef = useRef<ExercisePlaybackEngine | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const barIntervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const pendingRef = useRef<PendingDrumEvent[]>([])
  const hitResultsRef = useRef<HitResult[]>([])
  const extraHitsRef = useRef<ExtraHitEvent[]>([])
  const totalExpectedEventsRef = useRef(0)

  const clockOffsetMsRef = useRef(0)
  const countInDurationMsRef = useRef(0)
  const barDurationMsRef = useRef(0)
  const phaseRef = useRef<VisualTrainerPhase>('idle')
  const prePausePhaseRef = useRef<VisualTrainerPhase>('idle')

  const thresholds = GRADING_THRESHOLDS[exercise.difficulty]

  const setPhaseBoth = useCallback((next: VisualTrainerPhase) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  const stopLoops = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    if (barIntervalIdRef.current !== null) {
      clearInterval(barIntervalIdRef.current)
      barIntervalIdRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      stopLoops()
      engineRef.current?.dispose()
      void audioContextRef.current?.close()
    }
  }, [stopLoops])

  const recomputeScoring = useCallback(() => {
    setScoring(summarizeScoring(hitResultsRef.current, extraHitsRef.current, totalExpectedEventsRef.current))
    setGradeCounts(countGrades(hitResultsRef.current, extraHitsRef.current))
  }, [])

  const startBarInterval = useCallback(() => {
    barIntervalIdRef.current = setInterval(() => {
      const audioContext = audioContextRef.current
      const engine = engineRef.current
      if (!audioContext || !engine) return
      const elapsedMs =
        (audioContext.currentTime - engine.startAudioTimeSeconds) * 1000 - countInDurationMsRef.current
      if (elapsedMs < 0) return
      setCurrentBar(Math.max(1, Math.floor(elapsedMs / barDurationMsRef.current) + 1))
    }, BAR_UPDATE_INTERVAL_MS)
  }, [])

  const tickRef = useRef<() => void>(() => {})

  const tick = useCallback(() => {
    const audioContext = audioContextRef.current
    const engine = engineRef.current
    if (!audioContext || !engine) return

    const elapsedMs =
      (audioContext.currentTime - engine.startAudioTimeSeconds) * 1000 - countInDurationMsRef.current

    noteHighwayRef.current?.render(elapsedMs)

    if (phaseRef.current === 'count-in' && elapsedMs >= 0) {
      setPhaseBoth('running')
    }

    const missed = detectMissedEvents(pendingRef.current, elapsedMs, thresholds)
    if (missed.length > 0) {
      const missedIds = new Set(missed.map((event) => event.eventId))
      pendingRef.current = pendingRef.current.filter((event) => !missedIds.has(event.eventId))
      for (const event of missed) {
        hitResultsRef.current.push({
          id: createId(),
          expectedEventId: event.eventId,
          instrument: event.instrument,
          expectedTimeMs: event.expectedTimeMs,
          grade: 'miss',
        })
        noteHighwayRef.current?.markResult(event.eventId, 'miss')
      }
      setLastGrade('miss')
      recomputeScoring()
    }

    if (pendingRef.current.length === 0 && phaseRef.current !== 'finished' && phaseRef.current !== 'idle') {
      setPhaseBoth('finished')
      stopLoops()
      return
    }

    rafIdRef.current = requestAnimationFrame(() => tickRef.current())
  }, [noteHighwayRef, recomputeScoring, setPhaseBoth, stopLoops, thresholds])

  useEffect(() => {
    tickRef.current = tick
  }, [tick])

  const handleHit = useCallback(
    (instrument: DrumInstrument, hitTimeMs: number) => {
      const engine = engineRef.current
      if (!engine) return

      const elapsedMs = convertHitTimeToExerciseElapsedMs(
        hitTimeMs,
        clockOffsetMsRef.current,
        engine.startAudioTimeSeconds,
        countInDurationMsRef.current,
      )

      setActiveHit({ instrument, hitToken: createId() })

      const match = findMatchingEvent(pendingRef.current, instrument, elapsedMs, thresholds)
      if (match) {
        pendingRef.current = pendingRef.current.filter((event) => event.eventId !== match.eventId)
        const grade = gradeTimingError(match.timingErrorMs, thresholds)
        hitResultsRef.current.push({
          id: createId(),
          expectedEventId: match.eventId,
          instrument,
          expectedTimeMs: elapsedMs - match.timingErrorMs,
          actualTimeMs: elapsedMs,
          timingErrorMs: match.timingErrorMs,
          grade,
        })
        noteHighwayRef.current?.markResult(match.eventId, 'hit')
        setLastGrade(grade)
      } else {
        extraHitsRef.current.push({ id: createId(), instrument, hitTimeMs: elapsedMs })
        setLastGrade('extra')
      }
      recomputeScoring()
    },
    [noteHighwayRef, recomputeScoring, thresholds],
  )

  useKeyboardDrums({ enabled: phase === 'running' || phase === 'count-in', onHit: handleHit })

  const start = useCallback(() => {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext()
    if (!engineRef.current) engineRef.current = new ExercisePlaybackEngine(audioContextRef.current)
    const audioContext = audioContextRef.current
    const engine = engineRef.current
    void audioContext.resume()
    stopLoops()

    pendingRef.current = resolveEventScheduleMs(exercise).map(({ event, timeMs }) => ({
      eventId: event.id,
      instrument: event.instrument,
      expectedTimeMs: timeMs,
    }))
    hitResultsRef.current = []
    extraHitsRef.current = []
    totalExpectedEventsRef.current = pendingRef.current.length

    barDurationMsRef.current = calculateBarDurationMs(exercise.bpm, exercise.timeSignature)
    countInDurationMsRef.current = COUNT_IN_BARS * barDurationMsRef.current
    clockOffsetMsRef.current = performance.now() - audioContext.currentTime * 1000

    engine.start(exercise, { countInBars: COUNT_IN_BARS })

    setScoring(EMPTY_SCORING)
    setGradeCounts(EMPTY_GRADE_COUNTS)
    setLastGrade(undefined)
    setActiveHit(undefined)
    setCurrentBar(1)
    setPhaseBoth('count-in')

    rafIdRef.current = requestAnimationFrame(tick)
    startBarInterval()
  }, [exercise, setPhaseBoth, startBarInterval, stopLoops, tick])

  const pause = useCallback(() => {
    if (phaseRef.current !== 'running' && phaseRef.current !== 'count-in') return
    prePausePhaseRef.current = phaseRef.current
    engineRef.current?.pause()
    stopLoops()
    setPhaseBoth('paused')
  }, [setPhaseBoth, stopLoops])

  const resume = useCallback(() => {
    if (phaseRef.current !== 'paused') return
    engineRef.current?.resumeFromPause()
    setPhaseBoth(prePausePhaseRef.current)
    rafIdRef.current = requestAnimationFrame(tick)
    startBarInterval()
  }, [setPhaseBoth, startBarInterval, tick])

  const restart = useCallback(() => {
    start()
  }, [start])

  const exit = useCallback(() => {
    engineRef.current?.stop()
    stopLoops()
    setPhaseBoth('idle')
  }, [setPhaseBoth, stopLoops])

  return { phase, scoring, gradeCounts, lastGrade, activeHit, currentBar, start, pause, resume, restart, exit }
}
