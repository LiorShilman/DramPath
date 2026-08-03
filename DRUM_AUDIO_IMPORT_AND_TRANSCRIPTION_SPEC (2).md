# Drum Audio Import & Transcription
## אפיון מקצועי להרחבת DrumPath: קלט אודיו, תמלול תופים, MIDI, MusicXML ו-PDF

**סוג מסמך:** מסמך הרחבה ל-`SPEC.md` ול-`VISUAL_DRUM_TRAINER_SPEC.md`  
**מערכת יעד:** DrumPath / Visual Drum Trainer  
**Frontend קיים:** React 19 + TypeScript strict + Vite, עברית RTL, PWA ו-Local-first  
**אחסון קיים:** Dexie.js / IndexedDB דרך Repositories  
**שירות Import מוצע:** שירות אופציונלי ונפרד; ASP.NET Core Orchestrator + Python Audio Worker הם המלצה, לא חלק מה-Stack הקיים  
**גרסת אפיון:** 1.2  
**סטטוס:** מוכן למימוש הדרגתי  

---

# 0. מסמכי מקור, קדימות ושינויים בגרסה 1.2

המסמך עודכן מול שני מסמכי המערכת הנוכחיים שסופקו:

1. `SPEC.md` — מקור האמת למוצר DrumPath, ל-Stack, לישויות הליבה, ל-Dexie, לגיבוי, ל-PWA ולכללי העבודה.
2. `VISUAL_DRUM_TRAINER_SPEC.md` — מקור האמת למנוע התרגול החזותי, `DrumInstrument`, `DrumNoteEvent`, `InteractiveExercise`, נתיבי המודול, תזמון, אודיו וניקוד.
3. מסמך זה — מקור האמת רק ליכולת Import/Transcription החדשה.

במקרה של סתירה:

```text
SPEC.md
  -> VISUAL_DRUM_TRAINER_SPEC.md
     -> DRUM_AUDIO_IMPORT_AND_TRANSCRIPTION_SPEC.md
```

מסמך זה רשאי להוסיף ישויות ושדות, אך אינו רשאי לשנות בשקט החלטה קיימת. כל שינוי נדרש יתבצע באמצעות Migration תואם לאחור ו-ADR.

שינויים עיקריים לעומת גרסה 1.0:

- התאמה מפורשת ל-React 19, Vite, Zustand, Dexie, Zod וארכיטקטורת ה-Repositories.
- הפרדה בין ישות הליבה `Exercise` לבין `InteractiveExercise` של Visual Trainer.
- שילוב עם `Song`, `Resource`, `PracticeSession` ו-`PracticeEntry` הקיימים.
- סכמת Dexie נוספת ללא שינוי טבלאות הליבה הקיימות.
- הבחנה בין Tempo Map לייצוא ובין BPM קבוע למנוע התרגול הקיים.
- חסימת Triplet לתרגיל אינטראקטיבי עד שמנוע Visual Trainer יתמוך בו.
- התאמת אחסון, גיבוי, PWA, פרטיות, נגישות, ביצועים ו-Definition of Done למסמך המערכת הראשי.
- סימון מפורש של ערכי `trial-v1` כנתוני ניסוי, ולא כברירות מחדל של המוצר.

שינויים בגרסה 1.2:

- חוזה מחייב של הרחבה מצטברת: אין הסרת יכולות קיימות לצורך ה-Import.
- מטריצת Regression המכסה את יכולות DrumPath ו-Visual Trainer הקיימות.
- רשימת תיקונים נורמטיבית שיש להחיל גם על `SPEC.md` ועל `VISUAL_DRUM_TRAINER_SPEC.md` בעת המימוש.
- מסלול הרחבה תואם לאחור ל-Tempo Map דינמי ול-Triplets, בלי לשנות התנהגות של תרגילים קיימים.
- איסור על המרה מאבדת מידע: אירוע שאינו נתמך עדיין נשמר ב-Score וב-Export ואינו נמחק או מומר בשקט.

## 0.1 חוזה הרחבה מצטברת — No Capability Regression

יכולת Drum Import & Transcription מתווספת למערכת; היא אינה מחליפה מודול, מסך, ישות, Route, כלל עסקי או פורמט קיים.

כללים מחייבים:

1. אין למחוק, לשנות שם או לשנות משמעות של Field קיים כדי להתאים לנתוני Import.
2. אין להסיר Route, מצב תרגול, מיפוי מקלדת, Sample, מדד ניקוד או אפשרות Offline קיימת.
3. אין לבצע Reset ל-Dexie ואין להחליף טבלה קיימת בטבלה חדשה ללא Migration השומר את כל הרשומות.
4. שדה חדש בישות קיימת יהיה אופציונלי, עם ברירת מחדל המשחזרת במדויק את ההתנהגות הקודמת.
5. נתון חדש שאינו נתמך עדיין במנוע התרגול נשמר ב-`DrumScoreDocument`; אין למחוק אותו, לקוונטז אותו מחדש או להמיר אותו לפורמט אחר ללא בחירה מפורשת.
6. תרגיל שנוצר ידנית לפני ההרחבה חייב להיטען, להתנגן, להיבדק ולהישמר ללא שינוי.
7. כשל או חוסר זמינות של שירות ה-Import לא ישפיעו על Dashboard, Today, Course, Practice, Journal, Analytics, Library, Settings או Visual Trainer.
8. הסרת הרחבת ה-Import מה-Bundle או השבתתה ב-Feature Flag לא תמנע שימוש ביכולות הליבה; תרגילים שכבר אושרו ימשיכו לפעול מקומית.
9. כל שינוי נדרש למסמך בסיס יופיע גם בסעיף 0.3 של מסמך זה, ולא יישאר כהנחה נסתרת למפתח.

## 0.2 מטריצת שימור יכולות

| יכולת קיימת | מצב לאחר ההרחבה | בדיקת Regression מחייבת |
|---|---|---|
| Dashboard והאימון הבא | ללא שינוי | פתיחה, חישוב נתונים ויצירת Session draft |
| Today Planner | ללא שינוי | בחירה, סדר ומשך של תרגילים קיימים |
| Course, Weeks ו-Lessons | ללא שינוי; ניתן לקשר תרגיל מיובא | CRUD וקשרים קיימים נשמרים |
| Exercise Library | מורחבת בתרגילים מיובאים | תרגילים ידניים ומיובאים מופיעים יחד |
| Metronome ו-Timer | ללא שינוי במצב Fixed | יציבות, Tap Tempo, Count-in ו-Pause/Resume |
| PracticeSession ו-PracticeEntry | ללא שינוי סכמטי מחייב | `exerciseId`, BPM, זמן ותוצאה נשמרים |
| Journal ו-Analytics | מורחבים בנתוני תרגיל מיובא | חישובי זמן, רצף ושיא BPM אינם משתנים |
| Song Library | מתווסף קישור Import אופציונלי | שירים קיימים ללא Import ממשיכים לעבוד |
| Resource Library | PDF מיובא אופציונלי בלבד | PDF/PNG/JPG קיימים וגיבוי Blob נשמרים |
| Backup/Restore | מורחב באופן תואם לאחור | גיבוי ישן נטען; גיבוי חדש משחזר גם Import |
| PWA ו-Offline | התרגול נשאר אופליין | Service Worker ותרגיל מאושר פועלים ללא רשת |
| Note Highway | ללא הסרה; מורחב לפי הצורך | תרגילים קיימים מציגים אותו Timing |
| Staff Cursor | ללא הסרה; מציג Score מיובא | תווים קיימים ומיובאים מוצגים ללא Regression |
| מצבי לימוד/תרגול/מבחן/חיקוי | ללא שינוי | כל מצב מתחיל, רץ ומסתיים כבעבר |
| Two Way Coordination וקריאת תווים | ללא שינוי | Seed ותרגילים קיימים נשמרים |
| Keyboard Mapping | ללא שינוי | `E/U/I/O/S/D/F/J/K` והגדרות מותאמות נשמרים |
| Samples ומנוע Web Audio | ללא שינוי | טעינה אופליין, Volume ו-Sample מתאים |
| Perfect/Early/Late/Miss | ללא שינוי | חלונות הניקוד לפי רמת קושי נשמרים |
| Accuracy, Combo ו-Timing Error | ללא שינוי | חישוב מול Fixtures קיימים נשאר זהה |
| Latency Calibration | ללא שינוי | Offset קיים נשמר ופועל גם בתרגיל מיובא |

## 0.3 תיקונים מחייבים למסמכי הבסיס בזמן המימוש

מסמך זה הוא Delta נורמטיבי. לאחר מימוש כל שלב, יש לעדכן גם את מסמכי הבסיס כדי שלא יהיו שלושה מסמכים סותרים.

### תיקונים ל-`SPEC.md`

1. הוסף ל-Roadmap מודול `Drum Import & Transcription` כהרחבה לאחר MVP הליבה; אין לשנות את החלטת "ללא Backend ב-MVP" עבור שאר המערכת.
2. הוסף למפת המסכים את נתיבי `/practice/visual/import/*` ואת נקודות הכניסה מספריית שירים ותרגילים.
3. הוסף לארכיטקטורה גבול אופציונלי של Import Service; כל יתר המערכת נשארת Local-first וללא תלות בשירות.
4. הוסף למודל הנתונים את ישויות Import המפורטות בסעיף 30.1, בלי להחליף ישויות ליבה.
5. הרחב את Backup/Restore ב-Score, Metadata ו-Artifacts לפי סעיף 30.2, תוך תמיכה בגיבויים ישנים.
6. הרחב את PWA: Route ה-Import מסומן כדורש שירות זמין, אך תרגול מאושר ו-PDF מקומי זמינים אופליין.
7. הרחב את Privacy: העלאת Audio מרוחקת דורשת פעולה ואישור מפורשים; אין Analytics חיצוני.
8. הוסף ל-Definition of Done את מטריצת ה-Regression בסעיף 0.2.

### תיקונים ל-`VISUAL_DRUM_TRAINER_SPEC.md`

1. הוסף את נתיבי ה-Import מסעיף 7 בלי להסיר נתיב Visual קיים.
2. הוסף `ImportedInteractiveExerciseMetadata` ו-`ImportedDrumEventMetadata` כישויות נפרדות; אל תשנה את שדות `DrumNoteEvent` הקיימים.
3. הוסף `ApproveDrumImportUseCase` המקשר `Exercise`, `InteractiveExercise`, `Song`, `Resource` ו-Score.
4. הוסף מקור תרגיל `manual | imported`, כאשר היעדר השדה משמעו `manual` לצורך תאימות לאחור.
5. הוסף שכבת `TempoResolver` לפי סעיף 16.5; ברירת המחדל לכל תרגיל קיים היא `fixed`.
6. הוסף תמיכת Triplets לפי סעיף 16.6 לפני הפעלת תרגיל מיובא המכיל Triplets.
7. אל תשנה Keyboard Mapping, Audio Samples, Hit windows, Scoring או Latency Calibration במסגרת ה-Import.
8. הרחב את Integration/E2E כך שהתוצאה נשמרת גם ב-`PracticeEntry` של DrumPath.
9. הוסף Golden Regression Fixtures עבור תרגיל ידני קיים לצד Fixture מיובא.

### כלל סנכרון מסמכים

בכל Pull Request או Milestone:

- אם השתנה Contract של DrumPath — עדכן `SPEC.md`.
- אם השתנה Contract של מנוע התרגול — עדכן `VISUAL_DRUM_TRAINER_SPEC.md`.
- אם השתנה Pipeline, Import API, Score או Export — עדכן מסמך זה.
- עדכן `docs/implementation-status.md` עם רשימת המסמכים ששונו.

# 1. מטרת ההרחבה

לאפשר למשתמש להעלות שיר, ערוץ תופים או ערוצי תופים מופרדים; לנתח אותם; ולהפיק מהם תרגיל אינטראקטיבי התואם למודל הקיים של Visual Drum Trainer.

התהליך יפיק:

1. אירועי תופים מזוהים לפי כלי וזמן.
2. MIDI עם Tempo Map העוקב אחרי ההקלטה.
3. תרגיל DrumPath נקי ומקוונטז.
4. MusicXML בקצב קבוע לבחירת המשתמש.
5. PDF תווים חזותי.
6. דוח Confidence, בדגש על High/Mid/Floor Tom.
7. מסך Review לתיקון טעויות לפני שמירת התרגיל.

ההרחבה אינה מחליפה את `InteractiveExercise`; היא מוסיפה תהליך יצירה חדש שמסתיים באותו מודל תרגול קיים.

# 2. החלטה ארכיטקטונית מרכזית

המערכת הקיימת מוגדרת Local-first, משתמש יחיד וללא Backend ב-MVP. יכולת התמלול היא הרחבה לאחר ליבת MVP ואינה הופכת את DrumPath למערכת תלויה-שרת.

עיקרון זה נשמר עבור:

- הפעלת תרגילים.
- מנוע התזמון.
- Audio Samples.
- Note Highway ו-Staff Cursor.
- קלט מקלדת/MIDI.
- ניקוד ויומן אימונים.
- עבודה אופליין לאחר השלמת הייבוא.

ניתוח האודיו יתווסף כגבול מערכת נפרד ואסינכרוני, משום שהשלבים הבאים כבדים ואינם חלק מה-Stack הקיים של ה-PWA:

- FFmpeg ו-Decoding.
- הפרדת Stems.
- STFT ו-Spectral Flux.
- Beat/Downbeat Tracking.
- סיווג Toms.
- יצירת MIDI, MusicXML ו-PDF.

שירות העיבוד הוא אופציונלי עבור האפליקציה כולה, אך נדרש בעת יצירת תמלול חדש. לאחר סיום ה-Import, התרגיל והתוצרים שנבחרו נשמרים מקומית ואין תלות בשירות בזמן התרגול.

## 2.1 מצבי פריסה נתמכים

| מצב | מיקום העיבוד | פרטיות | התנהגות אופליין |
|---|---|---|---|
| Local Companion | שירות מקומי או Self-hosted בשליטת המשתמש | האודיו אינו חייב לצאת מהמכשיר/הרשת הפרטית | Import זמין רק כאשר השירות המקומי פעיל; תרגול נשאר אופליין |
| Remote Import Service | שרת פרטי או שירות מרוחק מפורש | האודיו מועלה רק לאחר אישור המשתמש | Import דורש חיבור; תרגילים שאושרו נשארים אופליין |

מימוש ה-API יהיה בלתי תלוי בפריסה. כתובת השירות תגיע מ-Configuration/Settings ולא תהיה מקודדת ברכיבי UI.

## 2.2 Stack מוצע לשירות העיבוד

- ASP.NET Core: API, Job lifecycle, Validation, Storage policy ו-Progress.
- Python Worker: FFmpeg, DSP, Beat tracking, סיווג ו-Exporters.
- Queue פנימית או Hosted Background Service בגרסה ראשונה; תור חיצוני רק כאשר קיבולת בפועל דורשת זאת.

זוהי המלצת מימוש למסמך ההרחבה. שני מסמכי המקור אינם מגדירים Backend קיים, ולכן אין להציג Stack זה כמצב שכבר מומש.

# 3. עקרונות מחייבים

1. ה-LLM אינו מקור אמת לתזמון מוזיקלי.
2. עיבוד אודיו מתבצע בקוד דטרמיניסטי ובמודלים ייעודיים.
3. אין להכריח סיווג כאשר ה-Confidence נמוך.
4. אין למחוק את זמן המקור גם לאחר Quantization.
5. מבנה נתונים קנוני אחד מזין את כל ה-Exporters.
6. כל תוצאה אוטומטית עוברת Review לפני הפיכה לתרגיל מאושר.
7. אותה קלט + אותה גרסת Algorithm + אותו Preset חייבים להחזיר אותה תוצאה.
8. יש לשמור Provenance: מאיזה קובץ, Stem, אלגוריתם וגרסה הגיע כל תו.
9. רכיבי UI אינם ניגשים ישירות ל-Dexie או ל-IndexedDB.
10. כל Payload מקומי או מרוחק עובר Zod validation לפני שימוש או כתיבה.
11. Zustand משמש ל-UI ולמצב זמני בלבד; נתונים עמידים עוברים Repositories.
12. אין לשנות את `Exercise`, `PracticeSession`, `PracticeEntry`, `Resource` או `InteractiveExercise` ללא Migration תואם לאחור.
13. ה-Import נטען ב-Lazy Route ואינו מגדיל שלא לצורך את ה-Bundle הראשוני של DrumPath.

# 4. מצבי קלט

## 4.1 Full Mix

קובץ שיר מלא בלבד.

```text
song.wav | song.flac | song.mp3 | song.m4a
```

Pipeline:

```text
Full Mix -> Musical Stem Separation -> Drums Stem -> DrumSep -> Analysis
```

זהו המצב הנוח ביותר למשתמש, אך בעל הסיכון הגבוה ביותר ל-Separation Bleed.

## 4.2 Drums Stem

ערוץ תופים מלא בלבד.

```text
drums.wav
```

Pipeline:

```text
Drums Stem -> DrumSep -> Analysis
```

## 4.3 Pre-Separated Drum Stems

מצב מומלץ והמדויק ביותר. זהו המצב ששימש לבניית גרסת הניסיון של השיר `שתקתי בשבילך`.

קלט אפשרי:

```text
drums_full
kick
snare
toms
hi_hat
ride
crash
residual
```

`drums_full` מומלץ לצורך Beat Tracking ואימות, אך ניתן לבצע Import גם בלעדיו כאשר כל שאר הערוצים קיימים.

# 5. פורמטים ואימות קלט

## 5.1 פורמטים נתמכים

- WAV
- FLAC
- MP3
- M4A/AAC
- OGG

WAV או FLAC מועדפים. המרת MP3 ל-WAV אינה משחזרת מידע שאבד.

## 5.2 כללי Validation

- כל הקבצים חייבים להיות ניתנים לפענוח.
- כל ה-Stems חייבים להתחיל מאותה נקודת זמן.
- סטיית אורך מותרת כברירת מחדל: עד 50ms.
- אם Sample Rate שונה, יש לבצע Resampling לפני השוואה.
- אין לנחש Stem על סמך שם קובץ בלבד; המשתמש מאשר את המיפוי במסך.
- קובץ ריק או כמעט ריק יסומן `silent_stem` ולא ייצר תווים.
- יש לחשב Peak, RMS, Duration, Channels, Codec ו-Sample Rate לכל קובץ.
- אין להתחיל Analysis לפני השלמת בדיקת Alignment.
- מגבלת ה-25MB של `Resource` ב-`SPEC.md` אינה מוחלת אוטומטית על קלט אודיו. ל-Import תוגדר מגבלה נפרדת לפי יכולת השירות והאחסון.
- לפני שמירת Source Audio מקומית יש לבדוק `navigator.storage.estimate()` ולהציג למשתמש את הגודל הצפוי ואת מדיניות השמירה.
- שם קובץ עברי נשמר לתצוגה, אך אינו משמש כנתיב, מזהה או מקור לקביעת Stem.

# 6. חוויית משתמש: Import Wizard

## שלב 1: בחירת מקור

- שיר מלא.
- ערוץ תופים מלא.
- ערוצי תופים מופרדים.

## שלב 2: העלאת קבצים ומיפוי

המשתמש גורר קבצים וממפה כל קובץ ל-Stem.

המסך יציג:

- שם קובץ.
- משך.
- פורמט.
- Sample Rate.
- Waveform מקוצר.
- Stem שנבחר.
- אזהרת קובץ שקט/לא מיושר.

## שלב 3: Metadata

- שם השיר.
- אמן/יוצר, אופציונלי.
- BPM מבוקש, אופציונלי.
- Time Signature, אופציונלי.
- Quantization יעד.
- מצב יצוא.
- קישור אופציונלי ל-`Song` קיים או יצירת `Song` חדש לאחר האישור.
- שיוך אופציונלי ל-`Lesson` או ל-`Exercise` קיים; אין ליצור קשר לפני שהמשתמש מאשר.

## שלב 4: Processing

Progress לפי שלבים, ללא אחוזים מזויפים:

```text
Validating
Decoding
Separating stems
Detecting hits
Tracking tempo
Classifying toms
Quantizing
Generating score
Generating artifacts
Ready for review
```

## שלב 5: Review

- Waveform ו-Spectrogram.
- Solo/Mute לכל Stem.
- תצוגת Staff Cursor.
- מעבר בין Original Timing ל-Quantized Timing.
- סינון לפי Confidence.
- רשימת בעיות.
- תיקון כלי, זמן, Velocity ו-Confidence status.
- הוספת מכה חסרה.
- מחיקת False Positive.
- השמעת חלון קצר סביב המכה.

## שלב 6: Save & Export

- יצירת/עדכון `Exercise` ליבה דרך Repository קיים.
- שמירה כ-`InteractiveExercise` מקושר ל-`Exercise` הליבה.
- יצירת `Resource` עבור PDF התווים, אם המשתמש בחר לשמור אותו בספריית הקבצים.
- קישור ל-`Song` קיים או חדש, אם נבחר.
- MIDI עם Tempo Map.
- MIDI נקי בקצב קבוע.
- MusicXML.
- PDF.
- JSON מלא.
- CSV Confidence.

# 7. נתיבים חדשים ב-Frontend

```text
/practice/visual/import
/practice/visual/import/new
/practice/visual/import/:jobId
/practice/visual/import/:jobId/review
/practice/visual/import/:jobId/result
```

נקודות כניסה נוספות בתוך המסכים הקיימים, ללא Route חובה נוסף:

- `/songs` ו-`/songs/:songId` — פעולה "הפק תרגיל תופים" עם `songId` כ-Context.
- `/exercises` ו-`/exercises/:exerciseId` — פעולה "ייבא תמלול" עם `exerciseId` כ-Context.
- `/practice/visual/exercises` — פעולה "צור מאודיו".

כל הנתיבים החדשים יהיו Lazy-loaded וישמרו RTL, Mobile-first, Focus visible וכפתורי מגע של 44x44 פיקסלים לפחות.

# 8. מבנה תיקיות מוצע

```text
src/features/drum-import/
  domain/
    drumImport.types.ts
    drumImport.schemas.ts
    drumImport.rules.ts
  data/
    DrumImportJobRepository.ts
    DrumScoreDocumentRepository.ts
    DrumArtifactRepository.ts
  api/
    drumImportApi.ts
    drumImportSse.ts
  components/
    ImportSourceSelector.tsx
    StemFileMapper.tsx
    AudioMetadataForm.tsx
    ImportProgress.tsx
    WaveformReview.tsx
    StemMixer.tsx
    ConfidenceFilter.tsx
    HitInspector.tsx
    TempoMapEditor.tsx
    ScorePreview.tsx
    ArtifactDownloadList.tsx
  adapters/
    ScoreToInteractiveExerciseAdapter.ts
    ScoreToCoreExerciseAdapter.ts
    PdfArtifactToResourceAdapter.ts
  pages/
    DrumImportPage.tsx
    DrumImportProgressPage.tsx
    DrumImportReviewPage.tsx
    DrumImportResultPage.tsx
  tests/
    ScoreToInteractiveExerciseAdapter.test.ts
    QuantizedEventMapper.test.ts
    ImportReviewReducer.test.ts
```

שירותים:

```text
server/DrumPath.Import.Api/
  Controllers/
  Application/
  Domain/
  Infrastructure/
  Storage/
  Workers/

audio-worker/
  pipeline/
  detection/
  tempo/
  classification/
  quantization/
  exporters/
  tests/
```

כללי מיקום:

- Types וכללים טהורים נמצאים ב-`domain` ואינם תלויים ב-React.
- גישה ל-Dexie מתבצעת רק ב-`data`/Repositories.
- רכיבי UI משתמשים ב-Use cases/Hooks ולא ב-Dexie או ב-API גולמי.
- קוד שירות העיבוד אינו נכנס ל-`src/` של ה-PWA.
- Samples של Visual Trainer נשארים במודול הקיים ואינם מוכפלים במודול Import.

# 9. מודל Domain: קלט וקבצים

```ts
export type DrumImportInputMode =
  | "full_mix"
  | "drums_stem"
  | "preseparated_drum_stems";

export type DrumStemKind =
  | "full_mix"
  | "drums_full"
  | "kick"
  | "snare"
  | "toms"
  | "hi_hat"
  | "ride"
  | "crash"
  | "residual";

export interface UploadedAudioAsset {
  id: string;
  jobId: string;
  originalFileName: string;
  stemKind: DrumStemKind;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
  sampleRate: number;
  channels: number;
  codec: string;
  peakDbfs: number;
  rmsDbfs: number;
  checksumSha256: string;
  alignmentOffsetMs: number;
  validationStatus: "pending" | "valid" | "warning" | "invalid";
  validationIssues: AudioValidationIssue[];
  retention: "temporary" | "local_after_approval";
  createdAt: string;
  updatedAt: string;
}

export interface AudioValidationIssue {
  code:
    | "decode_failed"
    | "duration_mismatch"
    | "alignment_mismatch"
    | "silent_stem"
    | "unsupported_format"
    | "duplicate_stem"
    | "missing_required_stem";
  severity: "warning" | "error";
  assetId?: string;
  message: string;
}
```

# 10. Import Job

```ts
export type DrumImportStage =
  | "created"
  | "uploading"
  | "validating"
  | "decoding"
  | "separating"
  | "detecting_hits"
  | "tracking_tempo"
  | "classifying_toms"
  | "quantizing"
  | "generating_score"
  | "generating_artifacts"
  | "awaiting_review"
  | "completed"
  | "failed"
  | "cancelled";

export interface DrumImportJob {
  id: string;
  inputMode: DrumImportInputMode;
  title: string;
  requestedBpm?: number;
  requestedTimeSignature?: TimeSignature;
  quantization: QuantizationSettings;
  algorithmVersion: string;
  presetId: string;
  stage: DrumImportStage;
  progress: StageProgress[];
  assetIds: string[];
  linkedSongId?: string;
  linkedExerciseId?: string;
  resultId?: string;
  error?: ImportJobError;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface DrumImportJobDetails extends DrumImportJob {
  assets: UploadedAudioAsset[];
}

export interface StageProgress {
  stage: DrumImportStage;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  progress01?: number;
  message?: string;
  startedAt?: string;
  completedAt?: string;
}
```

# 11. מודל Tempo Map

```ts
export interface TimeSignature {
  numerator: number;
  denominator: number;
}

export interface TempoMap {
  mode: "fixed" | "performance_aligned";
  requestedBpm?: number;
  detectedConstantBpm: number;
  timeSignature: TimeSignature;
  firstDownbeatTimeMs: number;
  points: TempoMapPoint[];
  confidence: number;
  source: "detected" | "user" | "hybrid";
}

export interface TempoMapPoint {
  beatIndex: number;
  timeMs: number;
  bpmToNextPoint: number;
  confidence: number;
}

export interface BeatMarker {
  beatIndex: number;
  measure: number;
  beatInMeasure: number;
  timeMs: number;
  isDownbeat: boolean;
  confidence: number;
}
```

אין לחשב את זמן התרגיל באמצעות BPM יחיד כאשר `mode` הוא `performance_aligned`. יש לבצע Interpolation בין `TempoMapPoint` סמוכים.

# 12. אירוע מכה מזוהה

```ts
export type AnalysisInstrument =
  | "kick"
  | "snare"
  | "tom_unclassified"
  | "tom_floor"
  | "tom_mid"
  | "tom_high"
  | "hihat"
  | "ride"
  | "crash"
  | "residual";

export type ReviewStatus =
  | "unreviewed"
  | "accepted"
  | "corrected"
  | "rejected";

export interface DetectedDrumHit {
  id: string;
  sourceAssetId: string;
  sourceStem: DrumStemKind;
  sourceTimeMs: number;
  instrument: AnalysisInstrument;
  midiNote: number;
  velocity: number;
  onsetScore: number;
  levelDb: number;
  detectionConfidence: number;
  classificationConfidence?: number;
  uncertaintyReasons: UncertaintyReason[];
  reviewStatus: ReviewStatus;
  algorithmVersion: string;
}

export type UncertaintyReason =
  | "low_energy"
  | "weak_onset"
  | "stem_bleed"
  | "ambiguous_tom_cluster"
  | "low_spectral_clarity"
  | "conflicting_stems"
  | "off_grid"
  | "silent_stem";
```

# 13. Quantization

```ts
export type QuantizationGrid =
  | "quarter"
  | "eighth"
  | "eighth_triplet"
  | "sixteenth"
  | "sixteenth_triplet";

export interface QuantizationSettings {
  grid: QuantizationGrid;
  strength01: number;
  preserveMicroTiming: boolean;
  maxSnapDistanceMs: number;
  cleanScoreBpm: number;
}

export interface QuantizedDrumHit extends DetectedDrumHit {
  musicalPosition: MusicalPosition;
  quantizedTimeMs: number;
  quantizationDeltaMs: number;
  wasSnapped: boolean;
}

export interface MusicalPosition {
  measure: number;
  beat: number;
  subdivisionIndex: number;
  absoluteBeat: number;
  absoluteSlot: number;
}
```

שני הזמנים נשמרים תמיד:

- `sourceTimeMs` לצורך סנכרון עם ההקלטה.
- `quantizedTimeMs` לצורך תווים ותרגול נקי.

# 14. מבנה הנתונים הקנוני ששימש לבניית ה-PDF

אין לבנות PDF ישירות מ-`DetectedDrumHit[]`. תחילה נוצרת שכבת Intermediate Representation בשם `DrumScoreDocument`.

```ts
export interface DrumScoreDocument {
  schemaVersion: "1.0";
  id: string;
  title: string;
  sourceImportJobId: string;
  linkedSongId?: string;
  linkedExerciseId?: string;
  sourceDurationMs: number;
  intendedBpm?: number;
  cleanScoreBpm: number;
  tempoMap: TempoMap;
  timeSignature: TimeSignature;
  quantizationGrid: QuantizationGrid;
  measures: DrumScoreMeasure[];
  instrumentDefinitions: DrumScoreInstrumentDefinition[];
  analysisSummary: DrumAnalysisSummary;
  layout: DrumScoreLayout;
  generatedArtifactIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DrumScoreMeasure {
  number: number;
  absoluteStartBeat: number;
  sourceStartTimeMs: number;
  cleanStartTimeMs: number;
  slotsPerMeasure: number;
  slots: DrumScoreSlot[];
}

export interface DrumScoreSlot {
  absoluteSlot: number;
  slotInMeasure: number;
  beatInMeasure: number;
  subdivisionIndex: number;
  sourceTimeMs: number;
  cleanTimeMs: number;
  notes: DrumScoreNote[];
}

export interface DrumScoreNote {
  id: string;
  sourceHitId: string;
  instrument: ScoreInstrument;
  midiNote: number;
  velocity: number;
  notehead: "normal" | "x" | "diamond";
  staffOffsetSpaces: number;
  stemDirection: "up" | "down";
  detectionConfidence: number;
  classificationConfidence?: number;
  isUncertain: boolean;
  uncertaintyReasons: UncertaintyReason[];
  displayMarker?: "?";
  displayColor?: string;
}

export type ScoreInstrument =
  | "kick"
  | "snare"
  | "tom_floor"
  | "tom_mid"
  | "tom_high"
  | "hihat"
  | "ride"
  | "crash"
  | "residual";
```

# 15. מיפוי כלים ששימש בגרסת הניסיון

| כלי | MIDI Note | Notehead | Staff Offset | הערה |
|---|---:|---|---:|---|
| Kick | 36 | normal | -4.70 | מתחת לחמשה |
| Floor Tom | 41 | normal | -3.50 | נמוך |
| Snare | 38 | normal | -2.10 | מרכז |
| Mid Tom | 45 | normal | -1.50 | מעל Snare |
| High Tom | 48 | normal | -0.50 | גבוה |
| Residual | 56 | x | 0.05 | דורש Review |
| Ride | 51 | diamond | 0.35 | מצילה |
| Hi-Hat | 42 | x | 0.90 | ללא Open/Closed ב-v1 |
| Crash | 49 | x | 1.65 | מעל החמשה |

`staffOffsetSpaces` נמדד יחסית לקו העליון של החמשה ב-Renderer של גרסת הניסיון. ב-Renderer אחר מותר לבצע Adapter, אך אסור לשנות את המשמעות המוזיקלית.

## הגדרת כלי מלאה

```ts
export interface DrumScoreInstrumentDefinition {
  instrument: ScoreInstrument;
  displayName: string;
  midiNote: number;
  notehead: "normal" | "x" | "diamond";
  staffOffsetSpaces: number;
  keyboardBinding?: string;
  sampleId?: string;
}
```

# 16. הרחבת המודל הקיים של DrumPath

## 16.1 גבולות הישויות הקיימות

לפי מסמכי המקור קיימות שתי ישויות שונות:

- `Exercise` — ישות הליבה של DrumPath. משמשת לספריית התרגילים, BPM, קושי, תגים, שיעורים ו-`PracticeEntry`.
- `InteractiveExercise` — תרגיל ביצוע של Visual Trainer, הכולל תיבות, אירועי תופים, Display mode וקישור אופציונלי באמצעות `exerciseId`.

Import מאושר יוצר או מעדכן את שתיהן בתוך Use case אחד, אך דרך שני Repositories נפרדים. אין להחליף את `Exercise` ב-`InteractiveExercise` ואין לשמור `PracticeEntry.exerciseId` עם מזהה של `InteractiveExercise`.

## 16.2 אין לשנות את `DrumNoteEvent` הבסיסי

כדי לשמור תאימות מלאה למודל הקיים, Provenance ו-Confidence נשמרים ברשומת Metadata נפרדת המקושרת לפי `eventId`:

```ts
export interface ImportedDrumEventMetadata {
  eventId: string;
  sourceImportJobId: string;
  sourceHitId: string;
  sourceTimeMs: number;
  quantizedTimeMs: number;
  detectionConfidence: number;
  classificationConfidence?: number;
  reviewStatus: ReviewStatus;
  uncertaintyReasons: UncertaintyReason[];
}

export interface ImportedInteractiveExerciseMetadata {
  interactiveExerciseId: string;
  coreExerciseId: string;
  sourceImportJobId: string;
  scoreDocumentId: string;
  sourceAudioAssetIds: string[];
  quantizationSettings: QuantizationSettings;
  transcriptionStatus: "automatic" | "reviewed" | "approved";
  eventMetadata: ImportedDrumEventMetadata[];
  createdAt: string;
  updatedAt: string;
}
```

## 16.3 מדיניות Tempo ו-Subdivision

מנוע Visual Trainer הנוכחי משתמש ב-`bpm` יחיד וב-`subdivision` מסוג `quarter | eighth | sixteenth`. אין להסיר מגבלה זו באמצעות אובדן מידע. עד להשלמת הרחבת המנוע:

- `InteractiveExercise.bpm` תמיד יקבל את `cleanScoreBpm`.
- ה-Tempo Map המלא נשמר ב-`DrumScoreDocument` ומשמש Performance MIDI, Waveform Review ו-Timecode.
- אין להפעיל Tempo Map דינמי ב-`ExerciseRunner` בלי שלב הרחבה נפרד למנוע התזמון ובדיקות Regression.
- `eighth_triplet` ו-`sixteenth_triplet` נשמרים במלואם ב-Score וב-Export. הפעלה כ-`InteractiveExercise` תיחסם עם הודעה ברורה עד להוספת Tuplets ל-Visual Trainer; אין להמיר אותם לשמיניות/שש-עשריות רגילות בשקט.
- `residual` אינו `DrumInstrument` ולכן אינו נכנס לתרגיל כברירת מחדל.
- `hihat` אוטומטי ממופה ל-`hihat_closed` עד שיש סיווג Open/Closed מאושר.

## 16.4 Adapters ו-Use case

```ts
export interface ScoreToExerciseOptions {
  timingMode: "clean_fixed" | "performance_mapped";
  includeUnreviewedHits: boolean;
  fallbackHiHatType: "hihat_closed" | "hihat_open";
}

export interface ScoreToInteractiveExerciseAdapter {
  convert(
    score: DrumScoreDocument,
    options: ScoreToExerciseOptions
  ): InteractiveExercise;
}

export interface ApproveDrumImportResult {
  coreExerciseId: string;
  interactiveExerciseId: string;
  scoreDocumentId: string;
  notationResourceId?: string;
  artifactIds: string[];
  linkedSongId?: string;
}
```

Use case בשם `ApproveDrumImportUseCase` יבצע Transaction לוגי:

1. Validation של Score וכל ה-Hits שנבחרו.
2. יצירת `Exercise` חדש בקטגוריה המתאימה, או קישור ל-`Exercise` קיים לאחר אישור מפורש.
3. יצירת `InteractiveExercise` עם `exerciseId` של ישות הליבה.
4. שמירת Metadata, Score ו-Artifacts.
5. שמירת PDF כ-`Resource` והצבת `notationResourceId`, אם נבחר.
6. קישור ל-`Song`, אם נבחר.
7. Rollback של הרשומות שנוצרו אם שלב כלשהו נכשל.

בסיום תרגול, `VisualPracticeSession` ופרטי התוצאה נשמרים במודול Visual Trainer, ואילו `PracticeEntry.exerciseId` מצביע ל-`Exercise` הליבה כפי שנדרש ב-`SPEC.md`.

ה-Adapter רשאי לקבל `performance_mapped` רק כאשר Capability של המנוע מאשרת תמיכה. אחרת מוחזרת שגיאה טיפוסית `mapped_tempo_not_supported`; אין לבצע Fallback שקט ל-`clean_fixed`.

## 16.5 הרחבה תואמת לאחור ל-Tempo Map דינמי

הרחבה זו נדרשת כדי לתרגל מול התזמון החי של ההקלטה. היא מתווספת למצב Fixed הקיים ואינה מחליפה אותו.

```ts
export type ExerciseTempoMode = "fixed" | "mapped";

export interface InteractiveExerciseImportExtension {
  source?: "manual" | "imported";
  tempoMode?: ExerciseTempoMode;
  tempoMapId?: string;
  scoreDocumentId?: string;
}

export interface TempoResolver {
  beatToTimeMs(absoluteBeat: number): number;
  timeMsToBeat(timeMs: number): number;
  bpmAtBeat(absoluteBeat: number): number;
}
```

כללי תאימות:

- `source` חסר שווה `manual`.
- `tempoMode` חסר שווה `fixed`.
- במצב `fixed`, המנוע משתמש ב-`bpm` הקיים ובאותן נוסחאות Timing הקיימות.
- במצב `mapped`, `tempoMapId` חובה וה-Resolver מבצע Interpolation בין נקודות Tempo סמוכות.
- `FixedTempoResolver` עוטף את ההתנהגות הקיימת; אין לשכתב את תוצאות התזמון של תרגילים ישנים.
- `MappedTempoResolver` מוזרק ל-`TimingEngine`, ל-`ExerciseRunner`, ל-Note Highway ול-Staff Cursor דרך Interface משותף.
- Audio Scheduler נשאר מקור האמת; `requestAnimationFrame` משמש לתצוגה בלבד.
- Hit Matching משתמש בזמן הצפוי שמחזיר ה-Resolver, אך חלונות Perfect/Early/Late/Miss אינם משתנים.
- שינוי BPM ידני במהלך תרגיל `mapped` חסום או יוצר עותק `fixed`; אין לעוות את Tempo Map המקורי.
- תרגיל `mapped` ללא Tempo Map תקין אינו מתחיל ומציג שגיאת Validation, בלי להשפיע על תרגילים אחרים.

בדיקות חובה:

- תרגיל קיים ללא `tempoMode` מחזיר בדיוק אותם timestamps כמו לפני ההרחבה.
- Round-trip של `beatToTimeMs` ו-`timeMsToBeat` בתוך Tolerance מוגדר.
- מעבר בין נקודות Tempo רציף וללא Jump חזותי.
- Count-in מסתיים בדיוק ב-Downbeat הראשון.
- Pause/Resume ו-Restart אינם משנים את מיקום המפה.
- ניקוד באותם Timing errors מחזיר אותו Grade במצב Fixed ובמצב Mapped.

## 16.6 הרחבה תואמת לאחור ל-Triplets/Tuplets

```ts
export type MusicalSubdivision =
  | "quarter"
  | "eighth"
  | "sixteenth"
  | "eighth_triplet"
  | "sixteenth_triplet";

export function subdivisionsPerBeat(
  subdivision: MusicalSubdivision
): 1 | 2 | 3 | 4 | 6 {
  switch (subdivision) {
    case "quarter": return 1;
    case "eighth": return 2;
    case "eighth_triplet": return 3;
    case "sixteenth": return 4;
    case "sixteenth_triplet": return 6;
  }
}
```

דרישות מימוש:

- הרחב את Zod schema של `InteractiveExercise.subdivision`; הערכים הישנים נשארים תקינים ללא Migration של תוכן.
- `TimingEngine` מחשב Slot duration לפי 1/2/3/4/6 חלוקות לפעימה.
- Note Highway מציב Triplets במרווחי זמן שווים מול קו הפגיעה.
- Staff Renderer מציג Beam ו-Tuplet number מתאים; אין להציג Triplet כאילו הוא חלוקה בינארית.
- Hit Matcher ו-Scoring אינם משנים חלונות ניקוד.
- Metronome מאפשר Accent של פעימת הרבע ואופציונלית Click פנימי ל-Triplet בלי לשנות Presets קיימים.
- Keyboard Mapping, Drum Samples ו-Animations אינם משתנים.
- MusicXML משתמש ב-`time-modification`; MIDI משתמש במיקום Tick מדויק לפי PPQ.
- אם Renderer מסוים אינו תומך Tuplet, מוצגת תצוגת Fallback מסומנת; הנתונים עצמם נשמרים ללא שינוי.

בדיקות חובה:

- שלישיות שמיניות יוצרות 3 Slots לפעימה ושישיות יוצרות 6.
- תיבה 4/4 מכילה 12 או 24 Slots בהתאמה.
- אירוע ראשון ואחרון בתיבה אינם צוברים Drift.
- תרגילי Quarter/Eighth/Sixteenth קיימים מחזירים תוצאה זהה לפני ואחרי הרחבת ה-Union.
- MIDI ו-MusicXML שומרים את מיקום ה-Triplet לאחר Round-trip בכלי בדיקה תומך.

# 17. Analysis Preset ששימש לגרסת הניסיון

הערכים הבאים הועתקו מתוצר הניסוי הקודם של `שתקתי בשבילך`. הם אינם מופיעים ב-`SPEC.md` או ב-`VISUAL_DRUM_TRAINER_SPEC.md`, אינם Truth אוניברסלי ואינם ברירות מחדל מאושרות למוצר. יש לשמור אותם כ-Preset בעל גרסה ולהריץ Calibration/Golden Tests לפני שימוש בקלט אחר.

```ts
export interface DrumAnalysisPreset {
  id: string;
  algorithmVersion: string;
  analysisSampleRate: number;
  fftSize: number;
  hopSize: number;
  logMagnitudeGain: number;
  medianFilterFrames: number;
  instruments: Partial<Record<DrumStemKind, InstrumentDetectionPreset>>;
  tomClassifier: TomClassifierPreset;
  tempoTracker: TempoTrackerPreset;
}

export interface InstrumentDetectionPreset {
  minFrequencyHz: number;
  maxFrequencyHz: number;
  minOnsetScore: number;
  minLevelDb: number;
  minimumHitDistanceMs: number;
}
```

ערכי `trial-v1`:

```json
{
  "id": "trial-v1",
  "algorithmVersion": "drumpath-transcriber-1.0.0",
  "analysisSampleRate": 22050,
  "fftSize": 1024,
  "hopSize": 128,
  "logMagnitudeGain": 100,
  "medianFilterFrames": 173,
  "instruments": {
    "kick":     { "minFrequencyHz": 30,   "maxFrequencyHz": 300,   "minOnsetScore": 2.5,  "minLevelDb": -50, "minimumHitDistanceMs": 75 },
    "snare":    { "minFrequencyHz": 120,  "maxFrequencyHz": 7000,  "minOnsetScore": 15.0, "minLevelDb": -50, "minimumHitDistanceMs": 65 },
    "toms":     { "minFrequencyHz": 40,   "maxFrequencyHz": 2500,  "minOnsetScore": 2.5,  "minLevelDb": -58, "minimumHitDistanceMs": 65 },
    "hi_hat":   { "minFrequencyHz": 2500, "maxFrequencyHz": 10000, "minOnsetScore": 0.8,  "minLevelDb": -70, "minimumHitDistanceMs": 35 },
    "ride":     { "minFrequencyHz": 1200, "maxFrequencyHz": 10000, "minOnsetScore": 0.15, "minLevelDb": -90, "minimumHitDistanceMs": 85 },
    "crash":    { "minFrequencyHz": 800,  "maxFrequencyHz": 10000, "minOnsetScore": 3.0,  "minLevelDb": -62, "minimumHitDistanceMs": 200 },
    "residual": { "minFrequencyHz": 40,   "maxFrequencyHz": 10000, "minOnsetScore": 10.0, "minLevelDb": -60, "minimumHitDistanceMs": 65 }
  }
}
```

אם אלגוריתם ה-Onset Score משתנה, אין להשתמש בערכי הסף האלה ללא Calibration מחדש.

# 18. זיהוי מכות

Pipeline לכל Stem:

1. Decode למונו ב-22,050Hz.
2. STFT בגודל 1,024 ו-Hop של 128.
3. חיתוך לטווח התדרים של הכלי.
4. `log(1 + 100 * magnitude)`.
5. Positive Spectral Difference.
6. הסרת Baseline באמצעות Median Filter.
7. החלקת Onset Envelope.
8. Peak Detection עם Minimum Distance.
9. סינון לפי Onset Score ו-Level.
10. Refinement של זמן ההתחלה לפי עליית Energy מקומית.
11. מיזוג Peaks המתייחסים לאותה מכה.
12. חישוב Velocity ו-Confidence.

אין להשתמש ב-RMS בלבד לזיהוי Cymbals או Hi-Hat, בגלל דעיכה ארוכה וחפיפה ספקטרלית.

# 19. Beat ו-Tempo Tracking

## `trial-v1`

1. איסוף מכות חזקות מ-Kick, Snare, Toms ו-Crash.
2. חיפוש Beat Period בטווח 575-625ms.
3. התאמת כל האירועים לרשת Sixteenth.
4. משקל גבוה יותר ל-Kick ול-Crash.
5. בחירת Quarter-note phase.
6. זיהוי Downbeat לפי Crash, עם Kick כ-Fallback.
7. חישוב Residual לכל Beat.
8. Interpolation כאשר אין מכה על Beat מסוים.
9. Smoothing למניעת Tempo Jumps.
10. יצירת Tempo Point בכל תיבה.

בגרסת הניסיון של `שתקתי בשבילך`:

- BPM מבוקש: 100.
- BPM שנמדד: 102.0061.
- טווח Tempo Map: 101.128-102.5767.
- First Downbeat: 159.2ms.
- Beat Fit Score: 0.6564.

נתוני שיר יחיד אינם Preset ואין לקבע אותם במערכת.

כל נתון מספרי בסעיף זה ובסעיפי `trial-v1` הוא תיעוד של הרצה אמפירית קודמת. אם קובצי ה-Analysis המקוריים אינם זמינים בזמן המימוש, אין לטעון שהערכים אומתו מחדש.

# 20. סיווג Toms

## תהליך

1. לכל מכה נלקח חלון 25-300ms לאחר ה-Onset.
2. נבדק תחום 55-360Hz.
3. נבחר Peak לאחר העדפה מתונה לתדרים נמוכים.
4. התדרים מומרים ל-`log2`.
5. מתבצע Clustering לשלוש קבוצות.
6. מרכזים ממוינים מהנמוך לגבוה:
   - Floor Tom.
   - Mid Tom.
   - High Tom.

Confidence:

```text
tomConfidence =
  0.45 * clusterMargin +
  0.35 * spectralClarity +
  0.20 * detectionConfidence
```

ברירת מחדל:

```text
tomConfidence < 0.62 => uncertain
```

מכה לא ודאית:

- נצבעת בכתום.
- מקבלת `displayMarker: "?"`.
- מופיעה ברשימת Review.
- אינה משתנה אוטומטית ללא אישור משתמש.

בגרסת הניסיון התקבלו מרכזים של כ-97Hz, 127Hz ו-153Hz. מרכזים אלו שייכים לשיר המסוים בלבד.

# 21. הבחנה בין Hi-Hat פתוח וסגור

`trial-v1` ממפה את כל ערוץ Hi-Hat ל-MIDI 42 ול-`hihat_closed` בעת המרה ל-DrumPath.

שיפור עתידי:

- Decay Length.
- High-frequency energy slope.
- Choke detection.
- MIDI 42/44/46.
- Review ידני לפתוח/סגור/Pedal.

עד למימוש classifier ייעודי, אין לטעון שהמערכת מבדילה Open/Closed.

# 22. Residual

Residual עשוי להכיל:

- כלי הקשה נוספים.
- Ghost Notes.
- Bleed.
- שאריות Separator.

כללי v1:

- MIDI Note זמני: 56.
- תמיד מסומן ל-Review.
- אינו נשמר לתרגיל כברירת מחדל.
- המשתמש יכול להמיר אותו ידנית לכלי ידוע.

# 23. מבנה PDF

```ts
export interface DrumScoreLayout {
  pageSize: "A4";
  orientation: "landscape";
  systemsPerPage: number;
  measuresPerSystem: number;
  staffLines: 5;
  showBeatGuides: boolean;
  showMeasureNumbers: boolean;
  showSourceTimecode: boolean;
  uncertainColor: string;
  uncertainMarker: "?";
}
```

ברירות המחדל ששימשו לגרסת הניסיון:

```json
{
  "pageSize": "A4",
  "orientation": "landscape",
  "systemsPerPage": 4,
  "measuresPerSystem": 4,
  "staffLines": 5,
  "showBeatGuides": true,
  "showMeasureNumbers": true,
  "showSourceTimecode": true,
  "uncertainColor": "#D97706",
  "uncertainMarker": "?"
}
```

ה-PDF כולל:

- Title.
- BPM נקי ו-Time Signature.
- Legend.
- מרכזי Resonance של Toms.
- ארבע תיבות בשורה.
- ארבע מערכות בעמוד.
- קווי עזר לכל Beat.
- מספר תיבה ו-Timecode.
- סימון כתום ל-Tom לא ודאי.
- Footer עם Event Counts והסתייגות Automatic Trial.

# 24. Exporters

כל Exporter מקבל `DrumScoreDocument` בלבד.

```ts
export interface DrumScoreExporter<TOptions> {
  export(
    score: DrumScoreDocument,
    options: TOptions
  ): Promise<GeneratedArtifact>;
}

export interface GeneratedArtifact {
  id: string;
  importJobId: string;
  scoreDocumentId: string;
  type:
    | "midi_tempo_map"
    | "midi_fixed"
    | "musicxml"
    | "pdf"
    | "analysis_json"
    | "confidence_csv";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  storageKind: "indexeddb_blob" | "file_handle" | "temporary_remote";
  resourceId?: string;
  createdAt: string;
}
```

Exporters נדרשים:

- `PerformanceMidiExporter`.
- `FixedTempoMidiExporter`.
- `MusicXmlExporter`.
- `PdfDrumScoreRenderer`.
- `AnalysisJsonExporter`.
- `ConfidenceCsvExporter`.

רק PDF תואם ישירות לסוגי הקבצים המוגדרים בספריית `Resource` הנוכחית. MIDI, MusicXML, JSON ו-CSV נשמרים ב-`drumArtifacts` עד שמסמך `SPEC.md` יורחב במפורש לסוגי Resource נוספים. אין להרחיב MIME allowlist של `Resource` באופן סמוי.

# 25. MIDI עם Tempo Map

דרישות:

- Standard MIDI File Format 1.
- PPQ: 960 כברירת מחדל.
- Track 0: Tempo Map ו-Time Signature.
- Track 1: Drum Notes בערוץ MIDI 10.
- Tempo Event לפחות בכל תיבה.
- Note time נגזר מ-`sourceTimeMs` ומה-Tempo Map.
- Velocity נשמרת.
- Note Off קצר לכל מכה.

אין לבצע Quantization כפוי ל-MIDI המסונכרן, אלא אם המשתמש בחר בכך.

# 26. MusicXML

דרישות:

- `score-partwise` גרסה 4.0.
- Part יחיד בשם `Drumset`.
- Percussion Clef.
- הגדרת `score-instrument` ו-`midi-instrument` לכל כלי.
- MusicXML Notehead מתאים.
- סימון כתום ו-`?` למכה לא ודאית.
- New System כל ארבע תיבות.
- New Page כל מספר מערכות מוגדר.

MusicXML הוא מקור מומלץ ל-Engraving מקצועי חיצוני. ה-PDF הפנימי מיועד לתצוגה עקבית בתוך DrumPath.

# 27. API

זהו חוזה API לוגי של שירות ה-Import, לא Backend כללי של DrumPath. השירות אינו מנהל משתמשים, קורסים, יומן או Dexie. ה-PWA מחזיקה את ישויות הליבה ומייבאת את התוצאה המאושרת דרך Adapters ו-Repositories.

כל Response ו-SSE Event יעברו Zod validation בצד ה-Frontend. כתובת הבסיס מוגדרת ב-Configuration; אין לקרוא ל-API ישירות מתוך רכיבי תצוגה.

## יצירת Job

```http
POST /api/drum-import/jobs
Content-Type: application/json
```

```json
{
  "inputMode": "preseparated_drum_stems",
  "title": "שתקתי בשבילך",
  "requestedBpm": 100,
  "requestedTimeSignature": { "numerator": 4, "denominator": 4 },
  "quantization": {
    "grid": "sixteenth",
    "strength01": 1,
    "preserveMicroTiming": true,
    "maxSnapDistanceMs": 80,
    "cleanScoreBpm": 100
  },
  "presetId": "trial-v1"
}
```

## העלאת Asset

```http
POST /api/drum-import/jobs/{jobId}/assets
Content-Type: multipart/form-data
```

Fields:

```text
file
stemKind
```

## התחלת Analysis

```http
POST /api/drum-import/jobs/{jobId}/start
```

## סטטוס

```http
GET /api/drum-import/jobs/{jobId}
GET /api/drum-import/jobs/{jobId}/events
GET /api/drum-import/jobs/{jobId}/score
GET /api/drum-import/jobs/{jobId}/issues
```

## Review

```http
PATCH /api/drum-import/jobs/{jobId}/events/{eventId}
POST  /api/drum-import/jobs/{jobId}/events
DELETE /api/drum-import/jobs/{jobId}/events/{eventId}
POST  /api/drum-import/jobs/{jobId}/approve
```

`approve` מאשר את תוצאת השירות בלבד. יצירת `Exercise`, `InteractiveExercise`, `Resource` ונתוני Dexie מתבצעת מקומית באמצעות `ApproveDrumImportUseCase`; השירות אינו כותב למסד המקומי של הדפדפן.

## Artifacts

```http
POST /api/drum-import/jobs/{jobId}/artifacts
GET  /api/drum-import/jobs/{jobId}/artifacts
GET  /api/drum-import/jobs/{jobId}/artifacts/{artifactId}
```

## ביטול ומחיקה

```http
POST   /api/drum-import/jobs/{jobId}/cancel
DELETE /api/drum-import/jobs/{jobId}
```

# 28. Progress Streaming

מומלץ להשתמש ב-SSE.

```http
GET /api/drum-import/jobs/{jobId}/events/stream
Accept: text/event-stream
```

```ts
export interface DrumImportProgressEvent {
  jobId: string;
  stage: DrumImportStage;
  progress01?: number;
  message: string;
  timestamp: string;
}
```

# 29. LLM Integration

OpenAI או Claude הם שכבת Orchestration אופציונלית בלבד.

Tools אפשריים:

```text
create_drum_import_job
validate_audio_assets
start_drum_analysis
get_import_status
list_low_confidence_hits
correct_drum_hit
generate_drum_artifacts
approve_import_into_drumpath
```

מותר ל-LLM:

- להסביר שגיאות.
- לבחור Preset לפי בקשת המשתמש.
- להציג סיכום.
- לארגן Review.
- לקרוא לכלי Backend.

אסור ל-LLM:

- להמציא Onset timestamps.
- להחליף DSP.
- לאשר אוטומטית Confidence נמוך.
- לכתוב ישירות ל-`InteractiveExercise` ללא Validation.

# 30. שמירה מקומית ואופליין

לאחר אישור:

1. `DrumScoreDocument` נשמר דרך Repository ייעודי ב-IndexedDB.
2. `Exercise` נשמר דרך Repository הליבה.
3. `InteractiveExercise` נשמר דרך Repository של Visual Trainer ומקושר באמצעות `exerciseId`.
4. PDF יכול להישמר כ-`Resource`; יתר ה-Artifacts נשמרים ב-Repository ייעודי.
5. Source Audio נשמר רק לפי בחירה מפורשת ולאחר בדיקת Quota.
6. ניתן לתרגל ללא רשת; יצירת Import חדש דורשת שירות עיבוד זמין.

```ts
export interface ImportedExerciseRecord {
  id: string;
  importJobId: string;
  scoreDocumentId: string;
  coreExerciseId: string;
  interactiveExerciseId: string;
  artifactIds: string[];
  notationResourceId?: string;
  linkedSongId?: string;
  sourceAudioRetention: "none" | "local";
  approvedAt: string;
  updatedAt: string;
}
```

## 30.1 הרחבת Dexie

אין לשנות את `db.version(1)` המתועד ב-`SPEC.md`. יש להוסיף את הגרסה הבאה בפועל אחרי בדיקת הקוד הקיים; אין להניח שמספרה עדיין 2.

```ts
db.version(NEXT_SCHEMA_VERSION).stores({
  // כל הגדרות הטבלאות הקיימות נשמרות בהתאם ל-Dexie migration בפועל.
  drumImportJobs: "id, stage, inputMode, linkedSongId, linkedExerciseId, createdAt, updatedAt",
  drumImportAssets: "id, jobId, stemKind, checksumSha256, validationStatus, createdAt",
  drumScoreDocuments: "id, sourceImportJobId, linkedSongId, linkedExerciseId, updatedAt",
  drumImportMetadata: "interactiveExerciseId, coreExerciseId, sourceImportJobId, scoreDocumentId, updatedAt",
  drumArtifacts: "id, importJobId, scoreDocumentId, type, checksumSha256, createdAt",
  drumHitEdits: "id, importJobId, hitId, createdAt"
});
```

כללי Migration:

- גיבוי אוטומטי לפני Migration משמעותי, בהתאם ל-`SPEC.md`.
- מיגרציה Idempotent ככל האפשר.
- אין לשכתב תרגילים קיימים.
- כישלון מציג Recovery ואינו מוחק נתונים.
- UI אינו ניגש לטבלאות האלה ישירות.

## 30.2 גיבוי ושחזור

חבילת ה-ZIP הקיימת תורחב באופן תואם לאחור:

```text
manifest.json
data.json
resources/
drum-import/
  scores/
  artifacts/
  source-audio/   # רק אם המשתמש בחר לכלול
```

`manifest.json` יכיל `schemaVersion`, `appVersion`, Checksums ומדיניות הכללת Source Audio. Import במצב Merge ישתמש ב-UUID וב-`updatedAt`, יציג Preview ויבצע Zod validation ו-Rollback בדיוק כמו מנגנון הגיבוי הקיים.

אין לכלול Source Audio אוטומטית: הוא עשוי להגדיל מאוד את הגיבוי. ברירת המחדל היא Metadata, Score ו-Artifacts בלבד.

## 30.3 מחיקה וקשרים

- מחיקת `Exercise` מקושר אינה מוחקת מיד Source Audio או Score; מוצג Dialog עם אפשרויות מפורשות.
- מחיקת Import Job לפני אישור מוחקת Temp Assets לפי מדיניות השירות.
- מחיקת Score מאושר בודקת קישורים ל-`InteractiveExercise`, ל-`Resource` ול-`Song`.
- פעולות מחיקה הן דרך Use case ו-Repositories, לא Cascade סמוי ברכיב UI.

# 31. Review Rules

- מכה עם `isUncertain=true` חייבת להיות נגישה מרשימת Issues.
- אין להסתיר Confidence מהמשתמש.
- תיקון ידני אינו נדרס ב-Reprocessing, אלא אם המשתמש מאשר Reset.
- כל תיקון נשמר כ-Edit Operation.
- Undo/Redo נדרש במסך Review.

```ts
export interface DrumHitEditOperation {
  id: string;
  hitId: string;
  type: "add" | "delete" | "move" | "change_instrument" | "change_velocity" | "accept";
  before?: Partial<DetectedDrumHit>;
  after?: Partial<DetectedDrumHit>;
  createdAt: string;
}
```

# 32. Error Model

```ts
export interface ImportJobError {
  code:
    | "invalid_input"
    | "upload_failed"
    | "decode_failed"
    | "alignment_failed"
    | "separation_failed"
    | "analysis_failed"
    | "tempo_detection_failed"
    | "artifact_generation_failed"
    | "cancelled";
  message: string;
  retryable: boolean;
  stage: DrumImportStage;
  technicalDetails?: string;
}
```

ה-UI יציג הודעה אנושית. `technicalDetails` מיועד ל-Logs ולא יוצג כברירת מחדל.

# 33. אבטחה ופרטיות

- בדיקת MIME לפי תוכן, לא רק Extension.
- Filename אינו Path.
- שמות קבצים מנורמלים.
- מגבלת גודל ומשך ניתנות להגדרה.
- קבצים נשמרים באזור Job מבודד.
- אין להריץ קוד המגיע מהקלט.
- מחיקת Temp Files לאחר TTL.
- מחיקה מיידית לפי בקשת המשתמש.
- Logs אינם מכילים Audio bytes.
- API Keys נשמרים רק ב-Server.
- Source Audio אינו נשלח ל-LLM כאשר אין צורך מפורש.
- מצב ברירת המחדל של DrumPath נשאר ללא שליחת נתונים לשירות צד שלישי וללא Analytics חיצוני.
- לפני Remote Import יוצגו יעד ההעלאה, מטרת העיבוד ומדיניות המחיקה, והמשתמש יאשר פעולה זו במפורש.
- Local Companion לא ידווח Telemetry חיצוני כברירת מחדל.
- קישור חיצוני או Artifact download ייפתח בהתאם לכללי `rel="noopener noreferrer"` של המערכת.
- Blob URL מקומי ישוחרר לאחר Preview/Download.
- HTML מתוך Metadata או Filename לא ירונדר; יוצג טקסט בלבד.
- Content Security Policy ו-CORS יוגדרו במפורש לפי מצב הפריסה.

# 34. ביצועים

- Import הוא Background Job.
- UI אינו נחסם.
- Progress מתעדכן ללא Polling אגרסיבי.
- Decoding מתבצע פעם אחת לכל Asset.
- Intermediate PCM נשמר רק לאורך ה-Job.
- Analysis עובד על Mono Resampled copy; המקור נשמר ל-Export/Preview.
- Jobs כבדים מוגבלים לפי Worker capacity.
- Cancellation נבדק בין שלבים ובתוך עיבוד ארוך.
- Route ה-Import וכל ספריות Waveform/Notation הכבדות נטענים ב-Lazy loading.
- יעד ה-Bundle הראשוני של DrumPath נשאר עד 350KB gzip ללא ספריות PDF/Import, בהתאם ל-`SPEC.md`.
- רשימות Events גדולות יעברו Virtualization; אין לרנדר אלפי מכות בבת אחת.
- Review playback ותנועת Cursor ישתמשו ב-`requestAnimationFrame`; אין ליצור React state חדש בכל Frame.
- יעד תגובת UI ללחיצה נשאר פחות מ-16ms במכשיר היעד, בהתאם ל-Visual Trainer.

# 35. Observability

בגרסה Local-first המדדים נשמרים מקומית לצורכי אבחון בלבד. אין לשלוח Metrics או Audio לשירות Analytics חיצוני. בפריסת שרת פרטית ניתן להפעיל Metrics תפעוליים ללא Audio bytes, Filenames או תוכן אישי.

Metrics:

```text
drum_import_jobs_total
drum_import_job_duration_seconds
drum_import_stage_duration_seconds
drum_import_failures_total
drum_import_detected_hits_total
drum_import_uncertain_hits_total
drum_import_manual_corrections_total
drum_import_artifact_generation_seconds
```

לכל Job יהיה Correlation ID.

# 36. בדיקות Unit

- Validation של Stems.
- Duration tolerance.
- Silent stem detection.
- Onset thresholding.
- Peak merge.
- Velocity mapping.
- Tempo interpolation.
- Time-to-beat ו-Beat-to-time.
- Downbeat selection.
- Quantization לכל Grid.
- Duplicate hit removal באותו Slot וכלי.
- Tom cluster ordering.
- Tom confidence threshold.
- MIDI note mapping.
- Staff position mapping.
- Score-to-exercise adapter.
- Backward compatibility ל-`InteractiveExercise` קיים.
- חסימת Triplet ב-Adapter למנוע הקיים.
- מיפוי `hihat` ל-`hihat_closed` כברירת מחדל.
- הוצאת `residual` מהתרגיל האינטראקטיבי.
- יצירת `Exercise` ליבה וקישור `InteractiveExercise.exerciseId`.
- Zod validation לכל API Response, SSE Event ורשומת Dexie חדשה.
- חישוב Quota ומדיניות Source Audio retention.
- Merge/Replace של הרחבת הגיבוי.

# 37. בדיקות Integration

1. Upload של כל ה-Stems.
2. Validation ו-Alignment.
3. Analysis מלא.
4. יצירת `DrumScoreDocument`.
5. תיקון Tom לא ודאי.
6. יצירת MIDI/MusicXML/PDF.
7. שמירה כ-`InteractiveExercise`.
8. פתיחת התרגיל ב-Visual Trainer.
9. הפעלה ב-Note Highway.
10. שמירה ביומן האימונים.
11. אימות ש-`PracticeEntry.exerciseId` מצביע ל-`Exercise` הליבה.
12. שמירת PDF כ-`Resource` ללא שינוי Allowlist עבור MIDI/MusicXML.
13. ייצוא Backup, מחיקת נתונים, Restore ובדיקת Score ו-Artifacts.
14. Migration של Dexie עם נתוני גרסה קודמת ללא אובדן.

# 38. Golden Files

לכל גרסת Algorithm יש לשמור Fixture קטן ומורשה:

```text
fixtures/
  basic-rock/
    kick.wav
    snare.wav
    toms.wav
    hi_hat.wav
    crash.wav
    expected-events.json
    expected-score.json
    expected.mid
    expected.musicxml
```

בדיקת PDF אינה תסתמך על Hash בלבד. יש לבצע Render לעמודים והשוואת תמונה עם Tolerance.

# 39. E2E

1. המשתמש נכנס מספריית השירים או ממסך Visual Trainer ובוחר Pre-Separated Stems.
2. מעלה Kick, Snare, Toms, Hi-Hat, Crash ו-Residual.
3. המערכת מזהה Ride שקט ומציגה אזהרה.
4. המשתמש מתחיל Analysis.
5. Progress מוצג.
6. מסך Review מציג מכות לא ודאיות.
7. המשתמש משנה Tom אחד מ-Mid ל-Floor.
8. המשתמש מאשר.
9. נוצרים MIDI, MusicXML ו-PDF.
10. נוצרים `Exercise` ליבה ו-`InteractiveExercise` מקושר.
11. PDF נשמר כ-`Resource`, אם נבחר, והשיר מקושר לתרגיל.
12. התרגיל נפתח במצב Staff Cursor ב-BPM נקי קבוע.
13. תוצאת אימון נשמרת ביומן עם `PracticeEntry.exerciseId` תקין.
14. לאחר מעבר אופליין התרגיל וה-PDF עדיין זמינים.

# 40. קריטריוני קבלה ל-MVP

- תמיכה ב-Pre-Separated Drum Stems.
- Validation של אורך ו-Alignment.
- זיהוי Kick, Snare, Toms, Hi-Hat ו-Crash.
- Stem שקט אינו מייצר תווים.
- סיווג Floor/Mid/High Tom עם Confidence.
- סימון `?` לכל Tom מתחת לסף.
- Beat/Tempo Map מתוך ההקלטה.
- Quantization ל-Sixteenth.
- מסך Review עם Add/Delete/Move/Change Instrument.
- יצירת `DrumScoreDocument`.
- יצירת MIDI עם Tempo Map.
- יצירת MusicXML בקצב קבוע.
- יצירת PDF A4 Landscape.
- יצירת `Exercise` ליבה והמרה ל-`InteractiveExercise` מקושר.
- מנוע התרגול משתמש ב-`cleanScoreBpm`; Tempo Map נשמר לייצוא ול-Review ואינו מופעל במנוע הקיים.
- ניתן להשלים שלב 6A כדי להפעיל Tempo Map דינמי בלי להסיר את מצב Fixed.
- Triplet נשמר ב-Score וב-Exports ללא אובדן; הוא אינו מופעל כתרגיל אינטראקטיבי עד שלב 6B.
- PDF ניתן לשמירה כ-`Resource`; יתר ה-Artifacts אינם מרחיבים סמוי את סוגי Resource הקיימים.
- `PracticeEntry` שנוצר לאחר אימון מקושר ל-`Exercise` הליבה.
- כל הרשומות החדשות נכתבות דרך Repositories ועוברות Zod.
- Backup/Restore כולל Score ו-Artifacts ושומר תאימות לגיבויים קיימים.
- תרגול עובד אופליין לאחר השמירה.
- אין שינוי התנהגות בתרגילים קיימים.
- אין מחיקה, החלפה או הקטנת היקף של יכולת קיימת המופיעה במטריצת סעיף 0.2.

# 41. מחוץ לתחום ב-MVP

- זיהוי בזמן אמת ממיקרופון.
- תמלול מערכת תופים אקוסטית חיה.
- הפרדה מדויקת של Open/Closed/Pedal Hi-Hat.
- Rimshot/Cross-stick/Brush classification.
- זיהוי אוטומטי מושלם של Time Signature מורכב.
- עריכה מלאה ברמת DAW.
- אימון מודל ML בתוך DrumPath.
- Processing מלא בדפדפן.
- Auto-approval ללא Review.
- הפעלת Tempo Map דינמי לפני מימוש שלב 6A; המימוש עצמו מוגדר כחלק מהרחבת המערכת.
- הפעלת Tuplets/Triplets לפני מימוש שלב 6B; שמירתם וייצואם אינם מחוץ לתחום.
- שינוי מודל המשתמש היחיד, Authentication, Cloud Sync או Analytics חיצוני.
- שינוי סכמת `Resource` לכל סוגי האודיו והייצוא ללא החלטת מוצר נפרדת.

# 42. שלבי מימוש

## שלב 0: Compatibility Audit ו-ADR

- קריאת `SPEC.md`, `VISUAL_DRUM_TRAINER_SPEC.md` והקוד הקיים.
- איתור גרסת Dexie הפעילה וכל ה-Repositories בפועל.
- אימות Types קיימים במקום יצירת כפילויות.
- תיעוד גבול Local-first/Import Service ב-ADR.
- עדכון `docs/implementation-status.md`.

## שלב 1: Domain ו-IR

- Types.
- Zod Schemas.
- `DrumScoreDocument`.
- Instrument map.
- Adapter למודל הקיים.
- Zod Schemas ל-API, SSE ו-Dexie.
- תכנון Migration עם `NEXT_SCHEMA_VERSION` בפועל.
- Unit Tests.

## שלב 2: Import API

- Job lifecycle.
- Upload.
- Validation.
- Storage זמני.
- SSE progress.
- Cancellation.

## שלב 3: Pre-Separated Analysis

- Decode.
- Onset detection.
- Tempo map.
- Toms classification.
- Quantization.
- Analysis JSON.

## שלב 4: Review UI

- Waveform.
- Stem mixer.
- Score preview.
- Confidence issues.
- Manual corrections.
- Undo/Redo.

## שלב 5: Exporters

- Performance MIDI.
- Fixed MIDI.
- MusicXML.
- PDF.
- CSV.

## שלב 6: DrumPath Integration

- `Exercise` + `InteractiveExercise` Adapters.
- Dexie Repositories ו-Migration.
- `Song` ו-`Resource` integration.
- Visual Trainer route.
- Practice Journal.
- Backup/Restore.

## שלב 6A: Visual Trainer Mapped Tempo

- `ExerciseTempoMode` ו-Fields אופציונליים עם ברירת מחדל `fixed`.
- `TempoResolver`, `FixedTempoResolver` ו-`MappedTempoResolver`.
- שילוב ב-`TimingEngine`, `ExerciseRunner`, Note Highway ו-Staff Cursor.
- Count-in, Pause/Resume, Restart ו-Hit Matching מול Tempo Map.
- Regression Fixtures המוכיחים שאין שינוי בתרגילים קיימים.
- עדכון `VISUAL_DRUM_TRAINER_SPEC.md` ו-`docs/implementation-status.md`.

שלב זה חובה לפני הפעלת `performance_mapped` בתוך Visual Trainer. הוא אינו נדרש ליצירת Performance MIDI.

## שלב 6B: Visual Trainer Triplets

- הרחבת `MusicalSubdivision` ו-Zod ל-Triplets.
- Timing, Metronome subdivision, Note Highway ו-Staff notation.
- MusicXML Tuplets ו-MIDI Tick validation.
- Regression מלא ל-Quarter/Eighth/Sixteenth.
- עדכון `VISUAL_DRUM_TRAINER_SPEC.md` ו-`docs/implementation-status.md`.

שלב זה חובה לפני הפעלת Score עם Triplets כתרגיל אינטראקטיבי. עד אז ה-Score וה-Exports נשמרים במלואם.

## שלב 7: Optional Separation

- Drums Stem mode.
- Full Mix mode.
- DrumSep/Music separation provider abstraction.

## שלב 8: QA

- Golden files.
- E2E.
- Performance.
- Accessibility.
- Documentation.

# 43. Definition of Done

- TypeScript strict ללא `any`.
- Zod validation לכל Payload.
- API מחזיר Problem Details עקבי.
- Worker דטרמיניסטי לפי Algorithm Version.
- כל האירועים שומרים Source Time ו-Musical Position.
- כל Correction נשמרת.
- MIDI נפתח ב-DAW נפוץ.
- MusicXML נפתח בעורך תווים תומך.
- כל עמודי PDF עוברים Render QA.
- תרגיל שנוצר עובד ב-Note Highway וב-Staff Cursor.
- נוצר `Exercise` ליבה, ו-`InteractiveExercise.exerciseId` מצביע אליו.
- `PracticeEntry.exerciseId` מצביע ל-`Exercise` הליבה ולא לישות Visual.
- Tempo Map אינו מופעל במנוע הקיים ללא שלב 6A ובדיקות; לאחר שלב 6A גם מצב Fixed הקיים ממשיך לפעול ללא שינוי.
- Triplets נשמרים ללא אובדן ונחסמים ב-Adapter רק עד השלמת שלב 6B; לאחריו הם פועלים לצד החלוקות הקיימות.
- Migration של Dexie נבדקה מול גיבוי של הגרסה הקודמת.
- Export/Import ZIP משחזר Score, Metadata ו-Artifacts ללא אובדן Blob.
- Route ה-Import Lazy-loaded ויעד ה-Bundle הראשוני נשמר.
- Focus, RTL, 44x44, Reduced motion ואי-הסתמכות על צבע נבדקו.
- אין Analytics חיצוני ואין העלאה מרוחקת ללא פעולה ואישור מפורשים.
- התרגיל עובד ללא רשת לאחר Import.
- אין Regression בתרגילים הקיימים.
- כל שורה במטריצת שימור היכולות בסעיף 0.2 עברה בדיקה או תועדה כבדיקה ידנית חתומה.
- `SPEC.md` ו-`VISUAL_DRUM_TRAINER_SPEC.md` עודכנו בהתאם לסעיף 0.3 בכל שלב ששינה Contract שלהם.
- `lint`, `typecheck`, Unit, Integration ו-E2E עוברים.
- README, CHANGELOG, ADR ו-`docs/implementation-status.md` מעודכנים.

# 44. הוראות ל-Claude Code / Codex

1. קרא את `SPEC.md`, את `VISUAL_DRUM_TRAINER_SPEC.md` ואת המסמך הזה במלואם ובסדר הקדימות שהוגדר.
2. סקור את מבנה DrumPath בפועל לפני יצירת קבצים.
3. ממש שלב אחד בלבד בכל פעם.
4. אל תשנה את המודל הקיים ללא Migration תואם לאחור.
5. אל תשתמש ב-`any`.
6. כל Payload עובר Zod.
7. אין גישה ישירה ל-IndexedDB מתוך UI.
8. אין להעביר Audio Processing ל-React.
9. אין להשתמש ב-LLM ליצירת timestamps.
10. כתוב Unit Tests לכל Mapper וחוק עסקי.
11. שמור Algorithm Version בכל תוצאה.
12. עדכן את קובץ ה-Implementation Status הקיים לאחר כל שלב.
13. אל תניח שמספר גרסת Dexie הבא הוא 2; אתר את הגרסה בפועל.
14. אל תשנה את `DrumNoteEvent` הבסיסי לצורך Metadata של Import.
15. אל תשתמש ב-Tempo Map דינמי בתוך Visual Trainer לפני השלמת שלב 6A; אל תמחק את המפה ואל תמיר אותה בשקט.
16. בסוף כל שלב הרץ `lint`, `typecheck` ו-`tests` בהתאם ל-`SPEC.md`.
17. עדכן את קובץ הסטטוס הקיים; אם מיקומו הוא `docs/implementation-status.md`, אל תיצור קובץ כפול בשורש.
18. אל תסיר או תצמצם יכולת קיימת כדי לפתור התנגשות עם ה-Import; השתמש ב-Adapter, Field אופציונלי, Feature Flag או Migration תואם לאחור.
19. אם שלב משנה Contract של מסמך בסיס, עדכן אותו באותו שינוי בהתאם לסעיף 0.3.
20. הרץ את מטריצת ה-Regression בסעיף 0.2 לפני סגירת Milestone.

# 45. Prompt פתיחה למימוש שלב 0

```text
קרא במלואם:
- SPEC.md
- VISUAL_DRUM_TRAINER_SPEC.md
- DRUM_AUDIO_IMPORT_AND_TRANSCRIPTION_SPEC.md

המטרה היא להוסיף ל-DrumPath תהליך Import של ערוצי תופים, המפיק
DrumScoreDocument, MIDI, MusicXML, PDF, Exercise ו-InteractiveExercise מקושר.

ממש בשלב זה רק את שלב 0:
- סקור את הקוד ומבנה הפרויקט בפועל
- אתר Types, Repositories, Dexie versions ונתיבים קיימים
- הפק Compatibility Report
- כתוב ADR לגבול Local-first מול Import Service
- אל תיצור עדיין קוד Feature או Migration

שלב 1 העתידי, לאחר אישור דו"ח התאימות, יכלול:
- Domain types
- Zod schemas
- DrumScoreDocument
- Instrument definitions
- ScoreToInteractiveExerciseAdapter
- Unit tests

לפני כתיבת קוד:
1. סקור את מבנה הפרויקט.
2. אתר את Exercise, PracticeEntry, Resource, Song, DrumNoteEvent ו-InteractiveExercise הקיימים.
3. הצג רשימת קבצים שתיצור או תשנה.
4. ציין סתירות מול האפיון הקיים.
5. ציין את גרסת Dexie הפעילה ואת מספר הגרסה הבא; אל תנחש.
6. הצג Migration תואם לאחור ותוכנית Backup/Recovery.

דרישות:
- React + TypeScript strict.
- ללא any.
- RTL נשמר.
- תרגילים קיימים ממשיכים לעבוד ללא שינוי.
- אין Backend בשלב 1.
- אין Backend או Audio Processing בשלב 0.
- אין שינוי ב-DrumNoteEvent הבסיסי.
- Exercise ו-InteractiveExercise נשארים ישויות נפרדות ומקושרות.
- Visual Trainer משתמש ב-cleanScoreBpm קבוע; Tempo Map נשמר לייצוא בלבד בשלב זה.
- אין להסיר שום Route, מצב תרגול, מיפוי מקלדת, Sample, Scoring rule, Journal field, Backup capability או Offline capability קיימים.
- הפק רשימת תיקונים נדרשים ל-SPEC.md ול-VISUAL_DRUM_TRAINER_SPEC.md לפי סעיף 0.3.
- Tests לכל Mapper ו-Schema.
```

# 46. תוצאת יעד

המשתמש יוכל לקחת שיר שיצר, להעלות את ערוצי התופים המופרדים, לקבל תמלול שקוף וניתן לתיקון, ולאחר אישור להפוך אותו מיד לתרגיל DrumPath מלא:

```text
Audio Stems
    -> Detection
    -> Tempo Map
    -> Classification
    -> Quantization
    -> Review
    -> DrumScoreDocument
       -> Exercise (DrumPath core)
          -> InteractiveExercise (Visual Trainer)
          -> PracticeEntry / Journal
       -> MIDI
       -> MusicXML
       -> PDF
       -> Confidence Report
```

העיקרון המנחה: אוטומציה מהירה, אך ללא הסתרת אי-ודאות וללא אובדן הקשר בין ההקלטה המקורית לתווים.
