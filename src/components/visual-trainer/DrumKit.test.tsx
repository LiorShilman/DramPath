import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { DrumKit } from './DrumKit'

describe('DrumKit', () => {
  it('renders all 8 pieces with no hit class when idle', () => {
    const { container } = render(<DrumKit />)
    const pieces = ['kick', 'snare', 'hihat', 'ride', 'crash', 'tom_high', 'tom_mid', 'tom_floor']
    for (const piece of pieces) {
      const el = container.querySelector(`[data-instrument="${piece}"]`)
      expect(el).toBeInTheDocument()
      expect(el).not.toHaveClass('hit')
    }
  })

  it('applies the hit class to the kick piece on a kick hit', () => {
    const { container } = render(<DrumKit activeHits={{ kick: 'a' }} />)
    expect(container.querySelector('[data-instrument="kick"]')).toHaveClass('hit')
    expect(container.querySelector('[data-instrument="snare"]')).not.toHaveClass('hit')
  })

  it('routes both hihat_closed and hihat_open hits to the same shared hihat piece', () => {
    const { container: closed } = render(<DrumKit activeHits={{ hihat_closed: 'a' }} />)
    expect(closed.querySelector('[data-instrument="hihat"]')).toHaveClass('hit')

    const { container: open } = render(<DrumKit activeHits={{ hihat_open: 'b' }} />)
    expect(open.querySelector('[data-instrument="hihat"]')).toHaveClass('hit')
  })

  it('marks cymbal pieces (ride/crash/hihat) with the extra cymbal class', () => {
    const { container } = render(<DrumKit activeHits={{ crash: 'a' }} />)
    const crash = container.querySelector('[data-instrument="crash"]')
    expect(crash).toHaveClass('cymbal')
    expect(crash).toHaveClass('hit')
    expect(container.querySelector('[data-instrument="kick"]')).not.toHaveClass('cymbal')
  })

  it('remounts the active piece when a new hitToken arrives for the same instrument', () => {
    const { container, rerender } = render(<DrumKit activeHits={{ kick: 'first' }} />)
    const firstElement = container.querySelector('[data-instrument="kick"]')

    rerender(<DrumKit activeHits={{ kick: 'second' }} />)
    const secondElement = container.querySelector('[data-instrument="kick"]')

    expect(secondElement).not.toBe(firstElement)
    expect(secondElement).toHaveClass('hit')
  })

  it('applies the hit class to two different instruments hit at the same time, without either overwriting the other', () => {
    const { container } = render(<DrumKit activeHits={{ kick: 'a', snare: 'b' }} />)
    expect(container.querySelector('[data-instrument="kick"]')).toHaveClass('hit')
    expect(container.querySelector('[data-instrument="snare"]')).toHaveClass('hit')
    expect(container.querySelector('[data-instrument="ride"]')).not.toHaveClass('hit')
  })

  it('renders a real product photo for every piece', () => {
    const { container } = render(<DrumKit />)
    expect(container.querySelectorAll('img')).toHaveLength(8)
  })
})
