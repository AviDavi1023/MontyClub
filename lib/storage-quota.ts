/**
 * Safe localStorage operations with quota handling
 * Prevents silent data loss when quota is exceeded
 */

export interface StorageQuotaResult {
  success: boolean
  error?: string
  retried?: boolean
}

/**
 * Safely set item in localStorage, handling quota exceeded errors
 * @param key Storage key
 * @param value JSON-serializable value
 * @returns Result object with success status
 */
export function safeSetItem(key: string, value: any): StorageQuotaResult {
  try {
    const serialized = JSON.stringify(value)
    localStorage.setItem(key, serialized)
    return { success: true }
  } catch (error: any) {
    // Check for quota exceeded
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.error(`[Storage Quota] Exceeded for key: ${key}`)
      console.error(`[Storage Quota] Error:`, error.message)
      console.error(`[Storage Quota] Attempting cleanup...`)
      
      // Try to free up space by removing less critical items
      const cleaned = cleanupStorageQuota()
      
      if (cleaned > 0) {
        console.log(`[Storage Quota] Freed ${cleaned} bytes, retrying write...`)
        try {
          localStorage.setItem(key, serialized)
          return { success: true, retried: true }
        } catch (retryError: any) {
          console.error(`[Storage Quota] Retry failed:`, retryError.message)
          return {
            success: false,
            error: `Storage quota exceeded (even after cleanup). Data NOT saved.`,
            retried: true
          }
        }
      }
      
      return {
        success: false,
        error: `Storage quota exceeded. Could not free space. Data NOT saved.`
      }
    }
    
    // Other errors
    return {
      success: false,
      error: error.message || 'Unknown storage error'
    }
  }
}

/**
 * Safely get item from localStorage
 * @param key Storage key
 * @param fallback Value to return if key not found
 * @returns Stored value or fallback
 */
export function safeGetItem<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key)
    if (!item) return fallback
    return JSON.parse(item)
  } catch {
    return fallback
  }
}

/**
 * Get current storage usage
 * @returns Estimated bytes used (rough estimate)
 */
export function getStorageUsage(): number {
  let total = 0
  try {
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        const value = localStorage.getItem(key) || ''
        total += key.length + value.length
      }
    }
  } catch {}
  return total
}

/**
 * Estimate available storage
 * @returns Estimated bytes available (rough estimate, typically 5-10MB)
 */
export function getStorageAvailable(): number {
  // Typical browser localStorage limits
  // Most modern browsers: 5-10 MB
  // Estimate at 10 MB
  return 10 * 1024 * 1024
}

/**
 * Check if approaching quota limit
 * @param thresholdPercent Threshold percentage (default 80%)
 * @returns true if approaching limit
 */
export function isApproachingQuota(thresholdPercent: number = 80): boolean {
  const used = getStorageUsage()
  const available = getStorageAvailable()
  const percentUsed = (used / available) * 100
  return percentUsed >= thresholdPercent
}

/**
 * Clean up storage to free space
 * Removes less critical items to make room
 * @returns Bytes freed
 */
export function cleanupStorageQuota(): number {
  const itemsToClean = [
    // Analytics backup (least critical)
    'analytics:backup',
    // Announcements backup
    'montyclub:pendingAnnouncements:backup',
    // Updates backup
    'montyclub:pendingUpdateChanges:backup',
    // Collections backup
    'montyclub:pendingCollectionChanges:backup',
    // Registration backup
    'montyclub:pendingRegistrationChanges:backup',
  ]
  
  let freed = 0
  
  for (const key of itemsToClean) {
    try {
      const item = localStorage.getItem(key)
      if (item) {
        freed += item.length + key.length
        localStorage.removeItem(key)
        console.log(`[Storage Quota] Removed backup: ${key}`)
      }
    } catch (e) {
      // Ignore errors during cleanup
    }
  }
  
  return freed
}

/**
 * Get warning about storage status
 * @returns Warning message or null if OK
 */
export function getStorageWarning(): string | null {
  if (isApproachingQuota(90)) {
    return 'Browser storage is nearly full. Some changes may not be saved.'
  }
  if (isApproachingQuota(80)) {
    return 'Browser storage is getting full. Please clear old data if possible.'
  }
  return null
}
