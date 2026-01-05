/**
 * useOptimisticState Hook
 * 
 * Manages optimistic updates with automatic localStorage persistence and sync detection.
 * Handles the full lifecycle: local change → localStorage → API call → auto-sync → cleanup
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  mergeWithPending, 
  getSyncStatus, 
  autoSyncPending, 
  logSync 
} from '@/lib/optimistic-state'

export interface UseOptimisticStateOptions<T> {
  // localStorage key for pending changes
  storageKey: string
  // localStorage key for backup (redundancy)
  backupKey: string
  // Function to extract ID from item
  getItemId: (item: T) => string
  // Which fields to compare for sync detection (empty = all)
  fieldsToCheck?: (keyof T)[]
  // Domain name for logging
  domain: string
  // Callback when sync status changes
  onSyncStatusChange?: (isSynced: boolean) => void
}

export interface OptimisticState<T> {
  // Server items
  serverItems: T[]
  // Pending changes from localStorage
  pendingChanges: Record<string, Partial<T>>
  // Merged items (what UI should render)
  displayItems: T[]
  // Whether all pending changes are synced
  isSynced: boolean
  // How many items have pending changes
  pendingCount: number
  // Update a pending change
  updatePending: (id: string, changes: Partial<T>) => void
  // Clear a specific pending item
  clearPending: (id: string) => void
  // Clear all pending
  clearAllPending: () => void
  // Load pending from localStorage
  loadPending: () => void
  // Trigger sync check
  triggerSyncCheck: () => void
  // Get current pending for a specific item
  getPending: (id: string) => Partial<T> | undefined
}

/**
 * Hook for managing optimistic state
 * 
 * Usage:
 * ```tsx
 * const optimistic = useOptimisticState({
 *   serverItems: collections,
 *   storageKey: 'montyclub:pendingCollections',
 *   backupKey: 'montyclub:pendingCollections:backup',
 *   getItemId: c => c.id,
 *   domain: 'collections',
 *   fieldsToCheck: ['enabled', 'accepting', 'display', 'renewalEnabled']
 * })
 * 
 * // Render using optimistic.displayItems
 * // Make changes with optimistic.updatePending()
 * // Check sync status with optimistic.isSynced
 * ```
 */
export function useOptimisticState<T extends Record<string, any>>(
  serverItems: T[],
  options: UseOptimisticStateOptions<T>
): OptimisticState<T> {
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<T>>>({})
  const [isSynced, setIsSynced] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const storageLoadedRef = useRef(false)
  const lastServerRef = useRef<T[]>(serverItems)

  // Load pending from localStorage on mount
  useEffect(() => {
    if (storageLoadedRef.current) return

    try {
      const primary = localStorage.getItem(options.storageKey)
      if (primary) {
        const parsed = JSON.parse(primary)
        setPendingChanges(parsed)
        logSync({
          tag: options.domain,
          action: 'update',
          domain: options.domain,
          totalPending: Object.keys(parsed).length
        })
      } else {
        const backup = localStorage.getItem(options.backupKey)
        if (backup) {
          const bp = JSON.parse(backup)
          if (bp?.data) setPendingChanges(bp.data)
        }
      }
    } catch (error) {
      console.error(`[OptimisticState] Failed to load ${options.domain}:`, error)
    } finally {
      storageLoadedRef.current = true
    }
  }, [options.domain, options.storageKey, options.backupKey])

  // Update pending in localStorage
  const updatePending = useCallback((id: string, changes: Partial<T>) => {
    setPendingChanges(prev => {
      const next = {
        ...prev,
        [id]: {
          ...(prev[id] || {}),
          ...changes,
          _timestamp: Date.now()
        }
      }

      try {
        localStorage.setItem(options.storageKey, JSON.stringify(next))
        localStorage.setItem(options.backupKey, JSON.stringify({ t: Date.now(), data: next }))
      } catch (error) {
        console.error(`[OptimisticState] Failed to save ${options.domain}:`, error)
      }

      logSync({
        tag: options.domain,
        action: 'update',
        domain: options.domain,
        itemId: id,
        totalPending: Object.keys(next).length
      })

      return next
    })
  }, [options.domain, options.storageKey, options.backupKey])

  // Clear specific pending item
  const clearPending = useCallback((id: string) => {
    setPendingChanges(prev => {
      const { [id]: _, ...rest } = prev
      try {
        if (Object.keys(rest).length === 0) {
          localStorage.removeItem(options.storageKey)
          localStorage.removeItem(options.backupKey)
        } else {
          localStorage.setItem(options.storageKey, JSON.stringify(rest))
          localStorage.setItem(options.backupKey, JSON.stringify({ t: Date.now(), data: rest }))
        }
      } catch (error) {
        console.error(`[OptimisticState] Failed to clear ${options.domain}:`, error)
      }
      return rest
    })
  }, [options.domain, options.storageKey, options.backupKey])

  // Clear all pending
  const clearAllPending = useCallback(() => {
    setPendingChanges({})
    try {
      localStorage.removeItem(options.storageKey)
      localStorage.removeItem(options.backupKey)
    } catch (error) {
      console.error(`[OptimisticState] Failed to clear all ${options.domain}:`, error)
    }
  }, [options.domain, options.storageKey, options.backupKey])

  // Reload pending from localStorage
  const loadPending = useCallback(() => {
    try {
      const primary = localStorage.getItem(options.storageKey)
      if (primary) {
        const parsed = JSON.parse(primary)
        setPendingChanges(parsed)
      }
    } catch (error) {
      console.error(`[OptimisticState] Failed to reload ${options.domain}:`, error)
    }
  }, [options.domain, options.storageKey])

  // Check sync status with server
  const triggerSyncCheck = useCallback(() => {
    if (Object.keys(pendingChanges).length === 0) {
      setIsSynced(true)
      return
    }

    const status = getSyncStatus(serverItems, pendingChanges, options.getItemId, options.fieldsToCheck)
    setIsSynced(status.isSynced)

    if (status.isSynced) {
      logSync({
        tag: options.domain,
        action: 'clear',
        domain: options.domain,
        totalPending: status.totalPending,
        syncedCount: status.syncedCount
      })
    }

    options.onSyncStatusChange?.(status.isSynced)
  }, [serverItems, pendingChanges, options])

  // Auto-sync when server changes
  useEffect(() => {
    if (Object.keys(pendingChanges).length === 0) return

    // Check if server items have actually changed
    const itemsChanged = lastServerRef.current !== serverItems

    triggerSyncCheck()

    lastServerRef.current = serverItems
  }, [serverItems, pendingChanges, triggerSyncCheck])

  // Auto-clear synced items from localStorage
  useEffect(() => {
    if (Object.keys(pendingChanges).length === 0) return

    const wasCleared = autoSyncPending(
      options.storageKey,
      options.backupKey,
      serverItems,
      pendingChanges,
      options.getItemId,
      options.fieldsToCheck
    )

    if (wasCleared) {
      // Reload pending from localStorage (might be partially cleared)
      loadPending()
    }
  }, [serverItems, pendingChanges, options, loadPending])

  // Merge server items with pending changes
  const displayItems = mergeWithPending(serverItems, pendingChanges, options.getItemId)

  // Update pending count
  useEffect(() => {
    setPendingCount(Object.keys(pendingChanges).length)
  }, [pendingChanges])

  // Get pending for specific item
  const getPending = useCallback((id: string) => {
    return pendingChanges[id]
  }, [pendingChanges])

  return {
    serverItems,
    pendingChanges,
    displayItems,
    isSynced,
    pendingCount,
    updatePending,
    clearPending,
    clearAllPending,
    loadPending,
    triggerSyncCheck,
    getPending
  }
}
