import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useObjectUrl } from './useObjectUrl'

describe('useObjectUrl', () => {
  it('creates a blob URL for a given blob and revokes it on unmount', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    const blob = new Blob(['x'])

    const { result, unmount } = renderHook(() => useObjectUrl(blob))
    expect(result.current).toMatch(/^blob:/)

    unmount()
    expect(revokeSpy).toHaveBeenCalledWith(result.current)
    revokeSpy.mockRestore()
  })

  it('returns undefined when there is no blob', () => {
    const { result } = renderHook(() => useObjectUrl(undefined))
    expect(result.current).toBeUndefined()
  })

  it('revokes the previous url when the blob changes', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    const first = new Blob(['a'])
    const second = new Blob(['b'])

    const { result, rerender } = renderHook(({ blob }) => useObjectUrl(blob), {
      initialProps: { blob: first },
    })
    const firstUrl = result.current

    rerender({ blob: second })
    expect(revokeSpy).toHaveBeenCalledWith(firstUrl)
    expect(result.current).not.toBe(firstUrl)
    revokeSpy.mockRestore()
  })
})
