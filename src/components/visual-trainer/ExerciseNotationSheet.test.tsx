import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ExerciseNotationSheet } from './ExerciseNotationSheet'
import type { DrumNoteEvent } from '../../domain'

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
