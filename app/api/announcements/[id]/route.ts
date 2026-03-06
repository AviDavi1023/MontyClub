import { NextResponse, NextRequest } from 'next/server'
import { announcementsCache } from '@/lib/caches'
import { setAnnouncement, getAllAnnouncements, clearAnnouncement } from '@/lib/announcements-db'
import { invalidateClubsCache } from '@/lib/cache-utils'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return announcementsCache.withLock(async () => {
    try {
      const { id } = await params
      const body = await request.json()

      if (!body || typeof body.announcement !== 'string') {
        return NextResponse.json({ error: 'Invalid payload, expected { announcement: string }' }, { status: 400 })
      }
      
      // First, verify the club exists
      const supabaseUrl = process.env.SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase not configured')
      }
      
      const client = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
      
      // Now check for the specific club
      const { data: clubExists, error: checkError } = await (client.from('clubs') as any)
        .select('id, announcement')
        .eq('id', id)
        .single()
      
      if (checkError || !clubExists) {
        return NextResponse.json({ 
          error: `Club ${id} not found in database` 
        }, { status: 404 })
      }
      
      // Update in database
      await setAnnouncement(id, body.announcement)
      
      // Fetch fresh data from database
      const updated = await getAllAnnouncements()
      announcementsCache.set(updated)
      
      // Invalidate clubs cache since announcements affect club display
      invalidateClubsCache()
      
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
