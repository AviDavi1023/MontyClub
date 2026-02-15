import { NextRequest, NextResponse } from 'next/server'
import { readJSONFromStorage, writeJSONToStorage, listPaths } from '@/lib/supabase'
import { ClubRegistration, RegistrationCollection, Club } from '@/types/club'
import { withRegistrationLock } from '@/lib/registration-lock'
import { withSnapshotLock } from '@/lib/snapshot-lock'
import { invalidateClubsCache } from '@/lib/cache-utils'
import { withIdempotency } from '@/lib/idempotency'
import { scheduleSnapshotPublish } from '@/lib/deferred-snapshot-publish'

export const dynamic = 'force-dynamic'

async function handler(request: NextRequest, body: any) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_API_KEY

    if (!adminKey || adminKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { registrationId, collection } = body
    if (!registrationId || !collection) {
      return NextResponse.json(
        { error: 'Missing registration ID or collection ID' },
        { status: 400 }
      )
    }

    // Read the registration using collection ID as folder
    const path = `registrations/${collection}/${registrationId}.json`
    const registration: ClubRegistration | null = await readJSONFromStorage(path)

    if (!registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      )
    }

    // Update status to approved and set approvedAt timestamp
    registration.status = 'approved'
    registration.approvedAt = new Date().toISOString()

    // Save updated registration
    const success = await writeJSONToStorage(path, registration)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update registration' },
        { status: 500 }
      )
    }

    // AUTO-PUBLISH: Schedule debounced snapshot publish
    // Multiple approvals within 2 seconds result in a single publish
    // This prevents N full rebuilds from N rapid operations
    try {
      scheduleSnapshotPublish(async () => {
        await withSnapshotLock(async () => {
          try {
            console.log('[Snapshot] Auto-publishing catalog after registration approval...')
            
            // Get the display collection - read directly from Supabase for consistency
            const collectionsData = await readJSONFromStorage('settings/registration-collections.json')
            const collections: RegistrationCollection[] = Array.isArray(collectionsData) ? collectionsData : []
            const displayCollection = collections.find(c => c.display) || collections.find(c => c.enabled)
            
            if (!displayCollection) {
              console.warn('[Snapshot] No display collection found for snapshot')
              return
            }

            // List and read all registrations
            const regPaths = await listPaths(`registrations/${displayCollection.id}`)
            const jsonPaths = regPaths.filter(p => p.endsWith('.json'))
            
            const registrationPromises = jsonPaths.map(path => readJSONFromStorage(path))
            const allRegs = await Promise.all(registrationPromises)
            
            const registrations: ClubRegistration[] = allRegs.filter(
              reg => reg && typeof reg === 'object' && reg.status === 'approved'
            )

            // Sort by approvedAt (newest first)
            registrations.sort((a, b) => {
              const timeA = a.approvedAt ? new Date(a.approvedAt).getTime() : new Date(a.submittedAt).getTime()
              const timeB = b.approvedAt ? new Date(b.approvedAt).getTime() : new Date(b.submittedAt).getTime()
              return timeB - timeA
            })

            // Map to Club objects
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

            // Create snapshot
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

            // Write snapshot
            const success = await writeJSONToStorage('settings/clubs-snapshot.json', snapshot)
            
            if (success) {
              console.log(`[Snapshot] ✅ Auto-published ${clubs.length} clubs`)
              // CRITICAL: Invalidate cache INSIDE lock, AFTER successful write
              // This prevents race where cache is cleared but new snapshot isn't written yet
              invalidateClubsCache()
              console.log('[Cache] ✅ Invalidated after successful snapshot publish')
            } else {
              console.error('[Snapshot] ❌ Failed to write snapshot file')
              throw new Error('Snapshot write failed')
            }
          } catch (err) {
            console.error('[Snapshot] ❌ Error auto-publishing:', err)
            throw err // Re-throw so cache isn't invalidated
          }
        })
      })
    } catch (err) {
      console.error('[Snapshot] ❌ Error scheduling snapshot publish:', err)
      // Don't fail the approval if publish scheduling fails
      // The publish can be retriggered manually
    }

    return NextResponse.json({ 
      success: true,
      message: 'Registration approved'
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    })
  } catch (error) {
    console.error('Error approving registration:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { registrationId, collection } = body
  if (!registrationId || !collection) {
    return NextResponse.json(
      { error: 'Missing registration ID or collection ID' },
      { status: 400 }
    )
  }
  const path = `registrations/${collection}/${registrationId}.json`
  
  // Wrap handler with idempotency, then apply registration lock
  const withLock = (req: NextRequest) => withRegistrationLock(path, () => handler(req, body))
  return withIdempotency<any>(withLock)(request)
}
