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
      console.log(`[SERVER] Text to save: "${body.announcement}"`)
      
      // First, verify the club exists
      const supabaseUrl = process.env.SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase not configured')
      }
      
      const client = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
      
      // First, check how many clubs even exist in the database
      const { count: totalClubs } = await (client.from('clubs') as any)
        .select('*', { count: 'exact', head: true })
      console.log(`[SERVER] Total clubs in database: ${totalClubs}`)
      
      // Get all club IDs for debugging
      const { data: allClubs } = await (client.from('clubs') as any)
        .select('id')
        .limit(5)
      console.log(`[SERVER] First 5 club IDs: ${allClubs?.map((c: any) => c.id).join(', ') || 'none'}`)
      
      // Now check for the specific club
      const { data: clubExists, error: checkError } = await (client.from('clubs') as any)
        .select('id, announcement')
        .eq('id', id)
        .single()
      
      if (checkError || !clubExists) {
        console.error(`[SERVER ERROR] Club ${id} does not exist! Available clubs: ${totalClubs}`)
        return NextResponse.json({ 
          error: `Club ${id} not found in database. Total clubs in DB: ${totalClubs}` 
        }, { status: 404 })
      }
      
      console.log(`[SERVER] Club ${id} exists, current announcement: "${clubExists.announcement}"`)
      console.log(`[SERVER] Proceeding with update from "${clubExists.announcement}" to "${body.announcement}"`)
      
      // Update in database
      await setAnnouncement(id, body.announcement)
      
      console.log(`[SERVER] Database update call completed, checking club directly...`)
      
      // Verify the update worked by checking the club directly
      const { data: clubAfterUpdate, error: checkAfterError } = await (client.from('clubs') as any)
        .select('announcement')
        .eq('id', id)
        .single()
      
      console.log(`[SERVER] Club after update check: announcement="${clubAfterUpdate?.announcement}"`)
      if (checkAfterError) {
        console.error(`[SERVER] Error checking club after update:`, checkAfterError)
      }
      
      // Fetch fresh data from database
      const updated = await getAllAnnouncements()
      console.log(`[SERVER] Fresh announcements from DB:`, updated)
      console.log(`[SERVER] Looking for club ${id} in updated data...`)
      console.log(`[SERVER] updated[${id}] =`, updated[id])
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
