import { NextRequest, NextResponse } from 'next/server'
import { readJSONFromStorage, writeJSONToStorage } from '@/lib/supabase'
import { Club } from '@/types/club'
import { listCollections } from '@/lib/collections-db'
import { listRegistrations } from '@/lib/registrations-db'
import { withSnapshotLock } from '@/lib/snapshot-lock'
import { invalidateClubsCache } from '@/lib/cache-utils'

export const dynamic = 'force-dynamic'

/**
 * GET: Check snapshot status (exists, timestamp, club count)
 * POST: Manually trigger snapshot publish using Postgres data
 */

export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_API_KEY

    if (!expectedKey) {
      console.error('[SnapshotStatus] CRITICAL: ADMIN_API_KEY not configured')
      return NextResponse.json(
        { error: 'Server not configured: ADMIN_API_KEY not set' },
        { status: 500 }
      )
    }

    if (!adminKey || adminKey !== expectedKey) {
      console.warn('[SnapshotStatus] Unauthorized request - invalid or missing API key')
      return NextResponse.json(
        { error: 'Unauthorized. Please re-enter your API key after factory reset.' },
        { status: 401 }
      )
    }

    // Check if snapshot exists
    const snapshot = await readJSONFromStorage('settings/clubs-snapshot.json')

    if (!snapshot) {
      return NextResponse.json({
        exists: false,
        generatedAt: null,
        clubCount: null,
        collectionId: null,
        collectionName: null,
      })
    }

    return NextResponse.json({
      exists: true,
      generatedAt: snapshot.metadata?.generatedAt || null,
      clubCount: snapshot.metadata?.clubCount || snapshot.clubs?.length || 0,
      collectionId: snapshot.metadata?.collectionId || null,
      collectionName: snapshot.metadata?.collectionName || null,
    })
  } catch (error) {
    console.error('[Snapshot Status] Error checking status:', error)
    return NextResponse.json(
      { error: 'Failed to check snapshot status' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_API_KEY

    if (!expectedKey) {
      console.error('[SnapshotStatus POST] CRITICAL: ADMIN_API_KEY not configured')
      return NextResponse.json(
        { error: 'Server not configured: ADMIN_API_KEY not set' },
        { status: 500 }
      )
    }

    if (!adminKey || adminKey !== expectedKey) {
      console.warn('[SnapshotStatus POST] Unauthorized request - invalid or missing API key')
      return NextResponse.json(
        { error: 'Unauthorized. Please re-enter your API key after factory reset.' },
        { status: 401 }
      )
    }

    console.log('[Snapshot] Manual publish triggered by admin...')

    // Wrap entire publish in snapshot lock to prevent concurrent publishes
    return await withSnapshotLock(async () => {
      // Get display collection from Postgres
      const collections = await listCollections()
      const displayCollection = collections.find(c => c.display)

      if (!displayCollection) {
        console.warn('[Snapshot] No display collection found for snapshot')
        throw new Error('No display collection configured. Please select a collection as "Public Catalog" in Settings.')
      }

      console.log(`[Snapshot] Publishing from collection: ${displayCollection.name} (${displayCollection.id})`)

      // Get approved registrations from Postgres
      const registrations = await listRegistrations({ 
        collectionId: displayCollection.id,
        status: 'approved'
      })

      console.log(`[Snapshot] Found ${registrations.length} approved registrations`)

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

      // Merge admin-managed announcements (if enabled)
      try {
        const settingsData = await readJSONFromStorage('settings/settings.json')
        const settings = settingsData || { announcementsEnabled: true }
        
        if (settings.announcementsEnabled !== false) {
          const announcementsData = await readJSONFromStorage('settings/announcements.json')
          const mapRaw = announcementsData || {}
          const map: Record<string, string> = {}
          // Normalize keys to strings and trim values
          if (mapRaw && typeof mapRaw === 'object') {
            Object.keys(mapRaw).forEach((k) => {
              try {
                const v = (mapRaw as any)[k]
                if (typeof v === 'string' && v.trim() !== '') map[String(k).trim()] = v.trim()
                else if (v !== null && typeof v !== 'undefined') map[String(k).trim()] = String(v)
              } catch (e) {
                // ignore malformed entries
              }
            })
          }

          console.log(`[Snapshot] Merging ${Object.keys(map).length} announcements into snapshot`)
          // IMPORTANT: Only try exact string match, not numeric conversion
          // Club IDs are always strings, and converting "ABC123" to Number yields NaN
          clubs.forEach((c) => {
            const idStr = String(c.id).trim()
            if (map[idStr] && map[idStr].trim() !== '') {
              c.announcement = map[idStr].trim()
              console.log(`[Snapshot] Added announcement to club ${c.name} (${c.id})`)
            }
          })
        }
      } catch (err) {
        console.warn('[Snapshot] Could not merge announcements:', err)
      }

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

      console.log(`[Snapshot] Writing snapshot with ${clubs.length} clubs...`)

      // Write snapshot
      const success = await writeJSONToStorage('settings/clubs-snapshot.json', snapshot)

      if (!success) {
        console.error('[Snapshot] Failed to write snapshot file')
        throw new Error('Failed to write snapshot to storage')
      }

      console.log(`[Snapshot] ✅ Manual publish successful: ${clubs.length} clubs`)
      
      // Invalidate cache AFTER successful write (inside lock)
      invalidateClubsCache()
      console.log('[Cache] ✅ Invalidated after successful snapshot publish')

      return NextResponse.json({
        success: true,
        message: `Published ${clubs.length} clubs`,
        snapshot: {
          generatedAt: snapshot.metadata.generatedAt,
          clubCount: clubs.length,
          collectionId: displayCollection.id,
          collectionName: displayCollection.name,
        }
      })
    })
  } catch (error) {
    console.error('[Snapshot] Error during manual publish:', error)
    // If we get here, snapshot lock failed or something went wrong inside
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish snapshot' },
      { status: 500 }
    )
  }
}
