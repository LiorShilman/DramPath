import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader, Card, Button, Badge } from '../../components/ui'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { CURRICULUM_STAGES } from '../../lib/visual-trainer/curriculum/curriculum-stages'
import { CURRICULUM_PATTERNS } from '../../lib/visual-trainer/curriculum/pattern-library'
import { DIFFICULTY_LABELS, DIFFICULTY_VARIANTS } from '../visual-trainer/exercise-difficulty-labels'
import { hasGeneratedCurriculumTrack, generateCurriculumTrackUseCase } from './use-cases/generate-curriculum-track'
import { resetCurriculumTrackUseCase } from './use-cases/reset-curriculum-track'

const SUBDIVISION_LABELS: Record<string, string> = {
  quarter: 'רבעים',
  eighth: 'שמיניות',
  sixteenth: 'שש-עשריות',
}

const TOTAL_LESSON_COUNT = CURRICULUM_STAGES.reduce(
  (sum, stage) => sum + (CURRICULUM_PATTERNS[stage.order]?.length ?? 0),
  0,
)

type Status = 'checking' | 'not-generated' | 'generated'

/**
 * Preview-before-commit, same precedent as DrumImportPage: the stage table
 * is shown read-only before any write, one button invokes the transactional
 * use-case. If a track already exists, offers reset+regenerate instead of
 * silently duplicating (generateCurriculumTrackUseCase itself also guards
 * against this, but the UI should never let a user reach that error path
 * in normal use).
 */
export function CurriculumGeneratorPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('checking')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    let cancelled = false
    void hasGeneratedCurriculumTrack().then((exists) => {
      if (!cancelled) setStatus(exists ? 'generated' : 'not-generated')
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleGenerate() {
    setError(null)
    setWorking(true)
    try {
      await generateCurriculumTrackUseCase()
      void navigate('/lessons')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      setWorking(false)
    }
  }

  async function handleResetAndRegenerate() {
    setConfirmReset(false)
    setError(null)
    setWorking(true)
    try {
      await resetCurriculumTrackUseCase()
      await generateCurriculumTrackUseCase()
      void navigate('/lessons')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      setWorking(false)
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title="בניית מסלול שיעורים אוטומטי"
        subtitle="מסלול עצמאי של שיעורי מקצב, בעלייה הדרגתית בכלים, חלוקת זמן וקצב — נפרד מהקורס הקבוע."
        backTo="/lessons"
        backLabel="← חזרה לספריית שיעורים"
      />

      <Card className="flex flex-col gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          {TOTAL_LESSON_COUNT} שיעורים יווצרו, {CURRICULUM_STAGES.length} שלבים ושני שיעורים בכל שלב. כל שיעור כולל
          הסבר קצר, תצוגת תווים וניתן לנגן אותה, ולאחר מכן תרגול עם המלבנים הנעים.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
                <th className="py-1.5 pe-3 font-normal">שלב</th>
                <th className="py-1.5 pe-3 font-normal">כלים</th>
                <th className="py-1.5 pe-3 font-normal">חלוקה</th>
                <th className="py-1.5 pe-3 font-normal">BPM</th>
                <th className="py-1.5 font-normal">רמה</th>
              </tr>
            </thead>
            <tbody>
              {CURRICULUM_STAGES.map((stage) => (
                <tr key={stage.order} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="py-1.5 pe-3">{stage.title}</td>
                  <td className="py-1.5 pe-3">{stage.instruments.length}</td>
                  <td className="py-1.5 pe-3">{SUBDIVISION_LABELS[stage.subdivision]}</td>
                  <td className="py-1.5 pe-3 whitespace-nowrap">
                    {stage.bpm.min}–{stage.bpm.max}
                  </td>
                  <td className="py-1.5">
                    <Badge variant={DIFFICULTY_VARIANTS[stage.difficulty]}>{DIFFICULTY_LABELS[stage.difficulty]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <p className="text-sm text-[var(--color-danger-text)]">{error}</p>}

        {status === 'not-generated' && (
          <Button onClick={() => void handleGenerate()} disabled={working} className="self-start">
            {working ? 'יוצר…' : 'צור את המסלול'}
          </Button>
        )}

        {status === 'generated' && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-[var(--color-text-muted)]">המסלול כבר נוצר. אפשר לאפס וליצור מחדש (למשל לאחר עדכון התבניות).</p>
            <Button
              variant="danger-outline"
              onClick={() => setConfirmReset(true)}
              disabled={working}
              className="self-start"
            >
              {working ? 'מאפס ויוצר מחדש…' : 'איפוס ויצירה מחדש'}
            </Button>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmReset}
        title="לאפס וליצור את המסלול מחדש?"
        description="כל השיעורים שנוצרו אוטומטית יימחקו וייווצרו מחדש. שיעורים שנוצרו ידנית לא ייפגעו."
        confirmLabel="איפוס ויצירה מחדש"
        onConfirm={() => void handleResetAndRegenerate()}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  )
}
