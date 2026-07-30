import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionResults } from './SessionResults'
import type { ScoringSummary } from '../../domain'
import type { GradeCounts } from '../../hooks/useVisualTrainer'

const SCORING: ScoringSummary = {
  accuracyPercent: 75,
  currentCombo: 0,
  bestCombo: 6,
  averageTimingErrorMs: 22,
}

const GRADE_COUNTS: GradeCounts = { perfect: 4, early: 1, late: 1, miss: 2, extra: 0 }

describe('SessionResults', () => {
  it('shows the exercise title and rounded stats', () => {
    render(
      <SessionResults
        exerciseTitle="מקצב Rock בסיסי"
        scoring={SCORING}
        gradeCounts={GRADE_COUNTS}
        onRestart={vi.fn()}
        onExit={vi.fn()}
      />,
    )
    expect(screen.getByText(/מקצב Rock בסיסי/)).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('22ms')).toBeInTheDocument()
  })

  it('shows the grade breakdown counts', () => {
    render(
      <SessionResults
        exerciseTitle="x"
        scoring={SCORING}
        gradeCounts={GRADE_COUNTS}
        onRestart={vi.fn()}
        onExit={vi.fn()}
      />,
    )
    expect(screen.getByText('מושלם: 4')).toBeInTheDocument()
    expect(screen.getByText('פספוס: 2')).toBeInTheDocument()
  })

  it('calls onRestart and onExit', async () => {
    const onRestart = vi.fn()
    const onExit = vi.fn()
    const user = userEvent.setup()
    render(
      <SessionResults exerciseTitle="x" scoring={SCORING} gradeCounts={GRADE_COUNTS} onRestart={onRestart} onExit={onExit} />,
    )

    await user.click(screen.getByRole('button', { name: 'תרגול נוסף' }))
    expect(onRestart).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'חזרה לרשימת התרגילים' }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})
