import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LiveAccuracyMeter } from './LiveAccuracyMeter'

describe('LiveAccuracyMeter', () => {
  it('renders the rounded percent', () => {
    render(<LiveAccuracyMeter accuracyPercent={87.5} />)
    expect(screen.getByText('88%')).toBeInTheDocument()
  })

  it('clamps a value above 100 down to 100', () => {
    render(<LiveAccuracyMeter accuracyPercent={120} />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('clamps a negative value up to 0', () => {
    render(<LiveAccuracyMeter accuracyPercent={-10} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('exposes the live value on the accessible label, for the bar itself which has no visible text', () => {
    render(<LiveAccuracyMeter accuracyPercent={42} />)
    expect(screen.getByLabelText('דיוק חי: 42 אחוז')).toBeInTheDocument()
  })
})
