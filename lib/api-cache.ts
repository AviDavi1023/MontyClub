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
  private updateLock: Promise<void> = Promise.resolve()
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
      try {
        console.log(JSON.stringify({ 
          tag: 'api-cache', 
          cache: this.name, 
          action: 'get', 
          result: 'miss', 
          reason: 'not-initialized' 
        }))
      } catch {}
      return null
    }

    const age = Date.now() - this.timestamp
    if (age >= maxAgeMs) {
      this.misses++
      try {
        console.log(JSON.stringify({ 
          tag: 'api-cache', 
          cache: this.name, 
          action: 'get', 
          result: 'miss', 
          reason: 'stale',
          age 
        }))
      } catch {}
      return null
    }

    this.hits++
    try {
      console.log(JSON.stringify({ 
        tag: 'api-cache', 
        cache: this.name, 
        action: 'get', 
        result: 'hit',
        age 
      }))
    } catch {}
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
    try {
      console.log(JSON.stringify({ 
        tag: 'api-cache', 
        cache: this.name, 
        action: 'set',
        timestamp: this.timestamp 
      }))
    } catch {}
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache = null
    this.timestamp = 0
    try {
      console.log(JSON.stringify({ 
        tag: 'api-cache', 
        cache: this.name, 
        action: 'clear' 
      }))
    } catch {}
  }

  /**
   * Execute a function with exclusive lock
   * Prevents concurrent modifications from racing
   * @param fn Async function to execute with lock
   * @returns Result of the function
   */
  async withLock<R>(fn: () => Promise<R>): Promise<R> {
    const operationId = `${this.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    
    try {
      console.log(JSON.stringify({ 
        tag: 'api-cache', 
        cache: this.name, 
        action: 'lock-wait',
        operationId 
      }))
    } catch {}

    const currentOperation = this.updateLock.then(async () => {
      try {
        console.log(JSON.stringify({ 
          tag: 'api-cache', 
          cache: this.name, 
          action: 'lock-acquired',
          operationId 
        }))
      } catch {}

      try {
        const result = await fn()
        return result
      } finally {
        try {
          console.log(JSON.stringify({ 
            tag: 'api-cache', 
            cache: this.name, 
            action: 'lock-released',
            operationId 
          }))
        } catch {}
      }
    })

    // Update lock to point to current operation
    this.updateLock = currentOperation.then(() => {}).catch(() => {})

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
