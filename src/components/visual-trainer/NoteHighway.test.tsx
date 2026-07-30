import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { createId } from '../../domain'
import { NoteHighway } from './NoteHighway'
import type { NoteHighwayHandle } from './NoteHighway'
import type { DrumNoteEvent, InteractiveExercise } from '../../domain'

const EXERCISE: Pick<InteractiveExercise, 'bpm' | 'timeSignature' | 'subdivision'> = {
  bpm: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  subdivision: 'quarter',
}

function makeEvent(overrides: Partial<DrumNoteEvent> = {}): DrumNoteEvent {
  return {
    id: createId(),
    bar: 2,
    beat: 1,
    subdivisionIndex: 0,
    instrument: 'kick',
    velocity: 100,
    ...overrides,
  }
}

describe('NoteHighway', () => {
  it('hides a note before it enters the lookahead window', () => {
    const event = makeEvent()
    const ref = createRef<NoteHighwayHandle>()
    const { getByTestId } = render(
      <NoteHighway ref={ref} events={[event]} exercise={EXERCISE} lookaheadMs={2000} />,
    )

    // bar 2/beat 1 @120bpm/4-4 = 2000ms; well before the 2000ms lookahead window
    ref.current!.render(-1000)
    expect(getByTestId(`note-${event.id}`)).toHaveStyle({ visibility: 'hidden' })
  })

  it('shows a note at the top of the highway when it enters the lookahead window', () => {
    const event = makeEvent()
    const ref = createRef<NoteHighwayHandle>()
    const { getByTestId } = render(
      <NoteHighway ref={ref} events={[event]} exercise={EXERCISE} lookaheadMs={2000} />,
    )

    ref.current!.render(0) // eventTimeMs (2000) - lookaheadMs (2000) = 0
    const note = getByTestId(`note-${event.id}`)
    expect(note).toHaveStyle({ visibility: 'visible', transform: 'translateY(0px)' })
  })

  it('positions a note at the hit line offset when it is due', () => {
    const event = makeEvent()
    const ref = createRef<NoteHighwayHandle>()
    const { getByTestId } = render(
      <NoteHighway ref={ref} events={[event]} exercise={EXERCISE} lookaheadMs={2000} />,
    )

    ref.current!.render(2000) // exactly at the event's own time
    expect(getByTestId(`note-${event.id}`)).toHaveStyle({ visibility: 'visible', transform: 'translateY(368px)' })
  })

  it('hides a note well after it has passed the hit line', () => {
    const event = makeEvent()
    const ref = createRef<NoteHighwayHandle>()
    const { getByTestId } = render(
      <NoteHighway ref={ref} events={[event]} exercise={EXERCISE} lookaheadMs={2000} />,
    )

    ref.current!.render(2000 + 2000 * 2) // way past the hit line
    expect(getByTestId(`note-${event.id}`)).toHaveStyle({ visibility: 'hidden' })
  })

  it('renders each event with its instrument on the note element', () => {
    const event = makeEvent({ instrument: 'snare' })
    const { getByTestId } = render(<NoteHighway events={[event]} exercise={EXERCISE} />)
    expect(getByTestId(`note-${event.id}`)).toHaveAttribute('data-instrument', 'snare')
  })
})
