import type { SongStatus } from '../../domain'

export const SONG_STATUS_LABELS: Record<SongStatus, string> = {
  new: 'חדש',
  practicing: 'בתרגול',
  fluent: 'מנוגן חלק',
}
