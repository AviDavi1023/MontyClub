/**
 * Safe localStorage utilities with atomic operations and quota management
 * Prevents race conditions and quota overflow issues
 */

const STORAGE_QUOTA_WARN_MB = 4 // Warn when approaching 5MB limit
const STORAGE_QUOTA_BYTES = STORAGE_QUOTA_WARN_MB * 1024 * 1024

/**
 * Estimate localStorage usage in bytes
 */
export function getStorageUsage(): number {
  if (typeof window === 'undefined') return 0
  try {
    let total = 0
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        total += localStorage[key].length + key.length
      }
    }
    return total
  } catch {
    return 0
  }
}

/**
 * Check if we're approaching quota limit
 */
export function isApproachingQuotaLimit(): boolean {
  return getStorageUsage() > STORAGE_QUOTA_BYTES
}

/**
 * Safely parse JSON from localStorage with fallback
 */
export function safeGetJSON<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    if (value === null) return fallback
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

/**
 * Safely set JSON to localStorage with quota checking
 * Uses a lock-based approach to prevent concurrent writes
 * Tracks failures for automatic retry
 */
const storageWriteLock = new Map<string, Promise<boolean>>()
const failedWrites = new Map<string, { value: any; timestamp: number; retryCount: number }>()

export async function safeSetJSON<T>(key: string, value: T): Promise<boolean> {
  // Create lock entry if it doesn't exist
  if (!storageWriteLock.has(key)) {
    storageWriteLock.set(key, Promise.resolve(true))
  }

  // Chain operation through lock
  const previousOp = storageWriteLock.get(key)!
  
  const newOp = (async () => {
    await previousOp.catch(() => false) // Wait for previous to complete
    
    try {
      // Check quota before writing
      if (isApproachingQuotaLimit()) {
        console.warn(`[safeSetJSON] Approaching localStorage limit (${getStorageUsage()} / ${STORAGE_QUOTA_BYTES} bytes)`)
        // Don't prevent write, but log warning
      }

      const jsonString = JSON.stringify(value)
      
      // Test write to detect quota exceeded before actual write
      const testKey = `__test_write_${Date.now()}`
      try {
        localStorage.setItem(testKey, 'test')
        localStorage.removeItem(testKey)
      } catch (e: any) {
        if (e.name === 'QuotaExceededError') {
          console.error('[safeSetJSON] localStorage quota exceeded')
          // Track for retry after cleanup
          failedWrites.set(key, { value, timestamp: Date.now(), retryCount: 0 })
          return false
        }
      }

      // Perform actual write
      localStorage.setItem(key, jsonString)
      // Success - remove from failed writes if it was there
      failedWrites.delete(key)
      return true
    } catch (error: any) {
      console.error(`[safeSetJSON] Error writing to ${key}:`, error)
      if (error.name === 'QuotaExceededError') {
        console.error('[safeSetJSON] localStorage quota exceeded')
      }
      // Track for retry
      failedWrites.set(key, { value, timestamp: Date.now(), retryCount: 0 })
      return false
    }
  })()

  storageWriteLock.set(key, newOp)

  return await newOp
}

/**
 * Get failed writes that need retry
 */
export function getFailedWrites(): Array<{ key: string; value: any; timestamp: number; retryCount: number }> {
  return Array.from(failedWrites.entries()).map(([key, data]) => ({ key, ...data }))
}

/**
 * Retry failed localStorage writes
 * Returns number of successful retries
 */
export async function retryFailedWrites(): Promise<number> {
  let successCount = 0
  const toRetry = Array.from(failedWrites.entries())
  
  for (const [key, data] of toRetry) {
    if (data.retryCount >= 5) {
      console.warn(`[retryFailedWrites] Giving up on ${key} after 5 retries`)
      failedWrites.delete(key)
      continue
    }
    
    const success = await safeSetJSON(key, data.value)
    if (success) {
      successCount++
      failedWrites.delete(key)
      console.log(`[retryFailedWrites] ✅ Successfully retried ${key}`)
    } else {
      // Increment retry count
      data.retryCount++
      failedWrites.set(key, data)
      console.warn(`[retryFailedWrites] ❌ Retry ${data.retryCount} failed for ${key}`)
    }
  }
  
  return successCount
}

/**
 * Update localStorage object atomically (read-modify-write pattern)
 * Prevents race conditions where concurrent updates lose data
 */
export async function updateStorageObject<T extends Record<string, any>>(
  key: string,
  updates: Partial<T> | ((current: T) => Partial<T>),
  fallback: T
): Promise<boolean> {
  // Acquire lock for this key
  if (!storageWriteLock.has(key)) {
    storageWriteLock.set(key, Promise.resolve(true))
  }

  const previousOp = storageWriteLock.get(key)!
  
  const newOp = (async () => {
    await previousOp.catch(() => false) // Wait for previous operation

    try {
      // Read current state
      const current = safeGetJSON<T>(key, fallback)
      
      // Apply updates
      const updateObj = typeof updates === 'function' ? updates(current) : updates
      const updated = { ...current, ...updateObj }

      // Write atomically
      return await safeSetJSON(key, updated)
    } catch (error) {
      console.error(`[updateStorageObject] Error updating ${key}:`, error)
      return false
    }
  })()

  storageWriteLock.set(key, newOp)
  return await newOp
}

/**
 * Clear localStorage keys matching a prefix
 * Useful for cleaning up on logout or data wipe
 */
export function clearStorageByPrefix(prefix: string): number {
  let cleared = 0
  try {
    const keys = Object.keys(localStorage)
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key)
        cleared++
      }
    }
  } catch (error) {
    console.error('[clearStorageByPrefix] Error:', error)
  }
  return cleared
}

/**
 * Get all storage keys matching a prefix (for diagnostics)
 */
export function getStorageKeys(prefix?: string): string[] {
  try {
    return Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix))
  } catch {
    return []
  }
}

/**
 * Safely migrate data from old key to new key
 */
export function migrateStorageKey(oldKey: string, newKey: string): boolean {
  try {
    const value = localStorage.getItem(oldKey)
    if (value === null) return true // Nothing to migrate

    localStorage.setItem(newKey, value)
    localStorage.removeItem(oldKey)
    console.log(`[migrateStorageKey] Migrated ${oldKey} → ${newKey}`)
    return true
  } catch (error) {
    console.error(`[migrateStorageKey] Error:`, error)
    return false
  }
}
