import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { TouchDrumKitPage } from '../features/touch-practice'

// Entry point for touch.html — a second real HTML document (not a
// react-router route) so it can carry its own Web App Manifest with its
// own start_url. See TouchDrumKitPage's doc comment for why: a single
// shared manifest's start_url always wins on "Add to Home Screen",
// regardless of which page you installed from, so a genuinely separate
// direct-launch icon needs a genuinely separate document.
const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <TouchDrumKitPage />
  </StrictMode>,
)
