import { SUBDIVISIONS_PER_BEAT, calculateBarDurationMs, calculateEventTimeMs } from '../../domain/calculations/event-timing'
import { STAFF_POSITION, staffPositionToOffsetPx } from '../../lib/visual-trainer/staff-notation-layout'
import type { DrumInstrument, InteractiveExercise, Subdivision } from '../../domain'

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
   * there since there's nothing else on the page competing for width. */
  barsPerRow?: number
}

const BARS_PER_ROW = 4
const BAR_WIDTH_PX = 200
const NOTE_INSET_PX = 20
const LINE_SPACING_PX = 8
const NOTE_RADIUS_PX = 3
const STEM_LENGTH_PX = 12
const FLAG_GAP_PX = 4
const BASE_BOTTOM_PADDING_PX = 6
const ROW_GAP_PX = 12
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
  beamCymbals = false,
  showBeatLabels = false,
  barsPerRow = BARS_PER_ROW,
}: ExerciseNotationSheetProps) {
  const hasStem = (instrument: (typeof exercise.events)[number]['instrument']) => {
    const notehead = STAFF_POSITION[instrument].notehead
    return notehead === 'normal' || (beamCymbals && notehead === 'x')
  }
  const rowCount = Math.max(1, Math.ceil(exercise.bars / barsPerRow))

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
    const rowIndex = Math.floor(barGlobalIndex / barsPerRow)
    const barIndexInRow = barGlobalIndex % barsPerRow
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

  // The viewBox must match the widest row actually drawn — row 0 always has
  // the most bars (later rows only ever have fewer, on the last row), so
  // sizing it any wider than that (e.g. always barsPerRow) leaves a blank
  // strip when the exercise is shorter than a full row.
  const viewBoxWidth = Math.min(barsPerRow, exercise.bars) * BAR_WIDTH_PX

  // Real-time (not ARBITRARY_BPM) duration of each row, and each row's own
  // start offset — lets every row's fill animation run purely in CSS, with
  // `animation-delay` doing the cross-row sequencing instead of JS polling.
  let cumulativeRealMs = 0
  const rowRealTimings = Array.from({ length: rowCount }, (_, rowIndex) => {
    const rowBars = Math.min(barsPerRow, exercise.bars - rowIndex * barsPerRow)
    const rowDurationMs = playbackProgress
      ? rowBars * calculateBarDurationMs(playbackProgress.bpm, exercise.timeSignature)
      : 0
    const absoluteStartMs = cumulativeRealMs
    cumulativeRealMs += rowDurationMs
    const startMs = absoluteStartMs - (playbackProgress?.startOffsetMs ?? 0)
    return { startMs, durationMs: rowDurationMs }
  })

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${totalHeight}`}
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
        const rowBars = Math.min(barsPerRow, exercise.bars - rowIndex * barsPerRow)
        const rowTopY = rowIndex * (rowHeight + ROW_GAP_PX)
        const baselineY = rowTopY + rowHeight - bottomPadding
        const toY = (position: number) => baselineY - staffPositionToOffsetPx(position, LINE_SPACING_PX)
        const rowTiming = rowRealTimings[rowIndex]!

        // x per note, needed by both the beam grouping below and the note
        // rendering loop further down.
        const noteX = new Map(
          rowEvents.map((event) => [
            event.id,
            event.barIndexInRow * BAR_WIDTH_PX + NOTE_INSET_PX + event.fraction * (BAR_WIDTH_PX - NOTE_INSET_PX),
          ]),
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

            for (const steps of byGroup.values()) {
              const sortedStepKeys = [...steps.keys()].sort((a, b) => a - b)
              let runStart = 0
              for (let i = 1; i <= sortedStepKeys.length; i += 1) {
                const runBroke = i === sortedStepKeys.length || sortedStepKeys[i]! !== sortedStepKeys[i - 1]! + 1
                if (!runBroke) continue
                const runStepKeys = sortedStepKeys.slice(runStart, i)
                if (runStepKeys.length >= 2) {
                  const firstStepEvents = steps.get(runStepKeys[0]!)!
                  const lastStepEvents = steps.get(runStepKeys[runStepKeys.length - 1]!)!
                  const stemXFor = (id: string) => noteX.get(id)! + (direction === 'down' ? -NOTE_RADIUS_PX : NOTE_RADIUS_PX)
                  beams.push({ x1: stemXFor(firstStepEvents[0]!.id), x2: stemXFor(lastStepEvents[0]!.id), y: beamY, direction })
                  for (const stepKey of runStepKeys) {
                    for (const beamedEvent of steps.get(stepKey)!) {
                      beamedEventIds.add(beamedEvent.id)
                      noteBeamY.set(beamedEvent.id, beamY)
                    }
                  }
                }
                runStart = i
              }
            }
          }
        }

        return (
          <g key={rowIndex} data-testid={`notation-row-${rowIndex}`}>
            {playbackProgress && rowTiming.durationMs > 0 && (
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
                      // Same x formula real notes use (noteX above): beat 1
                      // isn't at the bar's literal left edge, it's inset by
                      // NOTE_INSET_PX — matching that here is what keeps a
                      // label lined up under its actual note.
                      x={
                        barIndexInRow * BAR_WIDTH_PX +
                        NOTE_INSET_PX +
                        (beatIndex / exercise.timeSignature.numerator +
                          subdivisionIndex / (exercise.timeSignature.numerator * SUBDIVISIONS_PER_BEAT[exercise.subdivision])) *
                          (BAR_WIDTH_PX - NOTE_INSET_PX)
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
              // A beamed note's stem reaches the voice's shared beam height
              // (variable length) instead of the fixed individual-flag
              // length — that's what visually connects e.g. a low snare note
              // to a high hi-hat note sharing the same beam.
              const stemEndY =
                noteBeamY.get(event.id) ??
                (direction === 'down' ? y + NOTE_RADIUS_PX + STEM_LENGTH_PX : y - NOTE_RADIUS_PX - STEM_LENGTH_PX)
              const isHighlighted = highlightedEventIds?.has(event.id) ?? false

              return (
                <g
                  key={eventIndex}
                  data-testid="notation-note"
                  data-instrument={event.instrument}
                  data-highlighted={isHighlighted}
                  style={isHighlighted ? { color: 'var(--color-warning-text)' } : undefined}
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
          </g>
        )
      })}
    </svg>
  )
}
