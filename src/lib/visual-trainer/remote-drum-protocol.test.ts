import { describe, expect, it } from 'vitest'
import { PRODUCTION_RELAY_PORT, buildProductionRelayWsUrl, parseRemoteRelayMessage } from './remote-drum-protocol'
import { createId, nowIso } from '../../domain'
import type { InteractiveExercise } from '../../domain'

function makeExercise(): InteractiveExercise {
  const now = nowIso()
  return {
    id: createId(),
    title: 'test exercise',
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
    createdAt: now,
    updatedAt: now,
  }
}

describe('parseRemoteRelayMessage', () => {
  it('parses a valid hit message', () => {
    expect(parseRemoteRelayMessage('{"type":"hit","instrument":"snare"}')).toEqual({
      type: 'hit',
      instrument: 'snare',
    })
  })

  it('parses a valid host_status message', () => {
    expect(parseRemoteRelayMessage('{"type":"host_status","connected":true}')).toEqual({
      type: 'host_status',
      connected: true,
    })
  })

  it('parses a valid controller_status message', () => {
    expect(parseRemoteRelayMessage('{"type":"controller_status","count":2}')).toEqual({
      type: 'controller_status',
      count: 2,
    })
  })

  it('returns undefined for garbage (non-JSON) input', () => {
    expect(parseRemoteRelayMessage('not json at all')).toBeUndefined()
  })

  it('returns undefined for an unknown message type', () => {
    expect(parseRemoteRelayMessage('{"type":"ping"}')).toBeUndefined()
  })

  it('returns undefined for a hit message with an invalid instrument', () => {
    expect(parseRemoteRelayMessage('{"type":"hit","instrument":"tambourine"}')).toBeUndefined()
  })

  it('returns undefined for a message missing a required field', () => {
    expect(parseRemoteRelayMessage('{"type":"hit"}')).toBeUndefined()
  })

  it('parses a valid notation_state message, exercise and all', () => {
    const exercise = makeExercise()
    const raw = JSON.stringify({
      type: 'notation_state',
      exercise,
      playbackProgress: { bpm: 100, sessionId: 1, startOffsetMs: -50 },
      paused: false,
      gradedEventIds: { 'event-1': 'hit', 'event-2': 'miss' },
    })
    expect(parseRemoteRelayMessage(raw)).toEqual({
      type: 'notation_state',
      exercise,
      playbackProgress: { bpm: 100, sessionId: 1, startOffsetMs: -50 },
      paused: false,
      gradedEventIds: { 'event-1': 'hit', 'event-2': 'miss' },
    })
  })

  it('parses a valid notation_clear message', () => {
    expect(parseRemoteRelayMessage('{"type":"notation_clear"}')).toEqual({ type: 'notation_clear' })
  })

  it('returns undefined for a notation_state message missing its exercise', () => {
    const raw = JSON.stringify({ type: 'notation_state', playbackProgress: { bpm: 100, sessionId: 1 }, paused: false })
    expect(parseRemoteRelayMessage(raw)).toBeUndefined()
  })

  it('returns undefined for a notation_state message whose exercise fails its own schema', () => {
    const raw = JSON.stringify({
      type: 'notation_state',
      exercise: { ...makeExercise(), bpm: 'not a number' },
      playbackProgress: { bpm: 100, sessionId: 1 },
      paused: false,
    })
    expect(parseRemoteRelayMessage(raw)).toBeUndefined()
  })

  // Full remote control (browse/select/play/pause/resume/stop from the
  // phone) — controller -> host: request_exercise_list/select_exercise/
  // transport_command. host -> controller: exercise_list/playback_status.

  it('parses a valid request_exercise_list message', () => {
    expect(parseRemoteRelayMessage('{"type":"request_exercise_list"}')).toEqual({ type: 'request_exercise_list' })
  })

  it('parses a valid select_exercise message', () => {
    expect(parseRemoteRelayMessage('{"type":"select_exercise","exerciseId":"abc-123"}')).toEqual({
      type: 'select_exercise',
      exerciseId: 'abc-123',
    })
  })

  it('returns undefined for a select_exercise message missing exerciseId', () => {
    expect(parseRemoteRelayMessage('{"type":"select_exercise"}')).toBeUndefined()
  })

  it('parses a valid select_routine message', () => {
    expect(parseRemoteRelayMessage('{"type":"select_routine","routineId":"routine-1"}')).toEqual({
      type: 'select_routine',
      routineId: 'routine-1',
    })
  })

  it('returns undefined for a select_routine message missing routineId', () => {
    expect(parseRemoteRelayMessage('{"type":"select_routine"}')).toBeUndefined()
  })

  it('parses a valid transport_command message for each action, including skip', () => {
    for (const action of ['start', 'pause', 'resume', 'stop', 'skip']) {
      expect(parseRemoteRelayMessage(`{"type":"transport_command","action":"${action}"}`)).toEqual({
        type: 'transport_command',
        action,
      })
    }
  })

  it('returns undefined for a transport_command message with an invalid action', () => {
    expect(parseRemoteRelayMessage('{"type":"transport_command","action":"rewind"}')).toBeUndefined()
  })

  it('parses a valid exercise_list message, exercises and routines, empty or populated', () => {
    expect(parseRemoteRelayMessage('{"type":"exercise_list","exercises":[],"routines":[]}')).toEqual({
      type: 'exercise_list',
      exercises: [],
      routines: [],
    })
    const raw = JSON.stringify({
      type: 'exercise_list',
      exercises: [{ id: 'ex-1', title: 'Basic Rock Beat', bpm: 90, difficulty: 'beginner', isCustom: true }],
      routines: [{ id: 'routine-1', title: 'Warm-up', exerciseCount: 3 }],
    })
    expect(parseRemoteRelayMessage(raw)).toEqual({
      type: 'exercise_list',
      exercises: [{ id: 'ex-1', title: 'Basic Rock Beat', bpm: 90, difficulty: 'beginner', isCustom: true }],
      routines: [{ id: 'routine-1', title: 'Warm-up', exerciseCount: 3 }],
    })
  })

  it('returns undefined for an exercise_list message missing routines', () => {
    const raw = JSON.stringify({
      type: 'exercise_list',
      exercises: [],
    })
    expect(parseRemoteRelayMessage(raw)).toBeUndefined()
  })

  it('returns undefined for an exercise_list item with an invalid difficulty', () => {
    const raw = JSON.stringify({
      type: 'exercise_list',
      exercises: [{ id: 'ex-1', title: 'x', bpm: 90, difficulty: 'expert', isCustom: true }],
      routines: [],
    })
    expect(parseRemoteRelayMessage(raw)).toBeUndefined()
  })

  it('returns undefined for a routine_list item with a non-positive exerciseCount', () => {
    const raw = JSON.stringify({
      type: 'exercise_list',
      exercises: [],
      routines: [{ id: 'routine-1', title: 'x', exerciseCount: 0 }],
    })
    expect(parseRemoteRelayMessage(raw)).toBeUndefined()
  })

  it('parses a valid playback_status message, including the all-null "nothing loaded" shape', () => {
    expect(
      parseRemoteRelayMessage('{"type":"playback_status","exerciseId":null,"title":null,"bpm":null,"phase":"none"}'),
    ).toEqual({ type: 'playback_status', exerciseId: null, title: null, bpm: null, phase: 'none' })

    const raw = JSON.stringify({ type: 'playback_status', exerciseId: 'ex-1', title: 'x', bpm: 90, phase: 'running' })
    expect(parseRemoteRelayMessage(raw)).toEqual({
      type: 'playback_status',
      exerciseId: 'ex-1',
      title: 'x',
      bpm: 90,
      phase: 'running',
    })
  })

  it('parses a valid playback_status message with routineProgress', () => {
    const raw = JSON.stringify({
      type: 'playback_status',
      exerciseId: 'ex-1',
      title: 'x',
      bpm: 90,
      phase: 'running',
      routineProgress: { stepIndex: 1, stepCount: 3 },
    })
    expect(parseRemoteRelayMessage(raw)).toEqual({
      type: 'playback_status',
      exerciseId: 'ex-1',
      title: 'x',
      bpm: 90,
      phase: 'running',
      routineProgress: { stepIndex: 1, stepCount: 3 },
    })
  })

  it('returns undefined for a playback_status message with an invalid phase', () => {
    const raw = JSON.stringify({ type: 'playback_status', exerciseId: null, title: null, bpm: null, phase: 'rewinding' })
    expect(parseRemoteRelayMessage(raw)).toBeUndefined()
  })
})

describe('buildProductionRelayWsUrl', () => {
  it('builds a wss:// url on the current hostname and the fixed production port', () => {
    expect(buildProductionRelayWsUrl('host')).toBe(`wss://${location.hostname}:${PRODUCTION_RELAY_PORT}/ws/host`)
    expect(buildProductionRelayWsUrl('controller')).toBe(`wss://${location.hostname}:${PRODUCTION_RELAY_PORT}/ws/controller`)
  })
})
