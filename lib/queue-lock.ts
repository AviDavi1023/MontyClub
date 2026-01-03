/**
 * Proper queue-based locking mechanism to replace promise chaining
 * Prevents lock starvation, properly propagates errors, and handles timeouts
 */

interface QueuedOperation<R> {
  id: string
  fn: () => Promise<R>
  resolve: (result: R) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout> | null
}

export class QueueLock {
  private queue: QueuedOperation<any>[] = []
  private processing = false
  private readonly name: string
  private readonly defaultTimeoutMs: number

  constructor(name: string, defaultTimeoutMs: number = 30000) {
    this.name = name
    this.defaultTimeoutMs = defaultTimeoutMs
  }

  /**
   * Execute a function with exclusive lock
   * @param id Unique operation ID for logging
   * @param fn Function to execute with lock
   * @param timeoutMs Operation timeout (default 30s)
   * @returns Result of the function
   */
  async withLock<R>(
    id: string,
    fn: () => Promise<R>,
    timeoutMs: number = this.defaultTimeoutMs
  ): Promise<R> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`[${this.name}] Operation ${id} exceeded timeout (${timeoutMs}ms)`))
      }, timeoutMs)

      const operation: QueuedOperation<R> = {
        id,
        fn,
        resolve,
        reject,
        timeout,
      }

      this.queue.push(operation)
      console.log(`[${this.name}] ${id} queued (queue size: ${this.queue.length})`)

      // Start processing if not already
      this.processQueue()
    })
  }

  /**
   * Process queued operations one at a time
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return

    this.processing = true

    while (this.queue.length > 0) {
      const operation = this.queue.shift()!

      console.log(`[${this.name}] ${operation.id} acquired lock (remaining: ${this.queue.length})`)

      try {
        const result = await operation.fn()
        if (operation.timeout) clearTimeout(operation.timeout)
        operation.resolve(result)
        console.log(`[${this.name}] ${operation.id} completed successfully`)
      } catch (error) {
        if (operation.timeout) clearTimeout(operation.timeout)
        const err = error instanceof Error ? error : new Error(String(error))
        operation.reject(err)
        console.error(`[${this.name}] ${operation.id} failed:`, err.message)
      }
    }

    this.processing = false
  }

  /**
   * Get queue stats for debugging
   */
  getStats(): { pending: number; processing: boolean } {
    return {
      pending: this.queue.length,
      processing: this.processing,
    }
  }

  /**
   * Clear queue (for emergency/testing)
   */
  clear(): void {
    for (const op of this.queue) {
      if (op.timeout) clearTimeout(op.timeout)
      op.reject(new Error(`[${this.name}] Queue cleared`))
    }
    this.queue = []
  }
}

/**
 * Create a singleton queue lock for a domain
 */
const locks = new Map<string, QueueLock>()

export function getQueueLock(domain: string, timeoutMs?: number): QueueLock {
  if (!locks.has(domain)) {
    locks.set(domain, new QueueLock(domain, timeoutMs))
  }
  return locks.get(domain)!
}
