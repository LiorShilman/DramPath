import { createBrowserRouter } from 'react-router'
import { routes } from './routes'

// Mirrors vite.config.ts's `base` — import.meta.env.BASE_URL always has a
// trailing slash (and is exactly '/' at the domain root, where no basename
// is needed at all).
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

export const router = createBrowserRouter(routes, { basename })
