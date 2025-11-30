import { NextRequest, NextResponse } from 'next/server'
import { readJSONFromStorage, writeJSONToStorage, listPaths, removePaths } from '@/lib/supabase'
import { RegistrationCollection } from '@/types/club'

export const dynamic = 'force-dynamic'

const COLLECTIONS_PATH = 'settings/registration-collections.json'

// Simple in-memory lock to prevent concurrent writes
let updateLock: Promise<void> = Promise.resolve()

async function getCollections(): Promise<RegistrationCollection[]> {
  const data = await readJSONFromStorage(COLLECTIONS_PATH)
  if (!data || !Array.isArray(data)) {
    // Create default collection if none exist
    const defaultCollection: RegistrationCollection = {
      id: `col-${Date.now()}`,
      name: `${new Date().getFullYear()} Club Requests`,
      enabled: true,
      createdAt: new Date().toISOString()
    }
    await writeJSONToStorage(COLLECTIONS_PATH, [defaultCollection])
    return [defaultCollection]
  }
  return data
}

async function saveCollections(collections: RegistrationCollection[]): Promise<boolean> {
  return await writeJSONToStorage(COLLECTIONS_PATH, collections)
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
    
    // Sort by creation date (newest first)
    collections.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json({ collections })
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
  console.log(`[${operationId}] 🔵 PATCH request received for collection:`, body.id, 'enabled:', body.enabled)
  
  // Serialize PATCH operations to prevent lost updates from concurrent requests
  const currentOperation = updateLock.then(async () => {
    console.log(`[${operationId}] 🟢 PATCH executing (lock acquired)`)
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
      const { id, name, enabled } = body

      if (!id) {
        return NextResponse.json(
          { error: 'Collection ID is required' },
          { status: 400 }
        )
      }

      // Retry logic to handle eventual consistency from Supabase storage
      let collections: RegistrationCollection[] = []
      let collectionIndex = -1
      const maxRetries = 3
      const retryDelay = 200 // ms
      
      console.log(`[${operationId}] 📖 Reading collections from storage...`)
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        collections = await getCollections()
        console.log(`[${operationId}] 📚 Collections read (attempt ${attempt + 1}):`, collections.map(c => ({ id: c.id, name: c.name, enabled: c.enabled })))
        collectionIndex = collections.findIndex(c => c.id === body.id)
        
        if (collectionIndex !== -1) break
        
        // If not found and not last attempt, wait before retry
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
        }
      }

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
        console.log(`[${operationId}] ✏️  Updating collection ${body.id} enabled: ${collections[collectionIndex].enabled} -> ${Boolean(enabled)}`)
        collections[collectionIndex].enabled = Boolean(enabled)
      }

      console.log(`[${operationId}] 💾 Saving collections to storage:`, collections.map(c => ({ id: c.id, enabled: c.enabled })))
      const success = await saveCollections(collections)
      console.log(`[${operationId}] ${success ? '✅' : '❌'} Save result:`, success)

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to update collection' },
          { status: 500 }
        )
      }

      console.log(`[${operationId}] 🎉 PATCH completed successfully for collection:`, collections[collectionIndex].id, 'enabled:', collections[collectionIndex].enabled)
      return NextResponse.json({ success: true, collection: collections[collectionIndex] })
    } catch (error) {
      console.error(`[${operationId}] ❌ Error updating collection:`, error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })

  // Update the lock to point to this operation
  updateLock = currentOperation.then(() => {
    console.log(`[${operationId}] 🔓 PATCH lock released`)
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
