import {
  LayoutDashboard,
  ListChecks,
  Map,
  BookOpen,
  Dumbbell,
  Music,
  NotebookPen,
  LineChart,
  FolderOpen,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

// Top-level nav — the persistent links from SPEC.md §10. Detail routes
// (/course/weeks/:weekId, /lessons/:lessonId, /exercises/:exerciseId),
// /practice/session, and /setup are reached via other screens/onboarding,
// not the main nav.
export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'דשבורד', icon: LayoutDashboard },
  { path: '/today', label: 'האימון של היום', icon: ListChecks },
  { path: '/course', label: 'מסלול הקורס', icon: Map },
  { path: '/lessons', label: 'ספריית שיעורים', icon: BookOpen },
  { path: '/exercises', label: 'ספריית תרגילים', icon: Dumbbell },
  { path: '/songs', label: 'ספריית שירים', icon: Music },
  { path: '/journal', label: 'יומן אימונים', icon: NotebookPen },
  { path: '/analytics', label: 'ניתוח התקדמות', icon: LineChart },
  { path: '/library', label: 'ספריית קבצים', icon: FolderOpen },
  { path: '/settings', label: 'הגדרות', icon: Settings },
]
