import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  practiceSessionRepository,
  exerciseRepository,
  practiceEntryRepository,
  achievementRepository,
  settingsRepository,
} from '../../data/repositories'
import {
  getLatestCleanBpm,
  suggestBpmChange,
  sumDurationSeconds,
  detectAchievements,
  type BpmSuggestion,
} from '../../domain/calculations'
import { calculateTapTempoBpm } from '../../lib/metronome-math'
import { nowIso } from '../../domain'
import type {
  Achievement,
  Exercise,
  PracticeEntry,
  PracticeResult,
  PracticeSession,
  Subdivision,
  UserSettings,
} from '../../domain'
import { EXERCISE_CATEGORY_LABELS, SUBDIVISION_LABELS } from '../exercises/exercise-labels'
import { useMetronome } from './useMetronome'
import { useInactivityPause } from '../../hooks/useInactivityPause'
import { Button, Card, PageHeader, buttonClassName } from '../../components/ui'

type Phase = 'loading' | 'no-session' | 'active' | 'summary'

const CHECKPOINT_INTERVAL_MS = 10_000
const BEATS_PER_BAR = [0, 1, 2, 3]

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function PracticeSessionPage() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [session, setSession] = useState<PracticeSession | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [allEntries, setAllEntries] = useState<PracticeEntry[]>([])
  const [sessionEntries, setSessionEntries] = useState<PracticeEntry[]>([])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentBpm, setCurrentBpm] = useState(0)
  const [cleanStreak, setCleanStreak] = useState(0)
  const [needsWorkStreak, setNeedsWorkStreak] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [running, setRunning] = useState(true)
  const [notes, setNotes] = useState('')
  const [suggestion, setSuggestion] = useState<BpmSuggestion | null>(null)
  const [newAchievements, setNewAchievements] = useState<Omit<Achievement, 'id'>[]>([])

  const [subdivision, setSubdivision] = useState<Subdivision>('quarter')
  const [accentFirstBeat, setAccentFirstBeat] = useState(true)
  const [countInBars, setCountInBars] = useState(1)
  const [tapTimestamps, setTapTimestamps] = useState<number[]>([])

  const exerciseStartRef = useRef<string>(nowIso())
  const metronome = useMetronome()

  // Refs mirroring state read from the unmount/checkpoint effects below, so
  // those effects don't need to resubscribe every time elapsedSeconds ticks.
  const elapsedSecondsRef = useRef(0)
  const sessionEntriesRef = useRef<PracticeEntry[]>([])
  const sessionRef = useRef<PracticeSession | null>(null)
  const phaseRef = useRef<Phase>('loading')
  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds
  }, [elapsedSeconds])
  useEffect(() => {
    sessionEntriesRef.current = sessionEntries
  }, [sessionEntries])
  useEffect(() => {
    sessionRef.current = session
  }, [session])
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [sessions, allExercises, userSettings, entries] = await Promise.all([
        practiceSessionRepository.getAll(),
        exerciseRepository.getAll(),
        settingsRepository.getSettings(),
        practiceEntryRepository.getAll(),
      ])
      if (cancelled) return

      const draft = sessions
        .filter((candidate) => candidate.status === 'draft')
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]

      if (!draft || draft.plannedExerciseIds.length === 0) {
        setPhase('no-session')
        return
      }

      const plannedExercises = draft.plannedExerciseIds
        .map((id) => allExercises.find((exercise) => exercise.id === id))
        .filter((exercise): exercise is Exercise => exercise !== undefined)

      const startIndex = Math.min(draft.currentExerciseIndex, plannedExercises.length - 1)
      const activeExercise = plannedExercises[startIndex]

      setSession(draft)
      setExercises(plannedExercises)
      setSettings(userSettings)
      setAllEntries(entries)
      setCurrentIndex(startIndex)
      setCurrentBpm(
        activeExercise
          ? (getLatestCleanBpm(entries, activeExercise.id) ?? activeExercise.startBpm)
          : 0,
      )
      setSubdivision(activeExercise?.subdivision ?? userSettings.metronomeDefaults.subdivision)
      setAccentFirstBeat(userSettings.metronomeDefaults.accentFirstBeat)
      setCountInBars(userSettings.metronomeDefaults.countInBars)
      exerciseStartRef.current = nowIso()
      setPhase('active')
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!running || phase !== 'active') return
    const intervalId = setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000)
    return () => clearInterval(intervalId)
  }, [running, phase])

  // Best-effort resilience save — if the session was removed elsewhere
  // (or, in tests, torn down concurrently), there's nothing to checkpoint.
  async function checkpointSession(sessionId: string) {
    try {
      await practiceSessionRepository.patch(sessionId, {
        actualDurationSeconds:
          sumDurationSeconds(sessionEntriesRef.current) + elapsedSecondsRef.current,
      })
    } catch {
      // ignored — see comment above
    }
  }

  // §17: checkpoint the running total every 10s so a crash mid-exercise
  // loses at most ~10s of progress.
  useEffect(() => {
    if (!session || phase !== 'active') return
    const intervalId = setInterval(() => {
      void checkpointSession(session.id)
    }, CHECKPOINT_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [session, phase])

  // Same checkpoint, fired once on actual unmount / navigating away.
  useEffect(() => {
    return () => {
      const currentSession = sessionRef.current
      if (currentSession && phaseRef.current === 'active') {
        void checkpointSession(currentSession.id)
      }
    }
  }, [])

  useInactivityPause(
    settings?.inactivityTimeoutSeconds ?? 120,
    () => setRunning(false),
    running && phase === 'active',
  )

  const currentExercise = exercises[currentIndex]
  const bpmStep = settings?.practiceRules.bpmStep ?? 5

  function adjustBpm(delta: number) {
    if (!currentExercise) return
    setCurrentBpm((bpm) => {
      const next = Math.min(currentExercise.maxBpm, Math.max(currentExercise.minBpm, bpm + delta))
      if (metronome.isPlaying) metronome.updateBpm(next)
      return next
    })
  }

  function handleTap() {
    const now = Date.now()
    const nextTaps = [...tapTimestamps, now].slice(-5)
    setTapTimestamps(nextTaps)
    const tappedBpm = calculateTapTempoBpm(nextTaps)
    if (tappedBpm !== undefined && currentExercise) {
      const clamped = Math.min(
        currentExercise.maxBpm,
        Math.max(currentExercise.minBpm, tappedBpm),
      )
      setCurrentBpm(clamped)
      if (metronome.isPlaying) metronome.updateBpm(clamped)
    }
  }

  function handleSubdivisionChange(next: Subdivision) {
    setSubdivision(next)
    if (metronome.isPlaying) metronome.updateSubdivision(next)
  }

  function handleAccentChange(next: boolean) {
    setAccentFirstBeat(next)
    if (metronome.isPlaying) metronome.updateAccentFirstBeat(next)
  }

  function handleToggleMetronome() {
    if (metronome.isPlaying) {
      metronome.stop()
    } else {
      metronome.start({ bpm: currentBpm, subdivision, accentFirstBeat, countInBars })
    }
  }

  async function finishSession(finalEntries: PracticeEntry[]) {
    if (!session) return
    metronome.stop()
    const completed = await practiceSessionRepository.patch(session.id, {
      status: 'completed',
      endedAt: nowIso(),
      actualDurationSeconds: sumDurationSeconds(finalEntries),
    })
    setSession(completed)

    const [allSessions, existingAchievements] = await Promise.all([
      practiceSessionRepository.getAll(),
      achievementRepository.getAll(),
    ])
    const historicalEntries = allEntries.filter((entry) => entry.sessionId !== completed.id)
    const detected = detectAchievements({
      session: completed,
      sessionEntries: finalEntries,
      allSessions,
      historicalEntries,
      exercises,
      existingAchievements,
    })
    await Promise.all(detected.map((achievement) => achievementRepository.create(achievement)))
    setNewAchievements(detected)

    setPhase('summary')
  }

  async function goToNextExercise(finalEntries: PracticeEntry[]) {
    if (!session) return
    metronome.stop()
    const isLast = currentIndex >= exercises.length - 1
    if (isLast) {
      await finishSession(finalEntries)
      return
    }

    const nextIndex = currentIndex + 1
    await practiceSessionRepository.patch(session.id, { currentExerciseIndex: nextIndex })
    const nextExercise = exercises[nextIndex]

    setCurrentIndex(nextIndex)
    setElapsedSeconds(0)
    setCleanStreak(0)
    setNeedsWorkStreak(0)
    setSuggestion(null)
    setNotes('')
    setRunning(true)
    setTapTimestamps([])
    exerciseStartRef.current = nowIso()
    setCurrentBpm(
      nextExercise ? (getLatestCleanBpm(allEntries, nextExercise.id) ?? nextExercise.startBpm) : 0,
    )
    setSubdivision(nextExercise?.subdivision ?? subdivision)
  }

  async function recordResult(result: PracticeResult) {
    if (!session || !currentExercise) return

    const entry = await practiceEntryRepository.create({
      sessionId: session.id,
      exerciseId: currentExercise.id,
      startedAt: exerciseStartRef.current,
      durationSeconds: elapsedSeconds,
      bpm: result === 'skipped' ? undefined : currentBpm,
      cleanRepetitions: result === 'clean' ? 1 : 0,
      result,
      subdivision,
      notes: notes || undefined,
    })
    const nextSessionEntries = [...sessionEntries, entry]
    setSessionEntries(nextSessionEntries)
    setAllEntries((prev) => [...prev, entry])

    if (result === 'skipped') {
      void goToNextExercise(nextSessionEntries)
      return
    }

    const nextCleanStreak = result === 'clean' ? cleanStreak + 1 : 0
    const nextNeedsWorkStreak = result === 'needs_work' ? needsWorkStreak + 1 : 0
    setCleanStreak(nextCleanStreak)
    setNeedsWorkStreak(nextNeedsWorkStreak)

    const nextSuggestion = suggestBpmChange({
      currentBpm,
      cleanStreak: nextCleanStreak,
      needsWorkStreak: nextNeedsWorkStreak,
      minBpm: currentExercise.minBpm,
      maxBpm: currentExercise.maxBpm,
      bpmStep,
    })
    if (nextSuggestion.direction !== 'none') {
      setSuggestion(nextSuggestion)
    }
  }

  function applySuggestion() {
    if (!suggestion) return
    setCurrentBpm(suggestion.suggestedBpm)
    if (metronome.isPlaying) metronome.updateBpm(suggestion.suggestedBpm)
    setCleanStreak(0)
    setNeedsWorkStreak(0)
    setSuggestion(null)
  }

  function dismissSuggestion() {
    setCleanStreak(0)
    setNeedsWorkStreak(0)
    setSuggestion(null)
  }

  if (phase === 'loading') {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  if (phase === 'no-session') {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-[var(--color-text-muted)]">אין תוכנית אימון פעילה.</p>
        <Link to="/today" className={buttonClassName('primary', 'lg')}>
          לתכנון האימון של היום
        </Link>
      </div>
    )
  }

  if (phase === 'summary') {
    const cleanCount = sessionEntries.filter((entry) => entry.result === 'clean').length
    const needsWorkCount = sessionEntries.filter((entry) => entry.result === 'needs_work').length
    const skippedCount = sessionEntries.filter((entry) => entry.result === 'skipped').length

    return (
      <div className="flex max-w-md flex-col gap-4">
        <h2 className="text-2xl font-semibold">האימון הושלם!</h2>
        <Card className="flex flex-col gap-1 tabular-nums">
          <p>
            זמן כולל: <strong>{formatDuration(sumDurationSeconds(sessionEntries))}</strong>
          </p>
          <p>נקי: {cleanCount}</p>
          <p>דורש עבודה: {needsWorkCount}</p>
          <p>דילוגים: {skippedCount}</p>
        </Card>

        {newAchievements.length > 0 && (
          <Card border="primary">
            <h3 className="mb-2 font-semibold">הישגים חדשים 🎉</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {newAchievements.map((achievement) => (
                <li key={achievement.title}>{achievement.title}</li>
              ))}
            </ul>
          </Card>
        )}

        <Link to="/" className={buttonClassName('primary', 'lg', 'self-start')}>
          לדשבורד
        </Link>
      </div>
    )
  }

  if (!currentExercise) {
    return <p className="text-[var(--color-text-muted)]">אין תרגילים בתוכנית.</p>
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <PageHeader
        title={currentExercise.name}
        subtitle={`תרגיל ${currentIndex + 1} מתוך ${exercises.length} · זמן כולל בתרגיל: ${formatDuration(elapsedSeconds)}`}
      />
      <p className="text-[var(--color-text-muted)]">
        {EXERCISE_CATEGORY_LABELS[currentExercise.category]}
      </p>
      {currentExercise.instructions && <p>{currentExercise.instructions}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => adjustBpm(-bpmStep)}
          aria-label="הפחת BPM"
          className="min-h-11 min-w-11 rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2 text-lg"
        >
          −
        </button>
        <span className="text-4xl font-bold tabular-nums">{currentBpm}</span>
        <button
          type="button"
          onClick={() => adjustBpm(bpmStep)}
          aria-label="הגבר BPM"
          className="min-h-11 min-w-11 rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2 text-lg"
        >
          +
        </button>
        <span className="text-sm tabular-nums text-[var(--color-text-muted)]">
          יעד {currentExercise.targetBpm}
        </span>
        <Button variant="ghost" size="lg" onClick={handleTap} aria-label="הקשה לקצב">
          הקשה לקצב
        </Button>
      </div>

      <Card padding="sm" className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          onClick={handleToggleMetronome}
          aria-label={metronome.isPlaying ? 'עצור מטרונום' : 'הפעל מטרונום'}
        >
          {metronome.isPlaying ? 'עצור מטרונום' : 'הפעל מטרונום'}
        </Button>

        <div className="flex items-center gap-1" aria-hidden="true">
          {BEATS_PER_BAR.map((beat) => (
            <span
              key={beat}
              className={`h-3 w-3 rounded-full border border-[var(--color-border)] ${
                metronome.isPlaying && metronome.beatIndex === beat
                  ? metronome.isCountIn
                    ? 'bg-[var(--color-warning)]'
                    : 'bg-[var(--color-primary)]'
                  : ''
              }`}
            />
          ))}
        </div>

        <label className="flex items-center gap-1 text-sm">
          חלוקה
          <select
            value={subdivision}
            onChange={(event) => handleSubdivisionChange(event.target.value as Subdivision)}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1"
          >
            {Object.entries(SUBDIVISION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={accentFirstBeat}
            onChange={(event) => handleAccentChange(event.target.checked)}
          />
          הדגשת פעימה ראשונה
        </label>

        <label className="flex items-center gap-1 text-sm">
          Count-in
          <select
            value={countInBars}
            onChange={(event) => setCountInBars(Number(event.target.value))}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1"
          >
            <option value={0}>ללא</option>
            <option value={1}>תיבה אחת</option>
            <option value={2}>שתי תיבות</option>
          </select>
        </label>
      </Card>

      <Button
        variant="ghost"
        size="lg"
        className="self-start"
        onClick={() => setRunning((value) => !value)}
        aria-label={running ? 'השהה טיימר' : 'המשך טיימר'}
      >
        {running ? 'השהה טיימר' : 'המשך טיימר'}
      </Button>

      {suggestion && (
        <Card padding="sm" border="primary" className="text-sm">
          <p>
            {suggestion.direction === 'up'
              ? `שלוש חזרות נקיות ברצף — להעלות ל-${suggestion.suggestedBpm} BPM?`
              : `שתי חזרות שדרשו עבודה — להוריד ל-${suggestion.suggestedBpm} BPM?`}
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={applySuggestion}>
              אישור
            </Button>
            <Button size="sm" variant="ghost" onClick={dismissSuggestion}>
              התעלם
            </Button>
          </div>
        </Card>
      )}

      <label className="flex flex-col gap-1 text-sm">
        הערה
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button variant="success" size="lg" onClick={() => void recordResult('clean')}>
          בוצע נקי
        </Button>
        <Button variant="warning" size="lg" onClick={() => void recordResult('needs_work')}>
          דורש עבודה
        </Button>
        <Button variant="ghost" size="lg" onClick={() => void recordResult('skipped')}>
          דילוג
        </Button>
        <Button variant="secondary" size="lg" onClick={() => void goToNextExercise(sessionEntries)}>
          {currentIndex >= exercises.length - 1 ? 'סיום אימון' : 'לתרגיל הבא'}
        </Button>
      </div>
    </div>
  )
}
