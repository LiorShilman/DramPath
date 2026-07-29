import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useInactivityPause } from './useInactivityPause'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useInactivityPause', () => {
  it('calls onTimeout after the configured silence period', () => {
    const onTimeout = vi.fn()
    renderHook(() => useInactivityPause(60, onTimeout, true))

    vi.advanceTimersByTime(59_000)
    expect(onTimeout).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1_000)
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it('resets the timer on activity', () => {
    const onTimeout = vi.fn()
    renderHook(() => useInactivityPause(60, onTimeout, true))

    vi.advanceTimersByTime(50_000)
    document.dispatchEvent(new Event('mousemove'))
    vi.advanceTimersByTime(50_000)

    expect(onTimeout).not.toHaveBeenCalled()

    vi.advanceTimersByTime(10_000)
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it('does nothing while disabled', () => {
    const onTimeout = vi.fn()
    renderHook(() => useInactivityPause(60, onTimeout, false))

    vi.advanceTimersByTime(120_000)
    expect(onTimeout).not.toHaveBeenCalled()
  })
})
