import { NextRequest, NextResponse } from 'next/server'
import { RegistrationCollection } from '@/types/club'
import { listCollections, getCollectionById, createCollection, updateCollection, deleteCollection, ensureSingleDisplay } from '@/lib/collections-db'
import { listRegistrations, deleteRegistration } from '@/lib/registrations-db'

export const dynamic = 'force-dynamic'

/**
 * GET - List all collections from Postgres
 * Instant consistency - no retries or eventual consistency handling needed
 */
export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_API_KEY

    if (!expectedKey) {
      console.error('[Collections GET] CRITICAL: ADMIN_API_KEY not configured')
      return NextResponse.json({ error: 'Server not configured: ADMIN_API_KEY not set' }, { status: 500 })
    }

    if (!adminKey || adminKey !== expectedKey) {
      console.warn('[Collections GET] Unauthorized request - invalid or missing API key')
      return NextResponse.json({ error: 'Unauthorized. Please re-enter your API key after factory reset.' }, { status: 401 })
    }

    const collections = await listCollections()
    const sorted = [...collections].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json({ collections: sorted })
  } catch (error) {
    console.error('Error fetching collections:', error)
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 })
  }
}

/**
 * POST - Create new collection in Postgres
 * Instant consistency means collection is immediately available for other operations
 */
export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_API_KEY

    if (!expectedKey) {
      console.error('[Collections POST] CRITICAL: ADMIN_API_KEY not configured')
      return NextResponse.json({ error: 'Server not configured: ADMIN_API_KEY not set' }, { status: 500 })
    }

    if (!adminKey || adminKey !== expectedKey) {
      console.warn('[Collections POST] Unauthorized request - invalid or missing API key')
      return NextResponse.json({ error: 'Unauthorized. Please re-enter your API key after factory reset.' }, { status: 401 })
    }

    const body = await request.json()
    const { name, enabled = false } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Collection name is required' }, { status: 400 })
    }

    const collections = await listCollections()

    // Check for duplicate names
    if (collections.some(c => c.name.toLowerCase() === name.trim().toLowerCase())) {
      return NextResponse.json({ error: 'Collection with this name already exists' }, { status: 400 })
    }

    // Check for slug collisions
    const { slugifyName } = await import('@/lib/slug')
    const newSlug = slugifyName(name.trim())
    if (collections.some(c => slugifyName(c.name) === newSlug)) {
      return NextResponse.json({ error: 'Collection name would create duplicate URL. Please choose a different name.' }, { status: 400 })
    }

    const newCollection: RegistrationCollection = {
      id: `col-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: name.trim(),
      enabled: Boolean(enabled),
      createdAt: new Date().toISOString(),
      display: false,
      accepting: false,
      renewalEnabled: false,
    }

    await createCollection(newCollection)
    return NextResponse.json({ success: true, collection: newCollection })
  } catch (error) {
    console.error('Error creating collection:', error)
    return NextResponse.json({ error: 'Internal server error', detail: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

/**
 * PATCH - Update collection in Postgres
 * All changes are instant - no eventual consistency needed
 */
export async function PATCH(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_API_KEY

    if (!expectedKey) {
      console.error('[Collections PATCH] CRITICAL: ADMIN_API_KEY not configured')
      return NextResponse.json({ error: 'Server not configured: ADMIN_API_KEY not set' }, { status: 500 })
    }

    if (!adminKey || adminKey !== expectedKey) {
      console.warn('[Collections PATCH] Unauthorized request - invalid or missing API key')
      return NextResponse.json({ error: 'Unauthorized. Please re-enter your API key after factory reset.' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, enabled, accepting, display, renewalEnabled } = body

    if (!id) {
      return NextResponse.json({ error: 'Collection ID is required' }, { status: 400 })
    }

    const collection = await getCollectionById(id)
    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    const updates: Partial<RegistrationCollection> = {}

    if (name !== undefined) {
      const trimmed = String(name).trim()
      if (trimmed !== collection.name) {
        const collections = await listCollections()
        if (collections.some(c => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase())) {
          return NextResponse.json({ error: 'Collection with this name already exists' }, { status: 400 })
        }

        const { slugifyName } = await import('@/lib/slug')
        if (collections.some(c => c.id !== id && slugifyName(c.name) === slugifyName(trimmed))) {
          return NextResponse.json({ error: 'Collection name would create duplicate URL' }, { status: 400 })
        }
      }
      updates.name = trimmed
    }

    if (enabled !== undefined) updates.enabled = Boolean(enabled)
    if (accepting !== undefined) updates.accepting = Boolean(accepting)
    if (renewalEnabled !== undefined) updates.renewalEnabled = Boolean(renewalEnabled)

    if (display !== undefined && display === true) {
      await ensureSingleDisplay(id)
      updates.display = true
    } else if (display !== undefined) {
      updates.display = Boolean(display)
    }

    await updateCollection(id, updates)
    const updated = await getCollectionById(id)

    return NextResponse.json({ success: true, collection: updated })
  } catch (error) {
    console.error('Error updating collection:', error)
    return NextResponse.json({ error: 'Failed to update collection', detail: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

/**
 * DELETE - Remove collection and optionally its registrations
 * Instant cleanup in Postgres - no eventual consistency delays
 */
export async function DELETE(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_API_KEY

    if (!expectedKey) {
      console.error('[Collections DELETE] CRITICAL: ADMIN_API_KEY not configured')
      return NextResponse.json({ error: 'Server not configured: ADMIN_API_KEY not set' }, { status: 500 })
    }

    if (!adminKey || adminKey !== expectedKey) {
      console.warn('[Collections DELETE] Unauthorized request - invalid or missing API key')
      return NextResponse.json({ error: 'Unauthorized. Please re-enter your API key after factory reset.' }, { status: 401 })
    }

    const url = new URL(request.url)
    const collectionId = url.searchParams.get('id')
    const deleteRegistrations = url.searchParams.get('deleteRegistrations') !== 'false'

    if (!collectionId) {
      return NextResponse.json({ error: 'Collection ID required' }, { status: 400 })
    }

    const collection = await getCollectionById(collectionId)
    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    // Delete registrations if requested
    if (deleteRegistrations) {
      const registrations = await listRegistrations({ collectionId })
      for (const reg of registrations) {
        await deleteRegistration(reg.id)
      }
    }

    // Delete collection itself
    await deleteCollection(collectionId)

    return NextResponse.json({ success: true, message: 'Collection deleted successfully' })
  } catch (error) {
    console.error('Error deleting collection:', error)
    return NextResponse.json({ error: 'Failed to delete collection', detail: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
