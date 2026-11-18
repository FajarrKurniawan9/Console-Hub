import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// WCAG 2 contrast for the token pairs actually used for text, in both themes.
// Vitest runs from web/.
const css = readFileSync(`${process.cwd()}/src/styles/tokens.css`, 'utf8')

function tokens(block: string) {
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
  )
}
const light = tokens(css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {'))))
const darkStart = css.indexOf(":root[data-theme='dark']")
const dark = tokens(css.slice(darkStart, css.indexOf('}', darkStart)))

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x! + 0.05) / (y! + 0.05)
}

const TEXT = ['text', 'text-muted', 'accent', 'ok', 'warn', 'error']
const BG = ['bg', 'surface']

describe('token contrast (AA, 4.5:1 for text)', () => {
  for (const [name, t] of [
    ['terang', light],
    ['gelap', dark],
  ] as const)
    for (const fg of TEXT)
      for (const bg of BG)
        it(`${name}: ${fg} on ${bg}`, () => {
          expect(ratio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5)
        })

  for (const [name, t] of [
    ['terang', light],
    ['gelap', dark],
  ] as const)
    it(`${name}: on-accent on accent (primary button)`, () => {
      expect(ratio(t['on-accent']!, t.accent!)).toBeGreaterThanOrEqual(4.5)
    })
})
