// Cache utilities for clubs data
// Manages server-side in-memory caching and invalidation

interface CacheEntry {
  data: any
  timestamp: number
}

let clubsCache: CacheEntry | null = null
const CACHE_TTL = 300000 // 5 minutes (300000ms) - shorter since snapshot is source of truth

/**
 * Get cached clubs data if still valid
 * Returns null if cache is expired or doesn't exist
 */
export function getCachedClubs() {
  if (!clubsCache) {
    return null
  }

  const now = Date.now()
  const age = now - clubsCache.timestamp

  if (age > CACHE_TTL) {
    clubsCache = null
    return null
  }

  return {
    data: clubsCache.data,
    age: Math.floor(age / 1000) // Return age in seconds for header
  }
}

/**
 * Set clubs data in cache
 */
export function setClubsCache(data: any) {
  clubsCache = {
    data,
    timestamp: Date.now()
  }
}

/**
 * Invalidate clubs cache
 * Called when clubs data is updated (announcements, approvals, etc.)
 */
export function invalidateClubsCache() {
  clubsCache = null
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats() {
  return {
    cached: clubsCache !== null,
    timestamp: clubsCache?.timestamp,
    age: clubsCache ? Math.floor((Date.now() - clubsCache.timestamp) / 1000) : null
  }
}
