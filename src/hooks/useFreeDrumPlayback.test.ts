import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { useFreeDrumPlayback } from './useFreeDrumPlayback'

// Same FakeAudioContext technique already established in useVisualTrainer.test.ts.
class FakeAudioContext {
  get currentTime() {
    return performance.now() / 1000
  }
  destination = {}
  sampleRate = 44100
  createOscillator() {
    return {
      type: '',
      frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
      start() {},
      stop() {},
    }
  }
  createGain() {
    return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }
  }
  createBufferSource() {
    return { buffer: null, connect() {}, start() {}, stop() {} }
  }
  createBiquadFilter() {
    return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(1) }
  }
  resume() {
    return Promise.resolve()
  }
  close() {
    return Promise.resolve()
  }
}

describe('useFreeDrumPlayback', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sets activeHits with the mapped instrument when a mapped key is pressed', () => {
    const { result } = renderHook(() => useFreeDrumPlayback())
    expect(result.current.activeHits.kick).toBeUndefined()

    fireEvent.keyDown(window, { code: 'KeyF' })

    expect(result.current.activeHits.kick).toBeTruthy()
  })

  it('gives each hit a fresh hitToken, even for the same instrument twice', () => {
    const { result } = renderHook(() => useFreeDrumPlayback())

    fireEvent.keyDown(window, { code: 'KeyF' })
    const firstToken = result.current.activeHits.kick

    fireEvent.keyUp(window, { code: 'KeyF' })
    fireEvent.keyDown(window, { code: 'KeyF' })
    const secondToken = result.current.activeHits.kick

    expect(secondToken).toBeTruthy()
    expect(secondToken).not.toBe(firstToken)
  })

  it('keeps both instruments active when two different keys are pressed close together, instead of one overwriting the other', () => {
    const { result } = renderHook(() => useFreeDrumPlayback())

    fireEvent.keyDown(window, { code: 'KeyF' })
    fireEvent.keyDown(window, { code: 'KeyJ' })

    expect(result.current.activeHits.kick).toBeTruthy()
    expect(result.current.activeHits.snare).toBeTruthy()
  })

  it('does nothing for an unmapped key', () => {
    const { result } = renderHook(() => useFreeDrumPlayback())
    fireEvent.keyDown(window, { code: 'KeyZ' })
    expect(Object.keys(result.current.activeHits)).toHaveLength(0)
  })
})
