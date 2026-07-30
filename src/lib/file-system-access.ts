// File System Access API — only in Chromium desktop (Chrome/Edge/Opera),
// not Firefox, not Safari, not mobile. Every export here is feature-detected
// by callers via isFileSystemAccessSupported() rather than browser-sniffed,
// so unsupported browsers just don't see the "link a file" option at all.

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

// Video and images both benefit from linking instead of copying — video for
// the obvious size reason, images because things like hi-res sheet-music
// scans can also be large. `multiple: true` so several files can be linked
// in one picker round-trip, matching the regular-upload input's `multiple`
// support. Returns [] if the user cancels the picker (AbortError) — that's
// a normal outcome here, not a failure to surface.
export async function pickLinkableFiles(): Promise<FileSystemFileHandle[]> {
  try {
    return await window.showOpenFilePicker({
      types: [{ description: 'וידאו או תמונה', accept: { 'video/*': [], 'image/*': [] } }],
      excludeAcceptAllOption: false,
      multiple: true,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return []
    throw error
  }
}

// Must be called from inside a user-gesture handler (a click), never on
// mount/render — browsers reject requestPermission() calls outside one.
export async function ensureReadPermission(handle: FileSystemFileHandle): Promise<boolean> {
  const options = { mode: 'read' as const }
  if ((await handle.queryPermission(options)) === 'granted') return true
  return (await handle.requestPermission(options)) === 'granted'
}
