/**
 * Unified BroadcastChannel utilities for cross-tab communication
 * Provides type-safe message passing and consistent event schema
 * Includes message queuing for reliability
 */

export type BroadcastDomain = 'clubs' | 'updates' | 'announcements' | 'registrations' | 'collections' | 'settings'
export type BroadcastAction = 'create' | 'update' | 'delete' | 'batch' | 'refresh'

export interface BroadcastMessage<T = any> {
  domain: BroadcastDomain
  action: BroadcastAction
  payload?: T
  timestamp?: number
  messageId?: string // Unique message ID to prevent duplicates
}

// In-memory message queue for resilient delivery
// Stores messages that couldn't be delivered immediately
const messageQueue: BroadcastMessage[] = []
const MAX_QUEUE_SIZE = 100

// Track recently seen messages to prevent duplicates
const seenMessages = new Set<string>()
const SEEN_MESSAGES_RETENTION = 60000 // Keep for 1 minute

/**
 * Generate unique message ID
 */
function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Broadcast a message to all tabs/windows
 * Message is queued if immediate broadcast fails
 * @param domain Data domain (clubs, updates, etc.)
 * @param action Action performed (create, update, delete, etc.)
 * @param payload Optional data payload
 */
export function broadcast(domain: BroadcastDomain, action: BroadcastAction, payload?: any): void {
  try {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
      return
    }
    
    const messageId = generateMessageId()
    const channel = new BroadcastChannel('montyclub')
    const message: BroadcastMessage = {
      domain,
      action,
      payload,
      timestamp: Date.now(),
      messageId,
    }
    
    try {
      channel.postMessage(message)
      console.log(`[Broadcast] Sent ${domain}:${action} (${messageId})`)
    } catch (error) {
      console.warn(`[Broadcast] Failed to send message, queueing:`, error)
      // Queue message for retry
      queueMessage(message)
    } finally {
      channel.close()
    }
  } catch (error) {
    console.warn('Broadcast initialization failed:', error)
  }
}

/**
 * Queue a message for retry delivery
 */
function queueMessage(message: BroadcastMessage): void {
  if (messageQueue.length >= MAX_QUEUE_SIZE) {
    // Remove oldest message to make room
    messageQueue.shift()
    console.warn('[Broadcast] Message queue full, dropping oldest message')
  }
  messageQueue.push(message)
  console.log(`[Broadcast] Message queued (queue size: ${messageQueue.length})`)
  
  // Try to deliver queued messages
  retryQueuedMessages()
}

/**
 * Retry delivery of queued messages
 */
function retryQueuedMessages(): void {
  if (messageQueue.length === 0) return

  const messagesToRetry = [...messageQueue]
  messageQueue.length = 0

  for (const message of messagesToRetry) {
    try {
      if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
        messageQueue.push(message) // Re-queue if BroadcastChannel not available
        continue
      }

      const channel = new BroadcastChannel('montyclub')
      channel.postMessage(message)
      channel.close()
      console.log(`[Broadcast] Retried queued message: ${message.domain}:${message.action}`)
    } catch (error) {
      console.warn('[Broadcast] Retry failed, re-queuing message')
      messageQueue.push(message)
    }
  }
}

/**
 * Create a BroadcastChannel listener with message type checking and deduplication
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
    
    // Deduplication: skip if we've seen this message recently
    if (message.messageId) {
      if (seenMessages.has(message.messageId)) {
        console.log(`[Broadcast] Duplicate message ignored: ${message.messageId}`)
        return
      }
      seenMessages.add(message.messageId)
      
      // Clean up old seen messages periodically
      setTimeout(() => {
        seenMessages.delete(message.messageId)
      }, SEEN_MESSAGES_RETENTION)
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
          timestamp: Date.now(),
          messageId: generateMessageId(),
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

  // Note: BroadcastChannel doesn't have standard onerror event, removed

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

/**
 * Get queue statistics (for monitoring)
 */
export function getBroadcastQueueStats() {
  return {
    queuedMessages: messageQueue.length,
    maxQueueSize: MAX_QUEUE_SIZE,
    seenMessagesInMemory: seenMessages.size,
  }
}

/**
 * Clear the message queue (for testing)
 */
export function clearBroadcastQueue(): void {
  messageQueue.length = 0
  seenMessages.clear()
  console.log('[Broadcast] Queue cleared')
}

/**
 * Manually trigger queue retry
 */
export function retryBroadcastQueue(): void {
  console.log(`[Broadcast] Manually retrying queue (${messageQueue.length} messages)`)
  retryQueuedMessages()
}
