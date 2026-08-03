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
      isDemo={false}
      currentBar={1}
      currentBeat={1}
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

  it('shows one beat dot per beat in the time signature, without highlighting any while idle', () => {
    renderControls({ phase: 'idle', currentBeat: 1 })
    const dots = screen.getByRole('img', { name: 'פעימות המטרונום' }).children
    expect(dots).toHaveLength(4)
    for (const dot of dots) expect(dot).toHaveClass('bg-[var(--color-border)]')
  })

  it('highlights only the current beat while running', () => {
    renderControls({ phase: 'running', currentBeat: 3 })
    const dots = screen.getByRole('img', { name: 'פעימות המטרונום' }).children
    expect(dots[2]).toHaveClass('bg-[var(--color-text)]')
    expect(dots[0]).toHaveClass('bg-[var(--color-border)]')
    expect(dots[1]).toHaveClass('bg-[var(--color-border)]')
    expect(dots[3]).toHaveClass('bg-[var(--color-border)]')
  })

  it('shows a demo badge only while a demo run is active', () => {
    renderControls({ phase: 'running', isDemo: true })
    expect(screen.getByText('מדגים')).toBeInTheDocument()
  })

  it('shows no demo badge for a real (non-demo) run', () => {
    renderControls({ phase: 'running', isDemo: false })
    expect(screen.queryByText('מדגים')).not.toBeInTheDocument()
  })

  it('shows no demo badge while idle, even if isDemo is true (leftover from a previous run)', () => {
    renderControls({ phase: 'idle', isDemo: true })
    expect(screen.queryByText('מדגים')).not.toBeInTheDocument()
  })
})
