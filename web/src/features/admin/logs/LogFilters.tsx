import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { inputClass } from '../../../components/ui/Input'
import { MultiSelect } from '../../../components/ui/MultiSelect'
import { Select } from '../../../components/ui/Select'
import { LOG_LEVEL } from '../../../lib/status'
import type { ConsoleInfo, LogLevel } from '../../../lib/api/schemas'
import type { useUrlState } from '../../../lib/useUrlState'
import { DEFAULT_RANGE, RANGES } from './timeRange'

const LEVELS = (Object.keys(LOG_LEVEL) as LogLevel[]).map((l) => ({
  value: l,
  label: LOG_LEVEL[l].label,
}))

export function LogFilters({
  url,
  consoles,
  onApply,
}: {
  url: ReturnType<typeof useUrlState>
  consoles: ConsoleInfo[]
  onApply: () => void
}) {
  const [text, setText] = useState(url.get('q'))
  const urlQ = url.get('q')
  // Debounce typing into the URL.
  useEffect(() => {
    if (text === urlQ) return
    const t = setTimeout(() => {
      url.set({ q: text || null })
      onApply()
    }, 300)
    return () => clearTimeout(t)
  }, [text, urlQ, url, onApply])

  const range = url.get('range') || DEFAULT_RANGE
  const active =
    url.list('console').length > 0 ||
    url.list('level').length > 0 ||
    !!urlQ ||
    range !== DEFAULT_RANGE
  const set = (patch: Parameters<typeof url.set>[0]) => {
    url.set(patch)
    onApply()
  }

  return (
    <div role="search" aria-label="Filter log" className="flex flex-wrap items-center gap-2">
      <MultiSelect
        label="Console"
        options={consoles.map((c) => ({ value: String(c.id), label: c.name }))}
        value={url.list('console')}
        onChange={(v) => set({ console: v })}
      />
      <MultiSelect
        label="Tingkat"
        options={LEVELS}
        value={url.list('level')}
        onChange={(v) => set({ level: v })}
      />
      <label className="relative flex items-center">
        <span className="sr-only">Kata kunci</span>
        <Search
          size={14}
          strokeWidth={1.5}
          className="pointer-events-none absolute left-2.5 text-muted"
          aria-hidden
        />
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Cari pesan, aktor, atau ID transaksi"
          className={`${inputClass} w-56 pl-8`}
        />
      </label>
      <label className="flex items-center gap-1.5 text-dense">
        <span className="text-muted">Rentang:</span>
        <Select
          value={range}
          onChange={(e) => set({ range: e.target.value === DEFAULT_RANGE ? null : e.target.value })}
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
      </label>
      {range === 'custom' ? (
        <>
          <label className="flex items-center gap-1.5 text-dense">
            <span className="text-muted">Dari</span>
            <input
              type="datetime-local"
              value={url.get('from')}
              onChange={(e) => set({ from: e.target.value || null })}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-1.5 text-dense">
            <span className="text-muted">Sampai</span>
            <input
              type="datetime-local"
              value={url.get('to')}
              onChange={(e) => set({ to: e.target.value || null })}
              className={inputClass}
            />
          </label>
        </>
      ) : null}
      {active ? (
        <Button
          variant="ghost"
          onClick={() => {
            setText('')
            set({ console: null, level: null, q: null, range: null, from: null, to: null })
          }}
        >
          <X size={14} strokeWidth={1.5} aria-hidden />
          Hapus filter
        </Button>
      ) : null}
    </div>
  )
}
