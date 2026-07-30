import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HitFeedback } from './HitFeedback'
import type { ScoringSummary } from '../../domain'

const SCORING: ScoringSummary = {
  accuracyPercent: 87.5,
  currentCombo: 3,
  bestCombo: 10,
  averageTimingErrorMs: 12.4,
}

describe('HitFeedback', () => {
  it('shows no grade badge when nothing has happened yet', () => {
    render(<HitFeedback lastGrade={undefined} scoring={SCORING} />)
    expect(screen.queryByText('מושלם!')).not.toBeInTheDocument()
    expect(screen.queryByText('פספוס')).not.toBeInTheDocument()
  })

  it('shows the Hebrew label for a perfect hit', () => {
    render(<HitFeedback lastGrade="perfect" scoring={SCORING} />)
    expect(screen.getByText('מושלם!')).toBeInTheDocument()
  })

  it('shows the Hebrew label for a miss', () => {
    render(<HitFeedback lastGrade="miss" scoring={SCORING} />)
    expect(screen.getByText('פספוס')).toBeInTheDocument()
  })

  it('shows the Hebrew label for an extra (unmatched) hit', () => {
    render(<HitFeedback lastGrade="extra" scoring={SCORING} />)
    expect(screen.getByText('הקשה שגויה')).toBeInTheDocument()
  })

  it('renders rounded accuracy, combo, and timing error stats', () => {
    render(<HitFeedback lastGrade={undefined} scoring={SCORING} />)
    expect(screen.getByText('88%')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('12ms')).toBeInTheDocument()
  })

  it('shows a placeholder when there is no timing error data yet', () => {
    render(<HitFeedback lastGrade={undefined} scoring={{ ...SCORING, averageTimingErrorMs: undefined }} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
