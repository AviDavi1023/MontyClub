/**
 * Reusable API route patterns for consistent cache-backed endpoints
 * These patterns prevent lost updates and eventual consistency issues
 */

import { NextRequest, NextResponse } from 'next/server'
import { ApiCache } from './api-cache'

/**
 * Standard error response format
 */
export interface ApiError {
  error: string
  detail?: any
}

/**
 * Standard success response format
 */
export interface ApiSuccess<T = any> {
  success: true
  data?: T
  [key: string]: any
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  maxAge?: number // Max age in milliseconds (default: 10000)
  noCache?: boolean // If true, skip cache on GET
}

/**
 * Creates a GET handler that uses cache with configurable max age
 * 
 * @param cache ApiCache instance
 * @param fetchFn Function to fetch fresh data from storage
 * @param config Cache configuration
 * @returns Next.js route handler
 * 
 * @example
 * const cache = createCache<MyData[]>('my-data')
 * export const GET = createCachedGET(cache, async () => {
 *   return await readFromStorage()
 * })
 */
export function createCachedGET<T>(
  cache: ApiCache<T>,
  fetchFn: (request: NextRequest) => Promise<T>,
  config: CacheConfig = {}
): (request: NextRequest) => Promise<NextResponse> {
  const { maxAge = 10000, noCache = false } = config

  return async (request: NextRequest) => {
    try {
      // Determine dynamic no-cache overrides (query param or header)
      const forceNoCache = request.nextUrl.searchParams.get('nocache') === '1' || request.headers.get('x-no-cache') === '1'

      // Try cache first unless disabled or forced fresh
      if (!noCache && !forceNoCache) {
        const cached = cache.get(maxAge)
        if (cached !== null) {
          try {
            console.log(JSON.stringify({ 
              tag: 'api-pattern', 
              pattern: 'cached-get', 
              result: 'cache-hit',
              age: cache.getAge()
            }))
          } catch {}
          // Return cached data with no-cache headers to prevent browser caching
          return NextResponse.json(cached, {
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
            },
          })
        }
      }

      // Cache miss or disabled - fetch fresh data
      try {
        console.log(JSON.stringify({ 
          tag: 'api-pattern', 
          pattern: 'cached-get', 
          result: 'cache-miss',
          reason: noCache ? 'disabled' : 'stale-or-empty'
        }))
      } catch {}

      const data = await fetchFn(request)
      cache.set(data)

      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      })
    } catch (error) {
      console.error('Error in cached GET:', error)
      return NextResponse.json(
        { error: 'Internal server error', detail: String(error) },
        { status: 500 }
      )
    }
  }
}

/**
 * Creates a PATCH handler with exclusive locking to prevent lost updates
 * 
 * @param cache ApiCache instance
 * @param updateFn Function to perform the update
 * @returns Next.js route handler
 * 
 * @example
 * export const PATCH = createLockedPATCH(cache, async (request) => {
 *   const body = await request.json()
 *   const current = cache.get() || await readFromStorage()
 *   const updated = modify(current, body)
 *   await saveToStorage(updated)
 *   cache.set(updated)
 *   return { success: true, data: updated }
 * })
 */
export function createLockedPATCH<T = any>(
  cache: ApiCache<any>,
  updateFn: (request: NextRequest) => Promise<T>
): (request: NextRequest) => Promise<NextResponse<T | ApiError>> {
  return async (request: NextRequest) => {
    return cache.withLock(async () => {
      try {
        const result = await updateFn(request)
        return NextResponse.json(result, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        })
      } catch (error) {
        console.error('Error in locked PATCH:', error)
        return NextResponse.json(
          { error: 'Internal server error', detail: String(error) },
          { status: 500 }
        )
      }
    })
  }
}

/**
 * Creates a POST handler with exclusive locking
 * 
 * @param cache ApiCache instance
 * @param createFn Function to create new resource
 * @returns Next.js route handler
 */
export function createLockedPOST<T = any>(
  cache: ApiCache<any>,
  createFn: (request: NextRequest) => Promise<T>
): (request: NextRequest) => Promise<NextResponse<T | ApiError>> {
  return async (request: NextRequest) => {
    return cache.withLock(async () => {
      try {
        const result = await createFn(request)
        return NextResponse.json(result, {
          status: 201,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        })
      } catch (error) {
        console.error('Error in locked POST:', error)
        return NextResponse.json(
          { error: 'Internal server error', detail: String(error) },
          { status: 500 }
        )
      }
    })
  }
}

/**
 * Creates a DELETE handler with exclusive locking
 * 
 * @param cache ApiCache instance
 * @param deleteFn Function to delete resource
 * @returns Next.js route handler
 */
export function createLockedDELETE<T = any>(
  cache: ApiCache<any>,
  deleteFn: (request: NextRequest) => Promise<T>
): (request: NextRequest) => Promise<NextResponse<T | ApiError>> {
  return async (request: NextRequest) => {
    return cache.withLock(async () => {
      try {
        const result = await deleteFn(request)
        return NextResponse.json(result, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        })
      } catch (error) {
        console.error('Error in locked DELETE:', error)
        return NextResponse.json(
          { error: 'Internal server error', detail: String(error) },
          { status: 500 }
        )
      }
    })
  }
}

/**
 * Helper to validate admin authentication
 * @param request Request object
 * @returns true if authenticated
 */
export function validateAdminAuth(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key')
  const expectedKey = process.env.ADMIN_API_KEY
  return adminKey === expectedKey && !!adminKey
}

/**
 * Helper to create unauthorized response
 * @returns 401 response
 */
export function unauthorizedResponse(): NextResponse<ApiError> {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  )
}

/**
 * Helper to create not found response
 * @param message Optional custom message
 * @returns 404 response
 */
export function notFoundResponse(message = 'Not found'): NextResponse<ApiError> {
  return NextResponse.json(
    { error: message },
    { status: 404 }
  )
}

/**
 * Helper to create bad request response
 * @param message Error message
 * @param detail Optional additional details
 * @returns 400 response
 */
export function badRequestResponse(message: string, detail?: any): NextResponse<ApiError> {
  return NextResponse.json(
    { error: message, detail },
    { status: 400 }
  )
}

/**
 * Retry a storage operation with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum retry attempts
 * @param baseDelay Base delay in ms
 * @returns Result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 150
): Promise<T> {
  let lastError: any
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * (attempt + 1)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}
