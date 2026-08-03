import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader, Card, Button } from '../../components/ui'
import { analyzeStems, safeCheckDrumImportServiceHealth, type StemFieldName } from './api/drum-import-client'
import { approveDrumImport } from './use-cases/approve-drum-import'
import type { AnalyzeResponse, DrumHitInstrument } from './domain/analyze-response'

const STEM_LABELS: Record<StemFieldName, string> = {
  kick: 'בס דראם (kick)',
  snare: 'סנר (snare)',
  toms: 'טמטמים (toms)',
  hh: 'היי-הט (hh)',
  ride: 'ריייד (ride)',
  crash: 'קראש (crash)',
  residual: 'שאריות (residual)',
}
const STEM_ORDER: StemFieldName[] = ['kick', 'snare', 'toms', 'hh', 'ride', 'crash', 'residual']

const INSTRUMENT_LABELS_WIRE: Record<DrumHitInstrument, string> = {
  kick: 'בס דראם',
  snare: 'סנר',
  tom_floor: 'טמטם רצפה',
  tom_mid: 'טמטם אמצעי',
  tom_high: 'טמטם גבוה',
  hihat: 'היי-הט',
  ride: 'ריייד',
  crash: 'קראש',
  residual: 'שאריות (לא יסווגו)',
}

type ServiceStatus = { kind: 'checking' } | { kind: 'ok' } | { kind: 'unavailable'; message: string }

/**
 * Import notation from separated drum-stem audio files, via the local
 * drum-import-service (ADR 0006 — optional external process, only needed
 * while actually on this page). Three states in one page, no wizard:
 * upload -> preview -> approve.
 */
export function DrumImportPage() {
  const navigate = useNavigate()
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({ kind: 'checking' })
  const [files, setFiles] = useState<Partial<Record<StemFieldName, File>>>({})
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [title, setTitle] = useState('')
  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void safeCheckDrumImportServiceHealth()
      .then((health) => {
        if (cancelled) return
        setServiceStatus(
          health.ffmpegAvailable
            ? { kind: 'ok' }
            : { kind: 'unavailable', message: 'השרת פועל אך ffmpeg אינו זמין בו.' },
        )
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setServiceStatus({ kind: 'unavailable', message: error instanceof Error ? error.message : String(error) })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const hasAnyFile = Object.values(files).some((file) => file !== undefined)

  async function handleAnalyze() {
    setAnalyzeError(null)
    setAnalyzing(true)
    try {
      const response = await analyzeStems(files)
      setResult(response)
    } catch (error) {
      setAnalyzeError(error instanceof Error ? error.message : String(error))
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleApprove() {
    if (!result) return
    if (!title.trim()) {
      setApproveError('צריך לתת שם לתרגיל.')
      return
    }
    setApproveError(null)
    setApproving(true)
    try {
      const sourceStemFileNames = STEM_ORDER.map((field) => files[field]?.name).filter(
        (name): name is string => name !== undefined,
      )
      const approved = await approveDrumImport({ title: title.trim(), response: result, sourceStemFileNames })
      void navigate(`/practice/visual/${approved.interactiveExerciseId}`)
    } catch (error) {
      setApproveError(error instanceof Error ? error.message : String(error))
      setApproving(false)
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title="ייבוא תווים מהקלטה"
        subtitle="העלאת קבצי stem נפרדים (kick/snare/toms/hh/ride/crash/residual) לניתוח אוטומטי וזיהוי מכות תופים."
        backTo="/practice/visual"
      />

      {serviceStatus.kind === 'unavailable' && (
        <Card border="warning" className="text-sm text-[var(--color-warning-text)]">
          {serviceStatus.message}
        </Card>
      )}

      {!result && (
        <Card className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {STEM_ORDER.map((field) => (
              <label key={field} className="flex flex-col gap-1 text-sm">
                <span>{STEM_LABELS[field]}</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    setFiles((current) => ({ ...current, [field]: file }))
                  }}
                  className="text-sm"
                />
              </label>
            ))}
          </div>
          {analyzeError && <p className="text-sm text-[var(--color-danger-text)]">{analyzeError}</p>}
          <Button
            onClick={() => void handleAnalyze()}
            disabled={!hasAnyFile || analyzing || serviceStatus.kind !== 'ok'}
          >
            {analyzing ? 'מנתח…' : 'נתח קבצי אודיו'}
          </Button>
        </Card>
      )}

      {result && (
        <Card className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <div className="text-[var(--color-text-muted)]">קצב שזוהה</div>
              <div className="font-semibold">{Math.round(result.detectedConstantBpm)} BPM</div>
            </div>
            <div>
              <div className="text-[var(--color-text-muted)]">מספר תיבות</div>
              <div className="font-semibold">{result.measures}</div>
            </div>
            <div>
              <div className="text-[var(--color-text-muted)]">רמת ודאות הקצב</div>
              <div className="font-semibold">{Math.round(result.beatFitScore * 100)}%</div>
            </div>
            <div>
              <div className="text-[var(--color-text-muted)]">מכות טום לא ודאיות</div>
              <div className="font-semibold">{result.uncertainTomHitCount}</div>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-text-muted)]">מכות שזוהו לפי כלי:</span>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {Object.entries(result.eventCountsByInstrument).map(([instrument, count]) => (
                <li key={instrument}>
                  {INSTRUMENT_LABELS_WIRE[instrument as DrumHitInstrument]}: {count}
                </li>
              ))}
            </ul>
          </div>

          {result.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-[var(--color-warning-text)]">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span>שם התרגיל</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5"
              placeholder="לדוגמה: שם השיר"
            />
          </label>

          {approveError && <p className="text-sm text-[var(--color-danger-text)]">{approveError}</p>}

          <div className="flex gap-2">
            <Button onClick={() => void handleApprove()} disabled={approving}>
              {approving ? 'שומר…' : 'אשר וצור תרגיל'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setResult(null)
                setAnalyzeError(null)
              }}
              disabled={approving}
            >
              נתח שוב
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
