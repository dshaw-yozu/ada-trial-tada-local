import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the app heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Ada trial' })).toBeInTheDocument()
  })
})

describe('main entry', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.resetModules()
  })

  it('mounts the app into the root element', async () => {
    document.body.innerHTML = '<div id="root"></div>'
    await import('./main')
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'Ada trial' }),
      ).toBeInTheDocument(),
    )
  })
})
