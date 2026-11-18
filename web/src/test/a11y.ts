import axe from 'axe-core'

/**
 * axe on the current document. jsdom does not render colours, so `color-contrast` is off here;
 * token contrast is checked separately (src/styles/contrast.test.ts).
 */
export async function axeViolations() {
  const res = await axe.run(document.body, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    rules: { 'color-contrast': { enabled: false } },
  })
  return res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
}
