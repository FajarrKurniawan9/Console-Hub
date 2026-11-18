import { Tooltip as T } from 'radix-ui'
import type { ReactNode } from 'react'

export const TooltipProvider = T.Provider

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          sideOffset={4}
          className="z-50 max-w-md rounded-sm border bg-bg px-2 py-1 text-xs text-fg shadow-pop"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  )
}
