/**
 * Admin Operations Helpers
 * 
 * Provides mutation functions for admin operations that follow the optimistic UI pattern:
 * 1. Update local state immediately (optimistic)
 * 2. Send API call in background
 * 3. Auto-sync when server catches up
 * 4. Handle errors by keeping localStorage until sync
 */

import { RegistrationCollection, ClubRegistration } from '@/types/club'

/**
 * Update a collection with optimistic rendering
 * Returns a function that manages the full lifecycle
 */
export async function updateCollectionOptimistic(
  collectionId: string,
  updates: Partial<RegistrationCollection>,
  options: {
    adminApiKey: string
    onPending: (id: string, changes: Partial<RegistrationCollection>) => void
    onSuccess: (message: string) => void
    onError: (message: string) => void
    onLoadCollections: () => Promise<void>
  }
): Promise<boolean> {
  const { adminApiKey, onPending, onSuccess, onError, onLoadCollections } = options

  // Step 1: Update local pending state immediately (optimistic)
  onPending(collectionId, updates)

  try {
    // Step 2: Send API call in background (don't wait for completion)
    const apiPromise = (async () => {
      const response = await fetch('/api/registration-collections', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify({ id: collectionId, ...updates })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || data.detail || 'Failed to update collection')
      }

      return response.json()
    })()

    // Step 3: Load from server after API completes
    // This allows auto-sync to detect matching state
    apiPromise
      .then(() => {
        // Small delay to allow Supabase propagation
        return new Promise(resolve => setTimeout(resolve, 300))
      })
      .then(() => onLoadCollections())
      .catch(err => {
        console.error('[OptimisticUpdate] Background sync failed:', err)
        // Retry will be handled by sync-reconciliation system
      })

    onSuccess(`Updated collection successfully`)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update collection'
    console.error('[OptimisticUpdate] Error:', message)
    onError(`${message} (will retry automatically)`)
    return false
  }
}

/**
 * Create a collection with optimistic rendering
 */
export async function createCollectionOptimistic(
  name: string,
  enabled: boolean,
  options: {
    adminApiKey: string
    onPending: (id: string, changes: Partial<RegistrationCollection>) => void
    onSuccess: (message: string, collectionId: string) => void
    onError: (message: string) => void
    onLoadCollections: () => Promise<void>
  }
): Promise<string | null> {
  const { adminApiKey, onPending, onSuccess, onError, onLoadCollections } = options

  try {
    // Create temporary ID for optimistic rendering
    const tempId = `temp-col-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    // Step 1: Add to pending with temporary ID
    onPending(tempId, {
      id: tempId,
      name,
      enabled,
      createdAt: new Date().toISOString(),
      accepting: enabled,
      display: false,
      renewalEnabled: false
    })

    try {
      // Step 2: Create on server
      const response = await fetch('/api/registration-collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify({ name, enabled })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create collection')
      }

      const created = await response.json()
      const realId = created.collection.id

      // Step 3: Replace temp ID with real ID in pending
      onPending(realId, {
        id: realId,
        name: created.collection.name,
        enabled: created.collection.enabled,
        createdAt: created.collection.createdAt,
        accepting: created.collection.accepting,
        display: created.collection.display,
        renewalEnabled: created.collection.renewalEnabled
      })

      // Step 4: Load from server to sync
      setTimeout(() => onLoadCollections(), 300)

      onSuccess(`Created collection "${name}"`, realId)
      return realId
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create collection'
      throw error
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create collection'
    console.error('[OptimisticCreate] Error:', message)
    onError(`${message} (collection removed from pending)`)
    return null
  }
}

/**
 * Approve a registration with optimistic rendering
 */
export async function approveRegistrationOptimistic(
  registrationId: string,
  collectionId: string,
  options: {
    adminApiKey: string
    onPending: (id: string, changes: Record<string, any>) => void
    onSuccess: (message: string) => void
    onError: (message: string) => void
    onLoadRegistrations: () => Promise<void>
  }
): Promise<boolean> {
  const { adminApiKey, onPending, onSuccess, onError, onLoadRegistrations } = options

  // Step 1: Update local pending immediately
  onPending(registrationId, { status: 'approved' })

  try {
    // Step 2: Send API call
    const response = await fetch('/api/registration-approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminApiKey
      },
      body: JSON.stringify({
        registrationId,
        collectionId
      })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to approve registration')
    }

    // Step 3: Load from server after API completes
    Promise.resolve()
      .then(() => new Promise(resolve => setTimeout(resolve, 300)))
      .then(() => onLoadRegistrations())
      .catch(err => console.error('[OptimisticApprove] Background sync failed:', err))

    onSuccess('Registration approved')
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to approve registration'
    console.error('[OptimisticApprove] Error:', message)
    onError(`${message} (will retry automatically)`)
    return false
  }
}

/**
 * Deny a registration with optimistic rendering
 */
export async function denyRegistrationOptimistic(
  registrationId: string,
  collectionId: string,
  denialReason: string,
  options: {
    adminApiKey: string
    onPending: (id: string, changes: Record<string, any>) => void
    onSuccess: (message: string) => void
    onError: (message: string) => void
    onLoadRegistrations: () => Promise<void>
  }
): Promise<boolean> {
  const { adminApiKey, onPending, onSuccess, onError, onLoadRegistrations } = options

  // Step 1: Update local pending immediately
  onPending(registrationId, { status: 'rejected', denialReason })

  try {
    // Step 2: Send API call
    const response = await fetch('/api/registration-deny', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminApiKey
      },
      body: JSON.stringify({
        registrationId,
        collectionId,
        denialReason
      })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to deny registration')
    }

    // Step 3: Load from server after API completes
    Promise.resolve()
      .then(() => new Promise(resolve => setTimeout(resolve, 300)))
      .then(() => onLoadRegistrations())
      .catch(err => console.error('[OptimisticDeny] Background sync failed:', err))

    onSuccess('Registration denied')
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to deny registration'
    console.error('[OptimisticDeny] Error:', message)
    onError(`${message} (will retry automatically)`)
    return false
  }
}

/**
 * Helper to get effective state (pending overrides server)
 */
export function getEffectiveField<T>(
  serverValue: T,
  pendingValue: T | undefined
): T {
  return pendingValue !== undefined ? pendingValue : serverValue
}

/**
 * Helper to check if a field has pending changes
 */
export function hasPendingChange(
  serverValue: any,
  pendingValue: any | undefined
): boolean {
  return pendingValue !== undefined && pendingValue !== serverValue
}
