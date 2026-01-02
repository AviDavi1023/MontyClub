/**
 * Sync Reconciliation System
 * Tracks failed API operations and retries them when admin is authenticated
 * Prevents phantom changes from being lost or shown incorrectly
 */

export interface FailedOperation {
  type: 'announcement' | 'update' | 'collection' | 'registration'
  action: 'create' | 'update' | 'delete' | 'toggle'
  data: any
  timestamp: number
  attempts: number
  lastError?: string
  targetId?: string
}

const FAILED_OPS_KEY = 'montyclub:failedOperations'
const MAX_RETRY_ATTEMPTS = 5
const RETRY_BACKOFF_MS = 2000

/**
 * Record a failed operation for later retry
 */
export function recordFailedOperation(operation: Omit<FailedOperation, 'timestamp' | 'attempts'>): void {
  if (typeof window === 'undefined') return
  
  try {
    const existing = getFailedOperations()
    const newOp: FailedOperation = {
      ...operation,
      timestamp: Date.now(),
      attempts: 0
    }
    
    // Add to list
    existing.push(newOp)
    
    // Save
    localStorage.setItem(FAILED_OPS_KEY, JSON.stringify(existing))
    console.log(`[Reconciliation] Recorded failed ${operation.type} operation for retry`)
  } catch (error) {
    console.error('[Reconciliation] Failed to record operation:', error)
  }
}

/**
 * Get all failed operations
 */
export function getFailedOperations(): FailedOperation[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(FAILED_OPS_KEY)
    if (!stored) return []
    
    const ops = JSON.parse(stored)
    return Array.isArray(ops) ? ops : []
  } catch {
    return []
  }
}

/**
 * Remove a successfully completed operation
 */
export function removeFailedOperation(index: number): void {
  if (typeof window === 'undefined') return
  
  try {
    const ops = getFailedOperations()
    ops.splice(index, 1)
    localStorage.setItem(FAILED_OPS_KEY, JSON.stringify(ops))
    console.log(`[Reconciliation] Removed completed operation`)
  } catch (error) {
    console.error('[Reconciliation] Failed to remove operation:', error)
  }
}

/**
 * Update attempt count and error for an operation
 */
function updateOperationAttempt(index: number, error: string): void {
  if (typeof window === 'undefined') return
  
  try {
    const ops = getFailedOperations()
    if (ops[index]) {
      ops[index].attempts += 1
      ops[index].lastError = error
      localStorage.setItem(FAILED_OPS_KEY, JSON.stringify(ops))
    }
  } catch (e) {
    console.error('[Reconciliation] Failed to update attempt:', e)
  }
}

/**
 * Retry all failed operations
 * Returns { succeeded: number, failed: number, errors: string[] }
 */
export async function retryFailedOperations(
  adminApiKey: string
): Promise<{ succeeded: number; failed: number; errors: string[] }> {
  const ops = getFailedOperations()
  if (ops.length === 0) {
    return { succeeded: 0, failed: 0, errors: [] }
  }
  
  console.log(`[Reconciliation] Retrying ${ops.length} failed operations...`)
  
  let succeeded = 0
  let failed = 0
  const errors: string[] = []
  
  // Process in order (FIFO)
  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i]
    
    // Skip if max attempts reached
    if (op.attempts >= MAX_RETRY_ATTEMPTS) {
      errors.push(`${op.type} operation exceeded max retries (${MAX_RETRY_ATTEMPTS})`)
      failed++
      continue
    }
    
    try {
      // Wait before retry (exponential backoff)
      if (op.attempts > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_BACKOFF_MS * Math.pow(2, op.attempts - 1)))
      }
      
      // Retry based on operation type
      let success = false
      
      switch (op.type) {
        case 'announcement':
          success = await retryAnnouncementOperation(op, adminApiKey)
          break
        case 'update':
          success = await retryUpdateOperation(op, adminApiKey)
          break
        case 'collection':
          success = await retryCollectionOperation(op, adminApiKey)
          break
        case 'registration':
          success = await retryRegistrationOperation(op, adminApiKey)
          break
      }
      
      if (success) {
        removeFailedOperation(i)
        succeeded++
        console.log(`[Reconciliation] ✅ Retry succeeded for ${op.type} operation`)
      } else {
        updateOperationAttempt(i, 'Retry returned false')
        failed++
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      updateOperationAttempt(i, errorMsg)
      errors.push(`${op.type}: ${errorMsg}`)
      failed++
      console.error(`[Reconciliation] ❌ Retry failed for ${op.type}:`, error)
    }
  }
  
  console.log(`[Reconciliation] Complete: ${succeeded} succeeded, ${failed} failed`)
  return { succeeded, failed, errors }
}

/**
 * Retry announcement operation
 */
async function retryAnnouncementOperation(op: FailedOperation, adminApiKey: string): Promise<boolean> {
  if (op.action === 'update' || op.action === 'create') {
    const response = await fetch('/api/announcements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminApiKey
      },
      body: JSON.stringify(op.data)
    })
    return response.ok
  }
  
  if (op.action === 'delete' && op.targetId) {
    const response = await fetch('/api/announcements', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminApiKey
      },
      body: JSON.stringify({ ids: [op.targetId] })
    })
    return response.ok
  }
  
  return false
}

/**
 * Retry update operation
 */
async function retryUpdateOperation(op: FailedOperation, adminApiKey: string): Promise<boolean> {
  if (op.action === 'update' && op.targetId) {
    const response = await fetch(`/api/updates/${op.targetId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminApiKey
      },
      body: JSON.stringify(op.data)
    })
    return response.ok
  }
  
  if (op.action === 'delete' && op.targetId) {
    const response = await fetch(`/api/updates/${op.targetId}`, {
      method: 'DELETE',
      headers: {
        'x-admin-key': adminApiKey
      }
    })
    return response.ok
  }
  
  return false
}

/**
 * Retry collection operation
 */
async function retryCollectionOperation(op: FailedOperation, adminApiKey: string): Promise<boolean> {
  if (op.action === 'toggle' && op.targetId) {
    const response = await fetch(`/api/registration-collections/${op.targetId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminApiKey
      },
      body: JSON.stringify(op.data)
    })
    return response.ok
  }
  
  return false
}

/**
 * Retry registration operation
 */
async function retryRegistrationOperation(op: FailedOperation, adminApiKey: string): Promise<boolean> {
  if (op.action === 'update' && op.targetId) {
    const endpoint = op.data.approved ? '/api/registration-approve' : '/api/registration-deny'
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminApiKey
      },
      body: JSON.stringify(op.data)
    })
    return response.ok
  }
  
  return false
}

/**
 * Clear all failed operations (for testing or manual intervention)
 */
export function clearFailedOperations(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(FAILED_OPS_KEY)
  console.log('[Reconciliation] Cleared all failed operations')
}

/**
 * Get count of failed operations for UI display
 */
export function getFailedOperationsCount(): number {
  return getFailedOperations().length
}
