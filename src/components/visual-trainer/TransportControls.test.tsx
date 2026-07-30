import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TransportControls } from './TransportControls'
import type { InteractiveExercise } from '../../domain'

const EXERCISE: Pick<InteractiveExercise, 'title' | 'bpm' | 'timeSignature' | 'bars'> = {
  title: 'תרגיל בדיקה',
  bpm: 100,
  timeSignature: { numerator: 4, denominator: 4 },
  bars: 2,
}

function renderControls(overrides: Partial<Parameters<typeof TransportControls>[0]> = {}) {
  const handlers = {
    onStart: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onRestart: vi.fn(),
    onExit: vi.fn(),
  }
  render(
    <TransportControls
      exercise={EXERCISE}
      phase="idle"
      currentBar={1}
      {...handlers}
      {...overrides}
    />,
  )
  return handlers
}

describe('TransportControls', () => {
  it('shows only Start when idle', () => {
    renderControls({ phase: 'idle' })
    expect(screen.getByRole('button', { name: 'התחל' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'השהה' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'המשך' })).not.toBeInTheDocument()
  })

  it('shows Pause while running', () => {
    renderControls({ phase: 'running' })
    expect(screen.getByRole('button', { name: 'השהה' })).toBeInTheDocument()
  })

  it('shows Resume while paused', () => {
    renderControls({ phase: 'paused' })
    expect(screen.getByRole('button', { name: 'המשך' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'השהה' })).not.toBeInTheDocument()
  })

  it('calls the right handler for each button', async () => {
    const user = userEvent.setup()
    const handlers = renderControls({ phase: 'running' })

    await user.click(screen.getByRole('button', { name: 'השהה' }))
    expect(handlers.onPause).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'התחל מחדש' }))
    expect(handlers.onRestart).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'יציאה' }))
    expect(handlers.onExit).toHaveBeenCalledTimes(1)
  })

  it('displays exercise metadata and clamped bar number', () => {
    renderControls({ phase: 'running', currentBar: 5 })
    expect(screen.getByText(/100 BPM/)).toBeInTheDocument()
    expect(screen.getByText(/4\/4/)).toBeInTheDocument()
    expect(screen.getByText(/תיבה 2 מתוך 2/)).toBeInTheDocument()
  })
})
