import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../test/utils'

describe('status pages', () => {
  it('shows 404 inside the layout for unknown paths', async () => {
    renderApp('/tidak-ada', 'user')
    expect(await screen.findByRole('heading', { name: /404/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kembali ke Beranda' })).toHaveAttribute('href', '/')
  })

  it('keeps the title and back link while a detail page fails', async () => {
    renderApp('/console/99', 'admin')
    expect(await screen.findByText('Data tidak ditemukan')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Semua sumber data/ })).toHaveAttribute(
      'href',
      '/console',
    )
  })
})
