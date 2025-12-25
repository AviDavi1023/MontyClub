/**
 * Debounce and throttle utilities for preventing duplicate requests
 * and ensuring smooth user interactions
 */

/**
 * Debounce function - delays execution until calls stop
 * Useful for search inputs, resize handlers, button clicks
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null

  return function (...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      func(...args)
      timeoutId = null
    }, delayMs)
  }
}

/**
 * Throttle function - limits execution frequency
 * Useful for scroll events, mousemove handlers
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let lastRunTime = 0
  let timeoutId: NodeJS.Timeout | null = null

  return function (...args: Parameters<T>) {
    const now = Date.now()

    if (now - lastRunTime >= delayMs) {
      func(...args)
      lastRunTime = now
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    } else if (!timeoutId) {
      const remaining = delayMs - (now - lastRunTime)
      timeoutId = setTimeout(() => {
        func(...args)
        lastRunTime = Date.now()
        timeoutId = null
      }, remaining)
    }
  }
}

/**
 * Create a debounced function with manual cancel support
 * Useful for cleaning up in useEffect
 */
export function createDebouncedFunction<T extends (...args: any[]) => any>(
  func: T,
  delayMs: number
): {
  execute: (...args: Parameters<T>) => void
  cancel: () => void
  flush: () => void
} {
  let timeoutId: NodeJS.Timeout | null = null
  let lastArgs: Parameters<T> | null = null

  return {
    execute(...args: Parameters<T>) {
      lastArgs = args
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        if (lastArgs) {
          func(...lastArgs)
        }
        timeoutId = null
        lastArgs = null
      }, delayMs)
    },

    cancel() {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
        lastArgs = null
      }
    },

    flush() {
      if (timeoutId && lastArgs) {
        clearTimeout(timeoutId)
        func(...lastArgs)
        timeoutId = null
        lastArgs = null
      }
    },
  }
}

/**
 * Request deduplication - prevents calling a function multiple times simultaneously
 * Useful for API calls that should only happen once even with rapid clicks
 */
export function deduplicate<T extends (...args: any[]) => Promise<any>>(
  func: T
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let inFlight: Promise<any> | null = null

  return async function (...args: Parameters<T>) {
    // If already in flight, return the same promise
    if (inFlight) {
      console.log('[Deduplicate] Request already in flight, using cached promise')
      return inFlight
    }

    inFlight = (async () => {
      try {
        return await func(...args)
      } finally {
        inFlight = null
      }
    })()

    return inFlight
  }
}

/**
 * Request deduplication with ID mapping
 * Useful when the same function is called with different parameters
 * and we want to deduplicate per unique ID
 */
export function deduplicateById<T extends (...args: any[]) => Promise<any>>(
  func: T,
  getIdFromArgs: (...args: Parameters<T>) => string
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  const inFlightMap = new Map<string, Promise<any>>()

  return async function (...args: Parameters<T>) {
    const id = getIdFromArgs(...args)

    // If already in flight for this ID, return the same promise
    if (inFlightMap.has(id)) {
      console.log(`[DeduplicateById] Request already in flight for ID: ${id}`)
      return inFlightMap.get(id)
    }

    const promise = (async () => {
      try {
        return await func(...args)
      } finally {
        inFlightMap.delete(id)
      }
    })()

    inFlightMap.set(id, promise)
    return promise
  }
}

/**
 * Batch requests - accumulate calls and execute once with all accumulated args
 * Useful for batch API operations
 */
export function createBatcher<T extends any[], R>(
  batchFn: (items: T[]) => Promise<R>,
  delayMs: number = 100,
  maxBatchSize: number = 50
): {
  add: (item: T) => Promise<R>
  flush: () => Promise<R>
  cancel: () => void
} {
  let batch: T[] = []
  let timeoutId: NodeJS.Timeout | null = null
  let pendingPromises: ((result: R) => void)[] = []

  async function executeBatch() {
    if (batch.length === 0) return

    const itemsToProcess = [...batch]
    batch = []

    try {
      const result = await batchFn(itemsToProcess)
      pendingPromises.forEach(resolve => resolve(result))
      pendingPromises = []
      return result
    } catch (error) {
      console.error('[Batcher] Batch execution failed:', error)
      throw error
    }
  }

  function scheduleBatch() {
    if (timeoutId) clearTimeout(timeoutId)

    if (batch.length >= maxBatchSize) {
      // Execute immediately if batch is full
      executeBatch()
    } else {
      // Schedule for later
      timeoutId = setTimeout(executeBatch, delayMs)
    }
  }

  return {
    add(item: T): Promise<R> {
      return new Promise((resolve) => {
        batch.push(item)
        pendingPromises.push(resolve)
        scheduleBatch()
      })
    },

    flush() {
      return executeBatch().then((result) => result ?? ({} as R))
    },

    cancel() {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      batch = []
      pendingPromises = []
    },
  }
}
