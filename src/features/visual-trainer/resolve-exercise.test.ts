import { afterEach, describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { resolveExercise, useResolveExercise } from './resolve-exercise'
import { DEMO_EXERCISES } from './demo-exercises'
import { interactiveExerciseRepository } from '../../data/repositories'
import { createId } from '../../domain'

describe('resolveExercise', () => {
  afterEach(async () => {
    const all = await interactiveExerciseRepository.getAll()
    await Promise.all(all.map((exercise) => interactiveExerciseRepository.remove(exercise.id)))
  })

  it('resolves a demo exercise id instantly, without touching Dexie', async () => {
    const demoExercise = DEMO_EXERCISES[0]!
    expect(await resolveExercise(demoExercise.id)).toEqual(demoExercise)
  })

  it('resolves a persisted (Dexie) exercise id', async () => {
    const created = await interactiveExerciseRepository.create({
      title: 'Persisted exercise',
      difficulty: 'beginner',
      bpm: 100,
      minBpm: 60,
      maxBpm: 160,
      timeSignature: { numerator: 4, denominator: 4 },
      subdivision: 'quarter',
      bars: 1,
      loopCount: 1,
      displayMode: 'staff_cursor',
      events: [{ id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }],
    })

    expect(await resolveExercise(created.id)).toEqual(created)
  })

  it('resolves an unknown id to \'not-found\'', async () => {
    expect(await resolveExercise('does-not-exist')).toBe('not-found')
  })
})

describe('useResolveExercise', () => {
  it('returns undefined for an undefined exerciseId', () => {
    const { result } = renderHook(() => useResolveExercise(undefined))
    expect(result.current).toBeUndefined()
  })

  it('resolves a demo exercise id synchronously (no loading state)', () => {
    const demoExercise = DEMO_EXERCISES[0]!
    const { result } = renderHook(() => useResolveExercise(demoExercise.id))
    expect(result.current).toEqual(demoExercise)
  })

  it('resolves a persisted exercise id asynchronously, undefined while loading', async () => {
    const created = await interactiveExerciseRepository.create({
      title: 'Persisted exercise',
      difficulty: 'beginner',
      bpm: 100,
      minBpm: 60,
      maxBpm: 160,
      timeSignature: { numerator: 4, denominator: 4 },
      subdivision: 'quarter',
      bars: 1,
      loopCount: 1,
      displayMode: 'staff_cursor',
      events: [{ id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }],
    })

    const { result } = renderHook(() => useResolveExercise(created.id))
    expect(result.current).toBeUndefined()
    await waitFor(() => expect(result.current).toEqual(created))

    await interactiveExerciseRepository.remove(created.id)
  })

  it('resolves an unknown id to \'not-found\'', async () => {
    const { result } = renderHook(() => useResolveExercise('does-not-exist'))
    await waitFor(() => expect(result.current).toBe('not-found'))
  })
})
