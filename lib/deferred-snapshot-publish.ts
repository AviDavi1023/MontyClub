/**
 * Deferred Snapshot Publish System
 * 
 * Debounces snapshot publishing to prevent multiple rebuilds from rapid approvals/denials.
 * Multiple operations within 2 seconds result in a single publish.
 * 
 * Architecture:
 * - When an approval/denial happens, queue a publish request
 * - Wait 2 seconds to see if more operations arrive
 * - If more arrive, reset the timer
 * - After 2 seconds of quiet, publish once
 * - Uses process-level state tracking (safe since each API call is independent)
 */

let publishTimer: NodeJS.Timeout | null = null
let publishPending = false
const DEBOUNCE_MS = 2000

/**
 * Schedule a deferred snapshot publish
 * Debounces multiple calls within DEBOUNCE_MS into a single publish
 * @param publisher Async function that builds and publishes the snapshot
 * @returns Function to cancel the scheduled publish
 */
export function scheduleSnapshotPublish(publisher: () => Promise<void>): () => void {
  // Mark as pending
  publishPending = true

  // Clear existing timer to restart the debounce
  if (publishTimer) {
    clearTimeout(publishTimer)
  }

  // Schedule publish after debounce period
  publishTimer = setTimeout(async () => {
    try {
      if (publishPending) {
        console.log('[DeferredPublish] Executing debounced snapshot publish...')
        await publisher()
        console.log('[DeferredPublish] ✅ Snapshot published')
      }
    } catch (err) {
      console.error('[DeferredPublish] ❌ Failed to publish snapshot:', err)
    } finally {
      publishPending = false
      publishTimer = null
    }
  }, DEBOUNCE_MS)

  // Return cancel function
  return () => {
    if (publishTimer) {
      clearTimeout(publishTimer)
      publishTimer = null
      console.log('[DeferredPublish] Cancelled scheduled publish')
    }
  }
}

/**
 * Check if a publish is currently pending (debouncing)
 */
export function isPublishPending(): boolean {
  return publishPending
}

/**
 * Get deferred publish stats (for monitoring)
 */
export function getDeferredPublishStats() {
  return {
    isPending: publishPending,
    timerActive: publishTimer !== null,
  }
}
