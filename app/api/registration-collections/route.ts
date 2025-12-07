import { NextRequest, NextResponse } from 'next/server'
import { readJSONFromStorage, writeJSONToStorage, listPaths, removePaths } from '@/lib/supabase'
import { RegistrationCollection } from '@/types/club'

export const dynamic = 'force-dynamic'

const COLLECTIONS_PATH = 'settings/registration-collections.json'

// In-memory cache to avoid eventual consistency issues with Supabase Storage
// This cache is the source of truth for PATCH operations
let collectionsCache: RegistrationCollection[] | null = null
let cacheTimestamp = 0

// Simple in-memory lock to prevent concurrent writes
let updateLock: Promise<void> = Promise.resolve()

async function getCollections(): Promise<RegistrationCollection[]> {
  const data = await readJSONFromStorage(COLLECTIONS_PATH)
  if (!data || !Array.isArray(data)) {
    // Return empty array on read failure - do NOT create default collection
    // This prevents the "default fallback" from overwriting real data during eventual consistency delays
    // Default collections should only be created explicitly during initial setup
    return []
  }
  // Update cache whenever we read from storage
  collectionsCache = data
  cacheTimestamp = Date.now()
  return data
}

async function saveCollections(collections: RegistrationCollection[]): Promise<boolean> {
  // Retry saves to tolerate transient storage latency
  for (let attempt = 0; attempt < 3; attempt++) {
    const ok = await writeJSONToStorage(COLLECTIONS_PATH, collections)
    if (ok) {
      // Update cache on successful write
      collectionsCache = collections
      cacheTimestamp = Date.now()
      return true
    }
    // small backoff
    await new Promise(r => setTimeout(r, 150 * (attempt + 1)))
  }
  return false
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

    // Use cache if it's fresh (less than 10 seconds old) to avoid eventual consistency issues
    // This ensures rapid GET requests after PATCH operations return the latest state
    const CACHE_MAX_AGE_MS = 10000
    let collections: RegistrationCollection[]
    
    if (collectionsCache !== null && (Date.now() - cacheTimestamp) < CACHE_MAX_AGE_MS) {
      try { console.log(JSON.stringify({ tag: 'collections-get', step: 'cache-hit', cacheAge: Date.now() - cacheTimestamp })) } catch {}
      collections = collectionsCache
    } else {
      try { console.log(JSON.stringify({ tag: 'collections-get', step: 'cache-miss', cacheExists: !!collectionsCache, cacheAge: collectionsCache ? Date.now() - cacheTimestamp : null })) } catch {}
      collections = await getCollections()
      
      // Only create default collection if database is truly empty (not just read failure)
      // This prevents overwriting data during eventual consistency delays
      if (collections.length === 0) {
        const defaultCollection: RegistrationCollection = {
          id: `col-${Date.now()}`,
          name: `${new Date().getFullYear()} Club Requests`,
          enabled: true,
          createdAt: new Date().toISOString()
        }
        const ok = await saveCollections([defaultCollection])
        if (ok) {
          collections = [defaultCollection]
        }
      }
    }
    
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

    // Check for duplicate names
    if (collections.some(c => c.name.toLowerCase() === name.trim().toLowerCase())) {
      return NextResponse.json(
        { error: 'Collection with this name already exists' },
        { status: 400 }
      )
    }

    const newCollection: RegistrationCollection = {
      id: `col-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: name.trim(),
      enabled: Boolean(enabled),
      createdAt: new Date().toISOString()
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
}

// PATCH - Update collection (name or enabled status)
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const operationId = `PATCH-${body.id}-${Date.now()}`
  try { console.log(JSON.stringify({ tag: 'collections-api', step: 'received', operationId, id: body.id, enabled: body.enabled })) } catch {}
  
  // Serialize PATCH operations to prevent lost updates from concurrent requests
  const currentOperation = updateLock.then(async () => {
    try { console.log(JSON.stringify({ tag: 'collections-api', step: 'lock-acquired', operationId })) } catch {}
    try {
      // Environment sanity checks
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
        return NextResponse.json(
          { error: 'Supabase environment not configured', detail: { url: !!process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY, anon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY } },
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

      // Use already-read body from outer scope to avoid double-read errors
      const { id, name, enabled } = body

      if (!id) {
        return NextResponse.json(
          { error: 'Collection ID is required' },
          { status: 400 }
        )
      }

      // Use in-memory cache as source of truth to avoid eventual consistency issues
      // The cache is updated synchronously after each successful write
      let collections: RegistrationCollection[]
      
      try { console.log(JSON.stringify({ tag: 'collections-api', step: 'read-start', operationId, cacheAge: collectionsCache ? Date.now() - cacheTimestamp : null })) } catch {}
      
      if (collectionsCache !== null) {
        // Use cached version to avoid storage read-after-write consistency issues
        collections = JSON.parse(JSON.stringify(collectionsCache)) // Deep clone
        try { console.log(JSON.stringify({ tag: 'collections-api', step: 'read-cache', operationId, collections: collections.map(c => ({ id: c.id, enabled: c.enabled })) })) } catch {}
      } else {
        // Cache not initialized - read from storage with retry logic
        const maxRetries = 5
        const retryDelay = 300 // ms
        collections = []
        let collectionIndex = -1
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          collections = await getCollections()
          try { console.log(JSON.stringify({ tag: 'collections-api', step: 'read-storage', attempt: attempt + 1, operationId, collections: collections.map(c => ({ id: c.id, enabled: c.enabled })) })) } catch {}
          collectionIndex = collections.findIndex(c => c.id === id)
          
          if (collectionIndex !== -1) break
          
          // If not found and not last attempt, wait before retry
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
          }
        }
      }
      
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
        collections[collectionIndex].name = name.trim()
      }

      if (enabled !== undefined) {
        try { console.log(JSON.stringify({ tag: 'collections-api', step: 'update', operationId, id: body.id, from: collections[collectionIndex].enabled, to: Boolean(enabled) })) } catch {}
        collections[collectionIndex].enabled = Boolean(enabled)
      }
      try { console.log(JSON.stringify({ tag: 'collections-api', step: 'save-start', operationId, collections: collections.map(c => ({ id: c.id, enabled: c.enabled })) })) } catch {}
      const success = await saveCollections(collections)
      try { console.log(JSON.stringify({ tag: 'collections-api', step: 'save-result', operationId, success })) } catch {}

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to update collection', detail: 'storage-write-failed' },
          { status: 500 }
        )
      }

      try { console.log(JSON.stringify({ tag: 'collections-api', step: 'done', operationId, id: collections[collectionIndex].id, enabled: collections[collectionIndex].enabled })) } catch {}
      return NextResponse.json({ success: true, collection: collections[collectionIndex] })
    } catch (error) {
      try { console.log(JSON.stringify({ tag: 'collections-api', step: 'error', operationId, error: String(error) })) } catch {}
      return NextResponse.json(
        { error: 'Internal server error', detail: String(error) },
        { status: 500 }
      )
    }
  })

  // Update the lock to point to this operation
  updateLock = currentOperation.then(() => {
    try { console.log(JSON.stringify({ tag: 'collections-api', step: 'lock-released', operationId })) } catch {}
  }).catch(() => {})
  
  return currentOperation
}

// DELETE - Delete collection (and optionally its registrations)
export async function DELETE(request: NextRequest) {
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

    // Delete associated registrations if requested
    if (deleteRegistrations) {
      try {
        const paths = await listPaths(`registrations/${collection.id}`)
        if (paths.length > 0) {
          await removePaths(paths)
        }
      } catch (err) {
        console.error('Error deleting registrations:', err)
        // Continue even if deletion fails
      }
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
}
