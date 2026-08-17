import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderRecording } from './render-recording'
import type { RecordingHit } from '../../domain/calculations/recording-hits'

// Same FakeAudioContext technique already established for Web-Audio-adjacent
// tests in this codebase (see useVisualTrainer.test.ts), extended with
// startRendering() since this is standing in for an OfflineAudioContext.
class FakeOfflineAudioContext {
  destination = {}
  sampleRate: number
  length: number

  constructor(_channels: number, length: number, sampleRate: number) {
    this.length = length
    this.sampleRate = sampleRate
  }

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

  async startRendering(): Promise<AudioBuffer> {
    return {
      length: this.length,
      sampleRate: this.sampleRate,
      getChannelData: () => new Float32Array(this.length),
    } as unknown as AudioBuffer
  }
}

describe('renderRecording', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.unstubAllGlobals()
  })

  it('renders without throwing, falling back to synthesis when no sample files are available', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch
    vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext)

    const hits: RecordingHit[] = [
      { instrument: 'kick', timeMs: 0, velocity: 100 },
      { instrument: 'snare', timeMs: 500, velocity: 90 },
    ]

    await expect(renderRecording(hits, 1000)).resolves.toBeDefined()
  })

  it('sizes the render buffer to the given duration plus tail headroom', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch
    let capturedLength = 0
    class CapturingContext extends FakeOfflineAudioContext {
      constructor(channels: number, length: number, sampleRate: number) {
        super(channels, length, sampleRate)
        capturedLength = length
      }
    }
    vi.stubGlobal('OfflineAudioContext', CapturingContext)

    await renderRecording([], 1000)

    // 1000ms + the 2s tail constant = 3s at 44100Hz.
    expect(capturedLength).toBe(Math.ceil(44100 * 3))
  })

  it('handles an empty hit list without throwing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch
    vi.stubGlobal('OfflineAudioContext', FakeOfflineAudioContext)

    await expect(renderRecording([], 500)).resolves.toBeDefined()
  })
})
