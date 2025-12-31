/**
 * Global lock for catalog snapshot publishing
 * Ensures only one snapshot publish operation runs at a time
 * Prevents race conditions and data corruption from concurrent writes
 */

let publishingLock: Promise<any> = Promise.resolve()
let lastPublishTime = 0
let publishInProgress = false

/**
 * Execute a function with exclusive snapshot publishing lock
 * Queues multiple attempts instead of running concurrently
 * @param fn Async function to execute with lock
 * @returns Result of the function
 */
export async function withSnapshotLock<R>(fn: () => Promise<R>): Promise<R> {
  const operationId = `snapshot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  
  console.log(`[SNAPSHOT-LOCK-WAIT] ${operationId} - Waiting for lock...`)

  // Create a new operation that waits for the previous one
  const currentOperation = (async () => {
    // Wait for previous operation to complete
    try {
      await publishingLock.catch(() => {})
    } catch {}
    
    // Check if already publishing (safety check)
    if (publishInProgress) {
      console.log(`[SNAPSHOT-LOCK-WAIT] ${operationId} - Another operation in progress, waiting...`)
      // Wait a bit and retry (up to 5 seconds)
      for (let i = 0; i < 50; i++) {
        if (!publishInProgress) break
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    publishInProgress = true
    
    try {
      console.log(`[SNAPSHOT-LOCK-ACQUIRED] ${operationId} - Publishing snapshot...`)
      const result = await fn()
      lastPublishTime = Date.now()
      console.log(`[SNAPSHOT-LOCK-SUCCESS] ${operationId} - Snapshot published successfully`)
      return result
    } catch (error) {
      console.error(`[SNAPSHOT-LOCK-ERROR] ${operationId} - Failed to publish snapshot:`, error)
      throw error
    } finally {
      publishInProgress = false
    }
  })()

  // Update the lock for next operation
  publishingLock = currentOperation.catch(() => {})

  return currentOperation
}

/**
 * Get the timestamp of the last successful snapshot publish
 */
export function getLastSnapshotPublishTime(): number {
  return lastPublishTime
}

/**
 * Check if a snapshot publish is currently in progress
 */
export function isSnapshotPublishing(): boolean {
  return publishInProgress
}
