import { useState } from 'react'
import { PlayCircle } from 'lucide-react'
import { ensureReadPermission } from '../lib/file-system-access'
import type { Resource } from '../domain'

export interface VideoThumbnailButtonProps {
  resource: Resource
  size?: number
  // Resolving (blob read, or linked-file permission + read) happens here,
  // triggered directly by the click — required for requestPermission()'s
  // user-gesture rule — but actual playback renders elsewhere (a side
  // panel), not inside this small thumbnail slot. The caller owns the
  // returned object URL and must revoke it when done.
  onPlay: (resource: Resource, videoUrl: string) => void
}

export function VideoThumbnailButton({ resource, size = 72, onPlay }: VideoThumbnailButtonProps) {
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setError(null)
    try {
      if (resource.sourceType === 'blob') {
        if (!resource.blob) return
        onPlay(resource, URL.createObjectURL(resource.blob))
        return
      }
      if (!resource.fileHandle) return
      const granted = await ensureReadPermission(resource.fileHandle)
      if (!granted) {
        setError('אין הרשאה לגשת לקובץ. נסו שוב כדי לאשר גישה מחדש.')
        return
      }
      const file = await resource.fileHandle.getFile()
      onPlay(resource, URL.createObjectURL(file))
    } catch {
      setError('הקובץ לא נמצא — ייתכן שהוזז או נמחק מהמחשב.')
    }
  }

  const style = { width: size, height: size }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => void handleClick()}
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
