/**
 * Idempotency key management for preventing duplicate request processing
 * Implements idempotent operations following RFC 9110 Idempotent-Key pattern
 */

import { NextRequest, NextResponse } from 'next/server'

// In-memory cache of processed idempotency keys
// Maps key -> { timestamp, response }
const idempotencyCache = new Map<string, {
  timestamp: number
  response: any
  status: number
}>(
)

const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Extract idempotency key from request headers
 * Standard header is Idempotency-Key (from RFC 9110)
 * Also checks X-Idempotency-Key for compatibility
 */
export function extractIdempotencyKey(request: NextRequest): string | null {
  return request.headers.get('Idempotency-Key') || request.headers.get('X-Idempotency-Key')
}

/**
 * Check if a request with this key has been processed before
 * Returns the cached response if found and still fresh
 */
export function getIdempotencyResult(key: string): { response: any; status: number } | null {
  const cached = idempotencyCache.get(key)
  if (!cached) return null

  // Check if cache is still fresh
  if (Date.now() - cached.timestamp > IDEMPOTENCY_TTL) {
    idempotencyCache.delete(key)
    return null
  }

  return { response: cached.response, status: cached.status }
}

/**
 * Store the result of processing an idempotency key
 */
export function storeIdempotencyResult(key: string, response: any, status: number): void {
  idempotencyCache.set(key, {
    timestamp: Date.now(),
    response,
    status,
  })
}

/**
 * Wrap a request handler to add idempotency protection
 * If the request has an Idempotency-Key header:
 * - Check if it's been processed before
 * - If yes, return cached response
 * - If no, process it and cache the result
 */
export function withIdempotency<T = any>(
  handler: (request: NextRequest) => Promise<NextResponse<T>>
): (request: NextRequest) => Promise<NextResponse<T>> {
  return async (request: NextRequest) => {
    const key = extractIdempotencyKey(request)

    // No idempotency key provided - process normally
    if (!key) {
      return handler(request)
    }

    // Check for duplicate request
    const cached = getIdempotencyResult(key)
    if (cached) {
      console.log(`[Idempotency] Cache hit for key: ${key}`)
      return NextResponse.json(cached.response, { status: cached.status })
    }

    // Process the request
    console.log(`[Idempotency] Processing new request with key: ${key}`)
    const response = await handler(request)

    // Cache successful idempotent operations (POST, PATCH, DELETE)
    const method = request.method
    if (['POST', 'PATCH', 'DELETE'].includes(method)) {
      try {
        const body = await response.clone().json()
        storeIdempotencyResult(key, body, response.status)
        console.log(`[Idempotency] Cached result for key: ${key}`)
      } catch {
        // Response body is not JSON or couldn't be cloned
        // Still cache in case of non-JSON responses
        storeIdempotencyResult(key, { status: 'cached' }, response.status)
      }
    }

    return response
  }
}

/**
 * Clear old idempotency cache entries (call periodically)
 * Returns number of entries cleared
 */
export function cleanupIdempotencyCache(): number {
  let cleared = 0
  const now = Date.now()

  for (const [key, value] of idempotencyCache.entries()) {
    if (now - value.timestamp > IDEMPOTENCY_TTL) {
      idempotencyCache.delete(key)
      cleared++
    }
  }

  if (cleared > 0) {
    console.log(`[Idempotency] Cleaned up ${cleared} expired entries`)
  }

  return cleared
}

/**
 * Get cache stats for monitoring
 */
export function getIdempotencyCacheStats() {
  return {
    size: idempotencyCache.size,
    ttl: IDEMPOTENCY_TTL,
  }
}

/**
 * Clear all idempotency cache (for testing or emergency)
 */
export function clearIdempotencyCache(): void {
  idempotencyCache.clear()
  console.log('[Idempotency] Cache cleared')
}
