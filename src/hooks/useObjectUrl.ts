import { useEffect, useMemo } from 'react'

// §29: "קבצים יוצגו באמצעות Blob URL שיושמד לאחר השימוש" — the URL is
// derived synchronously from the blob (useMemo, not setState-in-effect —
// creating it is what a memoized derived value is for), and the effect's
// only job is the cleanup side effect: revoke on blob change/unmount.
export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob])

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])

  return url
}
