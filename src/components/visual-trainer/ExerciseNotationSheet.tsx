import { useEffect, useRef, useState } from 'react'
import { SUBDIVISIONS_PER_BEAT, calculateBarDurationMs, calculateEventTimeMs } from '../../domain/calculations/event-timing'
import { STAFF_POSITION, staffPositionToOffsetPx } from '../../lib/visual-trainer/staff-notation-layout'
import { INSTRUMENT_LABELS } from '../../lib/visual-trainer/instrument-labels'
import type { DrumInstrument, ExtraHitEvent, HitGrade, InteractiveExercise, Subdivision } from '../../domain'

// Standard drum-notation convention: the "foot" voice (kick) stems down,
// every "hand" voice (snare/toms/cymbals) stems up — this is what makes it
// visually unambiguous which notes belong to which voice when several land
// on the same beat, instead of every stem sharing one direction.
type Voice = 'hands' | 'feet'
function voiceOf(instrument: DrumInstrument): Voice {
  return instrument === 'kick' ? 'feet' : 'hands'
}
function stemDirection(instrument: DrumInstrument): 'up' | 'down' {
  return voiceOf(instrument) === 'feet' ? 'down' : 'up'
}

export interface ExerciseNotationSheetProps {
  exercise: Pick<InteractiveExercise, 'events' | 'timeSignature' | 'subdivision' | 'bars'>
  /** Event ids to draw in a highlight color — e.g. whichever notes are
   * "now playing" during a preview playback, mirroring the same moment's
   * highlight in the grid editor above this sheet. */
  highlightedEventIds?: ReadonlySet<string>
  /** When set, each row grows a background fill left-to-right in real time
   * (via a CSS animation, not per-frame state) — `bpm` drives the actual
   * playback speed (independent of the arbitrary tempo used for note-x
   * layout above), `sessionId` remounts the fill elements so restarting
   * playback restarts the animation instead of no-oping on an unchanged style.
   * `startOffsetMs` accounts for a seek: playback that started mid-piece
   * needs every row's animation-delay shifted back by the same amount, so a
   * row already behind the seek point renders pre-filled (a negative delay
   * past its own duration, with fill-mode `both`, simply holds at 100%)
   * instead of restarting its fill from the wrong (zero) point. */
  playbackProgress?: { bpm: number; sessionId: number; startOffsetMs?: number }
  /** On by default (matches every existing preview usage). The real
   * practice runner (staff_cursor displayMode) turns this off — a wide,
   * low-opacity block is hard to judge precisely against, and read as "out
   * of sync" even though it shares the exact same timing as the cursor
   * line below (explicit user feedback, after confirming the line itself
   * was correct) — the thin cursor line alone is the real position
   * indicator there. */
  showFill?: boolean
  /** Freezes the fill/cursor animations in place (via CSS
   * animation-play-state) — real practice needs this, unlike the read-only
   * previews playbackProgress originally served: those never paused
   * mid-playthrough, so nothing here ever needed to freeze independent of
   * the audio clock before. Ignored without playbackProgress. */
  paused?: boolean
  /** Per-event grading result — colors that note's own head green (perfect/
   * early/late — all "counted as a hit") or red (miss) as it's graded, the
   * staff-notation equivalent of NoteHighway's own markResult flash.
   * Separate from highlightedEventIds (that one's a transient "now playing"
   * flash; this one persists until reset/replaced, same lifetime as a real
   * grade). */
  gradedEventIds?: ReadonlyMap<string, HitGrade>
  /** Per-event actual strike time (ms elapsed since bar 1, same clock the
   * note's own timing is measured against) — explicit user request: a small
   * red X drawn at the hit's own x, right beside the note it matched, so a
   * player can see exactly how far off (and which direction) a hit landed
   * instead of only its pass/fail grade. Only ever drawn for an 'early' or
   * 'late' grade (see the render below) — a 'perfect' hit is, by definition,
   * already close enough that a marker would just sit on top of the note
   * itself, and green-with-a-red-X-on-it read as "did I actually hit this
   * right?" on a small phone screen (explicit user feedback). Only
   * meaningful alongside playbackProgress (needs the run's real bpm to
   * convert ms into an x position) — a plain preview with no
   * playbackProgress simply never draws any marker, same as gradedEventIds
   * already assumes a real run. */
  hitTimingByEventId?: ReadonlyMap<string, number>
  /** Every hit this run that matched no scheduled event — explicit user
   * request: the results screen already counts these against accuracy, and
   * an all-green sheet showing nothing wrong for them read as a mismatch
   * between the numbers and what's on screen. Drawn as the same small
   * red-X marker as an early/late hitTimingByEventId marker, at the hit's
   * OWN instrument's staff line — there's no scheduled note to draw it
   * "beside", since by definition nothing matched. Only meaningful
   * alongside playbackProgress (needs the run's real bpm to convert the
   * hit's real elapsed ms into a bar/x position), same as
   * hitTimingByEventId above. */
  extraHits?: readonly ExtraHitEvent[]
  /** Off by default (cymbals draw as a plain X, no stem). When on, cymbal
   * (X notehead) instruments also get a stem and join the same beam
   * grouping as normal noteheads — an isolated cymbal note still gets its
   * own individual flag(s), same as a normal notehead would. */
  beamCymbals?: boolean
  /** Off by default. When on, draws a small beat number (1, 2, 3…) under
   * each beat position in every bar — for a standalone sheet with no grid
   * ruler alongside it (e.g. LessonDetailPage's read-only preview), a sparse
   * pattern (e.g. quarter notes on beats 1 and 3 only) otherwise gives no
   * visual cue at all for which beat a note falls on, or that beats 2/4 are
   * silent rather than just "not part of the bar". ExerciseBuilderPage keeps
   * this off — its own grid ruler above the sheet already serves that role. */
  showBeatLabels?: boolean
  /** How many bars share one row before wrapping — defaults to 4
   * (BARS_PER_ROW), which is what ExerciseBuilderPage keeps relying on.
   * A standalone preview with no grid ruler alongside it benefits from
   * fewer, bigger bars per row instead (e.g. LessonDetailPage passes 2) —
   * every note/stem/flag gets more horizontal room, which matters more
   * there since there's nothing else on the page competing for width.
   * Ignored once `rowBreakBars` is given a non-empty array. */
  barsPerRow?: number
  /** 1-indexed bar numbers where a new row starts, overriding the uniform
   * `barsPerRow` chunking — e.g. `[1, 5, 9]` makes bars 1-4 one row, 5-8
   * the next, 9.. the last, regardless of `barsPerRow`. Lets a builder mark
   * "this fill starts a fresh row" instead of wherever a fixed bar-count
   * happens to wrap (explicit user request — several distinct fill examples
   * in one exercise, each meant to start its own row). Bar 1 is always an
   * implicit row start whether or not it's included. Omit/empty to keep
   * the existing uniform-barsPerRow behavior. */
  rowBreakBars?: number[]
  /** Off by default. When on, shows a small live "coming up" line above the
   * staff — the instrument(s) of whichever event(s) come next after the
   * CURRENT playback position (not a fixed "next row" label — explicit user
   * correction after an earlier per-row version: it needs to track the
   * actual next note in the performance, updating continuously as playback
   * moves, including mid-row). Needs `playbackProgress` to mean anything —
   * without a real run in progress there's no live position to measure
   * "next" against, so this renders nothing regardless of this flag.
   * Ignores hand for any multi-instrument tie (explicit user request: a
   * chord already means both hands are busy, and DrumPath doesn't actually
   * know which hand plays which of the two — better to show nothing than
   * guess). For a single upcoming note, only when the WHOLE exercise never
   * uses a foot instrument at all (i.e. voiceOf() is 'hands' for every
   * single event — see isHandsOnlyExercise below) also shows which hand
   * plays it, assuming strict R/L alternation across the whole piece —
   * DrumPath has no real "which hand" data at all, so this alternating-
   * parity guess is deliberately only shown when it can't be wrong (no foot
   * instrument anywhere in the piece to desync it from reality). */
  showNextUpHint?: boolean
}

// 1-indexed bar numbers where each row starts — either the caller's own
// explicit break points (deduped, sorted, bar 1 implied) or synthesized
// from uniform barsPerRow chunks, same shape either way so the rest of the
// component doesn't need two separate code paths.
function computeRowStartBars(totalBars: number, barsPerRow: number, rowBreakBars: number[] | undefined): number[] {
  if (rowBreakBars && rowBreakBars.length > 0) {
    const breaks = [...new Set(rowBreakBars)].filter((bar) => bar > 1 && bar <= totalBars).sort((a, b) => a - b)
    return [1, ...breaks]
  }
  const starts: number[] = []
  for (let bar = 1; bar <= totalBars; bar += barsPerRow) starts.push(bar)
  return starts
}

const BARS_PER_ROW = 4
const BAR_WIDTH_PX = 200
// A one-time viewport-level margin, NOT a per-bar note inset (that was the
// earlier NOTE_INSET_PX approach, removed — see noteX's own comment for why
// it broke cursor sync). This just shifts the whole SVG's visible window a
// little left of x=0 via the viewBox origin — every note/line/cursor stays
// at its own unmodified x, so nothing about timing sync changes; only what
// portion of that coordinate space is actually in view does. Explicit user
// request: bar 1's own first note used to render flush against x=0, the
// literal edge of the screen — on a phone, that's exactly where a
// front-camera cutout can sit, physically covering it (confirmed via
// screenshot: the note was visibly clipped in half).
const VIEWPORT_LEFT_PADDING_PX = 16
// Reserved space for the count-in "runway" the cursor sweeps through before
// reaching bar 1 (see the cursor's own render code below). Deliberately
// much smaller than a full bar: the runway HAS to move at the exact same
// px/ms rate as the rest of the piece (it's the same single linear
// animation, just fed a further-left starting point — changing its rate
// would desync the whole row, not just the runway, reintroducing the exact
// note-vs-cursor bug documented on noteX below). At that fixed rate, a
// full count-in bar's worth of *time* covers a full bar's worth of
// *width* — reserving that much screen space read as a huge, mostly-empty
// margin on a phone (reported directly: "a fifth of the screen"). Instead
// the cursor sits still for most of the count-in (exactly as it did before
// this feature existed) and only starts its visible sweep for this last
// stretch of it — still real, correctly-paced motion arriving exactly on
// bar 1's own first note, just over a short final approach instead of the
// whole count-in bar. Always reserved (not just while a run with a
// count-in is actually active) so the viewBox — and everything's on-screen
// scale — never visibly jumps the instant a preview's own "play" starts one.
const COUNT_IN_RUNWAY_PX = BAR_WIDTH_PX / 4
const LINE_SPACING_PX = 8
const NOTE_RADIUS_PX = 3
const STEM_LENGTH_PX = 12
const FLAG_GAP_PX = 4
const BASE_BOTTOM_PADDING_PX = 6
const ROW_GAP_PX = 12
// How often the live "coming up" clock re-checks its position — a text
// label doesn't need per-frame (60fps) precision like the cursor does.
const NEXT_UP_HINT_POLL_MS = 200
const BEAT_LABEL_ROW_HEIGHT_PX = 10
const BEAT_LABEL_FONT_SIZE = 7
// Drum-count-out syllables for each off-beat subdivision slot (index 0, the
// beat itself, always gets its number instead — see the render site) —
// "1 2 3 4" / "1 & 2 & 3 & 4 &" / "1 e & a 2 e & a…", matching the course's
// own counting convention exactly (confirmed with the user — "&", not "+").
const SUBDIVISION_COUNT_SYLLABLES: Record<Subdivision, string[]> = {
  quarter: [''],
  eighth: ['', '&'],
  sixteenth: ['', 'e', '&', 'a'],
}
// The whole exercise shares one subdivision (no per-note duration yet), so
// every note gets the same flag count — reflecting the real note-duration
// shape (quarter/eighth/sixteenth), not just a plain circle.
const FLAG_COUNT: Record<Subdivision, number> = { quarter: 0, eighth: 1, sixteenth: 2 }
// How many beats' worth of notes share one beam group for a continuous
// same-instrument run — eighth notes group by half-bar (beats 1-2, 3-4),
// matching how a continuous pattern like hi-hat is normally engraved rather
// than the choppier per-beat grouping; sixteenths already make a
// substantial-looking group at just one beat, so they stay per-beat.
const BEAM_GROUP_BEATS: Record<Subdivision, number> = { quarter: 1, eighth: 2, sixteenth: 1 }
// Reserve enough headroom above the highest note for its stem + flags.
const TOP_PADDING_PX = STEM_LENGTH_PX + FLAG_GAP_PX * 2 + 4
// Bottom staff line = position 0; the drawn lines sit at positions 0/2/4/6/8.
const STAFF_LINE_POSITIONS = [0, 2, 4, 6, 8]
const STAFF_BOTTOM_LINE_POSITION = STAFF_LINE_POSITIONS[0]!
const STAFF_TOP_LINE_POSITION = STAFF_LINE_POSITIONS[STAFF_LINE_POSITIONS.length - 1]!

// bpm is arbitrary here — it cancels out below (event-time-ms / bar-duration-ms
// is tempo-independent), so this reuses the already-tested domain time math
// instead of a new pure function just for grid position.
const ARBITRARY_BPM = 60

function barDurationMs(exercise: ExerciseNotationSheetProps['exercise']): number {
  return calculateBarDurationMs(ARBITRARY_BPM, exercise.timeSignature)
}

/** A static, simplified rhythm sheet — noteheads on a standard 5-line
 * drum-notation staff, positioned by the grid (bar/beat/subdivision), not
 * by real time. Every note gets a stem + a flag count matching the
 * exercise's subdivision (quarter/eighth/sixteenth); consecutive
 * same-instrument notes within a beam group (see BEAM_GROUP_BEATS) share one
 * beam instead of individual flags, same as real engraving. There's still no
 * per-note duration, so this can't mix durations within one exercise, only
 * reflect the one subdivision the whole exercise shares — and only normal
 * (circle) noteheads beam for now, not cymbals (X noteheads, no stem yet). */
export function ExerciseNotationSheet({
  exercise,
  highlightedEventIds,
  playbackProgress,
  showFill = true,
  paused = false,
  gradedEventIds,
  hitTimingByEventId,
  extraHits,
  beamCymbals = false,
  showBeatLabels = false,
  barsPerRow = BARS_PER_ROW,
  rowBreakBars,
  showNextUpHint = false,
}: ExerciseNotationSheetProps) {
  const hasStem = (instrument: (typeof exercise.events)[number]['instrument']) => {
    const notehead = STAFF_POSITION[instrument].notehead
    return notehead === 'normal' || (beamCymbals && notehead === 'x')
  }
  // Auto-follows the playing row into view during real playback (explicit
  // user request: a long, multi-row exercise scrolled the cursor off
  // screen with nothing keeping it in view) — driven by the cursor rect's
  // own onAnimationStart, which already fires at exactly the right
  // wall-clock moment for each row (same CSS-animation-delay math the
  // cursor itself uses, so no separate timing logic to keep in sync).
  // lastScrolledRowIndexRef enforces "forward only" (explicit user
  // request): once row N has been scrolled to, an earlier row's own
  // animationstart (e.g. a stale one from before a session restart) can
  // never scroll back to it.
  const rowRefs = useRef(new Map<number, SVGGElement>())
  const lastScrolledRowIndexRef = useRef(-1)
  const scrollSessionIdRef = useRef<number | undefined>(undefined)

  // Live "coming up" clock (see showNextUpHint's own doc comment) — a
  // self-contained wall-clock projection from playbackProgress, independent
  // of the cursor's own CSS-only animation timing, since a text hint needs
  // its value read back out in JS, which animation-delay alone can't give.
  // Depends only on playbackProgress's own primitive fields (sessionId,
  // startOffsetMs), never the object itself, so a fresh object reference
  // from the caller every render can't spuriously reset the clock.
  const sessionId = playbackProgress?.sessionId
  const startOffsetMs = playbackProgress?.startOffsetMs ?? 0
  const hasPlayback = playbackProgress !== undefined
  const [liveElapsedMs, setLiveElapsedMs] = useState<number | null>(null)
  const clockAnchorRef = useRef<{ sessionId: number; startOffsetMs: number; startedAt: number } | null>(null)
  const pausedAtElapsedMsRef = useRef<number | null>(null)

  // Live-projects elapsed ms from playbackProgress via a wall-clock anchor
  // (ref only — setLiveElapsedMs is called exclusively from inside the
  // interval callback below, never synchronously in this effect's own body,
  // per react-hooks/set-state-in-effect: an effect should update external
  // systems or subscribe to them, not setState directly), so a fresh
  // session can take up to one NEXT_UP_HINT_POLL_MS tick to show its first
  // hint — acceptable, there's always a count-in bar before it'd matter.
  // Freezes across a pause the same way the cursor's own
  // animation-play-state does, so resuming continues from where it actually
  // left off instead of jumping ahead by however long the pause lasted.
  useEffect(() => {
    if (!showNextUpHint || !hasPlayback || sessionId === undefined) {
      clockAnchorRef.current = null
      pausedAtElapsedMsRef.current = null
      return
    }
    const isNewSession = clockAnchorRef.current?.sessionId !== sessionId
    if (isNewSession) pausedAtElapsedMsRef.current = null

    if (paused) {
      if (isNewSession) {
        pausedAtElapsedMsRef.current = startOffsetMs
        clockAnchorRef.current = { sessionId, startOffsetMs, startedAt: performance.now() }
      } else if (clockAnchorRef.current && pausedAtElapsedMsRef.current === null) {
        const anchor = clockAnchorRef.current
        pausedAtElapsedMsRef.current = anchor.startOffsetMs + (performance.now() - anchor.startedAt)
      }
      return
    }

    const resumeFromMs = isNewSession ? startOffsetMs : (pausedAtElapsedMsRef.current ?? startOffsetMs)
    clockAnchorRef.current = { sessionId, startOffsetMs: resumeFromMs, startedAt: performance.now() }
    pausedAtElapsedMsRef.current = null
    const intervalId = setInterval(() => {
      const anchor = clockAnchorRef.current
      if (anchor) setLiveElapsedMs(anchor.startOffsetMs + (performance.now() - anchor.startedAt))
    }, NEXT_UP_HINT_POLL_MS)
    return () => clearInterval(intervalId)
  }, [showNextUpHint, hasPlayback, sessionId, startOffsetMs, paused])

  const rowStartBars = computeRowStartBars(exercise.bars, barsPerRow, rowBreakBars)
  const rowCount = rowStartBars.length
  // Row index for a given 1-indexed bar — rowStartBars is sorted ascending,
  // so this is "the last start <= bar".
  const rowIndexForBar = (bar: number): number => {
    let index = 0
    for (let i = 0; i < rowStartBars.length; i += 1) {
      if (rowStartBars[i]! <= bar) index = i
      else break
    }
    return index
  }
  const rowBarsCount = (rowIndex: number): number => {
    const start = rowStartBars[rowIndex]!
    const nextStart = rowStartBars[rowIndex + 1] ?? exercise.bars + 1
    return nextStart - start
  }

  // extraHits, grouped by row and positioned via the SAME proportional x
  // math a real note uses (barIndexInRow*BAR_WIDTH_PX + fraction*BAR_WIDTH_PX
  // — see noteX below), just computed from the hit's own real elapsed time
  // instead of a scheduled DrumNoteEvent's grid position. Needs
  // playbackProgress's real bpm to convert real ms into a bar+fraction —
  // without it there's no live clock to place these against, so none are
  // drawn (matches extraHits' own doc comment). Modulo the exercise's own
  // single-loop duration — a hit during loop 2+ (loopCount > 1) still needs
  // to land somewhere on this sheet, which only ever shows one loop's worth
  // of bars.
  const extraHitsByRow = new Map<number, { id: string; instrument: DrumInstrument; x: number }[]>()
  if (playbackProgress && extraHits) {
    const realBarMs = calculateBarDurationMs(playbackProgress.bpm, exercise.timeSignature)
    const singleLoopDurationMs = exercise.bars * realBarMs
    for (const hit of extraHits) {
      const wrappedMs = singleLoopDurationMs > 0 ? hit.hitTimeMs % singleLoopDurationMs : hit.hitTimeMs
      const totalBarPosition = wrappedMs / realBarMs
      const barGlobalIndex = Math.floor(totalBarPosition)
      if (barGlobalIndex < 0 || barGlobalIndex >= exercise.bars) continue
      const fraction = totalBarPosition - barGlobalIndex
      const rowIndex = rowIndexForBar(barGlobalIndex + 1)
      const barIndexInRow = barGlobalIndex - (rowStartBars[rowIndex]! - 1)
      const x = barIndexInRow * BAR_WIDTH_PX + fraction * BAR_WIDTH_PX
      const rowHits = extraHitsByRow.get(rowIndex) ?? []
      rowHits.push({ id: hit.id, instrument: hit.instrument, x })
      extraHitsByRow.set(rowIndex, rowHits)
    }
  }

  // Only reserve vertical room up to the highest notehead actually used
  // (e.g. no crash in this exercise = no wasted headroom above the staff),
  // never less than the top staff line so the staff itself always shows in full.
  const highestPosition = exercise.events.reduce(
    (max, event) => Math.max(max, STAFF_POSITION[event.instrument].position),
    STAFF_TOP_LINE_POSITION,
  )
  // The feet (down-stem) voice's shared beam sits just below whichever of
  // its notes is lowest on the staff — mirrors highestPosition, just for
  // the opposite direction/voice.
  const feetPositions = exercise.events
    .filter((event) => stemDirection(event.instrument) === 'down')
    .map((event) => STAFF_POSITION[event.instrument].position)
  const lowestFeetPosition = feetPositions.length > 0 ? Math.min(...feetPositions) : STAFF_BOTTOM_LINE_POSITION
  // Same idea as TOP_PADDING_PX, but for the down-stem (kick) voice — its
  // stem + flags extend *below* the notehead instead of above it, so it
  // needs its own reserved room at the bottom, only when actually used.
  const hasDownStemNote = feetPositions.length > 0
  const bottomPadding =
    (hasDownStemNote ? BASE_BOTTOM_PADDING_PX + TOP_PADDING_PX : BASE_BOTTOM_PADDING_PX) +
    (showBeatLabels ? BEAT_LABEL_ROW_HEIGHT_PX : 0)
  const rowHeight = TOP_PADDING_PX + staffPositionToOffsetPx(highestPosition, LINE_SPACING_PX) + bottomPadding
  const totalHeight = rowCount * rowHeight + (rowCount - 1) * ROW_GAP_PX
  const barMs = barDurationMs(exercise)

  // No foot instrument (kick) anywhere in the whole piece — see
  // showNextUpHint's own doc comment for why that's exactly the condition
  // under which a plain alternating-parity hand guess can't be wrong.
  // hasDownStemNote already answers "is there a feet-voice note anywhere",
  // computed the same way voiceOf() would.
  const isHandsOnlyExercise = showNextUpHint && !hasDownStemNote
  // Global chronological order (not per-row, not exercise.events' own
  // array order) — sticking alternates continuously across the whole
  // piece, including across bar and row boundaries, not resetting at
  // either.
  const handByEventId = isHandsOnlyExercise
    ? new Map(
        [...exercise.events]
          .sort((a, b) => a.bar - b.bar || a.beat - b.beat || a.subdivisionIndex - b.subdivisionIndex)
          .map((event, index) => [event.id, index % 2 === 0 ? 'ימין' : 'שמאל'] as const),
      )
    : undefined

  const eventsByRow: {
    id: string
    barIndexInRow: number
    beat: number
    subdivisionIndex: number
    fraction: number
    instrument: (typeof exercise.events)[number]['instrument']
    accent?: boolean
  }[][] = Array.from({ length: rowCount }, () => [])

  for (const event of exercise.events) {
    const barGlobalIndex = event.bar - 1
    const rowIndex = rowIndexForBar(event.bar)
    const barIndexInRow = barGlobalIndex - (rowStartBars[rowIndex]! - 1)
    const totalBarPosition = calculateEventTimeMs(event, {
      bpm: ARBITRARY_BPM,
      timeSignature: exercise.timeSignature,
      subdivision: exercise.subdivision,
    }) / barMs
    const fraction = totalBarPosition - barGlobalIndex
    eventsByRow[rowIndex]?.push({
      id: event.id,
      barIndexInRow,
      beat: event.beat,
      subdivisionIndex: event.subdivisionIndex,
      fraction,
      instrument: event.instrument,
      accent: event.accent,
    })
  }

  // The next event(s) after the CURRENT live playback position (liveElapsedMs,
  // plain state — only the anchor bookkeeping above lives in refs, and only
  // ever touched from inside the two effects, never read during render, to
  // stay clear of the same react-hooks/refs pitfall this file has hit
  // before). Several can tie (two instruments landing at the exact same
  // instant), in which case all of them are "next up" together — no hand
  // guess for a tie (see showNextUpHint's own doc comment for why).
  let nextUpEvents: { id: string; instrument: DrumInstrument }[] = []
  if (showNextUpHint && playbackProgress && liveElapsedMs !== null) {
    let nextUpTimeMs: number | undefined
    for (const event of exercise.events) {
      const eventTimeMs = calculateEventTimeMs(event, {
        bpm: playbackProgress.bpm,
        timeSignature: exercise.timeSignature,
        subdivision: exercise.subdivision,
      })
      if (eventTimeMs <= liveElapsedMs) continue
      if (nextUpTimeMs === undefined || eventTimeMs < nextUpTimeMs) {
        nextUpTimeMs = eventTimeMs
        nextUpEvents = [{ id: event.id, instrument: event.instrument }]
      } else if (eventTimeMs === nextUpTimeMs) {
        nextUpEvents.push({ id: event.id, instrument: event.instrument })
      }
    }
  }

  // The viewBox must match the widest row actually drawn — rows can now
  // have different lengths (rowBreakBars), so this is a real max over every
  // row instead of just row 0's own length.
  const viewBoxWidth = Math.max(...rowStartBars.map((_, rowIndex) => rowBarsCount(rowIndex))) * BAR_WIDTH_PX

  // Real-time (not ARBITRARY_BPM) duration of each row, and each row's own
  // start offset — lets every row's fill animation run purely in CSS, with
  // `animation-delay` doing the cross-row sequencing instead of JS polling.
  let cumulativeRealMs = 0
  const rowRealTimings = Array.from({ length: rowCount }, (_, rowIndex) => {
    const rowBars = rowBarsCount(rowIndex)
    const rowDurationMs = playbackProgress
      ? rowBars * calculateBarDurationMs(playbackProgress.bpm, exercise.timeSignature)
      : 0
    const absoluteStartMs = cumulativeRealMs
    cumulativeRealMs += rowDurationMs
    const startMs = absoluteStartMs - (playbackProgress?.startOffsetMs ?? 0)
    return { startMs, durationMs: rowDurationMs }
  })

  return (
    // w-full is load-bearing, not decorative: the <svg> below sizes itself
    // to `width: 100%` of ITS containing block — before this wrapper <div>
    // existed, that containing block was this flex-item's own place inside
    // the caller's flex row, which resolves percentage widths against the
    // flex container's content box regardless of alignment. A bare <div>
    // with no width class instead sizes to its own content on the main
    // axis, so the svg's 100% resolved against an already content-sized
    // (i.e. tiny/collapsed) box — reported directly: notation rendered tiny
    // in a corner with most of the container left empty.
    <div className="w-full">
      {/* Live "coming up" line (see showNextUpHint's own doc comment) — a
          plain HTML element above the staff, not SVG: it needs to stay in
          one fixed on-screen spot regardless of scroll position, which an
          SVG element positioned in row-gap viewBox coordinates can't do once
          the sheet scrolls past that row. */}
      {showNextUpHint && nextUpEvents.length > 0 && (
        <div className="mb-1 text-sm text-[var(--color-primary-text)] opacity-85" aria-live="polite">
          הבא: {nextUpEvents.map((event) => INSTRUMENT_LABELS[event.instrument]).join(' + ')}
          {nextUpEvents.length === 1 && handByEventId?.get(nextUpEvents[0]!.id)
            ? ` (${handByEventId.get(nextUpEvents[0]!.id)})`
            : ''}
        </div>
      )}
      <svg
        viewBox={`-${COUNT_IN_RUNWAY_PX + VIEWPORT_LEFT_PADDING_PX} 0 ${viewBoxWidth + COUNT_IN_RUNWAY_PX + VIEWPORT_LEFT_PADDING_PX} ${totalHeight}`}
        // Plain `w-full` stretched a short exercise's small viewBox (e.g. one
        // bar = 200 units) to fill the whole, often much wider, container —
        // scaling every line/note/gap up with it. Capping at 2x native scale
        // instead of the unbounded 100% keeps it from stretching that far,
        // without also shrinking it down to a literal 200px postage stamp
        // (native 1x, which read as too small): it fills the container up to
        // that cap, and only shrinks below it for a genuinely narrow container.
        className="h-auto text-[var(--color-text)]"
        style={{ width: '100%', maxWidth: viewBoxWidth * 2 }}
        role="img"
        aria-label="תווי התרגיל"
      >
        {eventsByRow.map((rowEvents, rowIndex) => {
        const rowBars = rowBarsCount(rowIndex)
        const rowTopY = rowIndex * (rowHeight + ROW_GAP_PX)
        const baselineY = rowTopY + rowHeight - bottomPadding
        const toY = (position: number) => baselineY - staffPositionToOffsetPx(position, LINE_SPACING_PX)
        const rowTiming = rowRealTimings[rowIndex]!
        // Runway before THIS row's own bar 1 — every row gets one, not just
        // row 0 (reported directly: a row-2+ first note had the exact same
        // "cursor just appears on top of it" problem row 0's own count-in
        // runway was built for, since wrapping to a new row resets the
        // cursor to its own left edge with zero lead-in too). Where the
        // runway's time comes FROM differs:
        // - Row 0 borrows from the count-in wait before the piece's own bar
        //   1 (rowTiming.startMs > 0 there specifically means "there's a
        //   real wait", true for an ordinary count-in, false/0 for a
        //   mid-exercise seek, which skips the count-in entirely — a seek
        //   must NOT get a runway, there's no count-in click to justify one).
        // - Every later row borrows from the TAIL END of the row right
        //   before it — a separate <rect> at a separate screen position, so
        //   stealing a little of its own final stretch for this row's
        //   pre-roll doesn't touch its notes, its grading, or its own
        //   timing in any way; the piece itself never actually pauses
        //   between rows, only the cursor visually "arrives early" here.
        const barRealDurationMs = rowTiming.durationMs / rowBars
        const availableWaitMs = rowIndex === 0 ? Math.max(0, rowTiming.startMs) : rowRealTimings[rowIndex - 1]!.durationMs
        // How long covering COUNT_IN_RUNWAY_PX takes at this row's own
        // px/ms rate — same rate the rest of this row's own bars use, so
        // the runway's motion is neither stretched nor compressed relative
        // to bar 1 right after it. Capped by whatever wait is actually
        // available (in principle a fast enough tempo's count-in bar, or an
        // unusually short previous row, could be shorter than the runway's
        // own time-equivalent) — the cursor sits still (row 0) or the
        // previous row's own cursor simply hasn't reached that point yet
        // (later rows) for whatever's left before this.
        const preRollMs = availableWaitMs > 0 ? Math.min(availableWaitMs, (COUNT_IN_RUNWAY_PX * barRealDurationMs) / BAR_WIDTH_PX) : 0
        const preRollPx = preRollMs > 0 ? (preRollMs * BAR_WIDTH_PX) / barRealDurationMs : 0

        // x per note, needed by both the beam grouping below and the note
        // rendering loop further down. Pure proportional (barIndexInRow*
        // BAR_WIDTH_PX + fraction*BAR_WIDTH_PX) — NOT inset/compressed
        // per-bar (a previous version reserved NOTE_INSET_PX of breathing
        // room after each barline before a bar's own content started,
        // compressing the rest of that bar's notes into what was left).
        // That inset broke the cursor below: matching it required either an
        // inaccurate cursor (the original bug — reported directly: a
        // well-timed kick hit needed to land visibly before its note, a
        // roughly constant on-screen distance regardless of tempo, meaning
        // the cursor reached each note strictly LATER than its true instant)
        // or a per-bar cursor that jumps FORWARD by that same inset at every
        // barline (a later attempt) — which gives a downbeat note zero
        // visual lead-in, the cursor simply appears on top of it the instant
        // the bar starts (reported directly, and a real functional
        // regression, not just cosmetic — a downbeat-heavy pattern like
        // kick+snare on every beat becomes unplayable). A note landing
        // exactly on a barline's x (a beat-1 note, NOTE_RADIUS_PX=3, barely
        // overlapping the thin barline) is a small, purely cosmetic price
        // for a cursor that moves continuously across the whole row (like
        // real notation reads) AND stays exactly synced with every note at
        // every tempo — no bias hack needed on the grading side either.
        const noteX = new Map(
          rowEvents.map((event) => [event.id, event.barIndexInRow * BAR_WIDTH_PX + event.fraction * BAR_WIDTH_PX]),
        )

        // Real notation connects consecutive notes within a beam group with a
        // beam instead of individual flags — grouped by VOICE (hands vs.
        // feet), not by instrument: when e.g. hi-hat and snare are both in
        // the "hands" voice and land on consecutive steps, they share one
        // beam even though they're different instruments, exactly like a
        // real drum staff's composite rhythm. Each note still keeps its own
        // stem down to its own notehead (its own staff position) — only the
        // stem *length* changes for a beamed note, reaching up (or down, for
        // feet) to the voice's one shared beam height instead of a fixed
        // short length. A step with no same-voice neighbor in its group
        // still gets its own individual flag(s), same as real engraving.
        const rowFlagCount = FLAG_COUNT[exercise.subdivision]
        const beamedEventIds = new Set<string>()
        const noteBeamY = new Map<string, number>()
        const beams: { x1: number; x2: number; y: number; direction: 'up' | 'down' }[] = []
        if (rowFlagCount > 0) {
          const groupBeats = BEAM_GROUP_BEATS[exercise.subdivision]
          const subdivisionsPerBeat = SUBDIVISIONS_PER_BEAT[exercise.subdivision]
          // A single step index spanning the whole beam group (not just the
          // event's own beat) — needed so e.g. beat 2's subdivisionIndex 0
          // is correctly seen as consecutive with beat 1's last subdivision
          // when a group spans multiple beats (half-bar eighth grouping).
          const stepInGroup = (event: (typeof rowEvents)[number]) =>
            ((event.beat - 1) % groupBeats) * subdivisionsPerBeat + event.subdivisionIndex

          for (const voice of ['hands', 'feet'] as const) {
            const direction: 'up' | 'down' = voice === 'feet' ? 'down' : 'up'
            const beamPosition = voice === 'feet' ? lowestFeetPosition : highestPosition
            const noteY = toY(beamPosition)
            const beamY = direction === 'down' ? noteY + NOTE_RADIUS_PX + STEM_LENGTH_PX : noteY - NOTE_RADIUS_PX - STEM_LENGTH_PX

            // Bucket this voice's events by (bar, beam group, step) — a step
            // can hold more than one event when two instruments in the same
            // voice coincide (e.g. hi-hat + snare on the same subdivision).
            const byGroup = new Map<string, Map<number, typeof rowEvents>>()
            for (const event of rowEvents) {
              if (!hasStem(event.instrument) || voiceOf(event.instrument) !== voice) continue
              const groupIndex = Math.floor((event.beat - 1) / groupBeats)
              const groupKey = `${event.barIndexInRow}-${groupIndex}`
              const steps = byGroup.get(groupKey) ?? new Map<number, typeof rowEvents>()
              const step = stepInGroup(event)
              const stepEvents = steps.get(step) ?? []
              stepEvents.push(event)
              steps.set(step, stepEvents)
              byGroup.set(groupKey, steps)
            }

            // One beam spans the *whole* group whenever it holds 2+ notes,
            // even across a rest — real engraving (and this app's own
            // count-out labels, which already number every subdivision
            // slot including silent ones) treats "same beat group" as the
            // unit that reads as one rhythmic gesture, not "consecutive
            // sixteenths only" (explicit user correction: a hit on the
            // beat and another on its "a" with silence between should
            // still share one beam, not fall back to individual flags).
            for (const steps of byGroup.values()) {
              const sortedStepKeys = [...steps.keys()].sort((a, b) => a - b)
              if (sortedStepKeys.length < 2) continue
              const firstStepEvents = steps.get(sortedStepKeys[0]!)!
              const lastStepEvents = steps.get(sortedStepKeys[sortedStepKeys.length - 1]!)!
              const stemXFor = (id: string) => noteX.get(id)! + (direction === 'down' ? -NOTE_RADIUS_PX : NOTE_RADIUS_PX)
              beams.push({ x1: stemXFor(firstStepEvents[0]!.id), x2: stemXFor(lastStepEvents[0]!.id), y: beamY, direction })
              for (const stepKey of sortedStepKeys) {
                for (const beamedEvent of steps.get(stepKey)!) {
                  beamedEventIds.add(beamedEvent.id)
                  noteBeamY.set(beamedEvent.id, beamY)
                }
              }
            }
          }
        }

        return (
          <g
            key={rowIndex}
            data-testid={`notation-row-${rowIndex}`}
            ref={(el) => {
              if (el) rowRefs.current.set(rowIndex, el)
              else rowRefs.current.delete(rowIndex)
            }}
          >
            {showFill && playbackProgress && rowTiming.durationMs > 0 && (
              <rect
                key={playbackProgress.sessionId}
                data-testid={`notation-row-${rowIndex}-fill`}
                x={0}
                y={toY(STAFF_TOP_LINE_POSITION)}
                height={toY(STAFF_BOTTOM_LINE_POSITION) - toY(STAFF_TOP_LINE_POSITION)}
                fill="var(--color-primary-text)"
                opacity={0.28}
                style={{
                  ['--notation-fill-target-width' as string]: `${rowBars * BAR_WIDTH_PX}px`,
                  animation: `notation-row-fill ${rowTiming.durationMs}ms linear ${rowTiming.startMs}ms both`,
                  animationPlayState: paused ? 'paused' : 'running',
                }}
              />
            )}
            {/* The actual "where am I" indicator (explicit user request —
                "like you already color the background, mark a vertical
                line") — same animation-driven timing as the fill above
                (same CSS-transform technique, not per-frame JS/React state,
                per §18's rule), just a thin moving line instead of a
                widening block. Drawn a little past the staff on both ends
                so it reads as a distinct cursor, not another staff line.
                One continuous <rect> for the WHOLE row (not one per bar) —
                a per-bar version was tried and reverted (reported directly):
                it kept the cursor exactly synced with each note, but jumped
                FORWARD at every barline to reach the next bar's own inset
                start, meaning a downbeat note got zero visual lead-in — the
                cursor simply appeared on top of it, unplayable for any
                downbeat-heavy pattern. noteX above no longer insets/
                compresses per bar (see its own comment) specifically so
                THIS single linear sweep across the whole row — smooth,
                continuous, exactly what real notation reading feels like —
                stays exactly synced with every note at every tempo, with no
                jumps and no bias hack needed on the grading side. */}
            {playbackProgress && rowTiming.durationMs > 0 && (
              <rect
                key={playbackProgress.sessionId}
                data-testid={`notation-row-${rowIndex}-cursor`}
                x={-1}
                y={toY(STAFF_TOP_LINE_POSITION) - 6}
                width={2}
                height={toY(STAFF_BOTTOM_LINE_POSITION) - toY(STAFF_TOP_LINE_POSITION) + 12}
                fill="var(--color-primary-text)"
                style={{
                  ...(preRollPx > 0 ? { ['--notation-cursor-start-x' as string]: `${-preRollPx}px` } : {}),
                  ['--notation-cursor-target-x' as string]: `${rowBars * BAR_WIDTH_PX}px`,
                  animation: `notation-row-cursor ${preRollMs + rowTiming.durationMs}ms linear ${rowTiming.startMs - preRollMs}ms both`,
                  animationPlayState: paused ? 'paused' : 'running',
                }}
                onAnimationStart={() => {
                  if (scrollSessionIdRef.current !== playbackProgress.sessionId) {
                    scrollSessionIdRef.current = playbackProgress.sessionId
                    lastScrolledRowIndexRef.current = -1
                  }
                  if (rowIndex <= lastScrolledRowIndexRef.current) return
                  lastScrolledRowIndexRef.current = rowIndex
                  rowRefs.current.get(rowIndex)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                }}
              />
            )}
            {STAFF_LINE_POSITIONS.map((position) => (
              <line
                key={position}
                x1={0}
                x2={rowBars * BAR_WIDTH_PX}
                y1={toY(position)}
                y2={toY(position)}
                stroke="currentColor"
                strokeWidth={1}
                opacity={0.5}
              />
            ))}

            {Array.from({ length: rowBars + 1 }, (_, barLineIndex) => (
              <line
                key={barLineIndex}
                x1={barLineIndex * BAR_WIDTH_PX}
                x2={barLineIndex * BAR_WIDTH_PX}
                y1={toY(STAFF_BOTTOM_LINE_POSITION)}
                y2={toY(STAFF_TOP_LINE_POSITION)}
                stroke="currentColor"
                strokeWidth={barLineIndex === 0 || barLineIndex === rowBars ? 2 : 1}
                opacity={0.5}
              />
            ))}

            {/* A sparse pattern (e.g. quarter notes on beats 1 and 3 only)
                otherwise gives no visual cue for which beat a note falls on,
                or that beats 2/4 are silent rather than simply "not part of
                the bar" — see this file's showBeatLabels doc comment. One
                label per actual subdivision SLOT, not just per beat: at
                eighth/sixteenth subdivision there are 2/4 noteheads per
                beat, and labeling only the 4 downbeats among 8 or 16 visible
                marks read as mismatched/wrong (confirmed against a real
                screenshot) — standard count-out syllables ("1 + 2 + 3 + 4 +"
                for eighths, "1 e + a…" for sixteenths) label every slot. */}
            {showBeatLabels &&
              Array.from({ length: rowBars }, (_, barIndexInRow) =>
                Array.from({ length: exercise.timeSignature.numerator }, (_, beatIndex) =>
                  Array.from({ length: SUBDIVISIONS_PER_BEAT[exercise.subdivision] }, (_, subdivisionIndex) => (
                    <text
                      key={`${barIndexInRow}-${beatIndex}-${subdivisionIndex}`}
                      data-testid="notation-beat-label"
                      // Same x formula real notes use (noteX above) — keeps
                      // a label lined up directly under its actual note.
                      x={
                        barIndexInRow * BAR_WIDTH_PX +
                        (beatIndex / exercise.timeSignature.numerator +
                          subdivisionIndex / (exercise.timeSignature.numerator * SUBDIVISIONS_PER_BEAT[exercise.subdivision])) *
                          BAR_WIDTH_PX
                      }
                      y={rowTopY + rowHeight - 2}
                      textAnchor="middle"
                      fontSize={BEAT_LABEL_FONT_SIZE}
                      fill="currentColor"
                      opacity={0.5}
                    >
                      {subdivisionIndex === 0 ? beatIndex + 1 : SUBDIVISION_COUNT_SYLLABLES[exercise.subdivision][subdivisionIndex]}
                    </text>
                  )),
                ),
              )}

            {rowEvents.map((event, eventIndex) => {
              const staff = STAFF_POSITION[event.instrument]
              const x = noteX.get(event.id)!
              const y = toY(staff.position)
              const direction = stemDirection(event.instrument)
              const stemX = direction === 'down' ? x - NOTE_RADIUS_PX : x + NOTE_RADIUS_PX
              const isBeamed = beamedEventIds.has(event.id)
              // Where the ACTUAL hit landed, in the same x-space as the note
              // itself — mirrors noteX's own formula exactly (see that
              // constant's own comment), just fed the hit's real elapsed
              // time (at the run's real bpm) instead of the note's authored
              // fraction. Not clamped to [0, BAR_WIDTH_PX] — a hit landing
              // outside its own note's bar box is exactly the (rare, worth
              // seeing) case of a hit graded against this note despite
              // falling in a neighboring bar. Only ever drawn for an 'early'
              // or 'late' grade (see showHitMarker below) — explicit user
              // feedback: a red X sitting on an already-green 'perfect' note
              // read as "did I actually hit this right?" on a small phone
              // screen, not as useful calibration info.
              const grade = gradedEventIds?.get(event.id)
              const hitTimeMs = hitTimingByEventId?.get(event.id)
              const hitX =
                hitTimeMs !== undefined && playbackProgress
                  ? (() => {
                      const realBarDurationMs = calculateBarDurationMs(playbackProgress.bpm, exercise.timeSignature)
                      const barGlobalIndex = rowStartBars[rowIndex]! - 1 + event.barIndexInRow
                      const hitFractionInBar = (hitTimeMs - barGlobalIndex * realBarDurationMs) / realBarDurationMs
                      return event.barIndexInRow * BAR_WIDTH_PX + hitFractionInBar * BAR_WIDTH_PX
                    })()
                  : undefined
              const showHitMarker = hitX !== undefined && (grade === 'early' || grade === 'late')
              // A beamed note's stem reaches the voice's shared beam height
              // (variable length) instead of the fixed individual-flag
              // length — that's what visually connects e.g. a low snare note
              // to a high hi-hat note sharing the same beam.
              const stemEndY =
                noteBeamY.get(event.id) ??
                (direction === 'down' ? y + NOTE_RADIUS_PX + STEM_LENGTH_PX : y - NOTE_RADIUS_PX - STEM_LENGTH_PX)
              const isHighlighted = highlightedEventIds?.has(event.id) ?? false
              // Three-tier, not perfect/early/late-all-green: explicit user
              // feedback — an amber-with-an-X early/late note that was still
              // ALSO colored green read as "wait, is this one right or not?"
              // Pure green is reserved for an actual 'perfect' grade now;
              // early/late (still a counted hit, per gradeCounts/HitFeedback's
              // own perfect+early+late grouping — this is a display-only
              // distinction) gets the same amber showHitMarker's X already
              // uses, so a note is never both green AND marked with an X.
              const noteColor = grade
                ? grade === 'miss'
                  ? 'var(--color-danger-text)'
                  : grade === 'perfect'
                    ? 'var(--color-success-text)'
                    : 'var(--color-warning-text)'
                : isHighlighted
                  ? 'var(--color-warning-text)'
                  : undefined

              return (
                <g
                  key={eventIndex}
                  data-testid="notation-note"
                  data-instrument={event.instrument}
                  data-highlighted={isHighlighted}
                  data-grade={grade}
                  style={noteColor ? { color: noteColor } : undefined}
                >
                  {staff.ledger && (
                    <line
                      x1={x - NOTE_RADIUS_PX - 2}
                      x2={x + NOTE_RADIUS_PX + 2}
                      y1={y}
                      y2={y}
                      stroke="currentColor"
                      strokeWidth={1}
                    />
                  )}
                  {staff.notehead === 'normal' ? (
                    <circle cx={x} cy={y} r={NOTE_RADIUS_PX} fill="currentColor" />
                  ) : (
                    <>
                      <line
                        x1={x - NOTE_RADIUS_PX}
                        y1={y - NOTE_RADIUS_PX}
                        x2={x + NOTE_RADIUS_PX}
                        y2={y + NOTE_RADIUS_PX}
                        stroke="currentColor"
                        strokeWidth={1.1}
                      />
                      <line
                        x1={x - NOTE_RADIUS_PX}
                        y1={y + NOTE_RADIUS_PX}
                        x2={x + NOTE_RADIUS_PX}
                        y2={y - NOTE_RADIUS_PX}
                        stroke="currentColor"
                        strokeWidth={1.1}
                      />
                    </>
                  )}
                  {hasStem(event.instrument) && (
                    <>
                      <line
                        data-testid="notation-note-stem"
                        x1={stemX}
                        y1={y}
                        x2={stemX}
                        y2={stemEndY}
                        stroke="currentColor"
                        strokeWidth={1}
                      />
                      {!isBeamed &&
                        Array.from({ length: rowFlagCount }, (_, flagIndex) => {
                          // Mirrored for a down-stem: the flag hooks back up
                          // toward the notehead instead of down away from it.
                          const flagY = stemEndY + flagIndex * FLAG_GAP_PX * (direction === 'down' ? -1 : 1)
                          const curveSign = direction === 'down' ? -1 : 1
                          return (
                            <path
                              key={flagIndex}
                              data-testid="notation-note-flag"
                              d={`M${stemX},${flagY} C${stemX + 4},${flagY + 1 * curveSign} ${stemX + 4},${flagY + 5 * curveSign} ${stemX + 1},${flagY + 6 * curveSign}`}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={0.9}
                              strokeLinecap="round"
                            />
                          )
                        })}
                    </>
                  )}
                  {event.accent && (
                    <text
                      x={x}
                      y={hasStem(event.instrument) ? stemEndY + (direction === 'down' ? 10 : -6) : y - NOTE_RADIUS_PX - 6}
                      textAnchor="middle"
                      fontSize={11}
                      fill="currentColor"
                    >
                      &gt;
                    </text>
                  )}
                  {showHitMarker && (
                    <g data-testid="notation-hit-marker" style={{ color: 'var(--color-danger-text)' }}>
                      <line x1={hitX! - 3} y1={y - 3} x2={hitX! + 3} y2={y + 3} stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
                      <line x1={hitX! - 3} y1={y + 3} x2={hitX! + 3} y2={y - 3} stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
                    </g>
                  )}
                </g>
              )
            })}

            {beams.map((beam, beamIndex) => (
              <g key={beamIndex} data-testid="notation-beam" data-direction={beam.direction}>
                {Array.from({ length: rowFlagCount }, (_, lineIndex) => {
                  const lineY = beam.y + lineIndex * FLAG_GAP_PX * (beam.direction === 'down' ? -1 : 1)
                  return <line key={lineIndex} x1={beam.x1} x2={beam.x2} y1={lineY} y2={lineY} stroke="currentColor" strokeWidth={2} />
                })}
              </g>
            ))}
            {/* extraHits — no scheduled note to draw "beside", so this is
                its own marker at the hit's own instrument staff line (see
                extraHits' own doc comment). Same red-X glyph as the
                early/late showHitMarker above, for the same "here's exactly
                where an unmatched hit landed" meaning. */}
            {(extraHitsByRow.get(rowIndex) ?? []).map((hit) => {
              const y = toY(STAFF_POSITION[hit.instrument].position)
              return (
                <g key={hit.id} data-testid="notation-extra-hit-marker" style={{ color: 'var(--color-danger-text)' }}>
                  <line x1={hit.x - 3} y1={y - 3} x2={hit.x + 3} y2={y + 3} stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
                  <line x1={hit.x - 3} y1={y + 3} x2={hit.x + 3} y2={y - 3} stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
                </g>
              )
            })}
          </g>
        )
        })}
      </svg>
    </div>
  )
}
