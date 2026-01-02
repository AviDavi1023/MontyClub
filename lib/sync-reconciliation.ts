/**
 * Automatic sync reconciliation system
 * Periodically checks for pending changes and retries failed syncs
 * Runs when admin is authenticated to ensure data integrity
 */

import { retryFailedWrites, getFailedWrites } from './storage-utils'

interface PendingSync {
  key: string
  data: any
  apiEndpoint: string
  method: 'POST' | 'PATCH' | 'DELETE'
  retryCount: number
  lastAttempt: number
}

interface ReconciliationStats {
  announcementsSynced: number
  updatesSynced: number
  collectionsSynced: number
  snapshotsSynced: number
  localStorageRetried: number
  totalErrors: number
}

/**
 * Reconcile pending announcements with server
 */
async function reconcileAnnouncements(adminApiKey: string): Promise<number> {
  try {
    const pendingKey = 'montyclub:pendingAnnouncements'
    const pending = localStorage.getItem(pendingKey)
    
    if (!pending || pending === '{}') return 0
    
    const pendingAnnouncements = JSON.parse(pending)
    const pendingCount = Object.keys(pendingAnnouncements).length
    
    if (pendingCount === 0) return 0
    
    console.log(`[Reconciliation] Found ${pendingCount} pending announcements, syncing...`)
    
    // Fetch current server state
    const response = await fetch('/api/announcements', {
      headers: { 'x-admin-key': adminApiKey }
    })
    
    if (!response.ok) {
      console.error('[Reconciliation] Failed to fetch announcements:', response.status)
      return 0
    }
    
    const serverAnnouncements = await response.json()
    
    // Find differences that need syncing
    const toSync: Record<string, string> = {}
    for (const [clubId, announcement] of Object.entries(pendingAnnouncements)) {
      if (serverAnnouncements[clubId] !== announcement) {
        toSync[clubId] = announcement as string
      }
    }
    
    if (Object.keys(toSync).length === 0) {
      // All synced already, clear pending
      localStorage.removeItem(pendingKey)
      console.log('[Reconciliation] ✅ All announcements already synced')
      return 0
    }
    
    // Sync differences
    const syncResponse = await fetch('/api/announcements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminApiKey
      },
      body: JSON.stringify(toSync)
    })
    
    if (!syncResponse.ok) {
      console.error('[Reconciliation] Failed to sync announcements:', syncResponse.status)
      return 0
    }
    
    // Success - clear pending
    localStorage.removeItem(pendingKey)
    console.log(`[Reconciliation] ✅ Synced ${Object.keys(toSync).length} announcements`)
    return Object.keys(toSync).length
    
  } catch (error) {
    console.error('[Reconciliation] Error reconciling announcements:', error)
    return 0
  }
}

/**
 * Reconcile pending update changes with server
 */
async function reconcileUpdates(adminApiKey: string): Promise<number> {
  try {
    const pendingKey = 'montyclub:pendingUpdateChanges'
    const pending = localStorage.getItem(pendingKey)
    
    if (!pending || pending === '{}') return 0
    
    const pendingChanges = JSON.parse(pending)
    const pendingIds = Object.keys(pendingChanges)
    
    if (pendingIds.length === 0) return 0
    
    console.log(`[Reconciliation] Found ${pendingIds.length} pending update changes, syncing...`)
    
    // Fetch current server state
    const response = await fetch('/api/updates', {
      headers: { 'x-admin-key': adminApiKey }
    })
    
    if (!response.ok) {
      console.error('[Reconciliation] Failed to fetch updates:', response.status)
      return 0
    }
    
    const serverUpdates = await response.json()
    const serverMap = new Map(serverUpdates.map((u: any) => [u.id, u]))
    
    let syncedCount = 0
    const stillPending: Record<string, any> = {}
    
    // Check each pending change
    for (const [updateId, pendingState] of Object.entries(pendingChanges)) {
      const serverUpdate = serverMap.get(updateId)
      
      if (!serverUpdate) {
        // Update deleted on server, can clear pending
        continue
      }
      
      // Check if states match
      const pending = pendingState as any
      let needsSync = false
      
      if (pending.reviewed !== undefined && serverUpdate.reviewed !== pending.reviewed) {
        needsSync = true
      }
      
      if (pending.deleted && !pending.deleted) {
        needsSync = true
      }
      
      if (needsSync) {
        // Try to sync this update
        try {
          const syncResponse = await fetch('/api/updates', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-key': adminApiKey
            },
            body: JSON.stringify({
              id: updateId,
              ...pending
            })
          })
          
          if (syncResponse.ok) {
            syncedCount++
          } else {
            // Keep in pending
            stillPending[updateId] = pending
          }
        } catch (err) {
          // Keep in pending
          stillPending[updateId] = pending
        }
      }
    }
    
    // Update localStorage with remaining pending
    if (Object.keys(stillPending).length === 0) {
      localStorage.removeItem(pendingKey)
    } else {
      localStorage.setItem(pendingKey, JSON.stringify(stillPending))
    }
    
    if (syncedCount > 0) {
      console.log(`[Reconciliation] ✅ Synced ${syncedCount} update changes`)
    }
    
    return syncedCount
    
  } catch (error) {
    console.error('[Reconciliation] Error reconciling updates:', error)
    return 0
  }
}

/**
 * Retry failed snapshot publishes
 */
async function retryFailedSnapshots(adminApiKey: string): Promise<number> {
  try {
    // Check for failed snapshot publish queue (server-side storage)
    const response = await fetch('/api/admin/retry-snapshots', {
      method: 'POST',
      headers: {
        'x-admin-key': adminApiKey
      }
    })
    
    if (!response.ok) {
      // Endpoint might not exist yet, ignore
      return 0
    }
    
    const result = await response.json()
    return result.retried || 0
    
  } catch (error) {
    // Endpoint might not exist yet, ignore
    return 0
  }
}

/**
 * Main reconciliation function
 * Runs all reconciliation tasks and returns stats
 */
export async function runSyncReconciliation(adminApiKey: string): Promise<ReconciliationStats> {
  console.log('[Reconciliation] Starting automatic sync reconciliation...')
  
  const stats: ReconciliationStats = {
    announcementsSynced: 0,
    updatesSynced: 0,
    collectionsSynced: 0,
    snapshotsSynced: 0,
    localStorageRetried: 0,
    totalErrors: 0
  }
  
  try {
    // 1. Retry failed localStorage writes
    stats.localStorageRetried = await retryFailedWrites()
    
    // 2. Reconcile announcements
    stats.announcementsSynced = await reconcileAnnouncements(adminApiKey)
    
    // 3. Reconcile updates
    stats.updatesSynced = await reconcileUpdates(adminApiKey)
    
    // 4. Retry failed snapshots
    stats.snapshotsSynced = await retryFailedSnapshots(adminApiKey)
    
    const totalSynced = stats.announcementsSynced + stats.updatesSynced + 
                        stats.collectionsSynced + stats.snapshotsSynced + 
                        stats.localStorageRetried
    
    if (totalSynced > 0) {
      console.log(`[Reconciliation] ✅ Completed: ${totalSynced} items synced`)
    } else {
      console.log('[Reconciliation] ✅ Completed: All data already synced')
    }
    
  } catch (error) {
    console.error('[Reconciliation] Error during reconciliation:', error)
    stats.totalErrors++
  }
  
  return stats
}

/**
 * Start periodic reconciliation (runs every 30 seconds when admin is logged in)
 */
export function startPeriodicReconciliation(adminApiKey: string): () => void {
  console.log('[Reconciliation] Starting periodic reconciliation (every 30s)')
  
  // Run immediately on start
  runSyncReconciliation(adminApiKey).catch(console.error)
  
  // Then every 30 seconds
  const interval = setInterval(() => {
    runSyncReconciliation(adminApiKey).catch(console.error)
  }, 30000)
  
  // Return cleanup function
  return () => {
    console.log('[Reconciliation] Stopping periodic reconciliation')
    clearInterval(interval)
  }
}

/**
 * Get current failed writes for diagnostics
 */
export function getReconciliationDiagnostics() {
  return {
    failedWrites: getFailedWrites(),
    pendingAnnouncements: (() => {
      try {
        const data = localStorage.getItem('montyclub:pendingAnnouncements')
        return data ? Object.keys(JSON.parse(data)).length : 0
      } catch {
        return 0
      }
    })(),
    pendingUpdates: (() => {
      try {
        const data = localStorage.getItem('montyclub:pendingUpdateChanges')
        return data ? Object.keys(JSON.parse(data)).length : 0
      } catch {
        return 0
      }
    })(),
    pendingCollections: (() => {
      try {
        const data = localStorage.getItem('montyclub:pendingCollectionChanges')
        return data ? Object.keys(JSON.parse(data)).length : 0
      } catch {
        return 0
      }
    })()
  }
}
