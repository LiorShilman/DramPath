import { FileText, Image as ImageIcon, Video, File as FileIcon } from 'lucide-react'
import type { Resource } from '../domain'

export interface FileTypeIconProps {
  mimeType: Resource['mimeType']
  size?: number
}

// A quick visual cue for "what kind of file is this" in lists/pickers where
// a full thumbnail (ResourceThumbnail) isn't warranted — video/PDF/other
// files have no image to preview, and even images get this treatment in
// dense picker rows where an actual preview would be wasteful I/O.
export function FileTypeIcon({ mimeType, size = 18 }: FileTypeIconProps) {
  if (mimeType.startsWith('image/')) return <ImageIcon size={size} aria-hidden="true" />
  if (mimeType.startsWith('video/')) return <Video size={size} aria-hidden="true" />
  if (mimeType === 'application/pdf') return <FileText size={size} aria-hidden="true" />
  return <FileIcon size={size} aria-hidden="true" />
}
