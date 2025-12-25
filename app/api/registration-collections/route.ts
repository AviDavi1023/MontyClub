import { NextRequest, NextResponse } from 'next/server'
import { readJSONFromStorage, writeJSONToStorage, listPaths, removePaths } from '@/lib/supabase'
import { RegistrationCollection } from '@/types/club'

export const dynamic = 'force-dynamic'

const COLLECTIONS_PATH = 'settings/registration-collections.json'
const DEBUG = process.env.NODE_ENV === 'development'

// In-memory lock to prevent concurrent writes to the same file
// Force test comment
// This ensures read-modify-write operations are atomic across multiple requests
let updateLock: Promise<any> = Promise.resolve()

// Simple logging helper - only logs in development
function log(data: object) {
  if (DEBUG) {
    try {
      console.log(JSON.stringify(data))
    } catch {}
  }
}

// Retry helper with exponential backoff + jitter
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 100
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxAttempts - 1) {
        // Exponential backoff with jitter
        const delay = baseDelayMs * Math.pow(2, attempt)
        const jitter = Math.random() * delay
        await new Promise(r => setTimeout(r, delay + jitter))
      }
    }
  }

  throw lastError
}

/**
 * Execute a function with exclusive lock to prevent concurrent modifications
 * @param fn Async function to execute with lock
 * @returns Result of the function
 */
async function withLock<R>(fn: () => Promise<R>): Promise<R> {
  const operationId = `col-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  
  log({ tag: 'collections-lock', step: 'wait', operationId })

  // Create a new operation that waits for the previous one to complete
  const currentOperation = (async () => {
    // First, wait for the previous operation to complete
    await updateLock.catch(() => {})
    
    log({ tag: 'collections-lock', step: 'acquired', operationId })

    try {
      const result = await fn()
      return result
    } finally {
      log({ tag: 'collections-lock', step: 'released', operationId })
    }
  })()

  // Update lock to point to current operation BEFORE returning
  // This ensures the next request will wait for this one
  updateLock = currentOperation.catch(() => {})

  return currentOperation
}

async function getCollections(): Promise<RegistrationCollection[]> {
  const data = await readJSONFromStorage(COLLECTIONS_PATH, true)
  if (!data || !Array.isArray(data)) {
    return []
  }
  // Back-compat defaults: accepting mirrors enabled; display is undefined unless explicitly set
  const cols: RegistrationCollection[] = data.map((c: any) => ({
    id: String(c.id),
    name: String(c.name),
    enabled: Boolean(c.enabled),
    createdAt: String(c.createdAt),
    display: typeof c.display === 'boolean' ? c.display : undefined,
    accepting: typeof c.accepting === 'boolean' ? c.accepting : Boolean(c.enabled),
  }))
  return cols
}

async function saveCollections(collections: RegistrationCollection[]): Promise<boolean> {
  try {
    // Write with retry
    const ok = await withRetry(() => writeJSONToStorage(COLLECTIONS_PATH, collections), 3, 100)
    if (!ok) {
      console.error('[saveCollections] Write failed after retries')
      return false
    }

    // Normalize helper to compare regardless of key ordering
    const normalize = (arr: RegistrationCollection[] | any): RegistrationCollection[] => {
      if (!Array.isArray(arr)) return []
      const out = arr.map((c: any) => ({
        id: String(c.id || ''),
        name: String(c.name || ''),
        enabled: Boolean(c.enabled),
        createdAt: String(c.createdAt || ''),
      }))
      out.sort((a, b) => a.id.localeCompare(b.id))
      return out
    }

    const target = normalize(collections)
    // Read-back verification with cache-busting, a couple of attempts
    for (let attempt = 0; attempt < 3; attempt++) {
      // small backoff on subsequent attempts to allow storage propagation
      if (attempt > 0) await new Promise(r => setTimeout(r, 100 * attempt))
      const after = await readJSONFromStorage(COLLECTIONS_PATH, true /* bust cache */)
      const current = normalize(after)
      const equal = JSON.stringify(current) === JSON.stringify(target)
      if (equal) {
        log({ tag: 'collections-persistence', step: 'verified', attempt })
        return true
      }
      // Attempt a single re-write if mismatch, then re-verify in next loop
      log({ tag: 'collections-persistence', step: 'mismatch-rewrite', attempt })
      await writeJSONToStorage(COLLECTIONS_PATH, collections)
    }
    console.error('[saveCollections] Verification failed after retries')
    return false
  } catch (err) {
    console.error('[saveCollections] Exception:', err)
    return false
  }
}

// GET - List all collections
export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_API_KEY

    if (!adminKey || adminKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const collections = await getCollections()
    log({ tag: 'collections-get', count: collections.length })
    
    // Sort by creation date (newest first)
    const sorted = [...collections].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json({ collections: sorted })
  } catch (error) {
    console.error('Error fetching collections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 }
    )
  }
}

// POST - Create new collection
export async function POST(request: NextRequest) {
  return withLock(async () => {
    try {
      const adminKey = request.headers.get('x-admin-key')
      const expectedKey = process.env.ADMIN_API_KEY

      if (!adminKey || adminKey !== expectedKey) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      const body = await request.json()
      const { name, enabled = false } = body

      if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json(
          { error: 'Collection name is required' },
          { status: 400 }
        )
      }

      const collections = await getCollections()

      // Check for duplicate names (exact match)
      if (collections.some(c => c.name.toLowerCase() === name.trim().toLowerCase())) {
        return NextResponse.json(
          { error: 'Collection with this name already exists' },
          { status: 400 }
        )
      }

      // Check for slug collisions (different names that produce same slug)
      const { slugifyName } = await import('@/lib/slug')
      const newSlug = slugifyName(name.trim())
      const existingWithSameSlug = collections.find(c => slugifyName(c.name) === newSlug)
      
      if (existingWithSameSlug) {
        return NextResponse.json(
          { error: `Collection name would create duplicate URL (conflicts with "${existingWithSameSlug.name}"). Please choose a different name.` },
          { status: 400 }
        )
      }

      const newCollection: RegistrationCollection = {
        id: `col-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: name.trim(),
        enabled: Boolean(enabled),
        createdAt: new Date().toISOString(),
        display: false,
        accepting: Boolean(enabled),
      }

      collections.push(newCollection)
      const success = await saveCollections(collections)

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to create collection' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, collection: newCollection })
    } catch (error) {
      console.error('Error creating collection:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}

// PATCH - Update collection (name or enabled status)
export async function PATCH(request: NextRequest) {
  return withLock(async () => {
    const body = await request.json()
    const operationId = `PATCH-${body.id}-${Date.now()}`
    log({ tag: 'collections-api', step: 'received', operationId, id: body.id, enabled: body.enabled })

    try {
      // Environment sanity checks
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
        return NextResponse.json(
          { error: 'Supabase environment not configured' },
          { status: 500 }
        )
      }

      const adminKey = request.headers.get('x-admin-key')
      const expectedKey = process.env.ADMIN_API_KEY

      if (!adminKey || adminKey !== expectedKey) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      const { id, name, enabled, accepting, display, renewalEnabled } = body

      if (!id) {
        return NextResponse.json(
          { error: 'Collection ID is required' },
          { status: 400 }
        )
      }

      // Read collections with retry
      log({ tag: 'collections-api', step: 'read-start', operationId })
      const collections = await getCollections()
      const collectionIndex = collections.findIndex(c => c.id === id)

      if (collectionIndex === -1) {
        return NextResponse.json(
          { error: 'Collection not found' },
          { status: 404 }
        )
      }

      // Update fields if provided
      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
          return NextResponse.json(
            { error: 'Invalid collection name' },
            { status: 400 }
          )
        }
        // Check for duplicate names (excluding current collection)
        if (collections.some((c, idx) => idx !== collectionIndex && c.name.toLowerCase() === name.trim().toLowerCase())) {
          return NextResponse.json(
            { error: 'Collection with this name already exists' },
            { status: 400 }
          )
        }
        // Check for slug collisions (different names that produce same slug)
        const { slugifyName } = await import('@/lib/slug')
        const newSlug = slugifyName(name.trim())
        const existingWithSameSlug = collections.find((c, idx) => idx !== collectionIndex && slugifyName(c.name) === newSlug)
        if (existingWithSameSlug) {
          return NextResponse.json(
            { error: `Collection name would create duplicate URL (conflicts with "${existingWithSameSlug.name}"). Please choose a different name.` },
            { status: 400 }
          )
        }
        collections[collectionIndex].name = name.trim()
      }

      // Back-compat: 'enabled' now maps to 'accepting' unless 'accepting' explicitly provided
      if (enabled !== undefined && accepting === undefined) {
        const val = Boolean(enabled)
        log({ tag: 'collections-api', step: 'update-accepting-from-enabled', operationId, id, from: collections[collectionIndex].accepting, to: val })
        collections[collectionIndex].accepting = val
        // keep legacy field in sync for older clients
        collections[collectionIndex].enabled = val
      }

      if (accepting !== undefined) {
        const val = Boolean(accepting)
        log({ tag: 'collections-api', step: 'update-accepting', operationId, id, from: collections[collectionIndex].accepting, to: val })
        collections[collectionIndex].accepting = val
        collections[collectionIndex].enabled = val
      }

      if (renewalEnabled !== undefined) {
        const val = Boolean(renewalEnabled)
        log({ tag: 'collections-api', step: 'update-renewal', operationId, id, from: collections[collectionIndex].renewalEnabled, to: val })
        collections[collectionIndex].renewalEnabled = val
      }

      if (display !== undefined) {
        const val = Boolean(display)
        log({ tag: 'collections-api', step: 'update-display', operationId, id, to: val })
        if (val === true) {
          // ensure only one display=true
          for (let i = 0; i < collections.length; i++) {
            collections[i].display = (i === collectionIndex)
          }
        } else {
          collections[collectionIndex].display = false
        }
      }

      log({ tag: 'collections-api', step: 'save-start', operationId })
      const success = await saveCollections(collections)
      log({ tag: 'collections-api', step: 'save-result', operationId, success })

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to update collection' },
          { status: 500 }
        )
      }

      log({ tag: 'collections-api', step: 'done', operationId, id: collections[collectionIndex].id })
      return NextResponse.json({ success: true, collection: collections[collectionIndex] })
    } catch (error) {
      log({ tag: 'collections-api', step: 'error', operationId, error: String(error) })
      return NextResponse.json(
        { error: 'Internal server error', detail: String(error) },
        { status: 500 }
      )
    }
  })
}

// DELETE - Delete collection (and optionally its registrations)
export async function DELETE(request: NextRequest) {
  return withLock(async () => {
    try {
      const adminKey = request.headers.get('x-admin-key')
      const expectedKey = process.env.ADMIN_API_KEY

      if (!adminKey || adminKey !== expectedKey) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      const { searchParams } = new URL(request.url)
      const id = searchParams.get('id')
      const deleteRegistrations = searchParams.get('deleteRegistrations') === 'true'

      if (!id) {
        return NextResponse.json(
          { error: 'Collection ID is required' },
          { status: 400 }
        )
      }

      const collections = await getCollections()
      const collectionIndex = collections.findIndex(c => c.id === id)

      if (collectionIndex === -1) {
        return NextResponse.json(
          { error: 'Collection not found' },
          { status: 404 }
        )
      }

      // Prevent deleting last collection
      if (collections.length === 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last collection' },
          { status: 400 }
        )
      }

      const collection = collections[collectionIndex]

      // Always delete associated registrations to prevent orphaned files
      // (don't wait for explicit deleteRegistrations flag)
      try {
        const paths = await listPaths(`registrations/${collection.id}`)
        if (paths.length > 0) {
          await removePaths(paths)
          log({ tag: 'collections-api', step: 'deleted-registrations', count: paths.length, collectionId: collection.id })
        }
      } catch (err) {
        console.error('Error deleting registrations:', err)
        // Continue even if deletion fails - collection removal is more important
      }

      // Remove collection from list
      collections.splice(collectionIndex, 1)
      const success = await saveCollections(collections)

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to delete collection' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('Error deleting collection:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}
