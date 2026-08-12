import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Badge, Button, PageHeader } from '../../components/ui'
import type { BadgeVariant } from '../../components/ui'
import type { RemoteDrumInputStatus } from '../../hooks/useRemoteDrumInput'
import type { MidiDrumInputStatus } from '../../hooks/useMidiDrumInput'
import { DrumKit } from '../../components/visual-trainer/DrumKit'
import { NoteHighway } from '../../components/visual-trainer/NoteHighway'
import type { NoteHighwayHandle } from '../../components/visual-trainer/NoteHighway'
import { ExerciseNotationSheet } from '../../components/visual-trainer/ExerciseNotationSheet'
import { TransportControls } from '../../components/visual-trainer/TransportControls'
import { HitFeedback } from '../../components/visual-trainer/HitFeedback'
import { KeyboardGuide } from '../../components/visual-trainer/KeyboardGuide'
import { SessionResults } from '../../components/visual-trainer/SessionResults'
import { useVisualTrainer } from '../../hooks/useVisualTrainer'
import { findDemoExercise } from './demo-exercises'
import { interactiveExerciseRepository } from '../../data/repositories'
import type { DisplayMode, InteractiveExercise } from '../../domain'

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

// Phone-as-remote-controller status (ADR 0007) — richer than a flat
// connected/not boolean would be, since the reason nothing's happening
// matters here: relay not running vs. no phone connected yet vs. a second
// tab took over this one are three different things to tell the user.
const REMOTE_STATUS_LABELS: Record<RemoteDrumInputStatus, string> = {
  disabled: 'כבוי',
  connecting: 'מתחבר לשירות…',
  'waiting-for-phone': 'ממתין לחיבור טלפון',
  connected: 'טלפון מחובר',
  superseded: 'הוחלף בכרטיסייה אחרת',
}
const REMOTE_STATUS_BADGE_VARIANT: Record<RemoteDrumInputStatus, BadgeVariant> = {
  disabled: 'neutral',
  connecting: 'neutral',
  'waiting-for-phone': 'warning',
  connected: 'success',
  superseded: 'danger',
}

// Real e-kit input over Web MIDI — same "richer than a flat boolean"
// reasoning as REMOTE_STATUS_LABELS: unsupported (wrong browser) and
// no-device (nothing plugged in / permission denied) are two different
// things to tell the user, not just "not connected".
const MIDI_STATUS_LABELS: Record<MidiDrumInputStatus, string> = {
  disabled: 'כבוי',
  unsupported: 'הדפדפן לא תומך ב-MIDI (צריך Chrome/Edge)',
  requesting: 'מבקש הרשאה…',
  'no-device': 'לא נמצא התקן MIDI',
  connected: 'קיט תופים מחובר',
}
const MIDI_STATUS_BADGE_VARIANT: Record<MidiDrumInputStatus, BadgeVariant> = {
  disabled: 'neutral',
  unsupported: 'danger',
  requesting: 'neutral',
  'no-device': 'warning',
  connected: 'success',
}

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
  // Runtime override of which visual to watch — explicit user request: let
  // them pick notation-vs-rectangles right on the practice screen itself
  // (for demo AND real runs), without needing to go back and resave the
  // exercise just to try the other mode. Defaults to staff_cursor
  // unconditionally (not exercise.displayMode) — explicit user request:
  // entering practice for *any* exercise, including ones saved before this
  // screen had its own picker, should still start on notation rather than
  // falling rectangles. Declared before useVisualTrainer so its current
  // value can be passed in (the hook needs to know which visual is actually
  // on screen for its own staff_cursor-only grading correction).
  const [selectedDisplayMode, setSelectedDisplayMode] = useState<DisplayMode>('staff_cursor')
  const effectiveDisplayMode = selectedDisplayMode
  const trainer = useVisualTrainer(exercise, highwayRef, effectiveDisplayMode)
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
      elapsedMs={trainer.elapsedMs}
      onSeek={trainer.seek}
      onStart={trainer.start}
      onPause={trainer.pause}
      onResume={trainer.resume}
      onRestart={trainer.restart}
      onExit={handleExit}
      isMetronomeMuted={trainer.isMetronomeMuted}
      onToggleMetronomeMute={trainer.toggleMetronomeMute}
    />
  )
  const keyboardGuide = (
    <KeyboardGuide variant="inline" relevantInstruments={usedInstruments} pressedInstruments={trainer.activeHits} />
  )

  // displayMode 'staff_cursor' (explicit user request — real notation with
  // a moving playhead reads as "more educational" than falling rectangles)
  // swaps NoteHighway for ExerciseNotationSheet driven declaratively
  // (playbackProgress/gradedEventIds), not the imperative ref NoteHighway
  // needs — highwayRef simply stays unattached in this mode, so every
  // `noteHighwayRef.current?.xxx` call elsewhere in useVisualTrainer stays
  // a harmless no-op instead of needing its own branch there.
  const highway =
    effectiveDisplayMode === 'staff_cursor' ? (
      <ExerciseNotationSheet
        exercise={exercise}
        playbackProgress={
          // undefined while idle — without this the CSS animation was
          // present (and running) from the moment the page mounted, using
          // wall-clock time completely divorced from when the user actually
          // pressed Start (reported directly: "the line moves immediately,
          // even without pressing start"). Every existing preview usage
          // already gated this the same way (isPlaying ? {...} : undefined)
          // — this integration just missed doing the same.
          trainer.phase !== 'idle'
            ? {
                bpm: exercise.bpm,
                sessionId: trainer.playSessionId,
                // Negative: the fill/cursor's own animation-delay is
                // `startMs = 0 - startOffsetMs`, so a *negative*
                // startOffsetMs becomes a *positive* delay — the animation
                // waits out the count-in bar before it starts moving,
                // matching when the real audio's own bar 1 actually begins
                // (see countInDurationMs's own doc comment on
                // useVisualTrainer for why this was missing). Combined with
                // seekOffsetMs (0 for a normal start) so a seek also moves
                // the notation in lockstep — count-in and seek are mutually
                // exclusive at the engine level, so this collapses to
                // whichever one actually applies to the current run.
                startOffsetMs: trainer.seekOffsetMs - trainer.countInDurationMs,
              }
            : undefined
        }
        showFill={false}
        paused={trainer.phase === 'paused'}
        gradedEventIds={trainer.gradedEventIds}
        showBeatLabels
        rowBreakBars={exercise.rowBreakBars}
      />
    ) : (
      <NoteHighway ref={highwayRef} events={exercise.events} exercise={exercise} />
    )

  // Demo mode splits the whole content area horizontally — a full-height
  // left third just for the kit, right two-thirds for everything else
  // (transport/feedback/highway/legend stacked) — instead of the regular
  // layout's kit-and-legend-sharing-a-row-under-a-full-width-highway.
  // Explicit user request/iteration: a self-playing kit is the whole point
  // of watching a demo, so it gets real dedicated space rather than a small
  // strip at the bottom.
  //
  // staff_cursor (outside demo) shares this same side-by-side *structure*
  // (kit beside the content, not stacked below it — its own notation strip
  // pushed the kit and keyboard legend below the fold entirely in the
  // regular layout, reported directly: "you don't see them") but NOT
  // demo's own AspectFitBox/items-stretch sizing: that sizes the kit to
  // *match the opposite column's height*, which was designed around
  // NoteHighway's fixed 420px column — ExerciseNotationSheet's own height
  // grows with however many notation rows the exercise has, so
  // items-stretch grew the kit right along with it, well past the
  // viewport (reported directly, via screenshot, as "2 images" — the kit
  // was so tall it only appeared across two different scroll positions).
  // A plain width cap (bigger than the original note_highway one, per
  // that same earlier request) keeps the kit a sane, constant size
  // regardless of how tall the notation gets.
  const useSideBySideLayout = trainer.isDemo || effectiveDisplayMode === 'staff_cursor'
  const sideBySideKit = (
    <DrumKit
      activeHits={trainer.activeHits}
      isCountingIn={trainer.phase === 'count-in'}
      stickClickToken={trainer.stickClickToken}
    />
  )
  // Phone-control toggle + demo-launch button — only relevant outside an
  // actual demo run (a demo run already has trainer.isDemo true the whole
  // time it's active, so these would otherwise never have anywhere useful
  // to render for it).
  const phoneControlAndDemoButton = !trainer.isDemo && (
    <>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={trainer.togglePhoneControl}>
          {trainer.isPhoneControlEnabled ? 'כבה שליטת טלפון' : 'הפעל שליטת טלפון'}
        </Button>
        {trainer.isPhoneControlEnabled && (
          <Badge variant={REMOTE_STATUS_BADGE_VARIANT[trainer.remoteStatus]}>
            {REMOTE_STATUS_LABELS[trainer.remoteStatus]}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={trainer.toggleMidiControl}>
          {trainer.isMidiControlEnabled ? 'כבה קיט תופים אמיתי (MIDI)' : 'הפעל קיט תופים אמיתי (MIDI)'}
        </Button>
        {trainer.isMidiControlEnabled && (
          <Badge variant={MIDI_STATUS_BADGE_VARIANT[trainer.midiStatus]}>{MIDI_STATUS_LABELS[trainer.midiStatus]}</Badge>
        )}
      </div>
      {trainer.phase === 'idle' && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={trainer.startDemo}>
            מוד אוטומטי — הדגמה
          </Button>
          {/* Runtime visual choice for this screen, independent of the
              exercise's own saved displayMode (see selectedDisplayMode's own
              doc comment) — applies to demo AND a real practice run alike,
              only meaningful before starting (phase idle), so it's tucked
              next to the demo button rather than shown everywhere. */}
          <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
            תצוגת תרגול
            <select
              value={selectedDisplayMode}
              onChange={(event) => setSelectedDisplayMode(event.target.value as DisplayMode)}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1"
            >
              <option value="note_highway">מלבנים יורדים</option>
              <option value="staff_cursor">תווים עם פלייהד נע</option>
            </select>
          </label>
        </div>
      )}
    </>
  )

  const body = useSideBySideLayout ? (
    trainer.isDemo ? (
      <div className="flex flex-1 flex-col gap-4 lg:flex-row-reverse lg:items-stretch">
        {/* AspectFitBox (not a width percentage like FreeNotationPracticePage's
            kit column): that page's kit column had no particular height to
            fill, but here the right two-thirds column is tall
            (transport/feedback/highway/legend stacked), and a width-driven
            kit left real empty space below it. Plain CSS aspect-ratio can't
            reliably derive width-from-height here (see AspectFitBox's own
            comment), so this measures the column and sizes the kit in JS. */}
        <div className="h-full w-full lg:w-[45%]">
          <AspectFitBox ratio={4 / 3}>{sideBySideKit}</AspectFitBox>
        </div>
        <div className="flex w-full flex-col gap-1.5 lg:w-[55%]">
          {transportControls}
          <HitFeedback lastGrade={trainer.lastGrade} lastDynamicsGrade={trainer.lastDynamicsGrade} scoring={trainer.scoring} />
          {highway}
          {keyboardGuide}
        </div>
      </div>
    ) : (
      // staff_cursor (non-demo): a 24-bar exercise's notation can run many
      // screens tall, and the kit+keys+transport were ending up scrolled
      // apart from each other, or the kit stretched to match the
      // notation's own unbounded height (both reported directly, via
      // screenshot). lg:sticky pins the whole kit/transport/keyboard
      // column in place while only the notation column scrolls — kit and
      // keys always stay visible together, and the keys sit beside the
      // notation instead of trailing below every row of it.
      <div className="flex flex-1 flex-col gap-4 lg:flex-row-reverse lg:items-start">
        <div className="flex w-full shrink-0 flex-col gap-3 lg:sticky lg:top-14 lg:w-[32rem]">
          {transportControls}
          <HitFeedback lastGrade={trainer.lastGrade} lastDynamicsGrade={trainer.lastDynamicsGrade} scoring={trainer.scoring} />
          {sideBySideKit}
          {keyboardGuide}
          {phoneControlAndDemoButton}
        </div>
        <div className="w-full min-w-0 flex-1">{highway}</div>
      </div>
    )
  ) : (
    <>
      {transportControls}
      <HitFeedback lastGrade={trainer.lastGrade} lastDynamicsGrade={trainer.lastDynamicsGrade} scoring={trainer.scoring} />
      {highway}
      {/* flex-1 on the outer wrapper: the page fits in one screen with real
          leftover space below the highway, so growing this section to fill
          the remaining height (and centering vertically within it) pulls
          the row down into that space instead of leaving it stranded near
          the top. Only reached by note_highway now — staff_cursor uses the
          side-by-side layout above instead (useSideBySideLayout), so this
          branch no longer needs its own conditional here. */}
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
            <DrumKit
              activeHits={trainer.activeHits}
              isCountingIn={trainer.phase === 'count-in'}
              stickClickToken={trainer.stickClickToken}
            />
          </div>
          <div className="flex flex-col gap-3">
            {keyboardGuide}
            {phoneControlAndDemoButton}
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
              dynamicsSummary={trainer.dynamicsSummary}
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

  // key={exercise.id}: react-router does NOT remount this element on a
  // param-only route change (/practice/visual/A -> /practice/visual/B stays
  // the same VisualTrainerRunner/useVisualTrainer instance with a new
  // exercise prop otherwise) — combined with the async Dexie resolution
  // above, a remote "select a different exercise while one is running"
  // (see RemoteHostProvider) could otherwise leave the old run's engine/tick
  // loop alive against stale state. Forcing a real unmount/remount here
  // makes every exercise switch, remote-triggered or not, start clean.
  return <VisualTrainerRunner key={exercise.id} exercise={exercise} highwayRef={highwayRef} />
}
