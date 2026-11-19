import { useEffect, useState } from 'react'

/**
 * Gives focus back to what had it when the dialog opened, also when the dialog
 * unmounts instead of closing (`{open ? <Form/> : null}`).
 */
export function useReturnFocus() {
  const [returnTo] = useState(() => document.activeElement as HTMLElement | null)
  useEffect(
    () => () => {
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
