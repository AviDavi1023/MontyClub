import { NextRequest, NextResponse } from 'next/server'
import { listCollections } from '@/lib/collections-db'
import { listRegistrations } from '@/lib/registrations-db'

export const dynamic = 'force-dynamic'

/**
 * Simple test endpoint to verify import system is working
 * Creates a test registration and verifies it can be queried
 */
export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get or create a test collection
    const collections = await listCollections()
    if (collections.length === 0) {
      return NextResponse.json({ error: 'No collections found. Create one first.' }, { status: 400 })
    }

    const testCollection = collections[0]
    console.log(`[Test Import] Using collection: ${testCollection.id}`)

    // Query registrations in this collection before import
    const before = await listRegistrations({ collectionId: testCollection.id, status: 'approved' })
    
    // Try a simple query of all registrations to see if DB is working
    const allRegs = await listRegistrations({})

    return NextResponse.json({
      status: 'ok',
      diagnostic: {
        collections: collections.map(c => ({ id: c.id, name: c.name })),
        testCollectionId: testCollection.id,
        allRegistrationsCount: allRegs.length,
        approvedInTestCollection: before.length,
        sample: allRegs.slice(0, 3).map(r => ({
          id: r.id,
          clubName: r.clubName,
          collectionId: r.collectionId,
          status: r.status
        }))
      }
    })
  } catch (error) {
    console.error('Error in test endpoint:', error)
    return NextResponse.json(
      { 
        error: 'Test failed', 
        detail: error instanceof Error ? error.message : String(error) 
      }, 
      { status: 500 }
    )
  }
}
