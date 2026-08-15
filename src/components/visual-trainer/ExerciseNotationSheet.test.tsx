import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { ExerciseNotationSheet } from './ExerciseNotationSheet'
import type { DrumNoteEvent } from '../../domain'

// The live "coming up" hint polls a wall-clock (performance.now()) on a
// setInterval (see NEXT_UP_HINT_POLL_MS in ExerciseNotationSheet.tsx) —
// fake timers make both the interval and performance.now() itself
// deterministic, so a test can advance past a specific event's own real
// time without a real 200ms+ wait.
beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

function makeEvent(overrides: Partial<DrumNoteEvent>): DrumNoteEvent {
  return {
    id: crypto.randomUUID(),
    bar: 1,
    beat: 1,
    subdivisionIndex: 0,
    instrument: 'kick',
    velocity: 100,
    ...overrides,
  }
}

const EXERCISE = {
  timeSignature: { numerator: 4, denominator: 4 },
  subdivision: 'quarter' as const,
  bars: 1,
  events: [
    makeEvent({ instrument: 'kick', beat: 1 }),
    makeEvent({ instrument: 'snare', beat: 2 }),
    makeEvent({ instrument: 'crash', beat: 3, accent: true }),
    makeEvent({ instrument: 'hihat_closed', beat: 4 }),
  ],
}

describe('ExerciseNotationSheet', () => {
  it('renders one note per event', () => {
    const { container } = render(<ExerciseNotationSheet exercise={EXERCISE} />)
    expect(container.querySelectorAll('[data-testid="notation-note"]')).toHaveLength(4)
  })

  it('renders the 5 staff lines and 2 bar-lines for a single-bar exercise', () => {
    const { container } = render(<ExerciseNotationSheet exercise={EXERCISE} />)
    const row = container.querySelector('[data-testid="notation-row-0"]')!
    const lines = row.querySelectorAll(':scope > line')
    expect(lines).toHaveLength(5 + 2) // 5 staff lines + start/end bar-lines
  })

  it('renders one continuous cursor for the whole row (not one per bar), and a beat-1 note sits exactly at its own bar\'s left edge', () => {
    const twoBarExercise = {
      ...EXERCISE,
      bars: 2,
      events: [makeEvent({ instrument: 'kick', bar: 1, beat: 1 }), makeEvent({ instrument: 'kick', bar: 2, beat: 1 })],
    }
    const { container } = render(
      <ExerciseNotationSheet exercise={twoBarExercise} playbackProgress={{ bpm: 120, sessionId: 1 }} />,
    )
    // One continuous cursor for the row — a per-bar-jump version was tried
    // and reverted (gave downbeat notes zero visual lead-in, see
    // useVisualTrainer.ts's applyStaffCursorTimingBias comment history).
    expect(container.querySelectorAll('[data-testid="notation-row-0-cursor"]')).toHaveLength(1)
    // BAR_WIDTH_PX=200 (module-private layout constant) — bar 2's beat-1
    // note sits exactly at its own bar's left edge (1*200), matching where
    // a continuously-sweeping cursor reaches at that same real instant.
    const kickInBar2 = container.querySelectorAll('[data-testid="notation-row-0"] [data-instrument="kick"] circle')[1]!
    expect(Number(kickInBar2.getAttribute('cx'))).toBe(1 * 200)
  })

  it('draws the cursor as a plain thin filled line by default (no perfectWindowMs given)', () => {
    const { container } = render(<ExerciseNotationSheet exercise={EXERCISE} playbackProgress={{ bpm: 120, sessionId: 1 }} />)
    const cursor = container.querySelector('[data-testid="notation-row-0-cursor"]')!
    expect(cursor.getAttribute('width')).toBe('2')
    expect(cursor.getAttribute('fill')).toBe('var(--color-primary-text)')
    expect(cursor.getAttribute('stroke')).toBeNull()
  })

  it('draws the cursor as a hollow box sized to the real perfect-hit window when perfectWindowMs is given', () => {
    // Explicit user request, after reporting that judging "close enough"
    // against a fixed-size notehead was misleading — the box shows the
    // ACTUAL window a hit needs to land inside to grade 'perfect' (see
    // hit-matcher.ts), converted to pixels at the real tempo, instead of
    // an unrelated fixed dot size. 120bpm/4-4 = 2000ms/bar, BAR_WIDTH_PX=200
    // (module-private) — 0.1px/ms, so a 50ms window is ±5px (10px wide).
    const { container } = render(
      <ExerciseNotationSheet exercise={EXERCISE} playbackProgress={{ bpm: 120, sessionId: 1 }} perfectWindowMs={50} />,
    )
    const cursor = container.querySelector('[data-testid="notation-row-0-cursor"]')!
    expect(cursor.getAttribute('x')).toBe('-5')
    expect(cursor.getAttribute('width')).toBe('10')
    expect(cursor.getAttribute('fill')).toBe('none')
    expect(cursor.getAttribute('stroke')).toBe('var(--color-primary-text)')
  })

  it('gives row 0\'s cursor a count-in "runway" (starts left of x=0, arrives at x=0 exactly when the count-in ends) — explicit user request: bar 1\'s own first note used to have zero visual lead-in', () => {
    const { container } = render(
      // startOffsetMs mirrors VisualTrainerPage's own seekOffsetMs-minus-
      // countInDurationMs convention — a negative value here means "this
      // much count-in time before bar 1 truly begins" (500ms, at 120bpm/
      // 4-4 == a quarter of one 2000ms bar).
      <ExerciseNotationSheet exercise={EXERCISE} playbackProgress={{ bpm: 120, sessionId: 1, startOffsetMs: -500 }} />,
    )
    const cursor = container.querySelector('[data-testid="notation-row-0-cursor"]')! as SVGElement
    // 500ms of a 2000ms bar (120bpm/4-4) is a quarter of BAR_WIDTH_PX=200 —
    // the runway distance the cursor starts left of x=0.
    expect(cursor.style.getPropertyValue('--notation-cursor-start-x')).toBe('-50px')
    // Delay is fully absorbed into the runway's own motion (starts moving
    // immediately) rather than sitting motionless at x=0 for 500ms first.
    expect(cursor.style.animation).toContain('linear 0ms both')
  })

  it('caps the runway distance for a longer count-in, sitting still for the excess instead of reserving a whole extra bar of screen space', () => {
    const { container } = render(
      // A full 2000ms count-in bar (120bpm/4-4) is 4x the runway's own
      // 500ms time-equivalent (COUNT_IN_RUNWAY_PX = BAR_WIDTH_PX/4) —
      // explicit user report: an earlier, uncapped version reserved a
      // whole bar of runway regardless, reading as "a fifth of the screen"
      // on a phone.
      <ExerciseNotationSheet exercise={EXERCISE} playbackProgress={{ bpm: 120, sessionId: 1, startOffsetMs: -2000 }} />,
    )
    const cursor = container.querySelector('[data-testid="notation-row-0-cursor"]')! as SVGElement
    // Still capped at the same -50px runway, not -200px (a whole bar).
    expect(cursor.style.getPropertyValue('--notation-cursor-start-x')).toBe('-50px')
    // The excess (2000ms - 500ms runway = 1500ms) is a real animation-delay
    // — the cursor sits still at -50px for that long, THEN sweeps the
    // final 500ms/50px into bar 1's own first note, arriving exactly on time.
    expect(cursor.style.animation).toContain('linear 1500ms both')
  })

  it('also gives row 1+ a runway, borrowed from the tail of the row right before it — not just row 0\'s count-in', () => {
    const twoRowExercise = { ...EXERCISE, bars: 8 }
    const { container } = render(
      <ExerciseNotationSheet exercise={twoRowExercise} playbackProgress={{ bpm: 120, sessionId: 1 }} barsPerRow={4} />,
    )
    // Row 0 has no count-in here (startOffsetMs omitted) — no runway.
    const row0Cursor = container.querySelector('[data-testid="notation-row-0-cursor"]')! as SVGElement
    expect(row0Cursor.style.getPropertyValue('--notation-cursor-start-x')).toBe('')
    // Row 1 still gets one, borrowed from row 0's own tail end — the exact
    // same -50px runway row 0 itself would get from a count-in, capped the
    // same way, even though nothing here is "counting in".
    const row1Cursor = container.querySelector('[data-testid="notation-row-1-cursor"]')! as SVGElement
    expect(row1Cursor.style.getPropertyValue('--notation-cursor-start-x')).toBe('-50px')
  })

  it('shows no "coming up" hint by default (showNextUpHint off)', () => {
    const { container } = render(<ExerciseNotationSheet exercise={EXERCISE} />)
    expect(container.textContent).not.toContain('הבא:')
  })

  it('shows no hint without playbackProgress, even with showNextUpHint on — no live position to measure "next" against', () => {
    const { container } = render(<ExerciseNotationSheet exercise={EXERCISE} showNextUpHint />)
    expect(container.textContent).not.toContain('הבא:')
  })

  it('shows the live next instrument, updating as playback advances past earlier notes', () => {
    // Explicit user correction after an earlier per-row version: the hint
    // must track the actual next note in the performance as it plays, not a
    // static "next row's first note" computed once. bpm 60 in 4/4 quarters
    // = exactly 1000ms/beat, so event times are easy round numbers.
    const exercise = {
      ...EXERCISE,
      bars: 1,
      events: [
        makeEvent({ instrument: 'kick', beat: 1 }),
        makeEvent({ instrument: 'snare', beat: 2 }),
        makeEvent({ instrument: 'crash', beat: 3 }),
      ],
    }
    const { container } = render(
      <ExerciseNotationSheet exercise={exercise} showNextUpHint playbackProgress={{ bpm: 60, sessionId: 1, startOffsetMs: 0 }} />,
    )
    // First poll tick (200ms) — beat 1 (t=0) is already behind the live
    // clock by then, so "next" is the beat-2 snare (t=1000ms).
    act(() => vi.advanceTimersByTime(200))
    expect(container.textContent).toContain('הבא: סנר')
    // Advance past beat 2's own time — "next" becomes the beat-3 crash.
    act(() => vi.advanceTimersByTime(1000))
    expect(container.textContent).toContain('הבא: קראש')
  })

  it('adds an alternating hand hint for a single upcoming note, but never for a live chord (tie)', () => {
    const handsOnlyExercise = {
      ...EXERCISE,
      bars: 1,
      events: [
        makeEvent({ instrument: 'snare', beat: 1 }), // chronological index 0 -> right (already behind by the first poll tick)
        makeEvent({ instrument: 'snare', beat: 2 }), // index 1 -> left
        makeEvent({ instrument: 'snare', beat: 3 }),
        makeEvent({ instrument: 'hihat_closed', beat: 3 }), // simultaneous with the beat-3 snare -> tie, no hand guess
      ],
    }
    const { container } = render(
      <ExerciseNotationSheet
        exercise={handsOnlyExercise}
        showNextUpHint
        playbackProgress={{ bpm: 60, sessionId: 1, startOffsetMs: 0 }}
      />,
    )
    act(() => vi.advanceTimersByTime(200))
    expect(container.textContent).toContain('הבא: סנר (שמאל)')

    act(() => vi.advanceTimersByTime(1000)) // past beat 2 (t=1000ms) -> the beat-3 tie
    expect(container.textContent).toContain('הבא: סנר + היי-הט סגור')
    expect(container.textContent).not.toMatch(/\(ימין\)|\(שמאל\)/)
  })

  it('never adds a hand hint when the exercise uses a foot instrument anywhere, even for a live single-note "next"', () => {
    const exercise = { ...EXERCISE, bars: 1, events: [makeEvent({ instrument: 'kick', beat: 1 }), makeEvent({ instrument: 'snare', beat: 2 })] }
    const { container } = render(
      <ExerciseNotationSheet exercise={exercise} showNextUpHint playbackProgress={{ bpm: 60, sessionId: 1, startOffsetMs: 0 }} />,
    )
    act(() => vi.advanceTimersByTime(200))
    expect(container.textContent).toContain('הבא: סנר')
    expect(container.textContent).not.toMatch(/\(ימין\)|\(שמאל\)/)
  })

  it('freezes the live hint while paused, instead of continuing to advance', () => {
    const exercise = {
      ...EXERCISE,
      bars: 1,
      events: [
        makeEvent({ instrument: 'kick', beat: 1 }),
        makeEvent({ instrument: 'snare', beat: 2 }),
        makeEvent({ instrument: 'crash', beat: 3 }),
      ],
    }
    const { container, rerender } = render(
      <ExerciseNotationSheet exercise={exercise} showNextUpHint playbackProgress={{ bpm: 60, sessionId: 1, startOffsetMs: 0 }} />,
    )
    act(() => vi.advanceTimersByTime(200))
    expect(container.textContent).toContain('הבא: סנר')

    rerender(
      <ExerciseNotationSheet exercise={exercise} showNextUpHint playbackProgress={{ bpm: 60, sessionId: 1, startOffsetMs: 0 }} paused />,
    )
    act(() => vi.advanceTimersByTime(2000)) // well past the crash's own time (t=2000ms), if it were still running
    expect(container.textContent).toContain('הבא: סנר')
  })

  it('shows one instrument at a time, not concatenated, even for a pattern that repeats the same beat every bar', () => {
    const eightBarExercise = {
      ...EXERCISE,
      bars: 8,
      events: [1, 2, 3, 4, 5, 6, 7, 8].map((bar) => makeEvent({ instrument: 'snare', bar, beat: 1 })),
    }
    const { container } = render(
      <ExerciseNotationSheet exercise={eightBarExercise} showNextUpHint playbackProgress={{ bpm: 60, sessionId: 1, startOffsetMs: 0 }} />,
    )
    act(() => vi.advanceTimersByTime(200))
    expect(container.textContent).toContain('הבא: סנר')
    expect(container.textContent).not.toContain('הבא: סנר + סנר')
  })

  it('shows no hint once every event has passed (nothing left to come up)', () => {
    const exercise = { ...EXERCISE, bars: 1, events: [makeEvent({ instrument: 'kick', beat: 1 })] }
    const { container } = render(
      <ExerciseNotationSheet exercise={exercise} showNextUpHint playbackProgress={{ bpm: 60, sessionId: 1, startOffsetMs: 0 }} />,
    )
    act(() => vi.advanceTimersByTime(200))
    expect(container.textContent).not.toContain('הבא:')
  })

  it('does not give a mid-exercise seek (no count-in) a runway', () => {
    const { container } = render(
      // A seek's startOffsetMs is positive (how far INTO the piece it
      // starts), never the negative count-in convention above.
      <ExerciseNotationSheet exercise={EXERCISE} playbackProgress={{ bpm: 120, sessionId: 1, startOffsetMs: 300 }} />,
    )
    const cursor = container.querySelector('[data-testid="notation-row-0-cursor"]')! as SVGElement
    expect(cursor.style.getPropertyValue('--notation-cursor-start-x')).toBe('')
  })

  it('draws a hit-position marker (X) for a hit graded early or late', () => {
    const exercise = { ...EXERCISE, bars: 1 }
    const kickEventId = exercise.events[0]!.id // beat 1 kick
    const { container } = render(
      <ExerciseNotationSheet
        exercise={exercise}
        playbackProgress={{ bpm: 120, sessionId: 1 }}
        gradedEventIds={new Map([[kickEventId, 'late']])}
        hitTimingByEventId={new Map([[kickEventId, 100]])}
      />,
    )
    expect(container.querySelectorAll('[data-testid="notation-hit-marker"]')).toHaveLength(1)
  })

  it('colors perfect green, early/late amber, and miss red — never green with an X on it', () => {
    const exercise = {
      ...EXERCISE,
      bars: 1,
      events: [
        makeEvent({ instrument: 'kick', beat: 1 }),
        makeEvent({ instrument: 'snare', beat: 2 }),
        makeEvent({ instrument: 'crash', beat: 3 }),
        makeEvent({ instrument: 'hihat_closed', beat: 4 }),
      ],
    }
    const [perfectId, earlyId, lateId, missId] = exercise.events.map((event) => event.id) as [string, string, string, string]
    const { container } = render(
      <ExerciseNotationSheet
        exercise={exercise}
        gradedEventIds={
          new Map([
            [perfectId, 'perfect'],
            [earlyId, 'early'],
            [lateId, 'late'],
            [missId, 'miss'],
          ])
        }
      />,
    )
    const notes = container.querySelectorAll('[data-testid="notation-note"]')
    const byGrade = (grade: string) => [...notes].find((note) => note.getAttribute('data-grade') === grade)! as HTMLElement
    expect(byGrade('perfect').style.color).toBe('var(--color-success-text)')
    expect(byGrade('early').style.color).toBe('var(--color-warning-text)')
    expect(byGrade('late').style.color).toBe('var(--color-warning-text)')
    expect(byGrade('miss').style.color).toBe('var(--color-danger-text)')
  })

  it('draws no hit-position marker for a hit graded perfect (already-green noise, per direct user feedback)', () => {
    const exercise = { ...EXERCISE, bars: 1 }
    const kickEventId = exercise.events[0]!.id
    const { container } = render(
      <ExerciseNotationSheet
        exercise={exercise}
        playbackProgress={{ bpm: 120, sessionId: 1 }}
        gradedEventIds={new Map([[kickEventId, 'perfect']])}
        hitTimingByEventId={new Map([[kickEventId, 2]])}
      />,
    )
    expect(container.querySelectorAll('[data-testid="notation-hit-marker"]')).toHaveLength(0)
  })

  it('draws no hit-position marker for an event without one', () => {
    const { container } = render(
      <ExerciseNotationSheet exercise={EXERCISE} playbackProgress={{ bpm: 120, sessionId: 1 }} />,
    )
    expect(container.querySelectorAll('[data-testid="notation-hit-marker"]')).toHaveLength(0)
  })

  it('draws a marker for an extra (unmatched) hit, at its own instrument\'s staff line', () => {
    // Explicit user request: an "extra hit" already counts against accuracy
    // in the results — an all-green sheet showing nothing wrong for it read
    // as a mismatch between the numbers and what's on screen.
    const exercise = { ...EXERCISE, bars: 1 }
    const { container } = render(
      <ExerciseNotationSheet
        exercise={exercise}
        playbackProgress={{ bpm: 120, sessionId: 1 }}
        extraHits={[{ id: 'extra-1', instrument: 'crash', hitTimeMs: 1500 }]}
      />,
    )
    expect(container.querySelectorAll('[data-testid="notation-extra-hit-marker"]')).toHaveLength(1)
  })

  it('draws no extra-hit marker without playbackProgress (no real clock to place it against)', () => {
    const exercise = { ...EXERCISE, bars: 1 }
    const { container } = render(
      <ExerciseNotationSheet exercise={exercise} extraHits={[{ id: 'extra-1', instrument: 'crash', hitTimeMs: 1500 }]} />,
    )
    expect(container.querySelectorAll('[data-testid="notation-extra-hit-marker"]')).toHaveLength(0)
  })

  it('wraps an extra hit from a later loop back onto the single rendered loop', () => {
    // loopCount > 1 means a real run can produce a hit at an elapsed time
    // past the sheet's own single-loop bar count — it still needs to land
    // somewhere on screen instead of vanishing.
    const exercise = { ...EXERCISE, bars: 1 }
    // 1 bar at 120bpm 4/4 = 2000ms/bar — 2500ms is 500ms into loop 2's own bar 1.
    const { container } = render(
      <ExerciseNotationSheet
        exercise={exercise}
        playbackProgress={{ bpm: 120, sessionId: 1 }}
        extraHits={[{ id: 'extra-1', instrument: 'crash', hitTimeMs: 2500 }]}
      />,
    )
    expect(container.querySelectorAll('[data-testid="notation-extra-hit-marker"]')).toHaveLength(1)
  })

  it('positions kick with a filled circle notehead, low on the staff', () => {
    const { container } = render(<ExerciseNotationSheet exercise={EXERCISE} />)
    const kick = container.querySelector('[data-instrument="kick"]')!
    const circle = kick.querySelector('circle')!
    expect(circle).toBeTruthy()
    expect(Number(circle.getAttribute('cy'))).toBe(56) // baseline(60) - position(1)*4
  })

  it('positions snare higher than kick (both filled noteheads)', () => {
    const { container } = render(<ExerciseNotationSheet exercise={EXERCISE} />)
    const kickY = Number(container.querySelector('[data-instrument="kick"] circle')!.getAttribute('cy'))
    const snareY = Number(container.querySelector('[data-instrument="snare"] circle')!.getAttribute('cy'))
    expect(snareY).toBeLessThan(kickY) // lower cy = higher on the page (SVG y grows downward)
  })

  it('renders crash and hihat as X noteheads (two crossed lines, no circle)', () => {
    const { container } = render(<ExerciseNotationSheet exercise={EXERCISE} />)
    const crash = container.querySelector('[data-instrument="crash"]')!
    const hihat = container.querySelector('[data-instrument="hihat_closed"]')!
    expect(crash.querySelector('circle')).toBeNull()
    expect(crash.querySelectorAll('line')).toHaveLength(3) // ledger + 2 crossed lines, no stem
    expect(hihat.querySelector('circle')).toBeNull()
    expect(hihat.querySelectorAll('line')).toHaveLength(2) // 2 crossed lines, no ledger, no stem

    // Crash sits at the same height as hihat — the ledger line (the first of
    // crash's 3 lines) is the only thing that distinguishes them, so its
    // crossing point should match hihat's crossing point, not sit higher.
    const crashLedgerY = Number(crash.querySelector('line')!.getAttribute('y1'))
    const hihatLines = hihat.querySelectorAll('line')
    const hihatY = (Number(hihatLines[0]!.getAttribute('y1')) + Number(hihatLines[0]!.getAttribute('y2'))) / 2
    expect(crashLedgerY).toBe(hihatY)
  })

  it('renders an accent mark only on the accented event', () => {
    const { container } = render(<ExerciseNotationSheet exercise={EXERCISE} />)
    expect(container.querySelector('[data-instrument="crash"] text')?.textContent).toBe('>')
    expect(container.querySelector('[data-instrument="kick"] text')).toBeNull()
  })

  it('marks only the highlighted event id, leaving the rest un-highlighted', () => {
    const { container } = render(
      <ExerciseNotationSheet exercise={EXERCISE} highlightedEventIds={new Set([EXERCISE.events[0]!.id])} />,
    )
    expect(container.querySelector('[data-instrument="kick"]')).toHaveAttribute('data-highlighted', 'true')
    expect(container.querySelector('[data-instrument="snare"]')).toHaveAttribute('data-highlighted', 'false')
  })

  it('gives every note a stem, with a flag count matching the exercise subdivision', () => {
    const { container: quarterContainer } = render(<ExerciseNotationSheet exercise={{ ...EXERCISE, subdivision: 'quarter' }} />)
    expect(quarterContainer.querySelector('[data-instrument="kick"] [data-testid="notation-note-stem"]')).toBeTruthy()
    expect(quarterContainer.querySelectorAll('[data-instrument="kick"] [data-testid="notation-note-flag"]')).toHaveLength(0)

    const { container: eighthContainer } = render(<ExerciseNotationSheet exercise={{ ...EXERCISE, subdivision: 'eighth' }} />)
    expect(eighthContainer.querySelectorAll('[data-instrument="kick"] [data-testid="notation-note-flag"]')).toHaveLength(1)

    const { container: sixteenthContainer } = render(<ExerciseNotationSheet exercise={{ ...EXERCISE, subdivision: 'sixteenth' }} />)
    expect(sixteenthContainer.querySelectorAll('[data-instrument="kick"] [data-testid="notation-note-flag"]')).toHaveLength(2)
  })

  it('stems the kick (foot voice) down and every other instrument (hand voices) up', () => {
    const { container } = render(<ExerciseNotationSheet exercise={{ ...EXERCISE, subdivision: 'eighth' }} />)
    const kickNote = container.querySelector('[data-instrument="kick"]')!
    const kickCircle = kickNote.querySelector('circle')!
    const kickStem = kickNote.querySelector('[data-testid="notation-note-stem"]')!
    const kickY = Number(kickCircle.getAttribute('cy'))
    // A down-stem extends below the notehead (larger y, SVG grows downward);
    // an up-stem (snare) extends above it (smaller y).
    expect(Number(kickStem.getAttribute('y2'))).toBeGreaterThan(kickY)

    const snareNote = container.querySelector('[data-instrument="snare"]')!
    const snareCircle = snareNote.querySelector('circle')!
    const snareStem = snareNote.querySelector('[data-testid="notation-note-stem"]')!
    const snareY = Number(snareCircle.getAttribute('cy'))
    expect(Number(snareStem.getAttribute('y2'))).toBeLessThan(snareY)
  })

  it('beams two adjacent same-instrument eighth notes instead of giving each an individual flag', () => {
    const exercise = {
      ...EXERCISE,
      subdivision: 'eighth' as const,
      events: [
        makeEvent({ instrument: 'kick', beat: 1, subdivisionIndex: 0 }),
        makeEvent({ instrument: 'kick', beat: 1, subdivisionIndex: 1 }),
      ],
    }
    const { container } = render(<ExerciseNotationSheet exercise={exercise} />)
    expect(container.querySelectorAll('[data-testid="notation-note-flag"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-testid="notation-beam"]')).toHaveLength(1)
    // Both stems still render — a beam connects them, it doesn't replace them.
    expect(container.querySelectorAll('[data-testid="notation-note-stem"]')).toHaveLength(2)
  })

  it('beams a full half-bar run of eighth notes (beats 1&2) as one group, separate from beats 3&4', () => {
    const exercise = {
      ...EXERCISE,
      subdivision: 'eighth' as const,
      events: [1, 2, 3, 4].flatMap((beat) => [
        makeEvent({ instrument: 'kick', beat, subdivisionIndex: 0 }),
        makeEvent({ instrument: 'kick', beat, subdivisionIndex: 1 }),
      ]),
    }
    const { container } = render(<ExerciseNotationSheet exercise={exercise} />)
    // 8 consecutive kick eighth notes -> two half-bar beam groups (1-2, 3-4), no stray flags.
    expect(container.querySelectorAll('[data-testid="notation-beam"]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-testid="notation-note-flag"]')).toHaveLength(0)
  })

  it('does not beam kick with an adjacent snare — different voices (feet vs. hands), each isolated in its own', () => {
    const exercise = {
      ...EXERCISE,
      subdivision: 'eighth' as const,
      events: [
        makeEvent({ instrument: 'kick', beat: 1, subdivisionIndex: 0 }),
        makeEvent({ instrument: 'snare', beat: 1, subdivisionIndex: 1 }),
      ],
    }
    const { container } = render(<ExerciseNotationSheet exercise={exercise} />)
    expect(container.querySelectorAll('[data-testid="notation-beam"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-testid="notation-note-flag"]')).toHaveLength(2)
  })

  it('beams two adjacent DIFFERENT hands-voice instruments together (composite voice rhythm), each keeping its own staff position', () => {
    const exercise = {
      ...EXERCISE,
      subdivision: 'eighth' as const,
      events: [
        makeEvent({ instrument: 'hihat_closed', beat: 1, subdivisionIndex: 0 }),
        makeEvent({ instrument: 'snare', beat: 1, subdivisionIndex: 1 }),
      ],
    }
    const { container } = render(<ExerciseNotationSheet exercise={exercise} beamCymbals />)
    // One shared beam connects them, despite being different instruments.
    expect(container.querySelectorAll('[data-testid="notation-beam"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-testid="notation-note-flag"]')).toHaveLength(0)

    // Each note's stem still starts (y1) at its own instrument's staff
    // position — the beam doesn't move the noteheads, only extends each
    // one's stem length to reach the shared beam.
    const hihatStem = container.querySelector('[data-instrument="hihat_closed"] [data-testid="notation-note-stem"]')!
    const snareStem = container.querySelector('[data-instrument="snare"] [data-testid="notation-note-stem"]')!
    expect(hihatStem.getAttribute('y1')).not.toBe(snareStem.getAttribute('y1'))

    // But both stems reach the exact same shared beam height (the whole point).
    expect(hihatStem.getAttribute('y2')).toBe(snareStem.getAttribute('y2'))
  })

  it('does not beam cymbal (X notehead) instruments, which have no stem to beam from', () => {
    const exercise = {
      ...EXERCISE,
      subdivision: 'eighth' as const,
      events: [
        makeEvent({ instrument: 'crash', beat: 1, subdivisionIndex: 0 }),
        makeEvent({ instrument: 'crash', beat: 1, subdivisionIndex: 1 }),
      ],
    }
    const { container } = render(<ExerciseNotationSheet exercise={exercise} />)
    expect(container.querySelectorAll('[data-testid="notation-beam"]')).toHaveLength(0)
  })

  it('beams cymbals too when beamCymbals is on, giving them a stem to connect', () => {
    const exercise = {
      ...EXERCISE,
      subdivision: 'eighth' as const,
      events: [
        makeEvent({ instrument: 'crash', beat: 1, subdivisionIndex: 0 }),
        makeEvent({ instrument: 'crash', beat: 1, subdivisionIndex: 1 }),
      ],
    }
    const { container } = render(<ExerciseNotationSheet exercise={exercise} beamCymbals />)
    expect(container.querySelectorAll('[data-instrument="crash"] [data-testid="notation-note-stem"]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-testid="notation-beam"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-testid="notation-note-flag"]')).toHaveLength(0)
  })

  it('wraps to a second row when bars exceed the per-row limit', () => {
    const longExercise = {
      ...EXERCISE,
      bars: 5,
      events: [makeEvent({ instrument: 'kick', bar: 5, beat: 1 })],
    }
    const { container } = render(<ExerciseNotationSheet exercise={longExercise} />)
    expect(container.querySelectorAll('[data-testid^="notation-row-"]')).toHaveLength(2)
    expect(container.querySelector('[data-testid="notation-row-1"] [data-instrument="kick"]')).toBeTruthy()
  })

  it('wraps sooner with a smaller barsPerRow, so each bar renders wider (bigger notes)', () => {
    const fourBarExercise = {
      ...EXERCISE,
      bars: 4,
      events: [makeEvent({ instrument: 'kick', bar: 3, beat: 1 })],
    }
    const { container: defaultContainer } = render(<ExerciseNotationSheet exercise={fourBarExercise} />)
    expect(defaultContainer.querySelectorAll('[data-testid^="notation-row-"]')).toHaveLength(1)

    const { container: narrowContainer } = render(<ExerciseNotationSheet exercise={fourBarExercise} barsPerRow={2} />)
    // 4 bars at 2 bars/row = 2 rows, and the row-1 bar-3 kick lands in the
    // now-earlier second row instead of still fitting in row 0.
    expect(narrowContainer.querySelectorAll('[data-testid^="notation-row-"]')).toHaveLength(2)
    expect(narrowContainer.querySelector('[data-testid="notation-row-1"] [data-instrument="kick"]')).toBeTruthy()
  })

  it('renders no beat labels by default', () => {
    const { container } = render(<ExerciseNotationSheet exercise={EXERCISE} />)
    expect(container.querySelectorAll('[data-testid="notation-beat-label"]')).toHaveLength(0)
  })

  it('renders one numbered beat label per beat per bar for quarter subdivision when showBeatLabels is on', () => {
    const twoBarExercise = {
      ...EXERCISE,
      bars: 2,
      events: [makeEvent({ instrument: 'kick', bar: 1, beat: 1 }), makeEvent({ instrument: 'snare', bar: 2, beat: 3 })],
    }
    const { container } = render(<ExerciseNotationSheet exercise={twoBarExercise} showBeatLabels />)
    const labels = container.querySelectorAll('[data-testid="notation-beat-label"]')
    // 4 beats (numerator) per bar x 2 bars, 1 subdivision per beat (quarter)
    expect(labels).toHaveLength(8)
    expect(Array.from(labels).map((label) => label.textContent)).toEqual(['1', '2', '3', '4', '1', '2', '3', '4'])
  })

  it('labels every off-beat slot too for eighth subdivision, using "&" count-out syllables', () => {
    const eighthExercise = {
      ...EXERCISE,
      subdivision: 'eighth' as const,
      bars: 1,
      events: [makeEvent({ instrument: 'kick', beat: 1, subdivisionIndex: 0 })],
    }
    const { container } = render(<ExerciseNotationSheet exercise={eighthExercise} showBeatLabels />)
    const labels = container.querySelectorAll('[data-testid="notation-beat-label"]')
    // 4 beats x 2 subdivisions per beat (eighth) = 8 labels for a single bar
    // — matches the 8 x-noteheads a fully-filled eighth-note hihat pattern
    // would show, unlike the old "4 labels under 8 notes" mismatch.
    expect(labels).toHaveLength(8)
    expect(Array.from(labels).map((label) => label.textContent)).toEqual(['1', '&', '2', '&', '3', '&', '4', '&'])
  })

  it('labels every off-beat slot for sixteenth subdivision with 1-e-&-a count-out syllables', () => {
    const sixteenthExercise = {
      ...EXERCISE,
      subdivision: 'sixteenth' as const,
      bars: 1,
      events: [makeEvent({ instrument: 'kick', beat: 1, subdivisionIndex: 0 })],
    }
    const { container } = render(<ExerciseNotationSheet exercise={sixteenthExercise} showBeatLabels />)
    const labels = container.querySelectorAll('[data-testid="notation-beat-label"]')
    expect(labels).toHaveLength(16)
    expect(Array.from(labels).map((label) => label.textContent)).toEqual([
      '1', 'e', '&', 'a',
      '2', 'e', '&', 'a',
      '3', 'e', '&', 'a',
      '4', 'e', '&', 'a',
    ])
  })

  it('lines a beat label up under its own note (same x as beat 1\'s note)', () => {
    const { container } = render(<ExerciseNotationSheet exercise={EXERCISE} showBeatLabels />)
    const kickX = Number(container.querySelector('[data-instrument="kick"] circle')!.getAttribute('cx'))
    const beat1LabelX = Number(container.querySelector('[data-testid="notation-beat-label"]')!.getAttribute('x'))
    expect(beat1LabelX).toBeCloseTo(kickX)
  })
})
