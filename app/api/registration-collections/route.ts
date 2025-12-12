import { NextRequest, NextResponse } from 'next/server'
import { readJSONFromStorage, writeJSONToStorage, listPaths, removePaths } from '@/lib/supabase'
import { RegistrationCollection } from '@/types/club'

export const dynamic = 'force-dynamic'

const COLLECTIONS_PATH = 'settings/registration-collections.json'
const DEBUG = process.env.NODE_ENV === 'development'

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

async function getCollections(): Promise<RegistrationCollection[]> {
  const data = await readJSONFromStorage(COLLECTIONS_PATH)
  if (!data || !Array.isArray(data)) {
    return []
  }
  return data
}

async function saveCollections(collections: RegistrationCollection[]): Promise<boolean> {
  try {
    await withRetry(() => writeJSONToStorage(COLLECTIONS_PATH, collections), 3, 100)
    return true
  } catch {
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

    const { id, name, enabled } = body

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
      collections[collectionIndex].name = name.trim()
    }

    if (enabled !== undefined) {
      log({ tag: 'collections-api', step: 'update', operationId, id, from: collections[collectionIndex].enabled, to: Boolean(enabled) })
      collections[collectionIndex].enabled = Boolean(enabled)
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
