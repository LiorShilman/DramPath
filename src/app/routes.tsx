import type { RouteObject } from 'react-router'
import { AppLayout } from '../components/layout/AppLayout'
import {
  Dashboard,
  SetupWizard,
  CoursePage,
  WeekDetailPage,
  LessonsListPage,
  LessonDetailPage,
  ExercisesListPage,
  ExerciseDetailPage,
  TodayPage,
  PracticeSessionPage,
  SettingsPage,
  JournalPage,
  AnalyticsPage,
  LibraryPage,
  SongsListPage,
  SongDetailPage,
  ExerciseSelectPage,
  VisualTrainerPage,
  FreeNotationPracticePage,
  ExerciseBuilderPage,
  RoutineListPage,
  RoutineBuilderPage,
  RoutinePlayerPage,
  DrumImportPage,
  TouchDrumKitPage,
  CurriculumGeneratorPage,
} from './lazy-pages'

// Route map from SPEC.md §10. "/", "/setup", "/today", "/practice/session",
// "/course"(+detail), "/lessons"(+detail), "/exercises"(+detail),
// "/settings", "/journal", "/analytics", "/library" and "/songs"(+detail)
// render real screens; everything else is a placeholder until its stage
// lands. "/songs/:songId" isn't in §10's table but follows the same
// list+detail convention every other library feature already uses.
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'today', element: <TodayPage /> },
      { path: 'practice/session', element: <PracticeSessionPage /> },
      { path: 'course', element: <CoursePage /> },
      { path: 'course/weeks/:weekId', element: <WeekDetailPage /> },
      { path: 'lessons', element: <LessonsListPage /> },
      { path: 'lessons/:lessonId', element: <LessonDetailPage /> },
      // Standalone "private teacher" curriculum generator — link-only (not
      // in NAV_ITEMS), reached via a button on LessonsListPage's header.
      { path: 'practice/visual/curriculum', element: <CurriculumGeneratorPage /> },
      { path: 'exercises', element: <ExercisesListPage /> },
      { path: 'exercises/:exerciseId', element: <ExerciseDetailPage /> },
      { path: 'songs', element: <SongsListPage /> },
      { path: 'songs/:songId', element: <SongDetailPage /> },
      { path: 'journal', element: <JournalPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'setup', element: <SetupWizard /> },
      // Visual Drum Trainer (VISUAL_DRUM_TRAINER_SPEC.md) — list+detail,
      // same convention as lessons/exercises/songs: the list is in
      // NAV_ITEMS, the :exerciseId detail route is link-only.
      { path: 'practice/visual', element: <ExerciseSelectPage /> },
      { path: 'practice/visual/:exerciseId', element: <VisualTrainerPage /> },
      { path: 'practice/visual/free-notation', element: <FreeNotationPracticePage /> },
      { path: 'practice/visual/build', element: <ExerciseBuilderPage /> },
      { path: 'practice/visual/build/:exerciseId', element: <ExerciseBuilderPage /> },
      { path: 'practice/visual/import', element: <DrumImportPage /> },
      // Practice routines (setlists) — same list+detail(+build) convention
      // as exercises, one level down.
      { path: 'practice/visual/routines', element: <RoutineListPage /> },
      { path: 'practice/visual/routines/build', element: <RoutineBuilderPage /> },
      { path: 'practice/visual/routines/build/:routineId', element: <RoutineBuilderPage /> },
      { path: 'practice/visual/routines/:routineId/play', element: <RoutinePlayerPage /> },
    ],
  },
  // Standalone, chrome-free (no AppLayout/sidebar/nav) — a direct,
  // bookmarkable link for touch-based practice away from the desktop app,
  // e.g. "Add to Home Screen" on a phone. See TouchDrumKitPage's own doc
  // comment for the scoping rationale.
  { path: '/practice/touch', element: <TouchDrumKitPage /> },
]
