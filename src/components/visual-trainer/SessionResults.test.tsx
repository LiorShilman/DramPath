import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionResults } from './SessionResults'
import type { DynamicsSummary, ScoringSummary } from '../../domain'
import type { GradeCounts } from '../../hooks/useVisualTrainer'

const SCORING: ScoringSummary = {
  accuracyPercent: 75,
  currentCombo: 0,
  bestCombo: 6,
  averageTimingErrorMs: 22,
}

const GRADE_COUNTS: GradeCounts = { perfect: 4, early: 1, late: 1, miss: 2, extra: 0 }
const NO_DYNAMICS: DynamicsSummary = { points: [] }

describe('SessionResults', () => {
  it('shows the exercise title and rounded stats', () => {
    render(
      <SessionResults
        exerciseTitle="מקצב Rock בסיסי"
        scoring={SCORING}
        gradeCounts={GRADE_COUNTS}
        dynamicsSummary={NO_DYNAMICS}
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
        dynamicsSummary={NO_DYNAMICS}
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
      <SessionResults
        exerciseTitle="x"
        scoring={SCORING}
        gradeCounts={GRADE_COUNTS}
        dynamicsSummary={NO_DYNAMICS}
        onRestart={onRestart}
        onExit={onExit}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'תרגול נוסף' }))
    expect(onRestart).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'חזרה לרשימת התרגילים' }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('shows no velocity-consistency chart when no hit carried real MIDI data', () => {
    render(
      <SessionResults
        exerciseTitle="x"
        scoring={SCORING}
        gradeCounts={GRADE_COUNTS}
        dynamicsSummary={NO_DYNAMICS}
        onRestart={vi.fn()}
        onExit={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('dynamics-chart')).not.toBeInTheDocument()
    expect(screen.queryByText('עקביות דינמיקה (עוצמת הקשה)')).not.toBeInTheDocument()
  })

  it('shows the velocity-consistency chart when at least one hit carried real MIDI data', () => {
    const dynamicsSummary: DynamicsSummary = {
      points: [
        { hitId: 'a', actualVelocity: 100, dynamicsGrade: undefined },
        { hitId: 'b', actualVelocity: 120, dynamicsGrade: 'correct' },
      ],
    }
    render(
      <SessionResults
        exerciseTitle="x"
        scoring={SCORING}
        gradeCounts={GRADE_COUNTS}
        dynamicsSummary={dynamicsSummary}
        onRestart={vi.fn()}
        onExit={vi.fn()}
      />,
    )
    expect(screen.getByTestId('dynamics-chart')).toBeInTheDocument()
    expect(screen.getByText('עקביות דינמיקה (עוצמת הקשה)')).toBeInTheDocument()
  })
})
