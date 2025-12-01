/**
 * Reusable React hooks for managing localStorage-backed pending changes
 * Provides optimistic updates with automatic sync and revert on error
 */

import { useState, useEffect, useRef } from 'react'

/**
 * Generic pending change structure
 */
export type PendingChanges<T> = Record<string, T>

/**
 * Configuration for usePendingChanges hook
 */
export interface UsePendingChangesConfig {
  /** Primary localStorage key */
  primaryKey: string
  /** Backup localStorage key (with timestamp) */
  backupKey: string
  /** Tag for console logging */
  logTag?: string
  /** Enable verbose logging */
  debug?: boolean
}

/**
 * Hook for managing localStorage-backed pending changes with auto-persistence
 * 
 * @param config Configuration object
 * @returns Pending changes state and setter
 * 
 * @example
 * const [pending, setPending, loaded] = usePendingChanges({
 *   primaryKey: 'myapp:pending',
 *   backupKey: 'myapp:pending:backup',
 *   logTag: 'my-feature'
 * })
 */
export function usePendingChanges<T>(
  config: UsePendingChangesConfig
): [PendingChanges<T>, React.Dispatch<React.SetStateAction<PendingChanges<T>>>, boolean] {
  const { primaryKey, backupKey, logTag = 'pending', debug = false } = config
  
  const [pendingChanges, setPendingChanges] = useState<PendingChanges<T>>({})
  const [loaded, setLoaded] = useState(false)

  const log = (step: string, data?: any) => {
    if (!debug) return
    try {
      console.log(JSON.stringify({ tag: logTag, step, ...data }))
    } catch {}
  }

  // Load from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      
      const primary = localStorage.getItem(primaryKey)
      if (primary) {
        const parsed = JSON.parse(primary)
        if (parsed && typeof parsed === 'object') {
          setPendingChanges(parsed)
          log('loaded-primary', { count: Object.keys(parsed).length })
        }
      } else {
        // Fallback to backup
        const backup = localStorage.getItem(backupKey)
        if (backup) {
          try {
            const bp = JSON.parse(backup)
            if (bp && bp.data) {
              setPendingChanges(bp.data)
              log('loaded-backup', { count: Object.keys(bp.data).length })
            }
          } catch (e) {
            log('backup-parse-fail', { error: String(e) })
          }
        } else {
          log('no-storage')
        }
      }
    } catch (e) {
      log('load-fail', { error: String(e) })
    } finally {
      setLoaded(true)
    }
  }, [primaryKey, backupKey])

  // Persist to localStorage whenever changes occur
  useEffect(() => {
    if (!loaded) return

    try {
      if (Object.keys(pendingChanges).length === 0) {
        localStorage.removeItem(primaryKey)
        localStorage.removeItem(backupKey)
        log('cleared')
      } else {
        const serialized = JSON.stringify(pendingChanges)
        localStorage.setItem(primaryKey, serialized)
        localStorage.setItem(backupKey, JSON.stringify({ t: Date.now(), data: pendingChanges }))
        log('persisted', { count: Object.keys(pendingChanges).length })
      }
    } catch (e) {
      log('persist-fail', { error: String(e) })
    }
  }, [pendingChanges, loaded, primaryKey, backupKey])

  return [pendingChanges, setPendingChanges, loaded]
}

/**
 * Configuration for useAutoClearPending hook
 */
export interface AutoClearConfig<T, U> {
  /** Server data array */
  serverData: T[]
  /** Pending changes object */
  pendingChanges: PendingChanges<U>
  /** Whether localStorage has loaded */
  storageLoaded: boolean
  /** Function to extract ID from server item */
  getId: (item: T) => string
  /** Function to check if pending change matches server state */
  matches: (serverItem: T, pendingChange: U) => boolean
  /** Tag for console logging */
  logTag?: string
  /** Enable verbose logging */
  debug?: boolean
}

/**
 * Hook that automatically clears pending changes when they match server state
 * 
 * @param config Configuration object
 * @returns Function to update pending changes
 * 
 * @example
 * const clearPending = useAutoClearPending({
 *   serverData: items,
 *   pendingChanges,
 *   storageLoaded,
 *   getId: (item) => item.id,
 *   matches: (server, pending) => server.status === pending.status,
 *   logTag: 'my-feature'
 * })
 */
export function useAutoClearPending<T, U>(
  config: AutoClearConfig<T, U>
): (updater: (prev: PendingChanges<U>) => PendingChanges<U>) => void {
  const {
    serverData,
    pendingChanges,
    storageLoaded,
    getId,
    matches,
    logTag = 'autoclear',
    debug = false
  } = config

  const [, setPendingChanges] = useState<PendingChanges<U>>({})
  
  const log = (step: string, data?: any) => {
    if (!debug) return
    try {
      console.log(JSON.stringify({ tag: logTag, step, ...data }))
    } catch {}
  }

  useEffect(() => {
    if (!storageLoaded) {
      log('skip-not-loaded')
      return
    }
    if (Object.keys(pendingChanges).length === 0) return

    const stillPending = { ...pendingChanges }
    let hasCleared = false

    Object.keys(stillPending).forEach(id => {
      const pending = stillPending[id]
      const serverItem = serverData.find(item => getId(item) === id)

      // If deleted locally but not in server, keep pending
      if ((pending as any).deleted && !serverItem) {
        delete stillPending[id]
        hasCleared = true
        log('cleared-deleted', { id })
        return
      }

      // If matches server state, clear it
      if (serverItem && matches(serverItem, pending)) {
        delete stillPending[id]
        hasCleared = true
        log('cleared-match', { id })
      } else if (serverItem) {
        log('still-pending', { id })
      }
    })

    if (hasCleared) {
      setPendingChanges(stillPending)
      log('updated', { remaining: Object.keys(stillPending).length })
    } else {
      log('no-change')
    }
  }, [serverData, pendingChanges, storageLoaded])

  return setPendingChanges
}

/**
 * Helper to persist pending changes to localStorage
 * @param primaryKey Primary storage key
 * @param backupKey Backup storage key
 * @param changes Pending changes to persist
 */
export function persistPendingChanges<T>(
  primaryKey: string,
  backupKey: string,
  changes: PendingChanges<T>
): void {
  try {
    if (Object.keys(changes).length === 0) {
      localStorage.removeItem(primaryKey)
      localStorage.removeItem(backupKey)
    } else {
      localStorage.setItem(primaryKey, JSON.stringify(changes))
      localStorage.setItem(backupKey, JSON.stringify({ t: Date.now(), data: changes }))
    }
  } catch (e) {
    console.error('Failed to persist pending changes:', e)
  }
}

/**
 * Helper to load pending changes from localStorage
 * @param primaryKey Primary storage key
 * @param backupKey Backup storage key
 * @returns Pending changes or empty object
 */
export function loadPendingChanges<T>(
  primaryKey: string,
  backupKey: string
): PendingChanges<T> {
  try {
    const primary = localStorage.getItem(primaryKey)
    if (primary) {
      const parsed = JSON.parse(primary)
      if (parsed && typeof parsed === 'object') {
        return parsed
      }
    }
    
    const backup = localStorage.getItem(backupKey)
    if (backup) {
      const bp = JSON.parse(backup)
      if (bp && bp.data) {
        return bp.data
      }
    }
  } catch (e) {
    console.error('Failed to load pending changes:', e)
  }
  
  return {}
}

/**
 * Create optimistic update helper
 * @param setPending Pending changes setter
 * @param primaryKey Primary storage key
 * @param backupKey Backup storage key
 * @returns Helper functions for optimistic updates
 */
export function createOptimisticHelper<T>(
  setPending: React.Dispatch<React.SetStateAction<PendingChanges<T>>>,
  primaryKey: string,
  backupKey: string
) {
  return {
    /**
     * Apply an optimistic update
     * @param id Item ID
     * @param change Partial change to apply
     */
    apply: (id: string, change: Partial<T>) => {
      setPending(prev => {
        const next = {
          ...prev,
          [id]: { ...(prev[id] as any || {}), ...change } as T
        }
        persistPendingChanges(primaryKey, backupKey, next)
        return next
      })
    },

    /**
     * Revert an optimistic update on error
     * @param id Item ID
     */
    revert: (id: string) => {
      setPending(prev => {
        const next = { ...prev }
        delete next[id]
        persistPendingChanges(primaryKey, backupKey, next)
        return next
      })
    },

    /**
     * Clear all pending changes
     */
    clearAll: () => {
      setPending({})
      localStorage.removeItem(primaryKey)
      localStorage.removeItem(backupKey)
    }
  }
}
