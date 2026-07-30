import { useEffect, useState } from 'react'
import { PlayCircle } from 'lucide-react'
import { ensureReadPermission } from '../lib/file-system-access'
import type { Resource } from '../domain'

export interface InlineVideoPlayerProps {
  resource: Resource
  size?: number
}

// Plays a video resource in place — blob-backed or linked — instead of only
// being reachable via "open in a new tab" from the library. Loading is
// gated behind a click (not autoplay-on-render): for linked files this IS
// the required user gesture for requestPermission(), and for blob files
// it avoids decoding video the user hasn't asked to watch yet.
export function InlineVideoPlayer({ resource, size = 72 }: InlineVideoPlayerProps) {
  const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    }
  }, [videoUrl])

  async function handlePlay() {
    setError(null)
    try {
      if (resource.sourceType === 'blob') {
        if (!resource.blob) return
        setVideoUrl(URL.createObjectURL(resource.blob))
        return
      }
      if (!resource.fileHandle) return
      const granted = await ensureReadPermission(resource.fileHandle)
      if (!granted) {
        setError('אין הרשאה לגשת לקובץ. נסו שוב כדי לאשר גישה מחדש.')
        return
      }
      const file = await resource.fileHandle.getFile()
      setVideoUrl(URL.createObjectURL(file))
    } catch {
      setError('הקובץ לא נמצא — ייתכן שהוזז או נמחק מהמחשב.')
    }
  }

  const style = { width: size, height: size }

  if (videoUrl) {
    return (
      <video
        controls
        autoPlay
        src={videoUrl}
        style={style}
        className="shrink-0 rounded-[var(--radius-card)] bg-black object-contain"
      >
        <track kind="captions" />
      </video>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => void handlePlay()}
        aria-label={`נגן את ${resource.fileName}`}
        style={style}
        className="flex shrink-0 items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:opacity-80"
      >
        <PlayCircle size={Math.round(size * 0.4)} aria-hidden="true" />
      </button>
      {error && <p className="text-xs text-[var(--color-danger-text)]">{error}</p>}
    </div>
  )
}
