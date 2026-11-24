import { useEffect, useRef, useState } from 'react'
import { ShieldCheck } from 'lucide-react'

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void
      render: (
        container: HTMLElement,
        parameters: {
          sitekey: string
          callback: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
          theme?: 'light' | 'dark'
        },
      ) => number
      reset: (widgetId?: number) => void
    }
    onRecaptchaLoaded?: () => void
  }
}

interface RecaptchaProps {
  value: string | null
  onChange: (token: string | null) => void
  error?: string
}

export function Recaptcha({ value, onChange, error }: RecaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<number | null>(null)
  const siteKey = (import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined)?.trim()

  const [isScriptLoaded, setIsScriptLoaded] = useState(() =>
    Boolean(typeof window !== 'undefined' && window.grecaptcha?.render),
  )

  // Real Google reCAPTCHA loader when VITE_RECAPTCHA_SITE_KEY is provided
  useEffect(() => {
    if (!siteKey || isScriptLoaded) return

    const scriptId = 'google-recaptcha-script'
    let script = document.getElementById(scriptId) as HTMLScriptElement | null

    window.onRecaptchaLoaded = () => {
      setIsScriptLoaded(true)
    }

    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoaded&render=explicit'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  }, [siteKey, isScriptLoaded])

  useEffect(() => {
    if (!siteKey || !isScriptLoaded || !containerRef.current || !window.grecaptcha?.render) return

    if (widgetIdRef.current === null && containerRef.current.innerHTML === '') {
      widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => onChange(token),
        'expired-callback': () => onChange(null),
        'error-callback': () => onChange(null),
      })
    }
  }, [siteKey, isScriptLoaded, onChange])

  // Fallback / Developer Simulation Widget (when no Google site key is configured)
  if (!siteKey) {
    const isChecked = Boolean(value)
    return (
      <div className="flex flex-col gap-1">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onChange(isChecked ? null : 'simulated-recaptcha-token')}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              onChange(isChecked ? null : 'simulated-recaptcha-token')
            }
          }}
          className={`flex w-full items-center justify-between rounded-lg border bg-surface p-3 transition-colors cursor-pointer select-none ${
            isChecked ? 'border-[var(--ok)]/50 bg-[var(--ok)]/5' : 'border-border hover:bg-surface/80'
          }`}
          aria-label="Verifikasi Saya bukan robot"
          aria-pressed={isChecked}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex size-6 items-center justify-center rounded-sm border transition-colors ${
                isChecked
                  ? 'border-[var(--ok)] bg-[var(--ok)] text-white'
                  : 'border-border bg-bg'
              }`}
            >
              {isChecked ? (
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : null}
            </div>
            <span className="text-dense font-medium text-fg">Saya bukan robot</span>
          </div>

          <div className="flex flex-col items-center gap-0.5 text-[10px] text-muted">
            <ShieldCheck size={20} className={isChecked ? 'text-[var(--ok)]' : 'text-muted'} />
            <span className="font-semibold tracking-wider uppercase">reCAPTCHA</span>
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-xs text-error">
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div ref={containerRef} className="min-h-[78px]" />
      {error ? (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
