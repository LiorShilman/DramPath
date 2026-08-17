import { createContext, useContext } from 'react'
import type {
  NotationStatePayload,
  PedalDisciplineStatePayload,
  PlaybackStatusPayload,
  RemoteDrumInputStatus,
} from '../../hooks/useRemoteDrumInput'
import type { DrumInstrument } from '../../domain'

/** What a mounted useVisualTrainer instance registers with
 * RemoteHostProvider so inbound phone commands (a hit, or a
 * transport_command) reach the actual practice session currently on
 * screen. Exactly one of these is ever registered at a time — only one
 * VisualTrainerRunner is ever mounted. */
export interface RemoteSession {
  handleHit: (instrument: DrumInstrument, hitTimeMs: number) => void
  start: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  /** Only set for a practice-routine run (RoutinePlayerPage) — advances to
   * the next step. Absent for a plain single-exercise session, in which
   * case a remote 'skip' transport_command is a correct no-op. */
  skip?: () => void
  /** Only set for a practice-routine run, and only once at least one step
   * back exists — jumps to the previous step (explicit user request:
   * practice driven entirely from the phone needs a way to redo/revisit a
   * step, not just move forward). Absent otherwise, in which case a remote
   * 'previous' transport_command is a correct no-op. */
  previous?: () => void
  /** Re-sends this session's real current status (exercise + live phase) —
   * used when the phone re-selects whatever's already the current
   * exercise/routine: navigate() to an unchanged route is a no-op (nothing
   * remounts), so this is the only way to correct a phone whose own
   * display is stuck wrong (e.g. from a dropped message or a reconnect)
   * short of an actual phase transition happening to occur. Always
   * present, unlike skip/previous — every session has SOME current status
   * worth re-asserting. */
  resendStatus: () => void
}

export interface RemoteHostContextValue {
  status: RemoteDrumInputStatus
  /** Phone-as-remote-controller (ADR 0007) — off by default, persisted
   * across sessions. Owned by RemoteHostProvider (not useVisualTrainer) so
   * the connection exists for the whole app, not just while a practice page
   * is mounted — required for exercise-list browsing to work before any
   * exercise is even open, and a side effect worth knowing: the WS now
   * stays open everywhere (dashboard, lessons, settings) whenever this is
   * on, not just mid-run. */
  isEnabled: boolean
  toggleEnabled: () => void
  sendNotationState: (state: NotationStatePayload | null) => void
  sendPlaybackStatus: (status: PlaybackStatusPayload) => void
  /** PedalDisciplinePage's own mirror — see PedalDisciplineStatePayload. A
   * completely separate screen from the notation/exercise flow above, sent
   * directly by that page rather than via registerSession (it doesn't take
   * remote hits/transport commands, so there's no RemoteSession to
   * register). */
  sendPedalDisciplineState: (state: PedalDisciplineStatePayload | null) => void
  /** Called by useVisualTrainer on mount (and whenever its callbacks'
   * identities change); returns an unregister function. The unregister
   * function only clears the slot if it's still the registration that
   * created it (same identity-guard pattern as useRemoteDrumInput's own
   * socketRef) — a late cleanup from an already-superseded registration
   * must not wipe out a newer one. */
  registerSession: (session: RemoteSession) => () => void
}

// Kept in its own (non-.tsx) file, separate from RemoteHostProvider.tsx's
// actual component — react-refresh/only-export-components requires a file
// to export only components, so the context object/hook (not components)
// live here instead, same reasoning lazy-pages.tsx's own doc comment
// already documents for that file's split.
export const RemoteHostContext = createContext<RemoteHostContextValue | undefined>(undefined)

export function useRemoteHost(): RemoteHostContextValue {
  const context = useContext(RemoteHostContext)
  if (!context) throw new Error('useRemoteHost must be used within a RemoteHostProvider')
  return context
}
