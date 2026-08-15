import { z } from 'zod'
import {
  drumInstrumentSchema,
  extraHitEventSchema,
  hitGradeSchema,
  interactiveExerciseDifficultySchema,
  interactiveExerciseSchema,
} from '../../domain'

// Wire format for server/remote-drum-relay's WebSocket endpoints — kept in
// its own module (rather than inlined in the two hooks that use it) so
// useRemoteDrumInput.ts (desktop) and useRemoteDrumSender.ts (phone) parse
// incoming messages identically instead of each having its own ad-hoc JSON
// handling. No timestamp field on 'hit': the desktop stamps its own
// performance.now() the instant it receives the message rather than
// trusting the phone's unsynchronized clock — see ADR 0007.
const hitMessageSchema = z.object({ type: z.literal('hit'), instrument: drumInstrumentSchema })
const hostStatusMessageSchema = z.object({ type: z.literal('host_status'), connected: z.boolean() })
const controllerStatusMessageSchema = z.object({ type: z.literal('controller_status'), count: z.number().int().nonnegative() })
// Host -> controller direction (the phone mirroring the desktop's own
// currently-playing notation, explicit user request — hands are on a real
// e-kit, not the keyboard, so the phone becomes the display instead of the
// computer screen). Two separate small message types rather than one
// nullable-payload type, matching every other message shape in this file.
// Reuses interactiveExerciseSchema directly (not a lighter summary) — a
// typical exercise is small, flat JSON, well within one WS frame.
const notationStateMessageSchema = z.object({
  type: z.literal('notation_state'),
  exercise: interactiveExerciseSchema,
  playbackProgress: z.object({
    bpm: z.number(),
    sessionId: z.number(),
    startOffsetMs: z.number().optional(),
  }),
  paused: z.boolean(),
  // Per-note grading result (ExerciseNotationSheet's own gradedEventIds
  // prop — perfect/early/late all color a notehead green-ish, miss red; see
  // that component's own doc comment for exactly how) — a plain
  // string-keyed object, not a Map, since Map isn't JSON-serializable.
  // Keyed by DrumNoteEvent id. HitResult's own grade (hit-result.ts), not a
  // narrower hit/miss — early/late vs. perfect is what decides whether the
  // hit-position marker (hitTimingByEventId below) is worth drawing at all.
  gradedEventIds: z.record(z.string(), hitGradeSchema),
  // Per-note actual strike time (ms elapsed since bar 1, same clock the
  // note's own expectedTimeMs is measured against) — explicit user request:
  // seeing exactly where a hit landed relative to its note (not just
  // hit/miss) is what lets a player calibrate their own timing.
  // ExerciseNotationSheet's own hitTimingByEventId prop, same
  // keyed-by-DrumNoteEvent-id/plain-object shape as gradedEventIds above.
  hitTimingByEventId: z.record(z.string(), z.number()),
  // Every hit this run that matched no pending event — explicit user
  // request: with the results screen already counting these against
  // accuracy, an all-green sheet showing nothing wrong for them read as a
  // mismatch between the numbers and the display.
  extraHits: z.array(extraHitEventSchema),
  // Live running accuracy (0-100), recomputed on every hit/miss — explicit
  // user request: seeing where you stand mid-run, not just at the end.
  // Rides this same message (not a separate one) for the same reason
  // gradedEventIds/hitTimingByEventId do: it needs to stay in lockstep with
  // whichever hit/miss just changed it, not risk arriving out of order on
  // its own channel.
  liveAccuracyPercent: z.number(),
})
const notationClearMessageSchema = z.object({ type: z.literal('notation_clear') })

// Full remote control (browse/select/play/pause/resume/stop from the phone)
// — controller -> host: request_exercise_list/select_exercise/
// transport_command. host -> controller: exercise_list/playback_status.
// Kept as separate small schemas, same convention as every other message
// here, rather than one big "remote command" type.
const exerciseListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  bpm: z.number(),
  difficulty: interactiveExerciseDifficultySchema,
  // Persisted (Dexie) exercise vs. the in-memory demo catalog — same
  // distinction ExerciseSelectPage already renders as a "שלי" badge.
  isCustom: z.boolean(),
})
// Practice routines (setlists, src/domain/practice-routine.ts) — a much
// lighter summary than exerciseListItemSchema, since the phone only needs
// enough to show a pickable row (title + how many steps), not per-step
// detail; the routine's own exerciseIds resolve once the desktop starts it.
const routineListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  exerciseCount: z.number().int().positive(),
})
const exerciseListMessageSchema = z.object({
  type: z.literal('exercise_list'),
  exercises: z.array(exerciseListItemSchema),
  routines: z.array(routineListItemSchema),
})
const requestExerciseListMessageSchema = z.object({ type: z.literal('request_exercise_list') })
const selectExerciseMessageSchema = z.object({ type: z.literal('select_exercise'), exerciseId: z.string() })
// Separate from select_exercise (not a shared "select" type with a kind
// discriminator) — matches this file's convention of one small explicit
// schema per message rather than a polymorphic one.
const selectRoutineMessageSchema = z.object({ type: z.literal('select_routine'), routineId: z.string() })
const transportCommandMessageSchema = z.object({
  type: z.literal('transport_command'),
  // 'skip'/'previous': move a running routine forward/back one step (see
  // RoutinePlayerPage) — both a no-op if the current session isn't a
  // routine, and 'previous' also a no-op already on the first step.
  action: z.enum(['start', 'pause', 'resume', 'stop', 'skip', 'previous']),
})
// Unconditional session status (unlike notation_state, which only fires for
// a real, non-demo run with MIDI enabled — regardless of display mode) —
// this is what drives the phone's transport buttons. exerciseId/title/bpm are all null
// together exactly when phase is 'none' (nothing loaded on the desktop).
// Deliberately NOT importing VisualTrainerPhase from useVisualTrainer.ts
// here — this lib module is imported BY that hook (via useRemoteDrumInput),
// so importing back would invert the dependency; the phase values are
// inlined as their own literal union instead.
const playbackStatusMessageSchema = z.object({
  type: z.literal('playback_status'),
  exerciseId: z.string().nullable(),
  title: z.string().nullable(),
  bpm: z.number().nullable(),
  phase: z.enum(['idle', 'count-in', 'running', 'paused', 'finished', 'none']),
  // Present only while running a practice routine (RoutinePlayerPage) —
  // drives the phone's "skip" button and step indicator ("2/5"). Optional
  // so every existing non-routine sendPlaybackStatus call site needs no
  // changes.
  routineProgress: z.object({ stepIndex: z.number().int().nonnegative(), stepCount: z.number().int().positive() }).optional(),
  // Present only when phase is 'finished' — explicit user request: with
  // practice driven entirely from the phone ("no access to the computer"),
  // the results screen (today, desktop-only, VisualTrainerRunner's own
  // SessionResults dialog) needs to be visible on the phone too. Rides the
  // SAME message as the 'finished' transition itself (not a separate
  // message type) for the same reason routineProgress does — a second
  // channel could arrive out of order relative to the phase transition it
  // describes.
  resultsSummary: z
    .object({
      accuracyPercent: z.number(),
      gradeCounts: z.object({
        perfect: z.number().int().nonnegative(),
        early: z.number().int().nonnegative(),
        late: z.number().int().nonnegative(),
        miss: z.number().int().nonnegative(),
        extra: z.number().int().nonnegative(),
      }),
    })
    .optional(),
})

export const remoteRelayMessageSchema = z.discriminatedUnion('type', [
  hitMessageSchema,
  hostStatusMessageSchema,
  controllerStatusMessageSchema,
  notationStateMessageSchema,
  notationClearMessageSchema,
  exerciseListMessageSchema,
  requestExerciseListMessageSchema,
  selectExerciseMessageSchema,
  selectRoutineMessageSchema,
  transportCommandMessageSchema,
  playbackStatusMessageSchema,
])

// Mirrors server/remote-drum-relay/app/main.py's SUPERSEDED_CLOSE_CODE — the
// desktop-side hook must treat exactly this WS close code as "a second
// desktop tab took over, don't auto-reconnect" (see ADR 0007) rather than
// an ordinary disconnect worth retrying.
export const SUPERSEDED_CLOSE_CODE = 4001
export const DEFAULT_RELAY_PORT = 8001

// The relay's always-on production instance (PM2, own TLS cert exported
// from the same certificate every other project on this machine already
// shares — see ecosystem.config.js and ADR 0007) — a fixed, memorable
// address reachable the same way whether the phone is on the home network
// or away, no LAN IP or hostname to type in. Only used when the page itself
// was loaded over https (the deployed IIS site) — dev mode keeps using
// DEFAULT_RELAY_PORT over plain ws://localhost, unchanged.
export const PRODUCTION_RELAY_PORT = 40001

export function buildProductionRelayWsUrl(role: 'host' | 'controller'): string {
  return `wss://${location.hostname}:${PRODUCTION_RELAY_PORT}/ws/${role}`
}

export type RemoteRelayMessage = z.infer<typeof remoteRelayMessageSchema>
export type HitMessage = z.infer<typeof hitMessageSchema>
export type HostStatusMessage = z.infer<typeof hostStatusMessageSchema>
export type ControllerStatusMessage = z.infer<typeof controllerStatusMessageSchema>
export type NotationStateMessage = z.infer<typeof notationStateMessageSchema>
export type NotationClearMessage = z.infer<typeof notationClearMessageSchema>
export type ExerciseListItem = z.infer<typeof exerciseListItemSchema>
export type RoutineListItem = z.infer<typeof routineListItemSchema>
export type ExerciseListMessage = z.infer<typeof exerciseListMessageSchema>
export type RequestExerciseListMessage = z.infer<typeof requestExerciseListMessageSchema>
export type SelectExerciseMessage = z.infer<typeof selectExerciseMessageSchema>
export type SelectRoutineMessage = z.infer<typeof selectRoutineMessageSchema>
export type TransportCommandAction = z.infer<typeof transportCommandMessageSchema>['action']
export type TransportCommandMessage = z.infer<typeof transportCommandMessageSchema>
export type PlaybackStatusMessage = z.infer<typeof playbackStatusMessageSchema>

/** Parses a raw WebSocket text frame into a typed message, or undefined for
 * anything malformed (invalid JSON, unknown `type`, wrong shape) — the
 * relay itself already drops malformed input server-side, but a client
 * should never trust the wire regardless of what the server is expected to
 * do. Never throws. */
export function parseRemoteRelayMessage(raw: string): RemoteRelayMessage | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }
  const result = remoteRelayMessageSchema.safeParse(parsed)
  return result.success ? result.data : undefined
}
