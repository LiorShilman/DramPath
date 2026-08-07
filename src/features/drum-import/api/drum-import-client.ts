import { analyzeResponseSchema, healthResponseSchema, type AnalyzeResponse, type HealthResponse } from '../domain/analyze-response'

// ADR 0006: the drum-import service is an optional local process
// (server/drum-import-service, run separately via `uvicorn`) — the PWA
// never assumes it's running except when the user is actively on this
// page. Overridable via VITE_DRUM_IMPORT_SERVICE_URL for local dev against
// a non-default port. Default targets 127.0.0.1 explicitly, not
// "localhost" — on a machine where something else is already listening on
// port 8000 on the IPv6 loopback (::1), "localhost" can resolve to that
// other process instead of this one, since uvicorn's own default bind
// (127.0.0.1 only, IPv4) never claims ::1.
const configuredServiceUrl = import.meta.env.VITE_DRUM_IMPORT_SERVICE_URL
const SERVICE_URL = typeof configuredServiceUrl === 'string' ? configuredServiceUrl : 'http://127.0.0.1:8000'

const STEM_FIELDS = ['kick', 'snare', 'toms', 'hh', 'ride', 'crash', 'residual'] as const
export type StemFieldName = (typeof STEM_FIELDS)[number]

export class DrumImportServiceUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('שירות ניתוח האודיו אינו זמין. ודאו שהשרת המקומי פועל.')
    this.name = 'DrumImportServiceUnavailableError'
    this.cause = cause
  }
}

export async function checkDrumImportServiceHealth(): Promise<HealthResponse> {
  const response = await fetch(`${SERVICE_URL}/api/v1/health`)
  if (!response.ok) throw new DrumImportServiceUnavailableError()
  return healthResponseSchema.parse(await response.json())
}

// Wraps fetch's network-level rejection (service not running at all) in the
// same error type checkDrumImportServiceHealth's !response.ok path uses, so
// callers only need one catch clause for "service unreachable."
export async function safeCheckDrumImportServiceHealth(): Promise<HealthResponse> {
  try {
    return await checkDrumImportServiceHealth()
  } catch (error) {
    if (error instanceof DrumImportServiceUnavailableError) throw error
    throw new DrumImportServiceUnavailableError(error)
  }
}

export async function analyzeStems(stems: Partial<Record<StemFieldName, File>>): Promise<AnalyzeResponse> {
  const formData = new FormData()
  for (const field of STEM_FIELDS) {
    const file = stems[field]
    if (file) formData.append(field, file, file.name)
  }

  let response: Response
  try {
    response = await fetch(`${SERVICE_URL}/api/v1/analyze`, { method: 'POST', body: formData })
  } catch (error) {
    throw new DrumImportServiceUnavailableError(error)
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { detail?: string } | undefined
    throw new Error(body?.detail ?? `ניתוח האודיו נכשל (HTTP ${response.status}).`)
  }

  return analyzeResponseSchema.parse(await response.json())
}

// ADR 0008 — the optional Fadr-backed path: one full song in, the exact
// same AnalyzeResponse shape out as analyzeStems above. Only meaningful
// when the health check's fadrConfigured is true; the service itself
// still enforces that (503 otherwise), this doesn't duplicate that check.
export async function analyzeFullSong(song: File): Promise<AnalyzeResponse> {
  const formData = new FormData()
  formData.append('song', song, song.name)

  let response: Response
  try {
    response = await fetch(`${SERVICE_URL}/api/v1/analyze-from-song`, { method: 'POST', body: formData })
  } catch (error) {
    throw new DrumImportServiceUnavailableError(error)
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { detail?: string } | undefined
    throw new Error(body?.detail ?? `ניתוח השיר נכשל (HTTP ${response.status}).`)
  }

  return analyzeResponseSchema.parse(await response.json())
}
