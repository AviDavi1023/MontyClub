/**
 * Generic in-memory cache manager for API routes
 * Prevents lost updates from concurrent requests and eventual consistency issues
 * with distributed storage systems like Supabase Storage
 */

export interface CacheMetrics {
  hits: number
  misses: number
  lastUpdate: number | null
  itemCount: number
}

export class ApiCache<T> {
  private cache: T | null = null
  private timestamp = 0
  private updateLock: Promise<any> = Promise.resolve()
  private hits = 0
  private misses = 0
  private readonly name: string

  constructor(name: string) {
    this.name = name
  }

  /**
   * Get cached data if it exists and is fresh enough
   * @param maxAgeMs Maximum age in milliseconds (default: 10 seconds)
   * @returns Cached data or null if not available/stale
   */
  get(maxAgeMs: number = 10000): T | null {
    if (this.cache === null) {
      this.misses++
      return null
    }

    const age = Date.now() - this.timestamp
    if (age >= maxAgeMs) {
      this.misses++
      return null
    }

    this.hits++
    return this.cache
  }

  /**
   * Check if cache exists (regardless of age)
   * @returns true if cache has been initialized
   */
  exists(): boolean {
    return this.cache !== null
  }

  /**
   * Get cache age in milliseconds
   * @returns Age in ms, or null if not initialized
   */
  getAge(): number | null {
    if (this.cache === null) return null
    return Date.now() - this.timestamp
  }

  /**
   * Set cache data and update timestamp
   * @param data Data to cache
   */
  set(data: T): void {
    this.cache = data
    this.timestamp = Date.now()
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache = null
    this.timestamp = 0
  }

  /**
   * Execute a function with exclusive lock
   * Prevents concurrent modifications from racing
   * @param fn Async function to execute with lock
   * @returns Result of the function
   */
  async withLock<R>(fn: () => Promise<R>): Promise<R> {
    // Create a new operation that waits for the previous one to complete
    const currentOperation = (async () => {
      await this.updateLock.catch(() => {})
      return fn()
    })()

    // Update lock to point to current operation BEFORE returning
    // This ensures the next request will wait for this one
    this.updateLock = currentOperation.catch(() => {})

    return currentOperation
  }

  /**
   * Get cache metrics for monitoring
   * @returns Cache statistics
   */
  getMetrics(): CacheMetrics {
    return {
      hits: this.hits,
      misses: this.misses,
      lastUpdate: this.cache !== null ? this.timestamp : null,
      itemCount: this.cache !== null ? 1 : 0
    }
  }

  /**
   * Reset metrics counters
   */
  resetMetrics(): void {
    this.hits = 0
    this.misses = 0
  }
}

/**
 * Create a new cache instance with type inference
 * @param name Cache identifier for logging
 * @returns New ApiCache instance
 */
export function createCache<T>(name: string): ApiCache<T> {
  return new ApiCache<T>(name)
}
