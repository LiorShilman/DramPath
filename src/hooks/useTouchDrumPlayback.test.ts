import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTouchDrumPlayback } from './useTouchDrumPlayback'
import { playDrumSound } from '../lib/visual-trainer/drum-synth'

vi.mock('../lib/visual-trainer/drum-synth', () => ({
  playDrumSound: vi.fn(),
}))

// Same FakeAudioContext technique already established in useVisualTrainer.test.ts.
class FakeAudioContext {
  get currentTime() {
    return performance.now() / 1000
  }
  destination = {}
  createGain() {
    return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }
  }
  resume() {
    return Promise.resolve()
  }
  close() {
    return Promise.resolve()
  }
}

describe('useTouchDrumPlayback', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('plays a sound and flashes the piece on a normal hit', () => {
    const { result } = renderHook(() => useTouchDrumPlayback())

    act(() => result.current.playHit('snare'))

    expect(playDrumSound).toHaveBeenCalledTimes(1)
    expect(result.current.activeHits.snare).toBeTruthy()
  })

  it('skips the sound but still flashes the piece when silent is true', () => {
    const { result } = renderHook(() => useTouchDrumPlayback())

    act(() => result.current.playHit('kick', { silent: true }))

    expect(playDrumSound).not.toHaveBeenCalled()
    expect(result.current.activeHits.kick).toBeTruthy()
  })
})
