import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KeyboardGuide } from './KeyboardGuide'

describe('KeyboardGuide', () => {
  it('shows all 9 key-to-instrument mappings (fixed variant)', () => {
    render(<KeyboardGuide />)
    expect(screen.getByText('F')).toBeInTheDocument()
    expect(screen.getByText('בס דראם')).toBeInTheDocument()
    expect(screen.getByText('J')).toBeInTheDocument()
    expect(screen.getByText('סנר')).toBeInTheDocument()
    expect(screen.getByText('O')).toBeInTheDocument()
    expect(screen.getByText('טמטם רצפה')).toBeInTheDocument()
  })

  it('shows the same mappings in the inline variant, as a plain (non-fixed) card', () => {
    const { container } = render(<KeyboardGuide variant="inline" />)
    expect(screen.getByText('בס דראם')).toBeInTheDocument()
    expect(container.querySelector('.fixed')).toBeNull()
  })
})
