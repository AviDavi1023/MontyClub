/**
 * Unified BroadcastChannel utilities for cross-tab communication
 * Provides type-safe message passing and consistent event schema
 */

export type BroadcastDomain = 'clubs' | 'updates' | 'announcements' | 'registrations' | 'collections' | 'settings'
export type BroadcastAction = 'create' | 'update' | 'delete' | 'batch' | 'refresh'

export interface BroadcastMessage<T = any> {
  domain: BroadcastDomain
  action: BroadcastAction
  payload?: T
  timestamp?: number
}

/**
 * Broadcast a message to all tabs/windows
 * @param domain Data domain (clubs, updates, etc.)
 * @param action Action performed (create, update, delete, etc.)
 * @param payload Optional data payload
 */
export function broadcast(domain: BroadcastDomain, action: BroadcastAction, payload?: any): void {
  try {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
      return
    }
    
    const channel = new BroadcastChannel('montyclub')
    const message: BroadcastMessage = {
      domain,
      action,
      payload,
      timestamp: Date.now()
    }
    
    channel.postMessage(message)
    channel.close()
  } catch (error) {
    console.warn('Broadcast failed:', error)
  }
}

/**
 * Create a BroadcastChannel listener with message type checking
 * @param handler Message handler function
 * @returns Cleanup function to close the channel
 */
export function createBroadcastListener(
  handler: (message: BroadcastMessage) => void
): () => void {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return () => {}
  }

  const channel = new BroadcastChannel('montyclub')
  
  channel.onmessage = (event) => {
    const message = event.data
    
    // Validate message structure
    if (!message || typeof message !== 'object') {
      return
    }
    
    // Support legacy message format (type field)
    if (message.type && !message.domain) {
      // Convert legacy format to new format
      const parts = String(message.type).split(':')
      if (parts.length === 2) {
        const legacyMessage: BroadcastMessage = {
          domain: parts[0] as BroadcastDomain,
          action: parts[1] as BroadcastAction,
          payload: message.entry || message.payload,
          timestamp: Date.now()
        }
        handler(legacyMessage)
        return
      }
    }
    
    // Handle new unified format
    if (message.domain && message.action) {
      handler(message as BroadcastMessage)
    }
  }

  // Return cleanup function
  return () => {
    try {
      channel.close()
    } catch (error) {
      console.warn('Failed to close broadcast channel:', error)
    }
  }
}

/**
 * Create a domain-specific broadcast listener
 * @param domain Domain to filter messages for
 * @param handler Message handler for the specific domain
 * @returns Cleanup function
 */
export function createDomainListener(
  domain: BroadcastDomain,
  handler: (action: BroadcastAction, payload?: any) => void
): () => void {
  return createBroadcastListener((message) => {
    if (message.domain === domain) {
      handler(message.action, message.payload)
    }
  })
}
