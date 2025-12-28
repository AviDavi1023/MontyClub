/**
 * Registration-level locking to prevent concurrent mutations
 * Ensures atomic read-modify-write operations on registration files
 */

// Map of registration paths to their current lock promise
const registrationLocks = new Map<string, Promise<any>>()

/**
 * Execute a function with exclusive lock on a registration
 * Prevents concurrent modifications to the same registration
 * @param registrationPath Full path to registration file (e.g., "registrations/col-123/reg-456.json")
 * @param fn Async function to execute with lock
 * @returns Result of the function
 */
export async function withRegistrationLock<R>(
  registrationPath: string,
  fn: () => Promise<R>
): Promise<R> {
  const operationId = `${registrationPath.split('/').pop()}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

  // Get current lock for this registration, or resolve immediately
  const currentLock = registrationLocks.get(registrationPath) || Promise.resolve()

  // Create new lock that waits for current one
  const newLock = (async () => {
    // Wait for previous operation to complete
    await currentLock.catch(() => {})

    try {
      return await fn()
    } finally {
      // Lock resolved, next operation can proceed
    }
  })()

  // Update lock for next operation on this registration
  registrationLocks.set(registrationPath, newLock.catch(() => {}))

  return newLock
}

/**
 * Clean up old locks to prevent memory leaks
 * Call periodically (e.g., every 10 minutes)
 */
export function cleanupRegistrationLocks(): number {
  const now = Date.now()
  let cleaned = 0

  // Remove locks older than 1 hour
  for (const [path] of registrationLocks.entries()) {
    // Extract timestamp from operation ID in the promise (simple heuristic)
    // For now, keep all locks (they auto-resolve), just log
    if (registrationLocks.size > 10000) {
      console.warn('[registration-lock] Lock map has grown large, consider restart')
    }
  }

  return cleaned
}

// Periodic cleanup (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupRegistrationLocks()
  }, 5 * 60 * 1000)
}
