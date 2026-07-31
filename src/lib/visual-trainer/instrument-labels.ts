import type { DrumInstrument } from '../../domain'

export const INSTRUMENT_LABELS: Record<DrumInstrument, string> = {
  kick: 'בס דראם',
  snare: 'סנר',
  hihat_closed: "היי-הט סגור",
  hihat_open: "היי-הט פתוח",
  ride: 'ריייד',
  crash: 'קראש',
  tom_high: 'טמטם גבוה',
  tom_mid: 'טמטם אמצעי',
  tom_floor: 'טמטם רצפה',
}
