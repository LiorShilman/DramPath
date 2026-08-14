import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { SettingsPage } from './SettingsPage'
import { db } from '../../data/db'

afterEach(async () => {
  await db.settings.clear()
})

// SettingsPage now links to /settings/module-kits — needs a Router context.
function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  )
}

describe('SettingsPage', () => {
  it('loads the default metronome settings', async () => {
    renderPage()
    const bpmInput = await screen.findByLabelText('BPM התחלתי')
    await waitFor(() => expect(bpmInput).toHaveValue(80))
  })

  it('autosaves an edit without clobbering the rest of practiceRules', async () => {
    renderPage()
    const bpmInput = await screen.findByLabelText('BPM התחלתי')
    // Wait for the async defaultValues load to finish rendering before
    // editing — otherwise the load can resolve mid-edit and overwrite it.
    await waitFor(() => expect(bpmInput).toHaveValue(80))

    const user = userEvent.setup()
    await user.clear(bpmInput)
    await user.type(bpmInput, '100')

    await waitFor(async () => {
      const settings = await db.settings.get('user-settings')
      expect(settings?.metronomeDefaults.bpm).toBe(100)
    })

    const settings = await db.settings.get('user-settings')
    expect(settings?.practiceRules.cleanRepsToMaster).toBe(3)
    expect(settings?.practiceRules.sessionsToMaster).toBe(2)
  })
})
