import { Badge, PageHeader } from '../../components/ui'

interface ModuleKitPreset {
  order: number
  name: string
  description: string
  recommended?: boolean
}

// Static reference data (not user-editable, not Dexie-backed) — the sound
// Kit list on the user's own Z11D drum module, transcribed from the
// module's own on-screen list so it's reachable from inside DrumPath
// without digging through the module's menus. Doesn't affect anything
// DrumPath itself does: MIDI note + velocity are all it ever reads from a
// real e-kit (see useMidiDrumInput.ts) — the module's own Kit only changes
// what the module itself plays through its own audio out.
const MODULE_KIT_PRESETS: ModuleKitPreset[] = [
  { order: 1, name: 'Improve', description: 'כללי / ברירת מחדל' },
  { order: 2, name: 'Rock', description: 'רוק ופופ-רוק' },
  { order: 3, name: 'Metal core', description: 'מטאל מודרני, צליל אגרסיבי' },
  { order: 4, name: 'Pop', description: 'פופ, שירים מודרניים' },
  { order: 5, name: 'Compact', description: 'קיט יותר הדוק/קומפקטי' },
  { order: 6, name: 'H Rock', description: 'רוק כבד / Hard Rock' },
  { order: 7, name: 'C Jazz', description: 'Jazz' },
  { order: 8, name: 'Customer', description: 'סט מותאם/אלטרנטיבי' },
  { order: 9, name: 'Brush S', description: 'Brush / Jazz רך' },
  { order: 10, name: 'Studio', description: 'צליל אולפני, שימושי מאוד לאימון', recommended: true },
  { order: 11, name: 'Funk', description: 'Funk, Ghost notes, Groove' },
  { order: 12, name: 'Metal', description: 'Metal' },
  { order: 13, name: 'Jungle', description: 'סגנון אלקטרוני / Jungle' },
  { order: 14, name: 'Vintage', description: 'צליל תופים ישן/חם' },
  { order: 15, name: 'S Jazz', description: 'Jazz' },
  { order: 16, name: 'Jazz C', description: 'Jazz' },
  { order: 17, name: 'Acoustic', description: 'תופים אקוסטיים טבעיים', recommended: true },
  { order: 18, name: 'Brush M', description: 'Brush / Jazz' },
  { order: 19, name: 'Classic', description: 'Kit קלאסי' },
  { order: 20, name: 'Latin', description: 'Latin / Percussion' },
]

/** Reference-only page for the user's own e-kit sound module (Z11D) — the
 * Kit list is static device data, not something DrumPath reads or writes;
 * DrumPath's own MIDI input only ever cares about note+velocity per hit
 * (see useMidiDrumInput.ts), regardless of which Kit the module itself is
 * set to. Kept here purely so the list is reachable from inside the app
 * without digging through the module's own menu. */
export function ModuleKitsPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title="מודול תופים — קיטים" backTo="/settings" backLabel="← חזרה להגדרות" />
      <p className="text-sm text-[var(--color-text-muted)]">
        רשימת ה-Kit-ים (בנקי צלילים) של מודול ה-Z11D. הבחירה כאן משפיעה רק על הצליל שנשמע ישירות מהמודול —
        DrumPath קורא רק את הכלי ועוצמת ההקשה מכל MIDI, ומנגן צליל משלו, ללא קשר ל-Kit הפעיל.
      </p>
      <ul className="flex flex-col gap-2">
        {MODULE_KIT_PRESETS.map((kit) => (
          <li
            key={kit.order}
            className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 [box-shadow:var(--shadow-card)]"
          >
            <span className="w-6 shrink-0 text-center text-sm text-[var(--color-text-muted)]">{kit.order}</span>
            <span className="w-28 shrink-0 font-semibold">{kit.name}</span>
            <span className="flex-1 text-sm text-[var(--color-text-muted)]">{kit.description}</span>
            {kit.recommended && <Badge variant="success">מומלץ לאימון</Badge>}
          </li>
        ))}
      </ul>
    </div>
  )
}
