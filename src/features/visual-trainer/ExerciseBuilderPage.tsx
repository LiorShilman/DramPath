import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { PageHeader, Button, Card } from '../../components/ui'
import { ExerciseNotationSheet } from '../../components/visual-trainer/ExerciseNotationSheet'
import { interactiveExerciseRepository } from '../../data/repositories'
import { playDrumSound } from '../../lib/visual-trainer/drum-synth'
import { ExercisePlaybackEngine } from '../../lib/visual-trainer/exercise-playback-engine'
import { LANE_ORDER } from '../../lib/visual-trainer/drum-kit-layout'
import { INSTRUMENT_LABELS } from '../../lib/visual-trainer/instrument-labels'
import { SUBDIVISIONS_PER_BEAT, calculateBarDurationMs, calculateEventTimeMs } from '../../domain/calculations/event-timing'
import { STAFF_POSITION } from '../../lib/visual-trainer/staff-notation-layout'
import { DIFFICULTY_LABELS } from './exercise-difficulty-labels'
import { createId, nowIso } from '../../domain'
import type { DrumInstrument, DrumNoteEvent, InteractiveExerciseDifficulty, InteractiveExercise, Subdivision } from '../../domain'

const PLAYBACK_POLL_INTERVAL_MS = 30

const BEATS_PER_BAR = 4
const NOTE_VELOCITY = 100
const DEFAULT_BPM = 90

interface Setup {
  title: string
  difficulty: InteractiveExerciseDifficulty
  bpm: number
  subdivision: Subdivision
  bars: number
}

const DEFAULT_SETUP: Setup = {
  title: '',
  difficulty: 'beginner',
  bpm: DEFAULT_BPM,
  subdivision: 'eighth',
  bars: 2,
}

// One step = one (bar, beat, subdivisionIndex) slot on the grid.
interface Step {
  bar: number
  beat: number
  subdivisionIndex: number
}

function buildSteps(bars: number, subdivision: Subdivision): Step[] {
  const perBeat = SUBDIVISIONS_PER_BEAT[subdivision]
  const steps: Step[] = []
  for (let bar = 1; bar <= bars; bar += 1) {
    for (let beat = 1; beat <= BEATS_PER_BAR; beat += 1) {
      for (let subdivisionIndex = 0; subdivisionIndex < perBeat; subdivisionIndex += 1) {
        steps.push({ bar, beat, subdivisionIndex })
      }
    }
  }
  return steps
}

function cellKey(step: Step, instrument: DrumInstrument): string {
  return `${step.bar}-${step.beat}-${step.subdivisionIndex}-${instrument}`
}

function buildEvents(steps: Step[], activeCells: Set<string>): DrumNoteEvent[] {
  const events: DrumNoteEvent[] = []
  for (const step of steps) {
    for (const instrument of LANE_ORDER) {
      if (activeCells.has(cellKey(step, instrument))) {
        events.push({
          id: createId(),
          bar: step.bar,
          beat: step.beat,
          subdivisionIndex: step.subdivisionIndex,
          instrument,
          velocity: NOTE_VELOCITY,
        })
      }
    }
  }
  return events
}

function setupFromExercise(exercise: InteractiveExercise): Setup {
  return {
    title: exercise.title,
    difficulty: exercise.difficulty,
    bpm: exercise.bpm,
    subdivision: exercise.subdivision,
    bars: exercise.bars,
  }
}

/** VISUAL_DRUM_TRAINER_SPEC.md's graded exercises need structured
 * DrumNoteEvent[] — this is the manual-placement way to create one (no
 * live-capture/recording mode, confirmed with the user). Step 1 locks the
 * grid's shape (bars/subdivision) before any notes exist, since changing
 * either afterward would invalidate placed cells. */
export function ExerciseBuilderPage() {
  const navigate = useNavigate()
  const { exerciseId } = useParams<{ exerciseId?: string }>()
  const isEditing = Boolean(exerciseId)
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP)
  const [gridStarted, setGridStarted] = useState(false)
  const [activeCells, setActiveCells] = useState<Set<string>>(new Set())
  const [saveError, setSaveError] = useState<string | null>(null)
  // undefined = "not resolved yet", 'not-found' = "resolved, doesn't exist"
  // — only meaningful while isEditing; the create flow never touches this.
  const [loadedExercise, setLoadedExercise] = useState<InteractiveExercise | 'not-found' | undefined>(undefined)
  const [playingStepIndex, setPlayingStepIndex] = useState<number | undefined>(undefined)
  const [playSessionId, setPlaySessionId] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const outputNodeRef = useRef<GainNode | null>(null)
  const playbackEngineRef = useRef<ExercisePlaybackEngine | null>(null)
  const playPollIdRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!exerciseId) return
    let cancelled = false
    void interactiveExerciseRepository.getById(exerciseId).then((found) => {
      if (cancelled) return
      if (found) {
        setSetup(setupFromExercise(found))
        setActiveCells(new Set(found.events.map((event) => cellKey(event, event.instrument))))
        setGridStarted(true)
      }
      setLoadedExercise(found ?? 'not-found')
    })
    return () => {
      cancelled = true
    }
  }, [exerciseId])

  const steps = buildSteps(setup.bars, setup.subdivision)

  // Live notation preview reusing ExerciseNotationSheet (built earlier for
  // the graded runner, then unmounted from there per the user — but it's a
  // pure display of exactly the same STAFF_POSITION mapping they specced,
  // so it's a natural fit for previewing a pattern while building it here.
  const previewEvents = useMemo(() => buildEvents(steps, activeCells), [steps, activeCells])
  const previewExercise = useMemo(
    () => ({
      events: previewEvents,
      timeSignature: { numerator: 4, denominator: 4 },
      subdivision: setup.subdivision,
      bars: setup.bars,
    }),
    [previewEvents, setup.subdivision, setup.bars],
  )

  // Each step's own ms offset from the start of a single playthrough — used
  // to figure out which grid column is "now playing" while previewing.
  const stepTimesMs = useMemo(
    () =>
      steps.map((step) =>
        calculateEventTimeMs(step, { bpm: setup.bpm, timeSignature: { numerator: 4, denominator: 4 }, subdivision: setup.subdivision }),
      ),
    [steps, setup.bpm, setup.subdivision],
  )
  const singlePlaythroughMs = useMemo(
    () => calculateBarDurationMs(setup.bpm, { numerator: 4, denominator: 4 }) * setup.bars,
    [setup.bpm, setup.bars],
  )

  // Which notation-preview events fall on the currently-playing step, so
  // ExerciseNotationSheet can highlight the same moment the grid does.
  const playingStepEventIds = useMemo(() => {
    if (playingStepIndex === undefined) return undefined
    const step = steps[playingStepIndex]
    if (!step) return undefined
    const ids = new Set<string>()
    for (const event of previewEvents) {
      if (event.bar === step.bar && event.beat === step.beat && event.subdivisionIndex === step.subdivisionIndex) {
        ids.add(event.id)
      }
    }
    return ids
  }, [playingStepIndex, steps, previewEvents])

  // ExercisePlaybackEngine.start() takes a full InteractiveExercise — the
  // fields beyond bpm/timeSignature/bars/loopCount/events/subdivision are
  // unused by playback itself, so this is a throwaway wrapper, never saved.
  const previewPlaybackExercise = useMemo<InteractiveExercise>(
    () => ({
      id: createId(),
      title: setup.title,
      difficulty: setup.difficulty,
      bpm: setup.bpm,
      minBpm: setup.bpm,
      maxBpm: setup.bpm,
      timeSignature: { numerator: 4, denominator: 4 },
      subdivision: setup.subdivision,
      bars: setup.bars,
      loopCount: 1,
      displayMode: 'note_highway',
      events: previewEvents,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }),
    [setup.title, setup.difficulty, setup.bpm, setup.subdivision, setup.bars, previewEvents],
  )

  function stopPlayback() {
    if (playPollIdRef.current !== null) {
      clearInterval(playPollIdRef.current)
      playPollIdRef.current = null
    }
    playbackEngineRef.current?.stop()
    setPlayingStepIndex(undefined)
  }

  useEffect(() => stopPlayback, [])

  function startPlayback() {
    if (previewEvents.length === 0) return
    stopPlayback()

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
      outputNodeRef.current = audioContextRef.current.createGain()
      outputNodeRef.current.connect(audioContextRef.current.destination)
    }
    const audioContext = audioContextRef.current
    void audioContext.resume()

    if (!playbackEngineRef.current) playbackEngineRef.current = new ExercisePlaybackEngine(audioContext)
    const engine = playbackEngineRef.current
    // A single playthrough, no count-in — this is a quick "how does it
    // sound" preview while building, not a graded run.
    engine.start(previewPlaybackExercise, { countInBars: 0 })

    setPlayingStepIndex(0)
    setPlaySessionId((current) => current + 1)
    playPollIdRef.current = setInterval(() => {
      const elapsedMs = (audioContext.currentTime - engine.startAudioTimeSeconds) * 1000
      if (elapsedMs >= singlePlaythroughMs) {
        stopPlayback()
        return
      }
      let stepIndex = 0
      for (let i = 0; i < stepTimesMs.length; i += 1) {
        if (stepTimesMs[i]! <= elapsedMs) stepIndex = i
        else break
      }
      setPlayingStepIndex(stepIndex)
    }, PLAYBACK_POLL_INTERVAL_MS)
  }

  function playPreview(instrument: DrumInstrument) {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
      outputNodeRef.current = audioContextRef.current.createGain()
      outputNodeRef.current.connect(audioContextRef.current.destination)
    }
    void audioContextRef.current.resume()
    playDrumSound(audioContextRef.current, outputNodeRef.current!, audioContextRef.current.currentTime, instrument, NOTE_VELOCITY)
  }

  function toggleCell(step: Step, instrument: DrumInstrument) {
    const key = cellKey(step, instrument)
    setActiveCells((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
        playPreview(instrument)
      }
      return next
    })
  }

  async function handleSave() {
    if (!setup.title.trim()) {
      setSaveError('צריך לתת שם לתרגיל.')
      return
    }
    if (activeCells.size === 0) {
      setSaveError('צריך למקם לפחות תו אחד.')
      return
    }
    setSaveError(null)

    const events = buildEvents(steps, activeCells)

    const fields = {
      title: setup.title.trim(),
      difficulty: setup.difficulty,
      bpm: setup.bpm,
      minBpm: Math.max(40, setup.bpm - 30),
      maxBpm: setup.bpm + 50,
      timeSignature: { numerator: 4, denominator: 4 },
      subdivision: setup.subdivision,
      bars: setup.bars,
      loopCount: 2,
      displayMode: 'note_highway' as const,
      events,
    }

    const saved =
      isEditing && exerciseId
        ? await interactiveExerciseRepository.patch(exerciseId, fields)
        : await interactiveExerciseRepository.create(fields)

    void navigate(`/practice/visual/${saved.id}`)
  }

  if (isEditing && loadedExercise === undefined) {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  if (isEditing && loadedExercise === 'not-found') {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="תרגיל לא נמצא" backTo="/practice/visual" backLabel="← חזרה לרשימת התרגילים" />
        <p className="text-[var(--color-text-muted)]">התרגיל המבוקש לא קיים.</p>
      </div>
    )
  }

  if (!gridStarted) {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <PageHeader title={isEditing ? 'עריכת תרגיל' : 'תרגיל חדש'} backTo="/practice/visual" backLabel="← חזרה לרשימת התרגילים" />

        <Card padding="md" className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            שם התרגיל
            <input
              value={setup.title}
              onChange={(event) => setSetup((current) => ({ ...current, title: event.target.value }))}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
              placeholder="למשל: מקצב לשיר שלי"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            רמת קושי
            <select
              value={setup.difficulty}
              onChange={(event) =>
                setSetup((current) => ({ ...current, difficulty: event.target.value as InteractiveExerciseDifficulty }))
              }
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            >
              {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            קצב יעד (BPM)
            <input
              type="number"
              min={30}
              max={300}
              value={setup.bpm}
              onChange={(event) => setSetup((current) => ({ ...current, bpm: Number(event.target.value) }))}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            חלוקה
            <select
              value={setup.subdivision}
              onChange={(event) => setSetup((current) => ({ ...current, subdivision: event.target.value as Subdivision }))}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            >
              <option value="quarter">רבעים</option>
              <option value="eighth">שמיניות</option>
              <option value="sixteenth">שש-עשריות</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            מספר תיבות
            <input
              type="number"
              min={1}
              max={8}
              value={setup.bars}
              onChange={(event) =>
                setSetup((current) => ({ ...current, bars: Math.min(8, Math.max(1, Number(event.target.value))) }))
              }
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>

          <Button onClick={() => setGridStarted(true)} disabled={!setup.title.trim()}>
            המשך לעריכת התווים
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`${isEditing ? 'עריכת תרגיל' : 'תרגיל חדש'} — ${setup.title}`}
        backTo="/practice/visual"
        backLabel="← חזרה לרשימת התרגילים"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--color-text-muted)]">
          לחצו על תא כדי להוסיף או להסיר תו. כל שורה היא כלי, כל עמודה היא תת-חלוקה בזמן.
        </p>
        {playingStepIndex === undefined ? (
          <Button size="sm" variant="secondary" onClick={startPlayback} disabled={previewEvents.length === 0}>
            ▶ נגן
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={stopPlayback}>
            ⏹ עצור
          </Button>
        )}
      </div>

      {/* dir="ltr": musical time reads left-to-right universally, same as
          real sheet music — regardless of the app's RTL UI language. */}
      <div dir="ltr" className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)]">
        <table className="border-collapse">
          <tbody>
            {LANE_ORDER.map((instrument) => {
              const isCymbal = STAFF_POSITION[instrument].notehead === 'x'
              return (
                <tr key={instrument}>
                  <th className="sticky start-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-1.5 text-start text-sm font-semibold whitespace-nowrap">
                    {INSTRUMENT_LABELS[instrument]}
                  </th>
                  {steps.map((step, stepIndex) => {
                    const key = cellKey(step, instrument)
                    const isActive = activeCells.has(key)
                    const isBarStart = step.beat === 1 && step.subdivisionIndex === 0
                    const isBeatStart = step.subdivisionIndex === 0
                    const isPlayingNow = stepIndex === playingStepIndex
                    return (
                      <td
                        key={key}
                        className={`border-b border-[var(--color-border)] p-0.5 ${
                          isBarStart ? 'border-s-2 border-s-[var(--color-text)]' : isBeatStart ? 'border-s border-s-[var(--color-border)]' : ''
                        } ${isPlayingNow ? 'bg-[var(--color-primary)]/10' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleCell(step, instrument)}
                          aria-label={`${INSTRUMENT_LABELS[instrument]} תיבה ${step.bar} פעימה ${step.beat}.${step.subdivisionIndex + 1}`}
                          aria-pressed={isActive}
                          className={`flex h-8 w-8 items-center justify-center border font-bold transition-shadow ${
                            isCymbal ? 'rounded-[var(--radius-card)]' : 'rounded-full'
                          } ${
                            isActive
                              ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                              : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]'
                          } ${isPlayingNow && isActive ? 'ring-2 ring-offset-1 ring-[var(--color-warning-text)]' : ''}`}
                        >
                          {isCymbal ? '✕' : ''}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {previewEvents.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-muted)]">תצוגת תווים</h3>
          <div dir="ltr" className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <ExerciseNotationSheet
              exercise={previewExercise}
              highlightedEventIds={playingStepEventIds}
              playbackProgress={playingStepIndex !== undefined ? { bpm: setup.bpm, sessionId: playSessionId } : undefined}
            />
          </div>
        </div>
      )}

      {saveError && <p className="text-sm text-[var(--color-danger-text)]">{saveError}</p>}

      <div className="flex gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            stopPlayback()
            setGridStarted(false)
          }}
        >
          ← חזרה להגדרות
        </Button>
        <Button
          onClick={() => {
            stopPlayback()
            void handleSave()
          }}
        >
          שמירה והתחלת תרגול
        </Button>
      </div>
    </div>
  )
}
