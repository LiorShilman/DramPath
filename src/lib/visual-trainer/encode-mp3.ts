import { Mp3Encoder } from '@breezystack/lamejs'

const KBPS = 128
// lamejs's own documented per-call chunk size — arbitrary chunking still
// produces valid output, but this is the size its examples use.
const ENCODE_BLOCK_SIZE = 1152

function floatTo16BitPcm(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length)
  for (let i = 0; i < input.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, input[i] ?? 0))
    output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
  }
  return output
}

// Encodes a rendered AudioBuffer (render-recording.ts's output, always
// mono) to a real MP3 Blob. No browser can produce MP3 natively — there's
// no MediaRecorder mimeType for it — so this pure-JS encoder is the only
// path to the format the user explicitly asked for (shareable via WhatsApp
// etc., which webm/opus commonly isn't accepted for).
export function encodeMp3(audioBuffer: AudioBuffer): Blob {
  const pcm = floatTo16BitPcm(audioBuffer.getChannelData(0))
  const encoder = new Mp3Encoder(1, audioBuffer.sampleRate, KBPS)
  const chunks: Uint8Array[] = []

  for (let offset = 0; offset < pcm.length; offset += ENCODE_BLOCK_SIZE) {
    const chunk = encoder.encodeBuffer(pcm.subarray(offset, offset + ENCODE_BLOCK_SIZE))
    if (chunk.length > 0) chunks.push(chunk)
  }
  const finalChunk = encoder.flush()
  if (finalChunk.length > 0) chunks.push(finalChunk)

  // Uint8Array<ArrayBufferLike> vs BlobPart's ArrayBuffer-specific generic —
  // a real TS lib.dom quirk, not an actual runtime concern (encoder chunks
  // are always plain ArrayBuffer-backed).
  return new Blob(chunks as BlobPart[], { type: 'audio/mp3' })
}
