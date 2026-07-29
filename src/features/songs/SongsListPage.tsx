import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { songRepository } from '../../data/repositories'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Badge, Button, PageHeader } from '../../components/ui'
import { SONG_STATUS_LABELS } from './song-labels'
import type { Song, SongStatus } from '../../domain'

const ALL = 'all' as const

export function SongsListPage() {
  const navigate = useNavigate()
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<SongStatus | typeof ALL>(ALL)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSetSearch = useDebouncedCallback((value: string) => setSearch(value), 250)
  const [deleteTarget, setDeleteTarget] = useState<Song | null>(null)

  async function reload() {
    const all = await songRepository.getAll()
    setSongs(all.sort((a, b) => a.title.localeCompare(b.title)))
    setLoading(false)
  }

  useEffect(() => {
    // See the same justified fetch-on-mount pattern in Dashboard/useDashboardData.ts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [])

  const filtered = useMemo(() => {
    return songs.filter((song) => {
      if (statusFilter !== ALL && song.status !== statusFilter) return false
      if (search) {
        const haystack = `${song.title} ${song.artist ?? ''}`.toLowerCase()
        if (!haystack.includes(search.toLowerCase())) return false
      }
      return true
    })
  }, [songs, statusFilter, search])

  async function handleCreate() {
    const created = await songRepository.create({
      title: 'שיר חדש',
      exerciseIds: [],
      sections: [],
      status: 'new',
    })
    void navigate(`/songs/${created.id}`)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    await songRepository.remove(deleteTarget.id)
    setDeleteTarget(null)
    void reload()
  }

  if (loading) {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="ספריית שירים"
        actions={<Button onClick={() => void handleCreate()}>+ שיר חדש</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value)
            debouncedSetSearch(event.target.value)
          }}
          placeholder="חיפוש..."
          aria-label="חיפוש שירים"
          className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
        />
        <select
          aria-label="סינון לפי סטטוס"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as SongStatus | typeof ALL)}
          className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1.5 text-sm"
        >
          <option value={ALL}>כל הסטטוסים</option>
          {Object.entries(SONG_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">לא נמצאו שירים.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((song) => (
            <li
              key={song.id}
              className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 [box-shadow:var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between"
            >
              <Link to={`/songs/${song.id}`} className="font-semibold hover:underline">
                {song.title}
                {song.artist ? ` — ${song.artist}` : ''}
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <span className="tabular-nums">{song.bpm ? `${song.bpm} BPM` : '—'}</span>
                <Badge>{SONG_STATUS_LABELS[song.status]}</Badge>
                <Button size="sm" variant="danger-outline" onClick={() => setDeleteTarget(song)}>
                  מחיקה
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`למחוק את "${deleteTarget?.title ?? ''}"?`}
        description="לא ניתן לבטל פעולה זו."
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
