import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KeyboardGuide } from './KeyboardGuide'

describe('KeyboardGuide', () => {
  it('shows all 9 key-to-instrument mappings (fixed variant)', () => {
    render(<KeyboardGuide />)
    expect(screen.getByText('J')).toBeInTheDocument()
    expect(screen.getByText('בס דראם')).toBeInTheDocument()
    expect(screen.getByText('F')).toBeInTheDocument()
    expect(screen.getByText('סנר')).toBeInTheDocument()
    expect(screen.getByText('K')).toBeInTheDocument()
    expect(screen.getByText('טמטם רצפה')).toBeInTheDocument()
  })

  it('shows the same mappings in the inline variant, as a plain (non-fixed) card', () => {
    const { container } = render(<KeyboardGuide variant="inline" />)
    expect(screen.getByText('בס דראם')).toBeInTheDocument()
    expect(container.querySelector('.fixed')).toBeNull()
  })

  it('dims keys whose instrument is not in relevantInstruments, leaving the rest at full emphasis', () => {
    render(<KeyboardGuide variant="inline" relevantInstruments={new Set(['kick', 'snare'])} />)

    const kickKey = screen.getByText('J').closest('li')!
    const snareKey = screen.getByText('F').closest('li')!
    const crashKey = screen.getByText('E').closest('li')!

    expect(kickKey).not.toHaveClass('opacity-35')
    expect(snareKey).not.toHaveClass('opacity-35')
    expect(crashKey).toHaveClass('opacity-35')
  })

  it('lights up and plays the press animation on the key matching pressedInstruments', () => {
    render(<KeyboardGuide variant="inline" pressedInstruments={{ kick: 'token-a' }} />)

    const kickBadge = screen.getByText('J')
    const crashBadge = screen.getByText('E')

    expect(kickBadge).toHaveClass('pressed')
    expect(kickBadge).toHaveClass('bg-[var(--color-primary)]')
    expect(crashBadge).not.toHaveClass('pressed')
  })

  it('remounts the pressed key badge when a new token arrives, restarting the animation on repeated presses', () => {
    const { rerender } = render(<KeyboardGuide variant="inline" pressedInstruments={{ kick: 'first' }} />)
    const firstBadge = screen.getByText('J')

    rerender(<KeyboardGuide variant="inline" pressedInstruments={{ kick: 'second' }} />)
    const secondBadge = screen.getByText('J')

    expect(secondBadge).not.toBe(firstBadge)
    expect(secondBadge).toHaveClass('pressed')
  })
})
