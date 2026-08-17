import { describe, expect, it } from 'vitest'
import { encodeMp3 } from './encode-mp3'

function fakeAudioBuffer(samples: number[], sampleRate = 44100): AudioBuffer {
  const data = new Float32Array(samples)
  return {
    sampleRate,
    length: data.length,
    getChannelData: () => data,
  } as unknown as AudioBuffer
}

describe('encodeMp3', () => {
  it('produces a non-empty MP3 blob from a short buffer of real samples', () => {
    // A few hundred ms of a low sine wave — enough for lamejs to flush at
    // least one real frame, not just its own end-of-stream padding.
    const sampleCount = 44100 / 2
    const samples = Array.from({ length: sampleCount }, (_, i) => Math.sin((i / 44100) * 2 * Math.PI * 220))
    const blob = encodeMp3(fakeAudioBuffer(samples))

    expect(blob.type).toBe('audio/mp3')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('produces a blob (flush-only output) for a silent/empty buffer without throwing', () => {
    const blob = encodeMp3(fakeAudioBuffer([]))
    expect(blob.type).toBe('audio/mp3')
    expect(blob.size).toBeGreaterThanOrEqual(0)
  })
})
