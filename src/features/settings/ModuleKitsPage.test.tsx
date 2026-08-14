import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ModuleKitsPage } from './ModuleKitsPage'

describe('ModuleKitsPage', () => {
  it('lists all 20 kit presets, each with its order number and name', () => {
    render(
      <MemoryRouter>
        <ModuleKitsPage />
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(20)
    expect(screen.getByText('Improve')).toBeInTheDocument()
    expect(screen.getByText('Latin')).toBeInTheDocument()
  })

  it('marks Studio and Acoustic as recommended for training', () => {
    render(
      <MemoryRouter>
        <ModuleKitsPage />
      </MemoryRouter>,
    )
    const recommended = screen.getAllByText('מומלץ לאימון')
    expect(recommended).toHaveLength(2)
  })
})
