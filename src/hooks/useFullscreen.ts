import { useCallback, useEffect, useState } from 'react'

/** Native Fullscreen API (element.requestFullscreen()) — hides the mobile
 * browser's own chrome (address bar etc.) on a user gesture, without
 * needing "Add to Home Screen"/PWA install. `document.fullscreenElement` is
 * tracked via the 'fullscreenchange' event rather than assumed from the
 * toggle call, since the OS/browser can also exit fullscreen on its own
 * (back gesture, rotation on some devices). */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(() => document.fullscreenElement !== null)

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void document.documentElement.requestFullscreen().catch(() => {
        // Fullscreen requires a direct user gesture and can be denied by
        // the browser (e.g. iOS Safari doesn't support it at all) — nothing
        // to recover, the page just stays as it was.
      })
    }
  }, [])

  return { isFullscreen, toggleFullscreen }
}
