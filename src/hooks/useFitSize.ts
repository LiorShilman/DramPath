import { useEffect, useRef, useState } from 'react'

/** Measures a container via ResizeObserver and returns the largest width
 * (in px) an aspectRatio (width/height) box can have while fitting inside
 * it on both axes — i.e. "fit by whichever dimension is tighter", the way
 * object-fit: contain works for images/video. Deliberately not done in
 * pure CSS: percentage `height` + `aspect-ratio` only resolves if every
 * ancestor up the chain has a fully definite (non-auto) height, which
 * broke silently (the sized element collapsed to nothing) once the
 * available height itself came from flex distribution rather than a fixed
 * viewport unit — a real measurement has no such precondition. */
export function useFitSize<T extends HTMLElement>(aspectRatio: number) {
  const containerRef = useRef<T>(null)
  const [width, setWidth] = useState<number>()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width: containerWidth, height: containerHeight } = entry.contentRect
      setWidth(Math.max(0, Math.min(containerWidth, containerHeight * aspectRatio)))
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [aspectRatio])

  return { containerRef, width }
}
