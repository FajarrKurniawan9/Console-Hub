import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

export function JsonView({ value, label }: { value: unknown; label?: string }) {
  const text = value === undefined ? '' : JSON.stringify(value, null, 2)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked; the text stays selectable.
    }
  }
  return (
    <div className="relative rounded-md border bg-surface">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs text-muted">{label ?? 'JSON'}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-muted hover:bg-bg hover:text-fg"
          aria-label={copied ? 'Tersalin' : `Salin ${label ?? 'JSON'}`}
        >
          {copied ? (
            <Check size={14} strokeWidth={1.5} aria-hidden />
          ) : (
            <Copy size={14} strokeWidth={1.5} aria-hidden />
          )}
          {copied ? 'Tersalin' : 'Salin'}
        </button>
      </div>
      <pre className="max-h-96 overflow-auto p-3 font-mono text-xs leading-5 whitespace-pre-wrap break-all">
        {value === undefined ? <span className="text-muted">Tidak ada data</span> : text}
      </pre>
    </div>
  )
}
