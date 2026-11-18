import { useEffect, useState } from 'react'

/**
 * Gives focus back to what had it when the dialog was opened.
 * The element is captured on first render, before `autoFocus` inside the dialog moves focus,
 * and restored on close or on unmount (`{open ? <Form/> : null}` never calls onCloseAutoFocus).
 */
export function useReturnFocus() {
  const [returnTo] = useState(() => document.activeElement as HTMLElement | null)
  useEffect(
    () => () => {
      // After the portal is gone, so Radix's focus scope cannot take it back.
      if (returnTo?.isConnected) setTimeout(() => returnTo.focus(), 0)
    },
    [returnTo],
  )
  return {
    onCloseAutoFocus: (e: Event) => {
      if (returnTo?.isConnected) {
        e.preventDefault()
        returnTo.focus()
      }
    },
  }
}
