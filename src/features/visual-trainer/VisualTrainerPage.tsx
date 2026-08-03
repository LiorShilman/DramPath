import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Button, PageHeader } from '../../components/ui'
import { DrumKit } from '../../components/visual-trainer/DrumKit'
import { NoteHighway } from '../../components/visual-trainer/NoteHighway'
import type { NoteHighwayHandle } from '../../components/visual-trainer/NoteHighway'
import { TransportControls } from '../../components/visual-trainer/TransportControls'
import { HitFeedback } from '../../components/visual-trainer/HitFeedback'
import { KeyboardGuide } from '../../components/visual-trainer/KeyboardGuide'
import { SessionResults } from '../../components/visual-trainer/SessionResults'
import { useVisualTrainer } from '../../hooks/useVisualTrainer'
import { findDemoExercise } from './demo-exercises'
import { interactiveExerciseRepository } from '../../data/repositories'
import type { InteractiveExercise } from '../../domain'

interface VisualTrainerRunnerProps {
  exercise: InteractiveExercise
  highwayRef: RefObject<NoteHighwayHandle | null>
}

// DrumKit's own artwork is intentionally laid out to draw a little past its
// box on both sides (hihat pokes out the left, crash/ride the right — see
// this file's other DrumKit wrapper below, and DrumKit.tsx's PIECE_LAYOUT).
// Every other placement of DrumKit in the app absorbs that with margin
// (w-[90]/[80]% centered, or explicit end-padding) — AspectFitBox needs the
// same accommodation, or its own overflow-hidden (needed so an
// imprecise/mid-resize fit can't push the row wider) clips the cymbals for
// real, confirmed via screenshot.
const FIT_BOX_SAFETY_MARGIN = 0.85

/** Fits `children` into the largest box of the given aspect ratio that
 * fits inside this component's own area, on both axes at once — CSS
 * `aspect-ratio` alone doesn't reliably do this for a nested block/flex
 * item: confirmed via direct measurement that a div with `height: 100%` +
 * `aspect-ratio` still resolves its width via normal block fill-available
 * first (matching its container's width, not one derived from the height),
 * so a tall-but-narrow container just clipped instead of shrinking to fit.
 * Used by the demo layout's kit column, which needs the kit to genuinely
 * fill a tall column without overflowing its (narrower) width. */
function AspectFitBox({ ratio, children }: { ratio: number; children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | undefined>(undefined)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width: containerWidth, height: containerHeight } = entry.contentRect
      const width = Math.min(containerWidth, containerHeight * ratio) * FIT_BOX_SAFETY_MARGIN
      setSize({ width, height: width / ratio })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [ratio])

  return (
    <div ref={containerRef} className="flex h-full w-full items-center justify-center overflow-hidden">
      <div style={size}>{children}</div>
    </div>
  )
}

// Split from VisualTrainerPage so useVisualTrainer (which needs a real
// InteractiveExercise, not an optional one) is only ever called once we
// know the exercise actually exists — same "look up, then delegate to an
// inner component" pattern used for a possibly-missing entity elsewhere in
// this codebase (e.g. LessonDetailPage's not-found handling).
function VisualTrainerRunner({ exercise, highwayRef }: VisualTrainerRunnerProps) {
  const navigate = useNavigate()
  const trainer = useVisualTrainer(exercise, highwayRef)
  const usedInstruments = useMemo(
    () => new Set(exercise.events.map((event) => event.instrument)),
    [exercise.events],
  )

  function handleExit() {
    trainer.exit()
    void navigate('/practice/visual')
  }

  const transportControls = (
    <TransportControls
      exercise={exercise}
      phase={trainer.phase}
      isDemo={trainer.isDemo}
      currentBar={trainer.currentBar}
      currentBeat={trainer.currentBeat}
      onStart={trainer.start}
      onPause={trainer.pause}
      onResume={trainer.resume}
      onRestart={trainer.restart}
      onExit={handleExit}
    />
  )
  const keyboardGuide = (
    <KeyboardGuide variant="inline" relevantInstruments={usedInstruments} pressedInstruments={trainer.activeHits} />
  )

  // Demo mode splits the whole content area horizontally — a full-height
  // left third just for the kit, right two-thirds for everything else
  // (transport/feedback/highway/legend stacked) — instead of the regular
  // layout's kit-and-legend-sharing-a-row-under-a-full-width-highway.
  // Explicit user request/iteration: a self-playing kit is the whole point
  // of watching a demo, so it gets real dedicated space rather than a small
  // strip at the bottom.
  const body = trainer.isDemo ? (
    <div className="flex flex-1 flex-col gap-4 lg:flex-row-reverse lg:items-stretch">
      {/* AspectFitBox (not a width percentage like FreeNotationPracticePage's
          kit column): that page's kit column had no particular height to
          fill, but here the right two-thirds column is tall
          (transport/feedback/highway/legend stacked), and a width-driven
          kit left real empty space below it. Plain CSS aspect-ratio can't
          reliably derive width-from-height here (see AspectFitBox's own
          comment), so this measures the column and sizes the kit in JS. */}
      <div className="h-full w-full lg:w-[45%]">
        <AspectFitBox ratio={4 / 3}>
          <DrumKit activeHits={trainer.activeHits} />
        </AspectFitBox>
      </div>
      <div className="flex w-full flex-col gap-1.5 lg:w-[55%]">
        {transportControls}
        <HitFeedback lastGrade={trainer.lastGrade} scoring={trainer.scoring} />
        <NoteHighway ref={highwayRef} events={exercise.events} exercise={exercise} />
        {keyboardGuide}
      </div>
    </div>
  ) : (
    <>
      {transportControls}
      <HitFeedback lastGrade={trainer.lastGrade} scoring={trainer.scoring} />
      <NoteHighway ref={highwayRef} events={exercise.events} exercise={exercise} />
      {/* flex-1 on the outer wrapper: the page fits in one screen with real
          leftover space below the highway, so growing this section to fill
          the remaining height (and centering vertically within it) pulls
          the row down into that space instead of leaving it stranded near
          the top. */}
      <div className="flex flex-1 items-center">
        <div className="flex w-full flex-col items-center gap-4 lg:flex-row-reverse lg:justify-between">
          {/* pe-6 (not pe-3): the kit's own artwork intentionally draws
              slightly past its box on both sides (hihat pokes out the left,
              crash/ride the right — an established DrumKit quirk, see
              FreeNotationPracticePage's 80%-width kit column for the same
              accommodation). pe-3 was just enough for the hihat's resting
              overflow, but caused a real (if brief) page-level horizontal
              scrollbar every time hi-hat was actually played — confirmed via
              frame-by-frame measurement — back when cymbal-hit's animation
              still scaled/rotated the piece past its resting position.
              cymbal-hit is glow-only now (no transform, so cymbal stands'
              floor legs don't visibly move on hit), but pe-6 is kept as
              headroom rather than re-verifying the tighter pe-3 is safe
              again. */}
          <div className="w-full max-w-2xl shrink-0 pe-6 lg:w-[36rem]">
            <DrumKit activeHits={trainer.activeHits} />
          </div>
          <div className="flex flex-col gap-3">
            {keyboardGuide}
            {/* Only while idle — once a run (demo or real) is active, body
                itself switches to the demo layout above, which has no
                button of its own (exit/restart from TransportControls
                cover leaving a demo early). */}
            {trainer.phase === 'idle' && (
              <Button variant="secondary" onClick={trainer.startDemo}>
                מוד אוטומטי — הדגמה
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex h-full min-h-[calc(100svh-8rem)] flex-col gap-1.5">
      <PageHeader title={exercise.title} backTo="/practice/visual" backLabel="← חזרה לרשימת התרגילים" />

      {body}

      {trainer.phase === 'finished' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`סיום תרגול — ${exercise.title}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-lg">
            <SessionResults
              exerciseTitle={exercise.title}
              scoring={trainer.scoring}
              gradeCounts={trainer.gradeCounts}
              onRestart={trainer.restart}
              onExit={handleExit}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function VisualTrainerPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  // Demo exercises resolve instantly (in-memory, pure) — a plain derived
  // value, no effect needed. Only exercises this misses fall through to the
  // (async) repository lookup below, so the built-in catalog keeps its
  // current zero-latency load.
  const demoExercise = useMemo(() => (exerciseId ? findDemoExercise(exerciseId) : undefined), [exerciseId])
  // undefined = "not resolved yet", 'not-found' = "resolved, doesn't exist"
  // — a real 3-state result instead of a separate loading boolean, so the
  // only setState call in the effect below is inside the async callback
  // (no synchronous setState in the effect body itself).
  const [persistedResult, setPersistedResult] = useState<InteractiveExercise | 'not-found' | undefined>(undefined)
  const highwayRef = useRef<NoteHighwayHandle>(null)

  useEffect(() => {
    if (!exerciseId || demoExercise) return

    let cancelled = false
    void interactiveExerciseRepository.getById(exerciseId).then((found) => {
      if (!cancelled) setPersistedResult(found ?? 'not-found')
    })
    return () => {
      cancelled = true
    }
  }, [exerciseId, demoExercise])

  const exercise = demoExercise ?? (persistedResult === 'not-found' ? undefined : persistedResult)
  const isLoading = Boolean(exerciseId) && !demoExercise && persistedResult === undefined

  if (isLoading) {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  if (!exercise) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="תרגיל לא נמצא" backTo="/practice/visual" backLabel="← חזרה לרשימת התרגילים" />
        <p className="text-[var(--color-text-muted)]">התרגיל המבוקש לא קיים.</p>
      </div>
    )
  }

  return <VisualTrainerRunner exercise={exercise} highwayRef={highwayRef} />
}
