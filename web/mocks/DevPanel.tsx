import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { PASSWORD, users } from './data/users'
import { getScenario, SCENARIOS, setScenario, type Scenario } from './scenarios'

/**
 * Mock-only dev panel: scenario picker (same effect as `?scenario=`; reloads to apply) and the
 * mock accounts, so the login page itself carries no dummy data.
 */
function DevPanel() {
  const [value, setValue] = useState(getScenario)
  return (
    <div className="fixed bottom-3 left-3 z-40 flex flex-col gap-1 rounded-md border bg-bg px-2 py-1.5 font-mono text-xs text-muted shadow-pop">
      <label className="flex items-center gap-2">
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
      <details>
        <summary className="cursor-pointer">akun mock (sandi {PASSWORD})</summary>
        <ul className="pt-1">
          {users.map((u) => (
            <li key={u.id} className={u.is_active ? 'text-fg' : 'line-through'}>
              {u.email}
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

export function mountDevPanel() {
  const host = document.createElement('div')
  host.id = 'mock-dev-panel'
  document.body.append(host)
  createRoot(host).render(<DevPanel />)
}
