import { NextRequest, NextResponse } from 'next/server'
import { writeJSONToStorage, readJSONFromStorage } from '@/lib/supabase'
import { Club } from '@/types/club'
import { invalidateClubsCache } from '@/lib/cache-utils'
import { withSnapshotLock } from '@/lib/snapshot-lock'
import { listCollections, ensureSingleDisplay } from '@/lib/collections-db'
import { listRegistrations } from '@/lib/registrations-db'

export const dynamic = 'force-dynamic'

/**
 * Admin endpoint to publish a static catalog snapshot
 * Generates clubs-snapshot.json from approved registrations in Postgres
 * This provides instant loading without scanning 100+ registration files
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Publish Catalog] Starting catalog generation...')

    // Verify Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Publish Catalog] Supabase not configured properly')
      return NextResponse.json(
        { error: 'Supabase storage not configured. Check environment variables.' },
        { status: 500 }
      )
    }

    // Wrap entire publish in snapshot lock to prevent concurrent publishes
    return await withSnapshotLock(async () => {
      // 1. Get collections from Postgres
      const collections = await listCollections()
      console.log(`[Publish Catalog] Found ${collections.length} collections`, collections.map(c => ({ id: c.id, name: c.name, display: c.display })))
      
      let displayCollection = collections.find(c => c.display)
      
      // If no collection marked as display, auto-set the first one
      if (!displayCollection && collections.length > 0) {
        console.log(`[Publish Catalog] No display collection found. Auto-setting first collection as display.`)
        await ensureSingleDisplay(collections[0].id)
        displayCollection = collections[0]
        displayCollection.display = true
      }
      
      if (!displayCollection) {
        throw new Error('No collections found. Create a collection first.')
      }

      console.log(`[Publish Catalog] Using collection: ${displayCollection.name}`)

      // 2. Get approved registrations from Postgres for this collection
      console.log(`[Publish Catalog] Querying registrations with collectionId: ${displayCollection.id} (type: ${typeof displayCollection.id})`)
      const registrations = await listRegistrations({ 
        collectionId: displayCollection.id,
        status: 'approved'
      })

      console.log(`[Publish Catalog] Found ${registrations.length} approved registrations`)
      if (registrations.length === 0) {
        // Debug: fetch ALL registrations to see what's in the DB
        const allRegs = await listRegistrations({})
        console.log(`[Publish Catalog] DEBUG: Total registrations in DB: ${allRegs.length}`)
        const otherCollectionRegs = allRegs.filter(r => r.collectionId !== displayCollection.id)
        console.log(`[Publish Catalog] DEBUG: Registrations in other collections: ${otherCollectionRegs.length}`)
        const thisCollectionRegs = allRegs.filter(r => r.collectionId === displayCollection.id)
        console.log(`[Publish Catalog] DEBUG: Registrations in THIS collection: ${thisCollectionRegs.length}`)
        if (thisCollectionRegs.length > 0) {
          console.log(`[Publish Catalog] DEBUG: Statuses in this collection: ${JSON.stringify(thisCollectionRegs.map(r => r.status))}`)
        }
      }

      // 3. Sort by approvedAt (newest first)
      registrations.sort((a, b) => {
        const timeA = a.approvedAt ? new Date(a.approvedAt).getTime() : new Date(a.submittedAt).getTime()
        const timeB = b.approvedAt ? new Date(b.approvedAt).getTime() : new Date(b.submittedAt).getTime()
        return timeB - timeA
      })

      // 4. Map to Club objects
      const clubs: Club[] = registrations.map((r) => ({
        id: r.id,
        name: r.clubName,
        category: r.category || '',
        description: r.statementOfPurpose,
        advisor: r.advisorName,
        studentLeader: r.studentContactName,
        meetingTime: r.meetingDay,
        meetingFrequency: r.meetingFrequency,
        location: r.location,
        contact: r.studentContactEmail,
        socialMedia: r.socialMedia || '',
        active: true,
        notes: r.notes || '',
        announcement: '',
        keywords: [],
      }))

      // 5. Create snapshot with metadata
      const snapshot = {
        clubs,
        metadata: {
          generatedAt: new Date().toISOString(),
          collectionId: displayCollection.id,
          collectionName: displayCollection.name,
          clubCount: clubs.length,
          version: 1,
        }
      }

      // 6. Write snapshot to Supabase Storage
      const success = await writeJSONToStorage('settings/clubs-snapshot.json', snapshot)

      if (!success) {
        console.error('[Publish Catalog] Failed to write snapshot. Check Supabase bucket permissions.')
        throw new Error('Failed to write snapshot to storage')
      }

      // 7. Invalidate in-memory cache INSIDE lock so next request uses snapshot
      invalidateClubsCache()
      console.log('[Cache] ✅ Invalidated after successful snapshot publish')

      console.log(`[Publish Catalog] Successfully published ${clubs.length} clubs`)

      return NextResponse.json({
        success: true,
        message: `Catalog published successfully`,
        clubCount: clubs.length,
        generatedAt: snapshot.metadata.generatedAt,
      })
    })
  } catch (error) {
    console.error('[Publish Catalog] Error:', error)
    return NextResponse.json(
      { error: 'Failed to publish catalog', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check snapshot status
 */
export async function GET(request: NextRequest) {
  try {
    const snapshot = await readJSONFromStorage('settings/clubs-snapshot.json')
    
    if (!snapshot || !snapshot.metadata) {
      return NextResponse.json({
        exists: false,
        message: 'No published catalog found'
      })
    }

    return NextResponse.json({
      exists: true,
      ...snapshot.metadata
    })
  } catch (error) {
    console.error('[Publish Catalog] Error checking status:', error)
    return NextResponse.json(
      { error: 'Failed to check snapshot status' },
      { status: 500 }
    )
  }
}

