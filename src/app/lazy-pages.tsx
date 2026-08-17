import { lazy } from 'react'

// §33: lazy-load every route's page component so the initial bundle only
// pays for the app shell + whichever screen is actually being visited.
// Kept in its own file (rather than inline in routes.tsx) because
// react-refresh/only-export-components requires a file to export
// components only — routes.tsx also exports the non-component `routes` array.
export const Dashboard = lazy(() =>
  import('../features/dashboard').then((m) => ({ default: m.Dashboard })),
)
export const SetupWizard = lazy(() =>
  import('../features/setup').then((m) => ({ default: m.SetupWizard })),
)
export const CoursePage = lazy(() =>
  import('../features/course').then((m) => ({ default: m.CoursePage })),
)
export const WeekDetailPage = lazy(() =>
  import('../features/course').then((m) => ({ default: m.WeekDetailPage })),
)
export const LessonsListPage = lazy(() =>
  import('../features/lessons').then((m) => ({ default: m.LessonsListPage })),
)
export const LessonDetailPage = lazy(() =>
  import('../features/lessons').then((m) => ({ default: m.LessonDetailPage })),
)
export const ExercisesListPage = lazy(() =>
  import('../features/exercises').then((m) => ({ default: m.ExercisesListPage })),
)
export const ExerciseDetailPage = lazy(() =>
  import('../features/exercises').then((m) => ({ default: m.ExerciseDetailPage })),
)
export const TodayPage = lazy(() =>
  import('../features/today').then((m) => ({ default: m.TodayPage })),
)
export const PracticeSessionPage = lazy(() =>
  import('../features/practice-session').then((m) => ({ default: m.PracticeSessionPage })),
)
export const SettingsPage = lazy(() =>
  import('../features/settings').then((m) => ({ default: m.SettingsPage })),
)
export const ModuleKitsPage = lazy(() =>
  import('../features/settings').then((m) => ({ default: m.ModuleKitsPage })),
)
export const JournalPage = lazy(() =>
  import('../features/journal').then((m) => ({ default: m.JournalPage })),
)
export const AnalyticsPage = lazy(() =>
  import('../features/analytics').then((m) => ({ default: m.AnalyticsPage })),
)
export const LibraryPage = lazy(() =>
  import('../features/library').then((m) => ({ default: m.LibraryPage })),
)
export const SongsListPage = lazy(() =>
  import('../features/songs').then((m) => ({ default: m.SongsListPage })),
)
export const SongDetailPage = lazy(() =>
  import('../features/songs').then((m) => ({ default: m.SongDetailPage })),
)
export const ExerciseSelectPage = lazy(() =>
  import('../features/visual-trainer').then((m) => ({ default: m.ExerciseSelectPage })),
)
export const VisualTrainerPage = lazy(() =>
  import('../features/visual-trainer').then((m) => ({ default: m.VisualTrainerPage })),
)
export const FreeNotationPracticePage = lazy(() =>
  import('../features/visual-trainer').then((m) => ({ default: m.FreeNotationPracticePage })),
)
export const ExerciseBuilderPage = lazy(() =>
  import('../features/visual-trainer').then((m) => ({ default: m.ExerciseBuilderPage })),
)
export const RoutineListPage = lazy(() =>
  import('../features/visual-trainer').then((m) => ({ default: m.RoutineListPage })),
)
export const RoutineBuilderPage = lazy(() =>
  import('../features/visual-trainer').then((m) => ({ default: m.RoutineBuilderPage })),
)
export const RoutinePlayerPage = lazy(() =>
  import('../features/visual-trainer').then((m) => ({ default: m.RoutinePlayerPage })),
)
export const PedalDisciplinePage = lazy(() =>
  import('../features/visual-trainer').then((m) => ({ default: m.PedalDisciplinePage })),
)
export const DrumImportPage = lazy(() =>
  import('../features/drum-import').then((m) => ({ default: m.DrumImportPage })),
)
export const TouchDrumKitPage = lazy(() =>
  import('../features/touch-practice').then((m) => ({ default: m.TouchDrumKitPage })),
)
export const CurriculumGeneratorPage = lazy(() =>
  import('../features/curriculum').then((m) => ({ default: m.CurriculumGeneratorPage })),
)
