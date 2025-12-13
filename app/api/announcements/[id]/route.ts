import { NextResponse, NextRequest } from 'next/server'
import { readData, writeData } from '@/lib/runtime-store'
import { announcementsCache } from '@/lib/caches'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function ensureAnnouncementsFile() {
  // compatibility shim - runtime-store handles storage
  return null
}

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
      
      console.log(`[SERVER] Reading current announcements...`)
      const current = announcementsCache.get() ?? await readData('announcements', {})
      console.log(`[SERVER] Current announcements:`, current)
      
      const updated: Record<string, string> = { ...(current || {}) } as Record<string, string>
      if (body.announcement === '') {
        console.log(`[SERVER] Deleting announcement ${id}`)
        delete updated[id]
      } else {
        console.log(`[SERVER] Updating announcement ${id} to: "${body.announcement.substring(0, 50)}..."`)
        updated[id] = body.announcement
      }
      
      console.log(`[SERVER] Writing to storage...`)
      console.log(`[SERVER] Updated announcements:`, updated)
      const writeResult = await writeData('announcements', updated)
      console.log(`[SERVER] Write result:`, writeResult)
      
      announcementsCache.set(updated)
      console.log(`[SERVER] Cache updated`)
      
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
      const current = announcementsCache.get() ?? await readData('announcements', {})
      const updated: Record<string, string> = { ...(current || {}) } as Record<string, string>
      if (Object.prototype.hasOwnProperty.call(updated, id)) {
        delete updated[id]
        await writeData('announcements', updated)
        announcementsCache.set(updated)
      }
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
