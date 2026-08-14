import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useRemoteDrumInput } from '../../hooks/useRemoteDrumInput'
import type { PlaybackStatusPayload } from '../../hooks/useRemoteDrumInput'
import type { ExerciseListItem, RoutineListItem, TransportCommandAction } from '../../lib/visual-trainer/remote-drum-protocol'
import { interactiveExerciseRepository, practiceRoutineRepository } from '../../data/repositories'
import { DEMO_EXERCISES } from './demo-exercises'
import { RemoteHostContext } from './remote-host-context'
import type { RemoteHostContextValue, RemoteSession } from './remote-host-context'
import type { DrumInstrument } from '../../domain'

const PHONE_CONTROL_ENABLED_STORAGE_KEY = 'drumpath.isPhoneControlEnabled'

function loadIsEnabled(): boolean {
  return localStorage.getItem(PHONE_CONTROL_ENABLED_STORAGE_KEY) === 'true'
}

/** Owns the single desktop/"host" relay connection (ADR 0007) for the whole
 * app — rendered inside AppLayout, wrapping <Outlet/>, so it's the one
 * connection that survives navigation between the dashboard, exercise list,
 * and individual practice pages (a second connection would supersede/kill
 * whatever was host before, per the relay's single-global-host model — so
 * there must be exactly one, not one per practice-page mount like before
 * this feature). useVisualTrainer no longer opens its own connection; it
 * consumes useRemoteHost() (remote-host-context.ts) and registers itself as
 * the currently-active session via registerSession. */
export function RemoteHostProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isEnabled, setIsEnabled] = useState(loadIsEnabled)
  const registeredSessionRef = useRef<RemoteSession | undefined>(undefined)
  // sendExerciseList/sendPlaybackStatus are returned FROM the
  // useRemoteDrumInput call below, but handleRequestExerciseList/
  // handleSelectExercise (passed INTO that same call as options) need to
  // call them — the same declaration-order problem useVisualTrainer already
  // solved for sendNotationState, same ref-mirror fix.
  const sendExerciseListRef = useRef<(exercises: ExerciseListItem[], routines: RoutineListItem[]) => void>(() => {})
  const sendPlaybackStatusRef = useRef<(status: PlaybackStatusPayload) => void>(() => {})

  const handleHit = useCallback((instrument: DrumInstrument, hitTimeMs: number) => {
    registeredSessionRef.current?.handleHit(instrument, hitTimeMs)
  }, [])

  const handleRequestExerciseList = useCallback(() => {
    void Promise.all([interactiveExerciseRepository.getAll(), practiceRoutineRepository.getAll()]).then(
      ([customExercises, routines]) => {
        // Same newest-first ordering ExerciseSelectPage already uses on the
        // desktop — getAll() alone returns Dexie's raw (insertion) order,
        // which doesn't match what the desktop actually shows.
        const sortedCustomExercises = [...customExercises].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const sortedRoutines = [...routines].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const exerciseList: ExerciseListItem[] = [
          ...sortedCustomExercises.map((exercise) => ({
            id: exercise.id,
            title: exercise.title,
            bpm: exercise.bpm,
            difficulty: exercise.difficulty,
            isCustom: true,
          })),
          ...DEMO_EXERCISES.map((exercise) => ({
            id: exercise.id,
            title: exercise.title,
            bpm: exercise.bpm,
            difficulty: exercise.difficulty,
            isCustom: false,
          })),
        ]
        const routineList: RoutineListItem[] = sortedRoutines.map((routine) => ({
          id: routine.id,
          title: routine.title,
          exerciseCount: routine.exerciseIds.length,
        }))
        sendExerciseListRef.current(exerciseList, routineList)
      },
    )
  }, [])

  const handleSelectExercise = useCallback(
    (exerciseId: string) => {
      const targetPath = `/practice/visual/${exerciseId}`
      // Re-selecting whatever's ALREADY the current route is a real, common
      // case (reported directly: picking the same lesson again "cancels"
      // it) — react-router treats navigate() to an unchanged location as a
      // no-op, so nothing remounts and the "cleared" status below would
      // never get corrected by a fresh one, leaving the phone stuck on
      // "nothing selected" even though the exercise is still right there,
      // fully loaded, on the desktop. Skip both the clear and the
      // navigation entirely — there's nothing to change.
      if (location.pathname === targetPath) return
      // Tell the phone nothing is active BEFORE navigating — VisualTrainerPage's
      // own exercise resolution is genuinely async (a Dexie lookup for a
      // persisted exercise), so without this the phone could keep showing the
      // previous exercise's stale controls for a beat after the desktop already
      // moved on.
      sendPlaybackStatusRef.current({ exerciseId: null, title: null, bpm: null, phase: 'none' })
      void navigate(targetPath)
    },
    [navigate, location.pathname],
  )

  const handleSelectRoutine = useCallback(
    (routineId: string) => {
      const targetPath = `/practice/visual/routines/${routineId}/play`
      // Same "re-selecting the current route is a no-op navigation" fix as
      // handleSelectExercise above.
      if (location.pathname === targetPath) return
      // Same "clear before navigate" reasoning as handleSelectExercise —
      // RoutinePlayerPage's own resolution is async too (a whole routine's
      // worth of exercises, resolved up front).
      sendPlaybackStatusRef.current({ exerciseId: null, title: null, bpm: null, phase: 'none' })
      void navigate(targetPath)
    },
    [navigate, location.pathname],
  )

  const handleTransportCommand = useCallback((action: TransportCommandAction) => {
    const session = registeredSessionRef.current
    if (!session) return
    if (action === 'start') session.start()
    else if (action === 'pause') session.pause()
    else if (action === 'resume') session.resume()
    else if (action === 'stop') session.stop()
    else if (action === 'skip') session.skip?.()
    else if (action === 'previous') session.previous?.()
  }, [])

  const { status, sendNotationState, sendExerciseList, sendPlaybackStatus } = useRemoteDrumInput({
    enabled: isEnabled,
    onHit: handleHit,
    onRequestExerciseList: handleRequestExerciseList,
    onSelectExercise: handleSelectExercise,
    onSelectRoutine: handleSelectRoutine,
    onTransportCommand: handleTransportCommand,
  })

  useEffect(() => {
    sendExerciseListRef.current = sendExerciseList
  }, [sendExerciseList])
  useEffect(() => {
    sendPlaybackStatusRef.current = sendPlaybackStatus
  }, [sendPlaybackStatus])

  const toggleEnabled = useCallback(() => {
    setIsEnabled((prev) => {
      const next = !prev
      localStorage.setItem(PHONE_CONTROL_ENABLED_STORAGE_KEY, String(next))
      return next
    })
  }, [])

  const registerSession = useCallback((session: RemoteSession) => {
    registeredSessionRef.current = session
    return () => {
      if (registeredSessionRef.current === session) registeredSessionRef.current = undefined
    }
  }, [])

  const value = useMemo<RemoteHostContextValue>(
    () => ({ status, isEnabled, toggleEnabled, sendNotationState, sendPlaybackStatus, registerSession }),
    [status, isEnabled, toggleEnabled, sendNotationState, sendPlaybackStatus, registerSession],
  )

  return <RemoteHostContext.Provider value={value}>{children}</RemoteHostContext.Provider>
}
