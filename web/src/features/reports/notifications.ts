import { useEffect, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AuthUser, ReportExport } from '../../lib/api/schemas'

const STORAGE_PREFIX = 'ch.exports_seen_at.'
const AUTH_ME_KEY = ['auth', 'me'] as const

type Store = {
  scopeKey: string | null
  seeded: boolean
  knownStatuses: Map<number, ReportExport['status']>
  unreadReadyIds: Set<number>
  openModals: number
}

const store: Store = {
  scopeKey: null,
  seeded: false,
  knownStatuses: new Map(),
  unreadReadyIds: new Set(),
  openModals: 0,
}

const listeners = new Set<() => void>()
let snapshotUnreadCount = 0

function emit() {
  const nextCount = store.unreadReadyIds.size
  if (nextCount !== snapshotUnreadCount) {
    snapshotUnreadCount = nextCount
    for (const listener of listeners) listener()
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return snapshotUnreadCount
}

function readSeenAt(scopeKey: string): number | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${scopeKey}`)
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeSeenAt(scopeKey: string, ms: number) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${scopeKey}`, String(ms))
  } catch {
    // Ignore storage errors (private browsing/quota).
  }
}

function ensureScope(scopeKey: string) {
  if (store.scopeKey !== scopeKey) {
    store.scopeKey = scopeKey
    store.seeded = false
    store.knownStatuses.clear()
    store.unreadReadyIds.clear()
    emit()
  }
}

export function resetExportNotifications() {
  store.scopeKey = null
  store.seeded = false
  store.knownStatuses.clear()
  store.unreadReadyIds.clear()
  store.openModals = 0
  emit()
}

export function markExportsSeen(scopeKey: string, items: ReportExport[] | undefined) {
  ensureScope(scopeKey)
  let maxCompletedMs = Date.now()
  if (items) {
    for (const item of items) {
      if (item.is_mine === false) continue
      store.knownStatuses.set(item.id, item.status)
      if (item.status === 'completed' && item.completed_at) {
        const ms = Date.parse(item.completed_at)
        if (!Number.isNaN(ms) && ms > maxCompletedMs) {
          maxCompletedMs = ms
        }
      }
    }
  }
  store.unreadReadyIds.clear()
  writeSeenAt(scopeKey, maxCompletedMs)
  emit()
}

function syncExportSnapshot(scopeKey: string, items: ReportExport[]) {
  ensureScope(scopeKey)
  const storedSeenAt = readSeenAt(scopeKey)
  const mine = items.filter((e) => e.is_mine !== false)

  if (!store.seeded) {
    store.seeded = true
    for (const item of mine) {
      store.knownStatuses.set(item.id, item.status)
      if (item.status === 'completed' && storedSeenAt !== null && item.completed_at) {
        const ms = Date.parse(item.completed_at)
        if (!Number.isNaN(ms) && ms > storedSeenAt) {
          store.unreadReadyIds.add(item.id)
        }
      }
    }
    if (storedSeenAt === null) {
      writeSeenAt(scopeKey, Date.now())
    }
    if (store.openModals > 0 && store.unreadReadyIds.size > 0) {
      markExportsSeen(scopeKey, items)
    } else {
      emit()
    }
    return
  }

  let latestSeenCutoff = storedSeenAt ?? 0
  for (const item of mine) {
    const prev = store.knownStatuses.get(item.id)
    store.knownStatuses.set(item.id, item.status)

    const completedMs = item.completed_at ? Date.parse(item.completed_at) : 0
    const isNewlyCompleted =
      item.status === 'completed' &&
      ((prev !== undefined && prev !== 'completed') ||
        (prev === undefined && !Number.isNaN(completedMs) && completedMs > latestSeenCutoff))

    if (isNewlyCompleted) {
      toast.success(`${item.name} selesai diproses dan siap diunduh!`)
      if (store.openModals === 0) {
        store.unreadReadyIds.add(item.id)
      } else {
        if (!Number.isNaN(completedMs) && completedMs > latestSeenCutoff) {
          latestSeenCutoff = completedMs
        }
        writeSeenAt(scopeKey, Math.max(Date.now(), latestSeenCutoff))
      }
    } else if (
      prev !== undefined &&
      prev !== 'failed' &&
      prev !== 'cancelled' &&
      item.status === 'failed'
    ) {
      toast.error(
        item.error_message
          ? `${item.name} gagal diproses: ${item.error_message}`
          : `${item.name} gagal diproses.`,
      )
    }
  }

  emit()
}

function useNotificationScopeKey(): string {
  const qc = useQueryClient()
  const me = qc.getQueryData<AuthUser>(AUTH_ME_KEY)
  return me?.id != null ? String(me.id) : 'anon'
}

/**
 * Tracks newly completed exports across all pages, firing a single toast notification
 * and exposing the unread ready count for the green indicator dot.
 */
export function useExportNotifications(items: ReportExport[] | undefined, enabled = true) {
  const scopeKey = useNotificationScopeKey()
  const unreadReadyCount = useSyncExternalStore(subscribe, getSnapshot)

  useEffect(() => {
    if (!enabled || !items) return
    syncExportSnapshot(scopeKey, items)
  }, [enabled, items, scopeKey])

  return { unreadReadyCount }
}

/** Marks ready downloads as seen whenever the waiting list modal is opened. */
export function useRegisterExportModalOpen(open: boolean, items: ReportExport[] | undefined) {
  const scopeKey = useNotificationScopeKey()

  useEffect(() => {
    if (!open) return
    store.openModals += 1
    return () => {
      store.openModals = Math.max(0, store.openModals - 1)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    markExportsSeen(scopeKey, items)
  }, [open, scopeKey, items])
}
