import '@fontsource-variable/inter'
import '@fontsource/jetbrains-mono/400.css'
import './styles/tokens.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'

async function boot() {
  // MOCK-ONLY: the single entry point into /mocks. Delete this block at integration.
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    const { startMocks } = await import('../mocks/browser')
    await startMocks()
  }
  // END MOCK-ONLY

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
