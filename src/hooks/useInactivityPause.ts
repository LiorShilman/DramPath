import { useEffect, useRef } from 'react'

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'touchstart', 'pointerdown'] as const

/**
 * §17: "מניעת ספירת זמן כאשר האפליקציה נשארת פתוחה ללא פעילות מעבר לסף
 * שניתן להגדרה" — calls onTimeout once no mouse/keyboard/touch activity is
 * seen for `timeoutSeconds`. Disabled entirely (no listeners, no timer)
 * when `enabled` is false — e.g. the caller already paused.
 */
export function useInactivityPause(
  timeoutSeconds: number,
  onTimeout: () => void,
  enabled: boolean,
): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const onTimeoutRef = useRef(onTimeout)

  useEffect(() => {
    onTimeoutRef.current = onTimeout
  }, [onTimeout])

  useEffect(() => {
    if (!enabled) return undefined

    function reset() {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => onTimeoutRef.current(), timeoutSeconds * 1000)
    }

    reset()
    for (const eventName of ACTIVITY_EVENTS) {
      document.addEventListener(eventName, reset)
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      for (const eventName of ACTIVITY_EVENTS) {
        document.removeEventListener(eventName, reset)
      }
    }
  }, [enabled, timeoutSeconds])
}
