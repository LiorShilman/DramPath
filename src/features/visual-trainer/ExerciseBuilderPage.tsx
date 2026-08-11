import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { PageHeader, Button, Card } from '../../components/ui'
import { ExerciseNotationSheet } from '../../components/visual-trainer/ExerciseNotationSheet'
import { interactiveExerciseRepository } from '../../data/repositories'
import { playDrumSound } from '../../lib/visual-trainer/drum-synth'
import { ensureDrumSamplesLoading } from '../../lib/visual-trainer/drum-samples'
import { ExercisePlaybackEngine } from '../../lib/visual-trainer/exercise-playback-engine'
import { LANE_ORDER } from '../../lib/visual-trainer/drum-kit-layout'
import { INSTRUMENT_LABELS } from '../../lib/visual-trainer/instrument-labels'
import { SUBDIVISIONS_PER_BEAT, calculateBarDurationMs, calculateEventTimeMs } from '../../domain/calculations/event-timing'
import { STAFF_POSITION } from '../../lib/visual-trainer/staff-notation-layout'
import { DIFFICULTY_LABELS } from './exercise-difficulty-labels'
import { createId, nowIso } from '../../domain'
import type { DisplayMode, DrumInstrument, DrumNoteEvent, InteractiveExerciseDifficulty, InteractiveExercise, Subdivision } from '../../domain'

const PLAYBACK_POLL_INTERVAL_MS = 30

const BEATS_PER_BAR = 4
const NOTE_VELOCITY = 100
const DEFAULT_BPM = 90

// A real imported song can be 100+ bars — at sixteenth-note resolution
// that's thousands of grid columns, each with a row of cells per
// instrument. Rendering all of them (tens of thousands of interactive
// buttons) is what made the grid unusable on the long imported exercise —
// only columns actually near the viewport are rendered as real DOM nodes;
// everything else is just empty CSS Grid track space, which is nearly free.
const COLUMN_WIDTH_PX = 34
const VIRTUALIZATION_BUFFER_COLUMNS = 15

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

// Reverse of the period->break-list generation below (rowBreakBars useMemo)
// — only recognizes a list that's actually periodic (bar 1 + one constant
// step all the way to the end); anything else (irregular breaks from some
// other origin) just comes back as 0 (unset) rather than guessing a period
// that wouldn't round-trip correctly.
function periodFromRowBreakBars(rowBreakBars: number[] | undefined, bars: number): number {
  if (!rowBreakBars || rowBreakBars.length === 0) return 0
  const sorted = [...rowBreakBars].sort((a, b) => a - b)
  const period = sorted[0]! - 1
  if (period <= 0) return 0
  const expected: number[] = []
  for (let bar = 1 + period; bar <= bars; bar += period) expected.push(bar)
  const matches = expected.length === sorted.length && expected.every((bar, index) => bar === sorted[index])
  return matches ? period : 0
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
  const [beamCymbals, setBeamCymbals] = useState(false)
  // How the real practice runner (VisualTrainerPage) shows this exercise —
  // falling rectangles (the original mode) or real notation with a moving
  // playhead cursor (explicit user request: "feels much more comfortable,"
  // tried elsewhere first). Doesn't affect this page's own preview, which
  // already always renders notation regardless of this setting. Defaults to
  // staff_cursor (explicit user request) — a new exercise starts with
  // notation selected rather than requiring an extra click every time.
  const [displayMode, setDisplayMode] = useState<DisplayMode>('staff_cursor')
  // 0 = unset ("use the notation sheet's own default"). A period, not a
  // list of specific bars — "3" means a new row every 3rd bar, not "break
  // once before bar 3" (an earlier free-text version of this field asked
  // for explicit bar numbers, which didn't match what the user actually
  // expected when they typed a single number here).
  const [notationBarsPerRow, setNotationBarsPerRow] = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)
  // undefined = "not resolved yet", 'not-found' = "resolved, doesn't exist"
  // — only meaningful while isEditing; the create flow never touches this.
  const [loadedExercise, setLoadedExercise] = useState<InteractiveExercise | 'not-found' | undefined>(undefined)
  // The position marker (which grid column is "current") — always a valid
  // index, independent of whether audio is actually playing. Clicking the
  // ruler only ever moves this; it does not by itself start sound.
  const [cursorStepIndex, setCursorStepIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playSessionId, setPlaySessionId] = useState(0)
  // ms offset the current playback session was seeked to start at — state
  // (not just the ref below) because ExerciseNotationSheet's fill-animation
  // delay needs it during render, and reading a ref's .current there isn't
  // safe (react-hooks/refs).
  const [seekOffsetMs, setSeekOffsetMs] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const outputNodeRef = useRef<GainNode | null>(null)
  const playbackEngineRef = useRef<ExercisePlaybackEngine | null>(null)
  const playPollIdRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Mirrors seekOffsetMs, but as a ref — the tick loop below runs inside a
  // setInterval callback (not render), where reading state directly would
  // otherwise close over a stale value from whichever render scheduled it.
  const seekOffsetMsRef = useRef(0)
  // The grid's own horizontally-scrollable container — used both to keep
  // the playing column in view (only ever adjusts scrollLeft directly,
  // never scrollIntoView's block axis, so it can't cause the page itself
  // to jump vertically) and to drive column virtualization below.
  const gridScrollRef = useRef<HTMLDivElement | null>(null)
  // Which step columns are actually mounted as DOM nodes — updated from
  // the container's real scroll position/width, so it starts covering
  // "everything" (Infinity) until that first measurement lands, rather
  // than flashing an empty grid for one frame.
  const [visibleStepRange, setVisibleStepRange] = useState({ start: 0, end: Number.POSITIVE_INFINITY })

  // Created here (on mount) rather than lazily on the first click/preview —
  // decoding a sample doesn't need a 'running' context (only actual audible
  // playback does, which is why every other use of this ref still calls
  // .resume() itself on first real interaction). Creating it this early
  // gives ensureDrumSamplesLoading a real head start before the user's
  // first click, instead of racing it: previously, the very first preview
  // of a real-sample instrument (e.g. crash) always lost that race and
  // played the synthesized fallback instead of the actual sample — since
  // both the fetch and the play call fired in the same synchronous click
  // handler, the fetch could never finish in time. Reported directly: "the
  // first hit sounds like a different file, only the second one plays the
  // real crash."
  useEffect(() => {
    const audioContext = new AudioContext()
    audioContextRef.current = audioContext
    outputNodeRef.current = audioContext.createGain()
    outputNodeRef.current.connect(audioContext.destination)
    ensureDrumSamplesLoading(audioContext)
  }, [])

  useEffect(() => {
    if (!exerciseId) return
    let cancelled = false
    void interactiveExerciseRepository.getById(exerciseId).then((found) => {
      if (cancelled) return
      if (found) {
        setSetup(setupFromExercise(found))
        setActiveCells(new Set(found.events.map((event) => cellKey(event, event.instrument))))
        setBeamCymbals(found.beamCymbals ?? false)
        setDisplayMode(found.displayMode)
        // Only round-trips a *periodic* saved list (bar 1 + a constant
        // step) back into a single number — an exercise with irregular
        // breaks (not produced by this field) just shows unset here rather
        // than guessing which period it might have meant.
        setNotationBarsPerRow(periodFromRowBreakBars(found.rowBreakBars, found.bars))
        setGridStarted(true)
      }
      setLoadedExercise(found ?? 'not-found')
    })
    return () => {
      cancelled = true
    }
  }, [exerciseId])

  // Memoized, not recomputed inline: on a long (100+ bar) exercise this
  // array has thousands of entries, and cursorStepIndex updates every
  // ~30ms during playback — without memoization every one of those ticks
  // was rebuilding the entire array from scratch for no reason (bars and
  // subdivision hadn't changed), adding real per-tick cost right when
  // responsiveness matters most.
  const steps = useMemo(() => buildSteps(setup.bars, setup.subdivision), [setup.bars, setup.subdivision])

  useEffect(() => {
    const container = gridScrollRef.current
    if (!container) return

    function updateVisibleRange() {
      if (!container) return
      // jsdom (tests) always reports clientWidth 0 — no real layout engine.
      // Falling back to "everything visible" there means existing tests that
      // query for every cell keep working; real browsers always have a
      // nonzero clientWidth, so virtualization is only inert in tests.
      if (container.clientWidth === 0) {
        setVisibleStepRange({ start: 0, end: Number.POSITIVE_INFINITY })
        return
      }
      const visibleColumnCount = Math.ceil(container.clientWidth / COLUMN_WIDTH_PX)
      const start = Math.max(0, Math.floor(container.scrollLeft / COLUMN_WIDTH_PX) - VIRTUALIZATION_BUFFER_COLUMNS)
      const end = start + visibleColumnCount + VIRTUALIZATION_BUFFER_COLUMNS * 2
      setVisibleStepRange({ start, end })
    }

    updateVisibleRange()
    container.addEventListener('scroll', updateVisibleRange, { passive: true })
    window.addEventListener('resize', updateVisibleRange)
    return () => {
      container.removeEventListener('scroll', updateVisibleRange)
      window.removeEventListener('resize', updateVisibleRange)
    }
  }, [steps.length])

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

  // Generates the explicit break-bar list ExerciseNotationSheet actually
  // wants (e.g. period 3 over 8 bars -> [4, 7]) from the simpler "every N
  // bars" period the field above collects — the notation sheet's own
  // `rowBreakBars` prop stays a plain bar-number array either way, this is
  // just how this page's UI happens to produce one.
  const rowBreakBars = useMemo(() => {
    if (notationBarsPerRow <= 0) return []
    const breaks: number[] = []
    for (let bar = 1 + notationBarsPerRow; bar <= setup.bars; bar += notationBarsPerRow) breaks.push(bar)
    return breaks
  }, [notationBarsPerRow, setup.bars])

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

  // Which notation-preview events fall on the cursor's current step, so
  // ExerciseNotationSheet can highlight the same moment the grid does —
  // shown at rest too, not just while actually playing.
  const playingStepEventIds = useMemo(() => {
    const step = steps[cursorStepIndex]
    if (!step) return undefined
    const ids = new Set<string>()
    for (const event of previewEvents) {
      if (event.bar === step.bar && event.beat === step.beat && event.subdivisionIndex === step.subdivisionIndex) {
        ids.add(event.id)
      }
    }
    return ids
  }, [cursorStepIndex, steps, previewEvents])

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
    setIsPlaying(false)
    // cursorStepIndex intentionally left where it was — pressing play again
    // resumes from here rather than jumping back to bar 1.
  }

  useEffect(() => stopPlayback, [])

  // Keeps the cursor's column horizontally in view within the grid's own
  // scroll container, anchored ~20% into the viewport (not flush against
  // either edge) so most of the visible width shows what's coming up next,
  // matching how a played-position marker reads in any timeline UI.
  // Re-anchors on every single cursor change (no drift tolerance) — one
  // column's worth of scrollLeft is a cheap assignment, and correcting
  // every tick reads as continuous motion; a tolerance band instead
  // produced a visible periodic jump every few columns once the drift
  // crossed it. Computed from COLUMN_WIDTH_PX directly (not a rendered
  // cell's getBoundingClientRect) — with virtualization, the cursor's own
  // column may not be mounted as a DOM node yet on a big jump, and this
  // math doesn't need it to be. Pure scrollLeft assignment (never
  // scrollIntoView), so it only ever touches this one element's horizontal
  // axis, nothing else on the page.
  useEffect(() => {
    const container = gridScrollRef.current
    if (!container) return
    const cellLeft = cursorStepIndex * COLUMN_WIDTH_PX
    const maxScrollLeft = Math.max(0, steps.length * COLUMN_WIDTH_PX - container.clientWidth)
    const lookaheadOffset = container.clientWidth * 0.2
    const target = Math.min(maxScrollLeft, Math.max(0, cellLeft - lookaheadOffset))
    if (container.scrollLeft !== target) {
      container.scrollLeft = target
    }
  }, [cursorStepIndex, steps.length])

  // startStepIndex lets a caller seek: playback is scheduled starting at
  // that step's own timestamp instead of always from bar 1, beat 1. Defaults
  // to wherever the cursor currently sits, so pressing ▶ after a manual seek
  // (which only moved the cursor, per seekToStep below) plays from there.
  function startPlayback(startStepIndex = cursorStepIndex) {
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
    const offsetMs = stepTimesMs[startStepIndex] ?? 0
    seekOffsetMsRef.current = offsetMs
    setSeekOffsetMs(offsetMs)
    // A single playthrough, no count-in — this is a quick "how does it
    // sound" preview while building, not a graded run.
    engine.start(previewPlaybackExercise, { countInBars: 0, startOffsetMs: offsetMs })

    setCursorStepIndex(startStepIndex)
    setIsPlaying(true)
    setPlaySessionId((current) => current + 1)
    playPollIdRef.current = setInterval(() => {
      const positionMs = (audioContext.currentTime - engine.startAudioTimeSeconds) * 1000 + seekOffsetMsRef.current
      if (positionMs >= singlePlaythroughMs) {
        stopPlayback()
        return
      }
      let stepIndex = startStepIndex
      for (let i = 0; i < stepTimesMs.length; i += 1) {
        if (stepTimesMs[i]! <= positionMs) stepIndex = i
        else break
      }
      setCursorStepIndex(stepIndex)
    }, PLAYBACK_POLL_INTERVAL_MS)
  }

  // Seek: clicking the ruler only ever moves the cursor. While playback is
  // already running it also jumps the audio there (scrubbing); when
  // stopped, it just repositions the cursor for a future ▶ press — it must
  // NOT start sound on its own (confirmed with the user: clicking a ruler
  // position had been auto-starting playback unexpectedly).
  function seekToStep(stepIndex: number) {
    if (isPlaying) {
      startPlayback(stepIndex)
    } else {
      setCursorStepIndex(stepIndex)
    }
  }

  // Only these steps are actually mounted as grid cells (see
  // VIRTUALIZATION_BUFFER_COLUMNS above) — every other column is just
  // reserved, empty CSS Grid track space.
  const visibleSteps = useMemo(
    () =>
      steps
        .map((step, stepIndex) => ({ step, stepIndex }))
        .filter(({ stepIndex }) => stepIndex >= visibleStepRange.start && stepIndex < visibleStepRange.end),
    [steps, visibleStepRange],
  )

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
      // The floor here must stay below the setup form's own BPM minimum
      // (30) — clamping to a fixed 40 could exceed setup.bpm itself for a
      // slow target tempo, violating the schema's bpm >= minBpm rule.
      minBpm: Math.max(1, setup.bpm - 30),
      maxBpm: setup.bpm + 50,
      timeSignature: { numerator: 4, denominator: 4 },
      subdivision: setup.subdivision,
      bars: setup.bars,
      // A hardcoded 2 here silently doubled every expected hit (each note
      // scheduled once per loop) while the grid/notation preview and
      // NoteHighway's falling-note animation only ever show a single
      // playthrough — a real mismatch: a correct hit only counted for half
      // of what the runner expected, and NoteHighway has no support for
      // re-showing a note on a second pass, so loop 2 had no visual cue at all.
      loopCount: 1,
      displayMode,
      beamCymbals,
      rowBreakBars: rowBreakBars.length > 0 ? rowBreakBars : undefined,
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
              max={64}
              value={setup.bars}
              onChange={(event) =>
                setSetup((current) => ({ ...current, bars: Math.min(64, Math.max(1, Number(event.target.value))) }))
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

      {/* Sticky: stays reachable while scrolling through a long grid/notation
          preview instead of scrolling away with the instructions text. */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-1 py-2">
        <p className="text-sm text-[var(--color-text-muted)]">
          לחצו על תא כדי להוסיף או להסיר תו. כל שורה היא כלי, כל עמודה היא תת-חלוקה בזמן.
        </p>
        {!isPlaying ? (
          <Button size="sm" variant="secondary" onClick={() => startPlayback()} disabled={previewEvents.length === 0}>
            ▶ נגן
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={stopPlayback}>
            ⏸ השהה
          </Button>
        )}
      </div>

      {/* Two-column layout: the notation column (right, in DOM order first
          so RTL's grid places it on the visual right) stays put — it shows
          everything at once and doesn't need to chase the playhead. The
          grid column (left) is the one that scrolls horizontally to follow
          playback, per the user's own framing: notation stays fixed, the
          editing grid is the part that "moves with the playing." */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-2 lg:sticky lg:top-14">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--color-text-muted)]">תצוגת תווים</h3>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={beamCymbals} onChange={(event) => setBeamCymbals(event.target.checked)} />
              לחבר גם צלחות (X) בקורה
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            תצוגת תרגול (בעמוד התרגול עצמו, לא כאן)
            <select
              value={displayMode}
              onChange={(event) => setDisplayMode(event.target.value as DisplayMode)}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-1.5"
            >
              <option value="note_highway">מלבנים יורדים</option>
              <option value="staff_cursor">תווים עם פלייהד נע</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            תיבות שלמות בכל שורה (0 = ברירת מחדל)
            <input
              type="number"
              min={0}
              value={notationBarsPerRow}
              onChange={(event) => setNotationBarsPerRow(Math.max(0, Number(event.target.value)))}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-1.5"
            />
          </label>
          {previewEvents.length > 0 ? (
            <div dir="ltr" className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <ExerciseNotationSheet
                exercise={previewExercise}
                highlightedEventIds={playingStepEventIds}
                playbackProgress={
                  isPlaying ? { bpm: setup.bpm, sessionId: playSessionId, startOffsetMs: seekOffsetMs } : undefined
                }
                beamCymbals={beamCymbals}
                rowBreakBars={rowBreakBars}
              />
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">הוסיפו תווים ברשת כדי לראות תצוגה מקדימה.</p>
          )}
        </div>

        {/* dir="ltr": musical time reads left-to-right universally, same as
            real sheet music — regardless of the app's RTL UI language.
            CSS Grid (not <table>) is what makes virtualization possible:
            gridTemplateColumns reserves the full scrollable width for
            steps.length columns regardless of how many are actually
            rendered as DOM nodes (see visibleSteps above), so the scrollbar
            and scroll range are correct even on a 1900-column exercise
            while only ~50-100 cells per row actually exist in the DOM. */}
        <div
          ref={gridScrollRef}
          data-testid="exercise-grid-scroll"
          dir="ltr"
          className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)]"
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: `auto repeat(${steps.length}, ${COLUMN_WIDTH_PX}px)`,
              gridTemplateRows: `auto repeat(${LANE_ORDER.length}, auto)`,
            }}
          >
            <div
              className="sticky start-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-1 text-start text-xs font-normal text-[var(--color-text-muted)] whitespace-nowrap"
              style={{ gridColumn: 1, gridRow: 1 }}
            >
              דלג לזמן
            </div>
            {visibleSteps.map(({ step, stepIndex }) => {
              const isBarStart = step.beat === 1 && step.subdivisionIndex === 0
              const isBeatStart = step.subdivisionIndex === 0
              const isPlayingNow = stepIndex === cursorStepIndex
              return (
                <div
                  key={`ruler-${step.bar}-${step.beat}-${step.subdivisionIndex}`}
                  style={{ gridColumn: stepIndex + 2, gridRow: 1 }}
                  className={`border-b border-[var(--color-border)] p-0.5 ${
                    isBarStart ? 'border-s-2 border-s-[var(--color-text)]' : isBeatStart ? 'border-s border-s-[var(--color-border)]' : ''
                  } ${isPlayingNow ? 'bg-[var(--color-primary)]/20' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => seekToStep(stepIndex)}
                    aria-label={`דלג לתיבה ${step.bar} פעימה ${step.beat}.${step.subdivisionIndex + 1}`}
                    className={`h-6 w-8 rounded-[var(--radius-card)] transition-colors ${
                      isPlayingNow
                        ? 'bg-[var(--color-primary)] shadow-[0_0_0_2px_var(--color-primary)]'
                        : 'bg-[var(--color-surface)] hover:bg-[var(--color-border)]'
                    }`}
                  />
                </div>
              )
            })}
            {LANE_ORDER.map((instrument, rowIndex) => {
              const isCymbal = STAFF_POSITION[instrument].notehead === 'x'
              return (
                <Fragment key={instrument}>
                  <div
                    className="sticky start-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-1.5 text-start text-sm font-semibold whitespace-nowrap"
                    style={{ gridColumn: 1, gridRow: rowIndex + 2 }}
                  >
                    {INSTRUMENT_LABELS[instrument]}
                  </div>
                  {visibleSteps.map(({ step, stepIndex }) => {
                    const key = cellKey(step, instrument)
                    const isActive = activeCells.has(key)
                    const isBarStart = step.beat === 1 && step.subdivisionIndex === 0
                    const isBeatStart = step.subdivisionIndex === 0
                    const isPlayingNow = stepIndex === cursorStepIndex
                    return (
                      <div
                        key={key}
                        style={{ gridColumn: stepIndex + 2, gridRow: rowIndex + 2 }}
                        className={`border-b border-[var(--color-border)] p-0.5 ${
                          isBarStart ? 'border-s-2 border-s-[var(--color-text)]' : isBeatStart ? 'border-s border-s-[var(--color-border)]' : ''
                        } ${isPlayingNow ? 'bg-[var(--color-primary)]/20' : ''}`}
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
                      </div>
                    )
                  })}
                </Fragment>
              )
            })}
          </div>
        </div>
      </div>

      {saveError && <p className="text-sm text-[var(--color-danger-text)]">{saveError}</p>}

      <div className="flex gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            stopPlayback()
            setCursorStepIndex(0)
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
