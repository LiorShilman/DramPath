import { calculateBarDurationMs, calculateEventTimeMs } from '../../domain/calculations/event-timing'
import { STAFF_POSITION, staffPositionToOffsetPx } from '../../lib/visual-trainer/staff-notation-layout'
import type { InteractiveExercise, Subdivision } from '../../domain'

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
   * playback restarts the animation instead of no-oping on an unchanged style. */
  playbackProgress?: { bpm: number; sessionId: number }
}

const BARS_PER_ROW = 4
const BAR_WIDTH_PX = 200
const NOTE_INSET_PX = 20
const LINE_SPACING_PX = 8
const NOTE_RADIUS_PX = 3
const STEM_LENGTH_PX = 12
const FLAG_GAP_PX = 4
const BOTTOM_PADDING_PX = 6
const ROW_GAP_PX = 12
// The whole exercise shares one subdivision (no per-note duration yet), so
// every note gets the same flag count — reflecting the real note-duration
// shape (quarter/eighth/sixteenth), not just a plain circle.
const FLAG_COUNT: Record<Subdivision, number> = { quarter: 0, eighth: 1, sixteenth: 2 }
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
 * exercise's subdivision (quarter/eighth/sixteenth) — there's no per-note
 * duration yet, so this can't mix durations or beam consecutive notes,
 * only reflect the one subdivision the whole exercise shares. */
export function ExerciseNotationSheet({ exercise, highlightedEventIds, playbackProgress }: ExerciseNotationSheetProps) {
  const rowCount = Math.max(1, Math.ceil(exercise.bars / BARS_PER_ROW))
  // Only reserve vertical room up to the highest notehead actually used
  // (e.g. no crash in this exercise = no wasted headroom above the staff),
  // never less than the top staff line so the staff itself always shows in full.
  const highestPosition = exercise.events.reduce(
    (max, event) => Math.max(max, STAFF_POSITION[event.instrument].position),
    STAFF_TOP_LINE_POSITION,
  )
  const rowHeight = TOP_PADDING_PX + staffPositionToOffsetPx(highestPosition, LINE_SPACING_PX) + BOTTOM_PADDING_PX
  const totalHeight = rowCount * rowHeight + (rowCount - 1) * ROW_GAP_PX
  const barMs = barDurationMs(exercise)

  const eventsByRow: {
    id: string
    barIndexInRow: number
    fraction: number
    instrument: (typeof exercise.events)[number]['instrument']
    accent?: boolean
  }[][] = Array.from({ length: rowCount }, () => [])

  for (const event of exercise.events) {
    const barGlobalIndex = event.bar - 1
    const rowIndex = Math.floor(barGlobalIndex / BARS_PER_ROW)
    const barIndexInRow = barGlobalIndex % BARS_PER_ROW
    const totalBarPosition = calculateEventTimeMs(event, {
      bpm: ARBITRARY_BPM,
      timeSignature: exercise.timeSignature,
      subdivision: exercise.subdivision,
    }) / barMs
    const fraction = totalBarPosition - barGlobalIndex
    eventsByRow[rowIndex]?.push({ id: event.id, barIndexInRow, fraction, instrument: event.instrument, accent: event.accent })
  }

  // The viewBox must match the widest row actually drawn — row 0 always has
  // the most bars (later rows only ever have fewer, on the last row), so
  // sizing it any wider than that (e.g. always BARS_PER_ROW) leaves a blank
  // strip when the exercise is shorter than a full row.
  const viewBoxWidth = Math.min(BARS_PER_ROW, exercise.bars) * BAR_WIDTH_PX

  // Real-time (not ARBITRARY_BPM) duration of each row, and each row's own
  // start offset — lets every row's fill animation run purely in CSS, with
  // `animation-delay` doing the cross-row sequencing instead of JS polling.
  let cumulativeRealMs = 0
  const rowRealTimings = Array.from({ length: rowCount }, (_, rowIndex) => {
    const rowBars = Math.min(BARS_PER_ROW, exercise.bars - rowIndex * BARS_PER_ROW)
    const rowDurationMs = playbackProgress
      ? rowBars * calculateBarDurationMs(playbackProgress.bpm, exercise.timeSignature)
      : 0
    const startMs = cumulativeRealMs
    cumulativeRealMs += rowDurationMs
    return { startMs, durationMs: rowDurationMs }
  })

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${totalHeight}`}
      className="w-full text-[var(--color-text)]"
      role="img"
      aria-label="תווי התרגיל"
    >
      {eventsByRow.map((rowEvents, rowIndex) => {
        const rowBars = Math.min(BARS_PER_ROW, exercise.bars - rowIndex * BARS_PER_ROW)
        const rowTopY = rowIndex * (rowHeight + ROW_GAP_PX)
        const baselineY = rowTopY + rowHeight - BOTTOM_PADDING_PX
        const toY = (position: number) => baselineY - staffPositionToOffsetPx(position, LINE_SPACING_PX)
        const rowTiming = rowRealTimings[rowIndex]!

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

            {rowEvents.map((event, eventIndex) => {
              const staff = STAFF_POSITION[event.instrument]
              const x = event.barIndexInRow * BAR_WIDTH_PX + NOTE_INSET_PX + event.fraction * (BAR_WIDTH_PX - NOTE_INSET_PX)
              const y = toY(staff.position)
              const flagCount = FLAG_COUNT[exercise.subdivision]
              const stemX = x + NOTE_RADIUS_PX
              const stemTopY = y - NOTE_RADIUS_PX - STEM_LENGTH_PX
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
                  {staff.notehead === 'normal' && (
                    <>
                      <line
                        data-testid="notation-note-stem"
                        x1={stemX}
                        y1={y}
                        x2={stemX}
                        y2={stemTopY}
                        stroke="currentColor"
                        strokeWidth={1}
                      />
                      {Array.from({ length: flagCount }, (_, flagIndex) => {
                        const flagTopY = stemTopY + flagIndex * FLAG_GAP_PX
                        return (
                          <path
                            key={flagIndex}
                            data-testid="notation-note-flag"
                            d={`M${stemX},${flagTopY} C${stemX + 4},${flagTopY + 1} ${stemX + 4},${flagTopY + 5} ${stemX + 1},${flagTopY + 6}`}
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
                      y={(staff.notehead === 'normal' ? stemTopY : y - NOTE_RADIUS_PX) - 6}
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
          </g>
        )
      })}
    </svg>
  )
}
