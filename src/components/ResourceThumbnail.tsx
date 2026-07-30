import { useEffect, useState } from 'react'
import { ImageIcon, Link as LinkIcon } from 'lucide-react'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { ensureReadPermission } from '../lib/file-system-access'
import type { Resource } from '../domain'

export interface ResourceThumbnailProps {
  resource: Resource | undefined
  size?: number
  alt?: string
}

// Three display states, because an image Resource isn't just "has a blob"
// anymore:
// - sourceType 'blob': the usual case, same useObjectUrl pattern as
//   LibraryPage's own preview.
// - sourceType 'link', permission already granted: queryPermission() does
//   NOT require a user gesture (unlike requestPermission()), so this can
//   safely run on mount/render — if the browser already remembers the
//   grant, load and show the real image with no click needed.
// - sourceType 'link', permission not yet granted: render a clickable
//   placeholder instead of failing or silently prompting — requestPermission
//   only works from inside a real click.
export function ResourceThumbnail({ resource, size = 40, alt }: ResourceThumbnailProps) {
  const blobUrl = useObjectUrl(resource?.sourceType === 'blob' ? resource.blob : undefined)
  const [linkUrl, setLinkUrl] = useState<string | undefined>(undefined)
  const [linkNeedsPermission, setLinkNeedsPermission] = useState(false)

  useEffect(() => {
    // Resetting state for the new `resource` identity, not deriving state
    // from a prop on every render — same justified pattern as the
    // fetch-on-mount effects (see useDashboardData.ts).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLinkUrl(undefined)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLinkNeedsPermission(false)
    if (!resource || resource.sourceType !== 'link' || !resource.fileHandle) return

    let cancelled = false
    const handle = resource.fileHandle
    void handle.queryPermission({ mode: 'read' }).then(async (status) => {
      if (cancelled) return
      if (status !== 'granted') {
        setLinkNeedsPermission(true)
        return
      }
      const file = await handle.getFile()
      if (cancelled) return
      setLinkUrl(URL.createObjectURL(file))
    })
    return () => {
      cancelled = true
    }
  }, [resource])

  useEffect(() => {
    return () => {
      if (linkUrl) URL.revokeObjectURL(linkUrl)
    }
  }, [linkUrl])

  async function handleGrantAccess() {
    if (!resource?.fileHandle) return
    const granted = await ensureReadPermission(resource.fileHandle)
    if (!granted) return
    const file = await resource.fileHandle.getFile()
    setLinkUrl(URL.createObjectURL(file))
    setLinkNeedsPermission(false)
  }

  if (!resource) return null

  const style = { width: size, height: size }
  const src = resource.sourceType === 'blob' ? blobUrl : linkUrl

  if (src) {
    return (
      <img
        src={src}
        alt={alt ?? resource.fileName}
        style={style}
        className="shrink-0 rounded-[var(--radius-card)] object-cover"
      />
    )
  }

  if (linkNeedsPermission) {
    return (
      <button
        type="button"
        onClick={() => void handleGrantAccess()}
        style={style}
        aria-label={`אשר גישה לתמונה: ${resource.fileName}`}
        title="לחצו כדי לאשר גישה ולהציג את התמונה המקושרת"
        className="flex shrink-0 items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]"
      >
        <LinkIcon size={Math.round(size * 0.5)} aria-hidden="true" />
      </button>
    )
  }

  return (
    <div
      style={style}
      className="flex shrink-0 items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]"
    >
      <ImageIcon size={Math.round(size * 0.5)} aria-hidden="true" />
    </div>
  )
}
