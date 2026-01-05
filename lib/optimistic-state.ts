/**
 * Optimistic State Management
 * 
 * Provides a unified system for managing optimistic updates across all admin operations.
 * Ensures UI always renders the most recent local state until server confirms sync.
 * 
 * Architecture:
 * 1. User makes change → stored in localStorage (instant)
 * 2. UI renders: merged(server, pending) → pending takes precedence
 * 3. API call sent in background (doesn't block)
 * 4. API succeeds → server state updated
 * 5. Auto-sync: Compare server with pending → clear localStorage when matched
 * 6. If API fails → localStorage preserved, auto-retry
 */

/**
 * Generic helper to merge server state with pending local changes
 * Pending state takes precedence over server state
 * 
 * @param serverItems Array of server items (e.g., collections)
 * @param pendingChanges Object with item IDs as keys
 * @param getItemId Function to extract ID from server item
 * @returns Merged array where pending overrides server
 */
export function mergeWithPending<T extends Record<string, any>>(
  serverItems: T[],
  pendingChanges: Record<string, Partial<T>>,
  getItemId: (item: T) => string
): T[] {
  return serverItems.map(item => {
    const id = getItemId(item)
    const pending = pendingChanges[id]
    
    if (!pending) return item
    
    // Merge: pending overwrites server fields
    return { ...item, ...pending }
  })
}

/**
 * Check if a server item matches its pending state
 * Returns true if they're in sync (pending can be cleared)
 * 
 * @param serverItem The item from the server
 * @param pendingChange The pending change in localStorage
 * @param fieldsToCheck Array of field names to compare (if empty, compares all)
 * @returns true if server matches pending (or no pending exists)
 */
export function isInSync<T extends Record<string, any>>(
  serverItem: T,
  pendingChange: Partial<T> | undefined,
  fieldsToCheck?: (keyof T)[]
): boolean {
  if (!pendingChange) return true
  
  // Remove metadata fields from comparison
  const { _timestamp, ...cleanPending } = pendingChange as any
  
  // Determine which fields to check
  const fieldsToCompare = fieldsToCheck && fieldsToCheck.length > 0 
    ? fieldsToCheck 
    : (Object.keys(cleanPending) as (keyof T)[])
  
  // Check if all pending fields match server
  for (const field of fieldsToCompare) {
    if (serverItem[field] !== cleanPending[field]) {
      return false
    }
  }
  
  return true
}

/**
 * Check if multiple items are in sync with their pending states
 * 
 * @param serverItems Array of server items
 * @param pendingChanges Pending changes by ID
 * @param getItemId Function to extract ID
 * @returns Object with sync status and details
 */
export function getSyncStatus<T extends Record<string, any>>(
  serverItems: T[],
  pendingChanges: Record<string, Partial<T>>,
  getItemId: (item: T) => string,
  fieldsToCheck?: (keyof T)[]
): {
  isSynced: boolean
  totalPending: number
  syncedCount: number
  syncedIds: string[]
  unsynedIds: string[]
} {
  const syncedIds: string[] = []
  const unsyncedIds: string[] = []
  
  // Build map of server items by ID for O(1) lookup
  const serverMap = new Map<string, T>()
  serverItems.forEach(item => {
    serverMap.set(getItemId(item), item)
  })
  
  // Check each pending item
  for (const [id, pending] of Object.entries(pendingChanges)) {
    const serverItem = serverMap.get(id)
    
    if (!serverItem) {
      // Server doesn't have this item yet (might be newly created)
      unsyncedIds.push(id)
      continue
    }
    
    if (isInSync(serverItem, pending, fieldsToCheck)) {
      syncedIds.push(id)
    } else {
      unsyncedIds.push(id)
    }
  }
  
  return {
    isSynced: unsyncedIds.length === 0,
    totalPending: Object.keys(pendingChanges).length,
    syncedCount: syncedIds.length,
    syncedIds,
    unsynedIds: unsyncedIds
  }
}

/**
 * Clear synced items from pending state
 * 
 * @param pendingChanges Current pending changes
 * @param syncedIds IDs that have been synced
 * @returns New pending object with synced items removed
 */
export function clearSyncedPending<T extends Record<string, any>>(
  pendingChanges: Record<string, Partial<T>>,
  syncedIds: string[]
): Record<string, Partial<T>> {
  const syncedSet = new Set(syncedIds)
  const remaining: Record<string, Partial<T>> = {}
  
  for (const [id, change] of Object.entries(pendingChanges)) {
    if (!syncedSet.has(id)) {
      remaining[id] = change
    }
  }
  
  return remaining
}

/**
 * Auto-sync helper: Compare server with pending and clear localStorage
 * Returns true if anything was cleared
 * 
 * @param storageKey localStorage key for pending changes
 * @param backupKey localStorage backup key
 * @param serverItems Current server items
 * @param pendingChanges Current pending changes
 * @param getItemId Function to extract ID
 * @param fieldsToCheck Which fields to compare (empty = all)
 * @returns true if pending was cleared or updated
 */
export function autoSyncPending<T extends Record<string, any>>(
  storageKey: string,
  backupKey: string,
  serverItems: T[],
  pendingChanges: Record<string, Partial<T>>,
  getItemId: (item: T) => string,
  fieldsToCheck?: (keyof T)[]
): boolean {
  if (typeof window === 'undefined') return false
  if (Object.keys(pendingChanges).length === 0) return false
  
  try {
    const status = getSyncStatus(serverItems, pendingChanges, getItemId, fieldsToCheck)
    
    if (status.isSynced) {
      // Everything is synced, clear localStorage
      localStorage.removeItem(storageKey)
      localStorage.removeItem(backupKey)
      console.log(`[AutoSync] Cleared ${storageKey} - all pending synced`)
      return true
    }
    
    if (status.syncedCount > 0) {
      // Partial sync: clear only the synced items, keep unsynced
      const updated = clearSyncedPending(pendingChanges, status.syncedIds)
      localStorage.setItem(storageKey, JSON.stringify(updated))
      localStorage.setItem(backupKey, JSON.stringify({ t: Date.now(), data: updated }))
      console.log(`[AutoSync] Cleared ${status.syncedCount} synced items from ${storageKey}`)
      return true
    }
    
    // Nothing synced yet, keep localStorage as-is
    return false
  } catch (error) {
    console.error('[AutoSync] Error during auto-sync:', error)
    return false
  }
}

/**
 * Create a UI-safe comparison key for detecting changes
 * Useful for dependency arrays in useEffect
 * 
 * @param item The item to create a key for
 * @param pending The pending changes to include
 * @param fieldsToCheck Which fields to include in key
 * @returns A string that changes when any watched field changes
 */
export function createStateKey<T extends Record<string, any>>(
  item: T,
  pending: Partial<T> | undefined,
  fieldsToCheck: (keyof T)[]
): string {
  const values: any[] = []
  
  for (const field of fieldsToCheck) {
    const value = pending?.[field] ?? item[field]
    values.push(`${String(field)}:${JSON.stringify(value)}`)
  }
  
  return values.join('|')
}

/**
 * Logging helper for sync operations
 */
export function logSync(data: {
  tag: string
  action: 'merge' | 'check' | 'clear' | 'update' | 'error'
  domain: string
  itemId?: string
  isSynced?: boolean
  totalPending?: number
  syncedCount?: number
  error?: string
}): void {
  try {
    console.log(JSON.stringify({
      ...data,
      timestamp: Date.now()
    }))
  } catch (e) {
    console.error('Failed to log sync:', e)
  }
}
