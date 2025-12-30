import { NextRequest, NextResponse } from 'next/server'
import { writeJSONToStorage, readJSONFromStorage, listPaths } from '@/lib/supabase'
import { ClubRegistration, RegistrationCollection, Club } from '@/types/club'
import { invalidateClubsCache } from '@/lib/cache-utils'

export const dynamic = 'force-dynamic'

/**
 * Admin endpoint to publish a static catalog snapshot
 * Generates clubs-snapshot.json from approved registrations
 * This provides instant loading without scanning 100+ registration files
 */
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

    console.log('[Publish Catalog] Starting catalog generation...')

    // Verify Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Publish Catalog] Supabase not configured properly')
      return NextResponse.json(
        { error: 'Supabase storage not configured. Check environment variables.' },
        { status: 500 }
      )
    }

    // 1. Get the display collection
    const collections: RegistrationCollection[] = await readJSONFromStorage('settings/registration-collections.json') || []
    const displayCollection = collections.find(c => c.display) || collections.find(c => c.enabled)
    
    if (!displayCollection) {
      return NextResponse.json(
        { error: 'No display collection found' },
        { status: 400 }
      )
    }

    console.log(`[Publish Catalog] Using collection: ${displayCollection.name}`)

    // 2. List and read all registrations (same logic as fetchClubsFromCollection)
    const regPaths = await listPaths(`registrations/${displayCollection.id}`)
    const jsonPaths = regPaths.filter(p => p.endsWith('.json'))
    
    console.log(`[Publish Catalog] Found ${jsonPaths.length} registration files`)

    const registrationPromises = jsonPaths.map(path => readJSONFromStorage(path))
    const allRegs = await Promise.all(registrationPromises)
    
    const registrations: ClubRegistration[] = allRegs.filter(
      reg => reg && typeof reg === 'object' && reg.status === 'approved'
    )

    console.log(`[Publish Catalog] Found ${registrations.length} approved registrations`)

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
      return NextResponse.json(
        { 
          error: 'Failed to write snapshot to storage', 
          detail: 'Check server logs and verify Supabase bucket permissions for club-data bucket'
        },
        { status: 500 }
      )
    }

    // 7. Invalidate in-memory cache so next request uses snapshot
    invalidateClubsCache()

    console.log(`[Publish Catalog] Successfully published ${clubs.length} clubs`)

    return NextResponse.json({
      success: true,
      message: `Catalog published successfully`,
      clubCount: clubs.length,
      generatedAt: snapshot.metadata.generatedAt,
    })
  } catch (error) {
    console.error('[Publish Catalog] Error:', error)
    return NextResponse.json(
      { error: 'Failed to publish catalog', detail: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check snapshot status
 */
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
