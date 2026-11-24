import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react'

interface OtpInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  error?: boolean
  autoFocus?: boolean
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = true,
}: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  // Ensure digits array matches length
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  useEffect(() => {
    if (autoFocus && inputsRef.current[0]) {
      inputsRef.current[0].focus()
    }
  }, [autoFocus])

  const focusInput = (index: number) => {
    const el = inputsRef.current[index]
    if (el) {
      el.focus()
      el.select()
    }
  }

  const handleChange = (index: number, char: string) => {
    if (disabled) return
    const cleaned = char.replace(/\D/g, '')
    if (!cleaned) return

    const lastChar = cleaned.slice(-1)
    const newDigits = [...digits]
    newDigits[index] = lastChar

    const newValue = newDigits.join('').slice(0, length)
    onChange(newValue)

    if (index < length - 1) {
      focusInput(index + 1)
    }

    if (newValue.length === length && onComplete) {
      onComplete(newValue)
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (e.key === 'Backspace') {
      e.preventDefault()
      const newDigits = [...digits]

      if (newDigits[index]) {
        newDigits[index] = ''
        onChange(newDigits.join(''))
      } else if (index > 0) {
        newDigits[index - 1] = ''
        onChange(newDigits.join(''))
        focusInput(index - 1)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      focusInput(index - 1)
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault()
      focusInput(index + 1)
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (disabled) return

    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return

    onChange(pasted)
    const targetIdx = Math.min(pasted.length, length - 1)
    focusInput(targetIdx)

    if (pasted.length === length && onComplete) {
      onComplete(pasted)
    }
  }

  return (
    <div className="grid grid-cols-6 gap-2 w-full" role="group" aria-label="Input kode OTP 6 digit">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete="one-time-code"
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          aria-label={`Digit ke-${i + 1}`}
          aria-invalid={error ? true : undefined}
          className={`h-12 w-full text-center font-mono text-xl font-bold rounded-lg border bg-bg transition-colors duration-150 outline-hidden ${
            error
              ? 'border-error text-error focus:ring-1 focus:ring-error'
              : digit
                ? 'border-accent text-fg'
                : 'border-border text-fg hover:border-border/80 focus:border-accent focus:ring-1 focus:ring-accent'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      ))}
    </div>
  )
}
