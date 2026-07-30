import { useEffect, useRef } from 'react'
import { DEFAULT_KEYBOARD_MAP, mapCodeToInstrument } from '../lib/visual-trainer/keyboard-map'
import type { DrumKeyboardMap } from '../lib/visual-trainer/keyboard-map'
import type { DrumInstrument } from '../domain'

export interface UseKeyboardDrumsOptions {
  keyMap?: DrumKeyboardMap
  enabled?: boolean
  onHit: (instrument: DrumInstrument, hitTimeMs: number) => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

/**
 * VISUAL_DRUM_TRAINER_SPEC.md §9's Input Handler — detects which drum-mapped
 * key was pressed and when. Deliberately does NOT play sound or do hit
 * matching itself (that's the separate Audio Scheduler / Scoring Engine
 * responsibilities, wired together in a later stage once there's a page).
 */
export function useKeyboardDrums({ keyMap = DEFAULT_KEYBOARD_MAP, enabled = true, onHit }: UseKeyboardDrumsOptions): void {
  const keyMapRef = useRef(keyMap)
  const onHitRef = useRef(onHit)

  useEffect(() => {
    keyMapRef.current = keyMap
  }, [keyMap])

  useEffect(() => {
    onHitRef.current = onHit
  }, [onHit])

  useEffect(() => {
    if (!enabled) return undefined

    const heldCodes = new Set<string>()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.altKey || event.metaKey) return
      if (isTypingTarget(event.target)) return
      if (heldCodes.has(event.code)) return

      const instrument = mapCodeToInstrument(event.code, keyMapRef.current)
      if (!instrument) return

      heldCodes.add(event.code)
      onHitRef.current(instrument, performance.now())
    }

    function handleKeyUp(event: KeyboardEvent) {
      heldCodes.delete(event.code)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [enabled])
}
