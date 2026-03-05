import { NextResponse, NextRequest } from 'next/server'
import { announcementsCache } from '@/lib/caches'
import { setAnnouncement, getAllAnnouncements, clearAnnouncement } from '@/lib/announcements-db'
import { invalidateClubsCache } from '@/lib/cache-utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return announcementsCache.withLock(async () => {
    try {
      const { id } = await params
      const body = await request.json()
      const requestId = `api-ann-${id}-${Date.now()}`
      
      console.log(`\n${'='.repeat(60)}`)
      console.log(`[SERVER LOCK ACQUIRED] Announcement PATCH: ${id}`)
      console.log(`Request ID: ${requestId}`)
      console.log(`Timestamp: ${new Date().toISOString()}`)
      console.log(`${'='.repeat(60)}`)

      if (!body || typeof body.announcement !== 'string') {
        console.log(`[SERVER ERROR] Invalid payload for announcement ${id}`)
        return NextResponse.json({ error: 'Invalid payload, expected { announcement: string }' }, { status: 400 })
      }
      
      console.log(`[SERVER] Updating announcement for club ${id}`)
      
      // Update in database
      await setAnnouncement(id, body.announcement)
      
      console.log(`[SERVER] Database updated, fetching fresh announcements...`)
      
      // Fetch fresh data from database
      const updated = await getAllAnnouncements()
      announcementsCache.set(updated)
      
      console.log(`[SERVER] Cache updated`)
      
      // Invalidate clubs cache since announcements affect club display
      invalidateClubsCache()
      
      console.log(`${'='.repeat(60)}`)
      console.log(`[SERVER SUCCESS] Announcement ${id} saved`)
      console.log(`Timestamp: ${new Date().toISOString()}`)
      console.log(`${'='.repeat(60)}\n`)

      return NextResponse.json({ id, announcement: updated[id] ?? '' }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      })
    } catch (err) {
      console.error(`[SERVER ERROR] Exception in PATCH announcement:`, err)
      return NextResponse.json({ error: 'Failed to update announcement' }, { status: 500 })
    }
  })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return announcementsCache.withLock(async () => {
    try {
      const { id } = await params
      
      // Clear announcement in database
      await clearAnnouncement(id)
      
      // Fetch fresh data from database
      const updated = await getAllAnnouncements()
      announcementsCache.set(updated)
      
      // Invalidate clubs cache
      invalidateClubsCache()
      
      return NextResponse.json({ id }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      })
    } catch (err) {
      console.error('Error deleting announcement:', err)
      return NextResponse.json({ error: 'Failed to delete announcement' }, { status: 500 })
    }
  })
}
