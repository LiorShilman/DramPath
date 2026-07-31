import { describe, expect, it, vi } from 'vitest'
import { renderHook, fireEvent } from '@testing-library/react'
import { useKeyboardDrums } from './useKeyboardDrums'

describe('useKeyboardDrums', () => {
  it('fires onHit with the mapped instrument on a mapped keydown', () => {
    const onHit = vi.fn()
    renderHook(() => useKeyboardDrums({ onHit }))

    fireEvent.keyDown(window, { code: 'KeyF' })

    expect(onHit).toHaveBeenCalledTimes(1)
    expect(onHit.mock.calls[0]![0]).toBe('snare')
    expect(typeof onHit.mock.calls[0]![1]).toBe('number')
  })

  it('does not re-fire while the key is held without an intervening keyup', () => {
    const onHit = vi.fn()
    renderHook(() => useKeyboardDrums({ onHit }))

    fireEvent.keyDown(window, { code: 'KeyF' })
    fireEvent.keyDown(window, { code: 'KeyF' })
    fireEvent.keyDown(window, { code: 'KeyF' })

    expect(onHit).toHaveBeenCalledTimes(1)
  })

  it('fires again after a keyup followed by a new keydown', () => {
    const onHit = vi.fn()
    renderHook(() => useKeyboardDrums({ onHit }))

    fireEvent.keyDown(window, { code: 'KeyF' })
    fireEvent.keyUp(window, { code: 'KeyF' })
    fireEvent.keyDown(window, { code: 'KeyF' })

    expect(onHit).toHaveBeenCalledTimes(2)
  })

  it('ignores an unmapped key', () => {
    const onHit = vi.fn()
    renderHook(() => useKeyboardDrums({ onHit }))

    fireEvent.keyDown(window, { code: 'KeyZ' })

    expect(onHit).not.toHaveBeenCalled()
  })

  it('ignores a keydown while a modifier is held', () => {
    const onHit = vi.fn()
    renderHook(() => useKeyboardDrums({ onHit }))

    fireEvent.keyDown(window, { code: 'KeyF', ctrlKey: true })

    expect(onHit).not.toHaveBeenCalled()
  })

  it('ignores a keydown targeting a text input', () => {
    const onHit = vi.fn()
    renderHook(() => useKeyboardDrums({ onHit }))

    const input = document.createElement('input')
    document.body.appendChild(input)
    fireEvent.keyDown(input, { code: 'KeyF' })
    document.body.removeChild(input)

    expect(onHit).not.toHaveBeenCalled()
  })

  it('suppresses all hits when disabled', () => {
    const onHit = vi.fn()
    renderHook(() => useKeyboardDrums({ onHit, enabled: false }))

    fireEvent.keyDown(window, { code: 'KeyF' })

    expect(onHit).not.toHaveBeenCalled()
  })

  it('removes its listeners on unmount', () => {
    const onHit = vi.fn()
    const { unmount } = renderHook(() => useKeyboardDrums({ onHit }))

    unmount()
    fireEvent.keyDown(window, { code: 'KeyF' })

    expect(onHit).not.toHaveBeenCalled()
  })
})
