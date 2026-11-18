import '@fontsource-variable/inter'
import '@fontsource/jetbrains-mono/400.css'
import './styles/tokens.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'

async function enableMocks() {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledFrame: 'bypass', quiet: true })
}

void enableMocks().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
