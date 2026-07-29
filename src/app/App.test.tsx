import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from './App'

describe('App', () => {
  it('renders the layout shell with the main nav and the dashboard route', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'DrumPath' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'ניווט ראשי' })).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'ברוכים הבאים ל-DrumPath' }),
    ).toBeInTheDocument()
  })
})
