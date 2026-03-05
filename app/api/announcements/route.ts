import { NextResponse, NextRequest } from 'next/server'
import { announcementsCache } from '@/lib/caches'
import { createCachedGET } from '@/lib/api-patterns'
import { invalidateClubsCache } from '@/lib/cache-utils'
import { getAllAnnouncements, setAnnouncement, bulkClearAnnouncements } from '@/lib/announcements-db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const GET = createCachedGET<Record<string, string>>(
  announcementsCache,
  async (_request: NextRequest) => {
    return await getAllAnnouncements()
  },
  { maxAge: 10000 }
)

export async function POST(request: NextRequest) {
  return announcementsCache.withLock(async () => {
    try {
      const body = await request.json()
      if (!body || typeof body !== 'object') {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
      }
      
      // Update each announcement in the database
      const entries = Object.entries(body)
      for (const [clubId, announcement] of entries) {
        if (typeof announcement === 'string') {
          await setAnnouncement(clubId, announcement)
        }
      }
      
      // Fetch fresh data from database
      const updated = await getAllAnnouncements()
      announcementsCache.set(updated)
      
      // Invalidate clubs cache since announcements affect club display
      invalidateClubsCache()
      
      return NextResponse.json(updated, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      })
    } catch (err) {
      console.error('Error writing announcements:', err)
      return NextResponse.json({ error: 'Failed to save announcements' }, { status: 500 })
    }
  })
}

// Bulk delete announcements: DELETE /api/announcements with JSON body { ids: string[] }
export async function DELETE(request: NextRequest) {
  return announcementsCache.withLock(async () => {
    try {
      let payload: any = null
      try {
        payload = await request.json()
      } catch (_e) {
        payload = null
      }

      if (!payload || !Array.isArray(payload.ids)) {
        return NextResponse.json({ error: 'Invalid payload, expected { ids: string[] }' }, { status: 400 })
      }

      const ids = payload.ids
        .filter((x: any) => typeof x === 'string')
        .map((x: string) => x.trim())
        .filter((x: string) => x.length > 0)

      if (ids.length === 0) {
        return NextResponse.json({ deleted: [], total: 0 })
      }

      // Clear announcements in database
      const deletedCount = await bulkClearAnnouncements(ids)
      
      // Fetch fresh data from database
      const updated = await getAllAnnouncements()
      announcementsCache.set(updated)
      
      // Invalidate clubs cache since we changed announcements
      invalidateClubsCache()
      
      return NextResponse.json({ deleted: ids.slice(0, deletedCount), total: deletedCount }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      })
    } catch (err) {
      console.error('Error bulk-deleting announcements:', err)
      return NextResponse.json({ error: 'Failed to delete announcements' }, { status: 500 })
    }
  })
}
