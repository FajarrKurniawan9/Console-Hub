import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getScenario, SCENARIOS, setScenario, type Scenario } from '../mocks/scenarios'

/** Dev-only mock scenario picker. Same effect as `?scenario=` in the URL. */
export default function DevScenarioSwitch() {
  const qc = useQueryClient()
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
          void qc.invalidateQueries()
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
