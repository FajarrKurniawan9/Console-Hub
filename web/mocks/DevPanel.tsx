import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { getScenario, SCENARIOS, setScenario, type Scenario } from './scenarios'

/** Mock-only scenario picker. Same effect as `?scenario=` in the URL; reloads to apply cleanly. */
function DevPanel() {
  const [value, setValue] = useState(getScenario)
  return (
    <label className="fixed bottom-3 left-3 z-40 flex items-center gap-2 rounded-md border bg-bg px-2 py-1 font-mono text-xs text-muted shadow-pop">
      skenario mock
      <select
        value={value}
        onChange={(e) => {
          const next = e.target.value as Scenario
          setScenario(next)
          setValue(next)
          const u = new URL(window.location.href)
          u.searchParams.delete('scenario')
          window.location.replace(u)
        }}
        className="rounded-sm bg-bg py-0.5 text-fg"
      >
        {SCENARIOS.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
    </label>
  )
}

export function mountDevPanel() {
  const host = document.createElement('div')
  host.id = 'mock-dev-panel'
  document.body.append(host)
  createRoot(host).render(<DevPanel />)
}
