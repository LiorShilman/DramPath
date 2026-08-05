import { describe, expect, it } from 'vitest'
import { PRODUCTION_RELAY_PORT, buildProductionRelayWsUrl, parseRemoteRelayMessage } from './remote-drum-protocol'

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
})

describe('buildProductionRelayWsUrl', () => {
  it('builds a wss:// url on the current hostname and the fixed production port', () => {
    expect(buildProductionRelayWsUrl('host')).toBe(`wss://${location.hostname}:${PRODUCTION_RELAY_PORT}/ws/host`)
    expect(buildProductionRelayWsUrl('controller')).toBe(`wss://${location.hostname}:${PRODUCTION_RELAY_PORT}/ws/controller`)
  })
})
