import type { Song } from '../../domain/song'

export type SongSeedInput = Omit<Song, 'id' | 'createdAt' | 'updatedAt'>

// Metadata only (title/artist) — no audio, links, or lyrics. Matches the
// example list in SPEC.md §19. The spec also mentions unlisted Hebrew songs
// from the course materials; since those titles weren't provided, two
// generic placeholders stand in for the user to replace.
export function buildSongSeed(): SongSeedInput[] {
  const songs: Array<{ title: string; artist: string }> = [
    { title: 'Billie Jean', artist: 'Michael Jackson' },
    { title: 'Highway to Hell', artist: 'AC/DC' },
    { title: 'Another One Bites the Dust', artist: 'Queen' },
    { title: 'Eye of the Tiger', artist: 'Survivor' },
    { title: 'Every Breath You Take', artist: 'The Police' },
    { title: 'שיר עברי לדוגמה 1', artist: 'להשלמה' },
    { title: 'שיר עברי לדוגמה 2', artist: 'להשלמה' },
  ]

  return songs.map(({ title, artist }) => ({
    title,
    artist,
    exerciseIds: [],
    sections: [],
    status: 'new' as const,
  }))
}
