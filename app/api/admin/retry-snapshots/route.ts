import { NextRequest, NextResponse } from 'next/server'
import { readData, writeData } from '@/lib/runtime-store'
import { writeJSONToStorage, readJSONFromStorage, listPaths } from '@/lib/supabase'
import { ClubRegistration, RegistrationCollection, Club } from '@/types/club'
import { withSnapshotLock } from '@/lib/snapshot-lock'
import { invalidateClubsCache } from '@/lib/cache-utils'

export const dynamic = 'force-dynamic'

/**
 * POST: Retry failed snapshot publishes
 * Processes queue of failed snapshot attempts
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

    // Get failed publish queue
    const failedPublishes = await readData('failed-snapshot-publishes', [])
    
    if (failedPublishes.length === 0) {
      return NextResponse.json({
        success: true,
        retried: 0,
        message: 'No failed snapshots to retry'
      })
    }

    console.log(`[Retry Snapshots] Found ${failedPublishes.length} failed publishes, retrying...`)

    let retriedCount = 0
    const stillFailed: any[] = []

    // Try to publish snapshot once (don't retry individual registrations)
    try {
      await withSnapshotLock(async () => {
        console.log('[Retry Snapshots] Attempting snapshot publish...')
        
        // Invalidate cache first
        invalidateClubsCache()
        
        // Get the display collection
        const collections: RegistrationCollection[] = await readData('settings/registration-collections', [])
        const displayCollection = collections.find(c => c.display) || collections.find(c => c.enabled)
        
        if (!displayCollection) {
          throw new Error('No display collection configured')
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
            retriedFrom: failedPublishes.length,
          }
        }

        // Write snapshot
        const success = await writeJSONToStorage('settings/clubs-snapshot.json', snapshot)
        
        if (!success) {
          throw new Error('Snapshot write failed')
        }
        
        console.log(`[Retry Snapshots] ✅ Successfully published ${clubs.length} clubs`)
        retriedCount = failedPublishes.length
      })

      // Success - clear the queue
      await writeData('failed-snapshot-publishes', [])
      
    } catch (error) {
      console.error('[Retry Snapshots] ❌ Retry failed:', error)
      // Keep the queue for next retry
      stillFailed.push(...failedPublishes)
    }

    // Update queue with remaining failed items
    if (stillFailed.length > 0) {
      await writeData('failed-snapshot-publishes', stillFailed)
    }

    return NextResponse.json({
      success: retriedCount > 0,
      retried: retriedCount,
      stillPending: stillFailed.length,
      message: retriedCount > 0 
        ? `Successfully retried ${retriedCount} snapshot publishes`
        : `Retry failed, ${stillFailed.length} still pending`
    })
    
  } catch (error) {
    console.error('[Retry Snapshots] Error:', error)
    return NextResponse.json(
      { error: 'Failed to retry snapshots', detail: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET: Check failed snapshot queue status
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

    const failedPublishes = await readData('failed-snapshot-publishes', [])
    
    return NextResponse.json({
      count: failedPublishes.length,
      items: failedPublishes,
    })
    
  } catch (error) {
    console.error('[Retry Snapshots] Error checking queue:', error)
    return NextResponse.json(
      { error: 'Failed to check retry queue' },
      { status: 500 }
    )
  }
}
