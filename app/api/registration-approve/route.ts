import { NextRequest, NextResponse } from 'next/server'
import { readJSONFromStorage, writeJSONToStorage, listPaths } from '@/lib/supabase'
import { ClubRegistration, RegistrationCollection, Club } from '@/types/club'
import { withRegistrationLock } from '@/lib/registration-lock'
import { withSnapshotLock } from '@/lib/snapshot-lock'
import { invalidateClubsCache } from '@/lib/cache-utils'
import { readData } from '@/lib/runtime-store'
import { withIdempotency } from '@/lib/idempotency'

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

    // AUTO-PUBLISH: Update snapshot with lock to prevent races
    // CRITICAL: Invalidate cache INSIDE the lock BEFORE writing to prevent race
    // This ensures no request can read stale cache after new snapshot exists
    let snapshotPublishFailed = false
    try {
      await withSnapshotLock(async () => {
        try {
          console.log('[Snapshot] Auto-publishing catalog after registration approval...')
          
          // STEP 1: Invalidate cache FIRST (inside lock, before snapshot write)
          // This prevents the race where a request reads stale cache after snapshot is written
          console.log('[Cache] Invalidating cache BEFORE snapshot publish (inside lock)')
          invalidateClubsCache()
          
          // STEP 2: Get the display collection
          const collections: RegistrationCollection[] = await readData('settings/registration-collections', [])
          const displayCollection = collections.find(c => c.display) || collections.find(c => c.enabled)
          
          if (!displayCollection) {
            console.warn('[Snapshot] No display collection found for snapshot')
            throw new Error('No display collection configured')
          }

          // STEP 3: List and read all registrations
          const regPaths = await listPaths(`registrations/${displayCollection.id}`)
          const jsonPaths = regPaths.filter(p => p.endsWith('.json'))
          
          const registrationPromises = jsonPaths.map(path => readJSONFromStorage(path))
          const allRegs = await Promise.all(registrationPromises)
          
          const registrations: ClubRegistration[] = allRegs.filter(
            reg => reg && typeof reg === 'object' && reg.status === 'approved'
          )

          // STEP 4: Sort by approvedAt (newest first)
          registrations.sort((a, b) => {
            const timeA = a.approvedAt ? new Date(a.approvedAt).getTime() : new Date(a.submittedAt).getTime()
            const timeB = b.approvedAt ? new Date(b.approvedAt).getTime() : new Date(b.submittedAt).getTime()
            return timeB - timeA
          })

          // STEP 5: Map to Club objects
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

          // STEP 6: Create snapshot
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

          // STEP 7: Write snapshot
          const success = await writeJSONToStorage('settings/clubs-snapshot.json', snapshot)
          
          if (!success) {
            console.error('[Snapshot] ❌ Failed to write snapshot file')
            throw new Error('Snapshot write failed')
          }
          
          console.log(`[Snapshot] ✅ Auto-published ${clubs.length} clubs`)
        } catch (err) {
          console.error('[Snapshot] ❌ Error auto-publishing:', err)
          snapshotPublishFailed = true
          throw err // Re-throw to mark as failed
        }
      })
    } catch (err) {
      console.error('[Snapshot] ❌ Error in snapshot publish:', err)
      // Mark registration in storage for retry on next admin panel load
      try {
        const failedPublishes = await readData('failed-snapshot-publishes', [])
        failedPublishes.push({
          registrationId,
          collectionId: collection,
          timestamp: new Date().toISOString(),
          error: String(err)
        })
        await writeData('failed-snapshot-publishes', failedPublishes.slice(-50)) // Keep last 50
        console.log('[Snapshot] Queued for retry on next admin login')
      } catch (queueErr) {
        console.error('[Snapshot] Failed to queue for retry:', queueErr)
      }
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
