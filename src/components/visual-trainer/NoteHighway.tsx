import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { calculateEventTimeMs } from '../../domain/calculations/event-timing'
import { calculateNoteProgress, isNoteVisible } from '../../lib/visual-trainer/note-highway-math'
import { LANE_ORDER, INSTRUMENT_COLORS } from '../../lib/visual-trainer/drum-kit-layout'
import { getKeyLabelForInstrument } from '../../lib/visual-trainer/keyboard-map'
import type { DrumKeyboardMap } from '../../lib/visual-trainer/keyboard-map'
import type { DrumNoteEvent, InteractiveExercise } from '../../domain'

export type NoteHitResult = 'hit' | 'miss'

export interface NoteHighwayHandle {
  render(currentTimeMs: number): void
  /** Flashes the note itself green (hit) or red (miss) — without this, a
   * hit/miss only shows up in the separate HitFeedback panel, which reads
   * as "pressing into thin air" since the falling note gives no reaction
   * of its own. */
  markResult(eventId: string, result: NoteHitResult): void
  /** Clears every hit/miss glow set by markResult. Event ids are stable
   * across a restart (same exercise, same DrumNoteEvent[]), so the same DOM
   * nodes get reused — without this, a note hit in a previous run keeps
   * glowing green on the next run even though nothing has been hit yet. */
  reset(): void
}

export interface NoteHighwayProps {
  events: DrumNoteEvent[]
  exercise: Pick<InteractiveExercise, 'bpm' | 'timeSignature' | 'subdivision'>
  lookaheadMs?: number
  /** Which key to label each note with — defaults to the standard mapping. */
  keyMap?: DrumKeyboardMap
}

const DEFAULT_LOOKAHEAD_MS = 2000
// A fixed pixel height (rather than measuring the container every frame,
// or animating a percentage-based `top` — §18 asks for transform-only
// animation, since it skips layout, unlike `top`) keeps the per-frame math
// a single multiplication with no DOM reads. A Stage 4 simplification —
// fine to make this responsive later.
const HIGHWAY_HEIGHT_PX = 480
const HIT_LINE_OFFSET_PX = 32
const NOTE_HEIGHT_PX = 48

/**
 * VISUAL_DRUM_TRAINER_SPEC.md §5/§18 — notes fall from the top toward a hit
 * line near the bottom. Driven imperatively: `render(currentTimeMs)` is
 * meant to be called every frame from a caller-owned requestAnimationFrame
 * loop and updates each note's `transform` directly via refs — never
 * `setState` per frame, per §18's explicit "no new React state every frame"
 * rule. Vertical orientation avoids any RTL/LTR ambiguity a horizontal
 * highway would raise in this Hebrew-RTL app.
 */
export const NoteHighway = forwardRef<NoteHighwayHandle, NoteHighwayProps>(function NoteHighway(
  { events, exercise, lookaheadMs = DEFAULT_LOOKAHEAD_MS, keyMap },
  ref,
) {
  const noteRefs = useRef(new Map<string, HTMLDivElement>())

  const eventTimes = useMemo(
    () => events.map((event) => ({ event, timeMs: calculateEventTimeMs(event, exercise) })),
    [events, exercise],
  )

  useImperativeHandle(
    ref,
    () => ({
      render(currentTimeMs: number) {
        for (const { event, timeMs } of eventTimes) {
          const el = noteRefs.current.get(event.id)
          if (!el) continue
          const progress = calculateNoteProgress(timeMs, currentTimeMs, lookaheadMs)
          if (!isNoteVisible(progress)) {
            el.style.visibility = 'hidden'
            continue
          }
          el.style.visibility = 'visible'
          el.style.transform = `translateY(${progress * (HIGHWAY_HEIGHT_PX - HIT_LINE_OFFSET_PX)}px)`
        }
      },
      markResult(eventId: string, result: NoteHitResult) {
        const el = noteRefs.current.get(eventId)
        if (!el) return
        el.style.boxShadow =
          result === 'hit' ? '0 0 0 3px #22c55e, 0 0 14px 3px #22c55e' : '0 0 0 3px #ef4444, 0 0 14px 3px #ef4444'
        el.style.opacity = result === 'miss' ? '0.55' : '1'
      },
      reset() {
        for (const el of noteRefs.current.values()) {
          el.style.boxShadow = 'none'
          el.style.opacity = '1'
        }
      },
    }),
    [eventTimes, lookaheadMs],
  )

  const laneCount = LANE_ORDER.length
  const laneIndex = useMemo(() => new Map(LANE_ORDER.map((instrument, index) => [instrument, index])), [])

  return (
    <div
      data-testid="note-highway"
      style={{ position: 'relative', height: HIGHWAY_HEIGHT_PX, overflow: 'hidden' }}
      className="w-full rounded-[var(--radius-card)] bg-[var(--color-surface)]"
    >
      <div
        data-testid="hit-line"
        style={{ position: 'absolute', bottom: HIT_LINE_OFFSET_PX, insetInline: 0, height: 2 }}
        className="bg-[var(--color-primary)]"
      />
      {eventTimes.map(({ event }) => {
        const lane = laneIndex.get(event.instrument) ?? 0
        const keyLabel = getKeyLabelForInstrument(event.instrument, keyMap)
        return (
          <div
            key={event.id}
            ref={(el) => {
              if (el) noteRefs.current.set(event.id, el)
              else noteRefs.current.delete(event.id)
            }}
            data-testid={`note-${event.id}`}
            data-instrument={event.instrument}
            style={{
              position: 'absolute',
              insetInlineStart: `${(lane / laneCount) * 100}%`,
              top: 0,
              width: `${100 / laneCount}%`,
              height: NOTE_HEIGHT_PX,
              borderRadius: 10,
              backgroundColor: INSTRUMENT_COLORS[event.instrument],
              visibility: 'hidden',
              willChange: 'transform',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'box-shadow 80ms ease-out, opacity 80ms ease-out',
            }}
          >
            {keyLabel && (
              <span
                aria-hidden="true"
                style={{ fontSize: 16, fontWeight: 700, color: '#111827', lineHeight: 1 }}
              >
                {keyLabel}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
})
