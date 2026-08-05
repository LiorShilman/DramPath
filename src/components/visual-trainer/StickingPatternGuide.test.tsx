import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StickingPatternGuide } from './StickingPatternGuide'

describe('StickingPatternGuide', () => {
  it('always shows exactly one right-hand pad and one left-hand pad, regardless of subdivision', () => {
    render(<StickingPatternGuide subdivision="sixteenth" />)
    expect(screen.getAllByLabelText('ימין')).toHaveLength(1)
    expect(screen.getAllByLabelText('שמאל')).toHaveLength(1)
  })

  it('shows the full pattern as a static caption for quarters', () => {
    render(<StickingPatternGuide subdivision="quarter" />)
    expect(screen.getByTestId('sticking-pattern-caption')).toHaveTextContent('י')
  })

  it('shows the full pattern as a static caption for eighths (both right hand)', () => {
    render(<StickingPatternGuide subdivision="eighth" />)
    expect(screen.getByTestId('sticking-pattern-caption')).toHaveTextContent('י י')
  })

  it('shows the full pattern as a static caption for sixteenths (alternating)', () => {
    render(<StickingPatternGuide subdivision="sixteenth" />)
    expect(screen.getByTestId('sticking-pattern-caption')).toHaveTextContent('י ש י ש')
  })

  it('flashes neither pad when activeSubdivisionIndex is not provided', () => {
    render(<StickingPatternGuide subdivision="sixteenth" />)
    expect(document.querySelector('.sticking-pad-hit')).not.toBeInTheDocument()
  })

  it('flashes only the right pad for an eighth-note tick (both subdivisions are right hand)', () => {
    render(<StickingPatternGuide subdivision="eighth" activeSubdivisionIndex={1} activeTick={5} />)
    expect(screen.getByLabelText('ימין')).toHaveClass('sticking-pad-hit')
    expect(screen.getByLabelText('שמאל')).not.toHaveClass('sticking-pad-hit')
  })

  it('flashes the left pad on the second sixteenth-note subdivision (R L R L)', () => {
    render(<StickingPatternGuide subdivision="sixteenth" activeSubdivisionIndex={1} activeTick={5} />)
    expect(screen.getByLabelText('שמאל')).toHaveClass('sticking-pad-hit')
    expect(screen.getByLabelText('ימין')).not.toHaveClass('sticking-pad-hit')
  })
})
