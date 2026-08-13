import { useEffect, useMemo, useState } from 'react'
import { findDemoExercise } from './demo-exercises'
import { interactiveExerciseRepository } from '../../data/repositories'
import type { InteractiveExercise } from '../../domain'

/** Resolves an exercise id to either the in-memory demo catalog (instant)
 * or a persisted (Dexie) exercise — the same two-tier lookup
 * VisualTrainerPage has always used, extracted so RoutinePlayerPage can
 * resolve a whole routine's worth of ids up front (via Promise.all, which a
 * hook can't be called inside) instead of duplicating this logic. */
export async function resolveExercise(exerciseId: string): Promise<InteractiveExercise | 'not-found'> {
  const demoExercise = findDemoExercise(exerciseId)
  if (demoExercise) return demoExercise
  const found = await interactiveExerciseRepository.getById(exerciseId)
  return found ?? 'not-found'
}

/** Single-id, reactive version of resolveExercise for a page driven by one
 * route param (VisualTrainerPage) — undefined while a persisted lookup is
 * still in flight, 'not-found' once resolved with nothing there, otherwise
 * the exercise itself. undefined exerciseId always resolves to undefined
 * (nothing to look up). */
export function useResolveExercise(exerciseId: string | undefined): InteractiveExercise | 'not-found' | undefined {
  // Demo exercises resolve instantly (in-memory, pure) — only exercises this
  // misses fall through to the (async) repository lookup below.
  const demoExercise = useMemo(() => (exerciseId ? findDemoExercise(exerciseId) : undefined), [exerciseId])
  const [persistedResult, setPersistedResult] = useState<InteractiveExercise | 'not-found' | undefined>(undefined)

  useEffect(() => {
    if (!exerciseId || demoExercise) return
    let cancelled = false
    void interactiveExerciseRepository.getById(exerciseId).then((found) => {
      if (!cancelled) setPersistedResult(found ?? 'not-found')
    })
    return () => {
      cancelled = true
    }
  }, [exerciseId, demoExercise])

  if (!exerciseId) return undefined
  return demoExercise ?? persistedResult
}
