import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { vi } from 'vitest'

// vite-plugin-pwa's virtual module is only resolvable by a real Vite dev
// server / build, not Vitest's transform pipeline — stub it so components
// using useRegisterSW (PwaUpdateBanner) can still be rendered in tests.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: async () => {},
  }),
}))
