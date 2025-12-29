/**
 * Request deduplication layer for preventing duplicate concurrent API calls
 * Maps request signatures to in-flight promises, collapsing concurrent requests
 */

interface PendingRequest<T> {
  promise: Promise<T>
  timestamp: number
  expiresAt: number
}

class RequestDeduplicator {
  private pending = new Map<string, PendingRequest<any>>()
  private readonly defaultTTL = 5000 // 5 second TTL for in-flight requests

  /**
   * Execute or return cached promise for a request
   * @param key Unique identifier for this request
   * @param executor Function that returns a Promise
   * @param ttl Time-to-live in milliseconds (default 5s)
   */
  async dedupe<T>(
    key: string,
    executor: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    const now = Date.now()
    const pending = this.pending.get(key)

    // If request is still in flight and not expired, return existing promise
    if (pending && pending.expiresAt > now) {
      return pending.promise
    }

    // Clean up expired request
    if (pending && pending.expiresAt <= now) {
      this.pending.delete(key)
    }

    // Create new request
    const promise = executor()
    const expiresAt = now + ttl

    this.pending.set(key, { promise, timestamp: now, expiresAt })

    // Clean up after request completes (success or error)
    promise
      .then(() => {
        // Keep successful responses in pending map for TTL duration
        // This handles rapid successive calls
      })
      .catch(() => {
        // Remove failed requests immediately to allow retry
        this.pending.delete(key)
      })

    return promise
  }

  /**
   * Manually invalidate a cached request
   */
  invalidate(key: string): void {
    this.pending.delete(key)
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.pending.clear()
  }

  /**
   * Get stats for debugging
   */
  getStats(): { pendingCount: number; keys: string[] } {
    const now = Date.now()
    const active = Array.from(this.pending.entries()).filter(
      ([, req]) => req.expiresAt > now
    )
    return {
      pendingCount: active.length,
      keys: active.map(([key]) => key),
    }
  }
}

export const deduplicator = new RequestDeduplicator()
