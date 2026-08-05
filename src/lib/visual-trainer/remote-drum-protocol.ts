import { z } from 'zod'
import { drumInstrumentSchema } from '../../domain'

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

export const remoteRelayMessageSchema = z.discriminatedUnion('type', [
  hitMessageSchema,
  hostStatusMessageSchema,
  controllerStatusMessageSchema,
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
