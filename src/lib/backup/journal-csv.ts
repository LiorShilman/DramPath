import type { Exercise, PracticeEntry } from '../../domain'

const HEADERS = ['תאריך', 'שם תרגיל', 'קטגוריה', 'BPM', 'תוצאה', 'משך (שניות)', 'הערה']

const RESULT_LABELS: Record<PracticeEntry['result'], string> = {
  clean: 'נקי',
  needs_work: 'דורש עבודה',
  skipped: 'דילוג',
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// §27: "אפשרות לייצוא CSV של יומן האימונים בלבד" — one row per practice
// entry (not per session), since that's the level the underlying data
// actually lives at.
export function buildJournalCsv(entries: PracticeEntry[], exercises: Exercise[]): string {
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]))

  const rows = [...entries]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((entry) => {
      const exercise = exerciseById.get(entry.exerciseId)
      return [
        new Date(entry.startedAt).toLocaleString('he-IL'),
        exercise?.name ?? '',
        exercise?.category ?? '',
        entry.bpm !== undefined ? String(entry.bpm) : '',
        RESULT_LABELS[entry.result],
        String(entry.durationSeconds),
        entry.notes ?? '',
      ]
    })

  return [HEADERS, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n')
}
