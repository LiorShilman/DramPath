import { useEffect, useRef, useState } from 'react'
import { buildBackupArchive } from '../../lib/backup/export-backup'
import {
  BackupImportError,
  commitImport,
  parseBackupArchive,
  previewImport,
  validateBackupData,
  type ImportMode,
  type ImportPreview,
  type ParsedBackup,
} from '../../lib/backup/import-backup'
import { settingsRepository } from '../../data/repositories'
import { nowIso, type Resource } from '../../domain'
import { Button, Card } from '../../components/ui'

type ExportStatus = 'idle' | 'exporting' | 'done'
type ImportStatus = 'idle' | 'loading' | 'ready' | 'importing' | 'done' | 'error'

const ENTITY_LABELS: Record<string, string> = {
  coursePlans: 'מסלולי לימוד',
  weeks: 'שבועות',
  lessons: 'שיעורים',
  exercises: 'תרגילים',
  songs: 'שירים',
  resources: 'קבצים',
  practiceSessions: 'אימונים',
  practiceEntries: 'רשומות תרגול',
  achievements: 'הישגים',
}

export function BackupSection() {
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle')
  const [importMode, setImportMode] = useState<ImportMode>('merge')
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle')
  const [importError, setImportError] = useState<string | null>(null)
  const [parsedBackup, setParsedBackup] = useState<ParsedBackup | null>(null)
  const [resources, setResources] = useState<Resource[] | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!parsedBackup || importStatus !== 'ready') return
    void previewImport(parsedBackup.data, importMode).then(setPreview)
  }, [importMode, parsedBackup, importStatus])

  async function handleExport() {
    setExportStatus('exporting')
    const archive = await buildBackupArchive()
    const url = URL.createObjectURL(archive)
    const link = document.createElement('a')
    link.href = url
    link.download = `drumpath-backup-${new Date().toISOString().slice(0, 10)}.zip`
    link.click()
    URL.revokeObjectURL(url)
    await settingsRepository.updateSettings({ lastBackupExportAt: nowIso() })
    setExportStatus('done')
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return

    setImportStatus('loading')
    setImportError(null)
    setParsedBackup(null)
    setResources(null)
    setPreview(null)

    try {
      const parsed = await parseBackupArchive(file)
      const validatedResources = await validateBackupData(parsed)
      const importPreview = await previewImport(parsed.data, importMode)
      setParsedBackup(parsed)
      setResources(validatedResources)
      setPreview(importPreview)
      setImportStatus('ready')
    } catch (error) {
      setImportError(
        error instanceof BackupImportError ? error.message : 'אירעה שגיאה בעת קריאת הגיבוי.',
      )
      setImportStatus('error')
    }
  }

  async function handleConfirmImport() {
    if (!parsedBackup || !resources) return
    setImportStatus('importing')
    try {
      await commitImport(parsedBackup.data, resources, importMode)
      setImportStatus('done')
      window.location.reload()
    } catch {
      setImportError('הייבוא נכשל — הנתונים הקיימים לא השתנו.')
      setImportStatus('error')
    }
  }

  function handleCancelImport() {
    setParsedBackup(null)
    setResources(null)
    setPreview(null)
    setImportError(null)
    setImportStatus('idle')
  }

  return (
    <Card className="flex flex-col gap-4">
      <h3 className="font-semibold">גיבוי ושחזור</h3>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-[var(--color-text-muted)]">
          ייצוא קובץ ZIP עם כל הנתונים והקבצים לגיבוי מקומי.
        </p>
        <Button
          className="self-start"
          onClick={() => void handleExport()}
          disabled={exportStatus === 'exporting'}
        >
          {exportStatus === 'exporting'
            ? 'מייצא…'
            : exportStatus === 'done'
              ? 'הגיבוי הורד ✓'
              : 'ייצוא גיבוי'}
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
        <p className="text-sm text-[var(--color-text-muted)]">שחזור מקובץ גיבוי (ZIP).</p>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name="import-mode"
              checked={importMode === 'merge'}
              onChange={() => setImportMode('merge')}
            />
            מיזוג (שמירת נתונים קיימים כברירת מחדל)
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name="import-mode"
              checked={importMode === 'replace'}
              onChange={() => setImportMode('replace')}
            />
            החלפה מלאה
          </label>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/zip,.zip"
          aria-label="בחירת קובץ גיבוי"
          onChange={(event) => void handleFileSelected(event)}
          className="text-sm"
        />

        {importStatus === 'error' && importError && (
          <p className="text-sm text-[var(--color-danger-text)]">{importError}</p>
        )}

        {importStatus === 'ready' && preview && (
          <Card padding="sm" border="primary" className="text-sm">
            <p className="mb-2 font-semibold">
              {importMode === 'replace'
                ? 'כל הנתונים הקיימים יוחלפו בנתוני הגיבוי:'
                : 'תצוגה מקדימה של המיזוג:'}
            </p>
            <ul className="flex flex-col gap-1">
              {Object.entries(preview.counts).map(([entity, counts]) => (
                <li key={entity} className="flex justify-between">
                  <span>{ENTITY_LABELS[entity] ?? entity}</span>
                  <span className="tabular-nums text-[var(--color-text-muted)]">
                    {importMode === 'replace'
                      ? `${counts.total} רשומות`
                      : `${counts.new} חדשות, ${counts.updated} עודכנו, ${counts.unchanged} ללא שינוי`}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => void handleConfirmImport()}>
                אישור ושחזור
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelImport}>
                ביטול
              </Button>
            </div>
          </Card>
        )}

        {importStatus === 'importing' && (
          <p className="text-sm text-[var(--color-text-muted)]">משחזר…</p>
        )}
      </div>
    </Card>
  )
}
