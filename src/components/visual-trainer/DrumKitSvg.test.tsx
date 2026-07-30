import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { DrumKitSvg } from './DrumKitSvg'

describe('DrumKitSvg', () => {
  it('renders all 8 visual pieces with no hit class when idle', () => {
    const { container } = render(<DrumKitSvg />)
    const pieces = ['kick', 'snare', 'hihat', 'ride', 'crash', 'tom_high', 'tom_mid', 'tom_floor']
    for (const piece of pieces) {
      const el = container.querySelector(`[data-instrument="${piece}"]`)
      expect(el).toBeInTheDocument()
      expect(el).not.toHaveClass('hit')
    }
  })

  it('applies the hit class to the kick piece on a kick hit', () => {
    const { container } = render(<DrumKitSvg activeHit={{ instrument: 'kick', hitToken: 'a' }} />)
    expect(container.querySelector('[data-instrument="kick"]')).toHaveClass('hit')
    expect(container.querySelector('[data-instrument="snare"]')).not.toHaveClass('hit')
  })

  it('routes both hihat_closed and hihat_open hits to the same shared hihat piece', () => {
    const { container: closed } = render(
      <DrumKitSvg activeHit={{ instrument: 'hihat_closed', hitToken: 'a' }} />,
    )
    expect(closed.querySelector('[data-instrument="hihat"]')).toHaveClass('hit')

    const { container: open } = render(<DrumKitSvg activeHit={{ instrument: 'hihat_open', hitToken: 'b' }} />)
    expect(open.querySelector('[data-instrument="hihat"]')).toHaveClass('hit')
  })

  it('marks cymbal pieces (ride/crash) with the extra cymbal class', () => {
    const { container } = render(<DrumKitSvg activeHit={{ instrument: 'crash', hitToken: 'a' }} />)
    const crash = container.querySelector('[data-instrument="crash"]')
    expect(crash).toHaveClass('cymbal')
    expect(crash).toHaveClass('hit')
    expect(container.querySelector('[data-instrument="kick"]')).not.toHaveClass('cymbal')
  })

  it('remounts the active piece when a new hitToken arrives for the same instrument', () => {
    const { container, rerender } = render(<DrumKitSvg activeHit={{ instrument: 'kick', hitToken: 'first' }} />)
    const firstElement = container.querySelector('[data-instrument="kick"]')

    rerender(<DrumKitSvg activeHit={{ instrument: 'kick', hitToken: 'second' }} />)
    const secondElement = container.querySelector('[data-instrument="kick"]')

    expect(secondElement).not.toBe(firstElement)
    expect(secondElement).toHaveClass('hit')
  })
})
