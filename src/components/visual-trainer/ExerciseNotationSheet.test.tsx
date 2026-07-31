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
    expect(Number(circle.getAttribute('cy'))).toBe(106) // baseline(114) - position(1)*8
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

  it('gives every note a stem, with a flag count matching the exercise subdivision', () => {
    const { container: quarterContainer } = render(<ExerciseNotationSheet exercise={{ ...EXERCISE, subdivision: 'quarter' }} />)
    expect(quarterContainer.querySelector('[data-instrument="kick"] [data-testid="notation-note-stem"]')).toBeTruthy()
    expect(quarterContainer.querySelectorAll('[data-instrument="kick"] [data-testid="notation-note-flag"]')).toHaveLength(0)

    const { container: eighthContainer } = render(<ExerciseNotationSheet exercise={{ ...EXERCISE, subdivision: 'eighth' }} />)
    expect(eighthContainer.querySelectorAll('[data-instrument="kick"] [data-testid="notation-note-flag"]')).toHaveLength(1)

    const { container: sixteenthContainer } = render(<ExerciseNotationSheet exercise={{ ...EXERCISE, subdivision: 'sixteenth' }} />)
    expect(sixteenthContainer.querySelectorAll('[data-instrument="kick"] [data-testid="notation-note-flag"]')).toHaveLength(2)
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
})
