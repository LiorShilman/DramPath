import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
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

  it('applies the hit class to the ride piece on a ride hit', () => {
    const { container } = render(<DrumKit activeHits={{ ride: 'a' }} />)
    expect(container.querySelector('[data-instrument="ride"]')).toHaveClass('hit')
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
    const { container, rerender } = render(<DrumKit activeHits={{ ride: 'first' }} />)
    const firstElement = container.querySelector('[data-instrument="ride"]')

    rerender(<DrumKit activeHits={{ ride: 'second' }} />)
    const secondElement = container.querySelector('[data-instrument="ride"]')

    expect(secondElement).not.toBe(firstElement)
    expect(secondElement).toHaveClass('hit')
  })

  it('applies the hit class to a non-image-swap instrument hit at the same time as a snare hit, without either overwriting the other', () => {
    const { container } = render(<DrumKit activeHits={{ ride: 'a', snare: 'b' }} />)
    expect(container.querySelector('[data-instrument="ride"]')).toHaveClass('hit')
    expect(container.querySelector('[data-instrument="crash"]')).not.toHaveClass('hit')
  })

  it('renders a real product photo for every piece, plus the 4 non-interactive decoration pieces (rack/module/pedal/throne)', () => {
    const { container } = render(<DrumKit />)
    expect(container.querySelectorAll('img')).toHaveLength(12)
  })

  it('renders a drumstick for every piece except kick, which is foot-pedal-operated', () => {
    const { container } = render(<DrumKit />)
    expect(container.querySelector('[data-instrument="kick"] .drumstick')).not.toBeInTheDocument()
    expect(container.querySelector('[data-instrument="snare"] .drumstick')).toBeInTheDocument()
    expect(container.querySelector('[data-instrument="crash"] .drumstick')).toBeInTheDocument()
  })

  describe.each([
    { piece: 'snare', instrument: 'snare', idleSrc: '/drum-kit/snare.webp', hitSrc: '/drum-kit/snare-hit.webp' },
    { piece: 'kick', instrument: 'kick', idleSrc: '/drum-kit/kick.webp', hitSrc: '/drum-kit/kick-hit.webp' },
    { piece: 'tom_floor', instrument: 'tom_floor', idleSrc: '/drum-kit/tom-floor.webp', hitSrc: '/drum-kit/tom-floor-hit.webp' },
    { piece: 'tom_mid', instrument: 'tom_mid', idleSrc: '/drum-kit/tom-mid.webp', hitSrc: '/drum-kit/tom-mid-hit.webp' },
    { piece: 'tom_high', instrument: 'tom_high', idleSrc: '/drum-kit/tom-high.webp', hitSrc: '/drum-kit/tom-high-hit.webp' },
  ] as const)('$piece hit feedback (blue-head image swap instead of the scale animation)', ({ piece, instrument, idleSrc, hitSrc }) => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it(`never applies the hit (scale animation) class to the ${piece} piece`, () => {
      const { container } = render(<DrumKit activeHits={{ [instrument]: 'a' }} />)
      expect(container.querySelector(`[data-instrument="${piece}"]`)).not.toHaveClass('hit')
    })

    it(`applies the image-hit (glow) class to the ${piece} piece only while active`, () => {
      const { container } = render(<DrumKit activeHits={{ [instrument]: 'a' }} />)
      expect(container.querySelector(`[data-instrument="${piece}"]`)).toHaveClass('image-hit')

      const { container: idleContainer } = render(<DrumKit />)
      expect(idleContainer.querySelector(`[data-instrument="${piece}"]`)).not.toHaveClass('image-hit')
    })

    it(`swaps to the blue-head image immediately on a ${piece} hit, then reverts after the flash window`, () => {
      const { container } = render(<DrumKit activeHits={{ [instrument]: 'a' }} />)
      const img = container.querySelector(`[data-instrument="${piece}"] img`)
      expect(img).toHaveAttribute('src', hitSrc)

      act(() => {
        vi.advanceTimersByTime(200)
      })

      expect(img).toHaveAttribute('src', idleSrc)
    })

    it(`shows the normal ${piece} image when idle`, () => {
      const { container } = render(<DrumKit />)
      const img = container.querySelector(`[data-instrument="${piece}"] img`)
      expect(img).toHaveAttribute('src', idleSrc)
    })
  })

  describe('onPieceHit (touch/tap targets)', () => {
    it('pieces are not interactive (no button role) when onPieceHit is not provided', () => {
      const { container } = render(<DrumKit />)
      expect(container.querySelector('[data-instrument="snare"]')).not.toHaveAttribute('role')
    })

    it('marks every piece as a button and fires onPieceHit with its instrument on tap', () => {
      const onPieceHit = vi.fn()
      const { container } = render(<DrumKit onPieceHit={onPieceHit} />)

      const snare = container.querySelector('[data-instrument="snare"]')
      expect(snare).toHaveAttribute('role', 'button')

      snare!.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      expect(onPieceHit).toHaveBeenCalledWith('snare')
    })

    it('resolves a tap on the shared hihat piece to hihat_closed (no separate open artwork to tap)', () => {
      const onPieceHit = vi.fn()
      const { container } = render(<DrumKit onPieceHit={onPieceHit} />)

      container.querySelector('[data-instrument="hihat"]')!.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      expect(onPieceHit).toHaveBeenCalledWith('hihat_closed')
    })
  })
})
