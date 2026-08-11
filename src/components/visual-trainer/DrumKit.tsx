import { useEffect, useState, type CSSProperties } from 'react'
import type { DrumInstrument } from '../../domain'
import { withBaseUrl } from '../../lib/asset-url'

// 9 instruments share 8 visual pieces — hihat_closed/hihat_open are the
// same physical hi-hat, matching the 8 real product photos available
// (public/drum-kit/) — one per piece, hihat.webp already shows the full
// stand+pedal so no separate open/closed artwork is needed.
type DrumPiece = 'kick' | 'snare' | 'hihat' | 'ride' | 'crash' | 'tom_high' | 'tom_mid' | 'tom_floor'

const INSTRUMENT_TO_PIECE: Record<DrumInstrument, DrumPiece> = {
  kick: 'kick',
  snare: 'snare',
  hihat_closed: 'hihat',
  hihat_open: 'hihat',
  ride: 'ride',
  crash: 'crash',
  tom_high: 'tom_high',
  tom_mid: 'tom_mid',
  tom_floor: 'tom_floor',
}

const CYMBAL_PIECES: ReadonlySet<DrumPiece> = new Set(['ride', 'crash', 'hihat'])

// Reverse of INSTRUMENT_TO_PIECE, for tap targets — hihat has no separate
// open/closed artwork to distinguish a tap between them, so a tap always
// resolves to the closed variant (the more common/basic case).
const PIECE_TO_INSTRUMENT: Record<DrumPiece, DrumInstrument> = {
  kick: 'kick',
  snare: 'snare',
  hihat: 'hihat_closed',
  ride: 'ride',
  crash: 'crash',
  tom_high: 'tom_high',
  tom_mid: 'tom_mid',
  tom_floor: 'tom_floor',
}

// Loose collage layout (percent of the container) approximating a kit from
// the player's viewpoint — these are real product photos (generated to
// match the user's own Lemon T550 e-kit, see docs/adr and the tools/
// asset-generation prompts) rather than a technical drawing, so positions
// are laid out by eye, not calculated. This second-generation set replaced
// the original cropped-cymbal/plain-shell photos with full-stand hardware
// shots (hihat/crash/ride now include their entire stand, not just the
// cymbal) plus three new non-interactive pieces (rack, sound module,
// throne — see DECORATION_LAYOUT below) for a fuller "this is literally
// your kit" look. First-pass placement, expected to need visual tuning
// once seen live (every prior DrumKit layout change this project has made
// needed at least one screenshot-driven correction pass).
// Front-facing kit shape: crash/ride angled at the top corners bookending
// the two mounted toms above the kick, hihat stand at the player's far
// left, snare/kick in the front row with the kick largest and centered.
// tom_floor sits further back and to the right (lower top%, higher left%
// than a naive "same row as kick" placement) — pulled back explicitly per
// user feedback, since kick and tom_floor overlapping heavily in the same
// row made kick's rounded edge look like it was cutting into tom_floor's
// silhouette (DOM/paint order already has tom_floor on top — see the
// isActive doc comment on DrumKitProps — this was a spacing issue, not a
// stacking one).
// Percentages below were measured directly off the user's own reference
// photo (Lemon T550 product shot) with a 10%-gridline overlay, not eyeballed
// — each piece's top/left/width matches where that same piece's silhouette
// actually falls in the reference. The reference has no throne in it at
// all (that asset is a bonus addition, not in the source photo), so
// throne's own placement is the one entry here that's a judgment call
// rather than a measurement — see its own comment below.
const PIECE_LAYOUT: Record<DrumPiece, CSSProperties> = {
  crash: { top: '3%', left: '20%', width: '26%' },
  ride: { top: '3%', left: '58%', width: '27%' },
  tom_high: { top: '21%', left: '33%', width: '19%' },
  tom_mid: { top: '21%', left: '50%', width: '18%' },
  hihat: { top: '20%', left: '8%', width: '32%' },
  snare: { top: '40%', left: '33%', width: '24%' },
  kick: { top: '43%', left: '48%', width: '24%' },
  tom_floor: { top: '38%', left: '63%', width: '24%' },
}

// Non-interactive pieces — no DrumInstrument maps to these, so unlike
// PIECE_LAYOUT they never respond to a hit and never appear in
// activeHits/onPieceHit. Purely decorative context around the actual
// instruments. rack renders first (backmost, everything else sits "on" or
// "in front of" it); kick_pedal and throne render after the instrument
// loop further down so they paint in front of the kick body they visually
// belong to/sit in front of.
type Decoration = 'rack' | 'sound_module' | 'kick_pedal' | 'throne'

const DECORATION_LAYOUT: Record<Decoration, CSSProperties> = {
  rack: { top: '15%', left: '15%', width: '70%' },
  sound_module: { top: '33%', left: '22%', width: '16%' },
  kick_pedal: { top: '60%', left: '49%', width: '19%' },
  // Not measurable from the reference (it has no throne) — placed per
  // explicit instruction instead: in the gap between the kick (left: 47%)
  // and the hihat stand (left: 8%, width 32% → right edge ~40%), and lower
  // than both (a seated player's stool is the closest object to the
  // camera in a real kit photo). Sized up from an earlier, smaller pass
  // (reported directly as looking too small) — the closest-to-camera object
  // in a real photo reads as bigger, not smaller, than gear further back.
  throne: { top: '56%', left: '30%', width: '22%' },
}

const DECORATION_IMAGE_SRC: Record<Decoration, string> = {
  rack: withBaseUrl('drum-kit/rack.webp'),
  sound_module: withBaseUrl('drum-kit/sound-module.webp'),
  kick_pedal: withBaseUrl('drum-kit/kick-pedal.webp'),
  throne: withBaseUrl('drum-kit/throne.webp'),
}

const DECORATION_ASPECT_RATIO: Record<Decoration, string> = {
  rack: '867 / 853',
  sound_module: '860 / 840',
  kick_pedal: '800 / 882',
  throne: '600 / 899',
}

const DECORATION_ALT: Record<Decoration, string> = {
  rack: 'שלדת מערכת התופים',
  sound_module: 'מודול הסאונד',
  kick_pedal: 'פדל בס דראם',
  throne: 'כיסא תופים',
}

const PIECE_IMAGE_SRC: Record<DrumPiece, string> = {
  kick: withBaseUrl('drum-kit/kick.webp'),
  snare: withBaseUrl('drum-kit/snare.webp'),
  hihat: withBaseUrl('drum-kit/hihat.webp'),
  ride: withBaseUrl('drum-kit/ride.webp'),
  crash: withBaseUrl('drum-kit/crash.webp'),
  tom_high: withBaseUrl('drum-kit/tom-high.webp'),
  tom_mid: withBaseUrl('drum-kit/tom-mid.webp'),
  tom_floor: withBaseUrl('drum-kit/tom-floor.webp'),
}

// Pieces with a real "hit" product photo (blue head): swap to it for a
// brief flash instead of the scale animation every other piece uses
// (explicit user request — "the same resolution as the original, used
// instead of moving the image"). Matches .drum-hit's 120ms scale animation
// duration plus a little buffer so the swap doesn't feel cut short.
const HIT_IMAGE_SRC: Partial<Record<DrumPiece, string>> = {
  snare: withBaseUrl('drum-kit/snare-hit.webp'),
  kick: withBaseUrl('drum-kit/kick-hit.webp'),
  tom_floor: withBaseUrl('drum-kit/tom-floor-hit.webp'),
  tom_mid: withBaseUrl('drum-kit/tom-mid-hit.webp'),
  tom_high: withBaseUrl('drum-kit/tom-high-hit.webp'),
}
const HIT_FLASH_MS = 150

// Every piece photo is a known fixed size — pinning aspect-ratio means the
// browser reserves the right space immediately, so a freshly-mounted <img>
// (every hit remounts its piece, see DrumKitProps' isActive comment) can
// never visibly collapse/pop-in while it decodes, on top of the actual
// pixel-alignment work below. All 8 pieces get one now (not just tom_floor)
// — this asset generation is full-stand hardware shots and non-square drum
// pads, none of them a plain square crop like the previous set mostly was.
const PIECE_ASPECT_RATIO: Record<DrumPiece, string> = {
  kick: '818 / 850',
  snare: '845 / 600',
  hihat: '571 / 880',
  ride: '562 / 867',
  crash: '576 / 839',
  tom_high: '897 / 838',
  tom_mid: '900 / 874',
  tom_floor: '865 / 600',
}

const PIECE_ALT: Record<DrumPiece, string> = {
  kick: 'בס דראם',
  snare: 'סנר',
  hihat: 'היי-הט',
  ride: 'ריייד',
  crash: 'קראש',
  tom_high: 'טמטם גבוה',
  tom_mid: 'טמטם אמצעי',
  tom_floor: 'טמטם רצפה',
}

export interface DrumKitProps {
  /** Keyed by instrument so two different instruments hit at (near-)the
   * same time both get their own entry instead of one overwriting the
   * other — a single `activeHit` value could only ever highlight one
   * piece, which made simultaneous hits look like only one registered.
   * A new hitToken per hit (e.g. crypto.randomUUID()) forces the piece to
   * remount so its CSS hit-animation restarts even on rapid repeated hits
   * of the same instrument — a class toggle alone can't restart an
   * animation that's already applied. */
  activeHits?: Partial<Record<DrumInstrument, string>>
  /** True for the whole count-in (not per-beat) — shows the held left stick
   * continuously for the entire count-in, not flickering on/off with every
   * beat (explicit user request: only the right stick's strike should
   * flash per beat; the left one just stays visible throughout, like a
   * drummer actually holding it there). */
  isCountingIn?: boolean
  /** A fresh id on every count-in beat — plays the right stick's "strike"
   * animation once per beat (a new token remounts it so its CSS animation
   * restarts, same trick activeHits uses for rapid repeated hits of the
   * same instrument). Only rendered while isCountingIn is also true.
   * Optional: pages without a count-in (or that don't care to show one)
   * simply never pass either prop. */
  stickClickToken?: string
  /** When provided, every piece becomes a tap/click target — calls this
   * with the instrument it represents. Optional and purely additive:
   * existing keyboard-driven callers (VisualTrainerPage,
   * FreeNotationPracticePage) don't pass it, so their pieces stay
   * non-interactive, exactly as before. */
  onPieceHit?: (instrument: DrumInstrument) => void
}

/** Real product photos (public/drum-kit/) laid out as a kit collage —
 * VISUAL_DRUM_TRAINER_SPEC.md §13's hit-animation contract (data-instrument
 * + .drum-piece/.hit/.cymbal classes) is unchanged from the earlier
 * hand-drawn SVG version, so the CSS in index.css didn't need to change.
 * Key letters are shown in the pinned bottom `KeyboardGuide` bar instead of
 * on the pieces themselves — badges layered on the photos were reported as
 * hurting the kit's look. */
/** A piece's own image swap (for pieces with a HIT_IMAGE_SRC entry): starts
 * true exactly when a fresh hit mounts this component (the parent already
 * remounts on a new `key` per hit — see DrumKit's isActive comment), then
 * flips itself back after the flash window so the blue-head photo doesn't
 * stay showing forever. */
function PieceImage({ piece, isActive }: { piece: DrumPiece; isActive: boolean }) {
  const hitImageSrc = HIT_IMAGE_SRC[piece]
  const [showHitImage, setShowHitImage] = useState(isActive && hitImageSrc !== undefined)

  useEffect(() => {
    if (!showHitImage) return
    const timeoutId = window.setTimeout(() => setShowHitImage(false), HIT_FLASH_MS)
    return () => window.clearTimeout(timeoutId)
  }, [showHitImage])

  const src = showHitImage && hitImageSrc ? hitImageSrc : PIECE_IMAGE_SRC[piece]
  const aspectRatio = PIECE_ASPECT_RATIO[piece]
  return (
    <img
      src={src}
      alt={PIECE_ALT[piece]}
      className="w-full drop-shadow-lg"
      style={aspectRatio ? { aspectRatio } : undefined}
    />
  )
}

// Every hit-image src, warmed into the browser's HTTP cache once on the
// kit's first mount — a piece's hit image is otherwise only ever requested
// lazily, the first time that piece is actually hit, which could show as a
// blank/late-popping-in flash instead of an instant swap, independent of
// how precisely the image itself is pixel-aligned to the idle photo.
const HIT_IMAGE_SRCS = Object.values(HIT_IMAGE_SRC)

// Purely visual, never interactive — no onPieceHit/data-instrument, unlike
// PieceImage's pieces. aria-hidden since DECORATION_ALT only exists as a
// human-readable label for future reference, not something a screen-reader
// user needs read out for every one of these on every render.
function DecorationImage({ decoration }: { decoration: Decoration }) {
  return (
    <img
      src={DECORATION_IMAGE_SRC[decoration]}
      alt={DECORATION_ALT[decoration]}
      aria-hidden="true"
      className="w-full drop-shadow-lg"
      style={{ position: 'absolute', aspectRatio: DECORATION_ASPECT_RATIO[decoration], ...DECORATION_LAYOUT[decoration] }}
    />
  )
}

export function DrumKit({ activeHits, isCountingIn, stickClickToken, onPieceHit }: DrumKitProps) {
  useEffect(() => {
    for (const src of HIT_IMAGE_SRCS) {
      const image = new Image()
      image.src = src
    }
  }, [])

  const pieceTokens: Partial<Record<DrumPiece, string>> = {}
  if (activeHits) {
    for (const [instrument, token] of Object.entries(activeHits) as [DrumInstrument, string | undefined][]) {
      if (token) pieceTokens[INSTRUMENT_TO_PIECE[instrument]] = token
    }
  }

  return (
    <div className="relative aspect-[4/3] w-full">
      {/* Backmost — everything else visually sits "on" or "in front of"
          the rack/module, so both paint before the instrument loop below. */}
      <DecorationImage decoration="rack" />
      <DecorationImage decoration="sound_module" />
      {(Object.keys(PIECE_LAYOUT) as DrumPiece[]).map((piece) => {
        const token = pieceTokens[piece]
        const isActive = token !== undefined
        // A piece with a HIT_IMAGE_SRC entry gets its feedback from
        // PieceImage's blue-head image swap plus a lighter glow
        // (image-hit), instead of the scale animation every other piece
        // uses.
        const hasHitImage = HIT_IMAGE_SRC[piece] !== undefined
        const stateClass = isActive ? (hasHitImage ? ' image-hit' : ' hit') : ''
        const className = `drum-piece${CYMBAL_PIECES.has(piece) ? ' cymbal' : ''}${stateClass}`
        return (
          <div
            key={isActive ? token : `${piece}-idle`}
            data-instrument={piece}
            className={`${className}${onPieceHit ? ' touch-manipulation cursor-pointer select-none' : ''}`}
            style={{ position: 'absolute', ...PIECE_LAYOUT[piece] }}
            role={onPieceHit ? 'button' : undefined}
            tabIndex={onPieceHit ? 0 : undefined}
            aria-label={onPieceHit ? PIECE_ALT[piece] : undefined}
            onPointerDown={onPieceHit ? () => onPieceHit(PIECE_TO_INSTRUMENT[piece]) : undefined}
            onKeyDown={
              onPieceHit
                ? (event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    onPieceHit(PIECE_TO_INSTRUMENT[piece])
                  }
                : undefined
            }
          >
            <PieceImage piece={piece} isActive={isActive} />
            {/* A CSS-drawn stick (index.css's .drumstick) rather than
                another product photo: it's reusable across every piece with
                one rule instead of needing a per-piece asset sourced and
                pixel-aligned the way the hit-image photos were. Always
                rendered — index.css only animates/shows it while the
                parent has .hit or .image-hit, so it's invisible at rest.
                Not rendered for kick, which is foot-pedal-operated. */}
            {piece !== 'kick' && <div className="drumstick" aria-hidden="true" />}
          </div>
        )
      })}
      {/* Frontmost pieces — paint after the instrument loop so the pedal
          sits in front of the kick body it belongs to, and the throne (the
          closest-to-camera object in a real kit photo) sits in front of
          everything else. */}
      <DecorationImage decoration="kick_pedal" />
      <DecorationImage decoration="throne" />
      {/* The count-off gesture drummers do before playing starts (see
          index.css's .stick-click-* rules) — right stick strikes left
          (explicit user request), centered above the kit rather than
          anchored to any one piece. The left stick mounts once and stays
          for the whole count-in (isCountingIn, no per-beat remount); only
          the right stick remounts per stickClickToken, so only it re-plays
          its strike animation on every beat — the left one never flickers. */}
      {isCountingIn && (
        <div className="stick-click-overlay" aria-hidden="true">
          <div className="stick-click stick-click-left" />
          {stickClickToken && <div key={stickClickToken} className="stick-click stick-click-right" />}
        </div>
      )}
    </div>
  )
}
