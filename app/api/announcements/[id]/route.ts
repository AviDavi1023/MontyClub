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
      if (!body || typeof body.announcement !== 'string') {
        return NextResponse.json({ error: 'Invalid payload, expected { announcement: string }' }, { status: 400 })
      }
      console.log(`[PATCH /api/announcements/${id}] Updating announcement to:`, body.announcement.substring(0, 50))
      const current = announcementsCache.get() ?? await readData('announcements', {})
      const updated: Record<string, string> = { ...(current || {}) } as Record<string, string>
      if (body.announcement === '') {
        delete updated[id]
      } else {
        updated[id] = body.announcement
      }
      const writeResult = await writeData('announcements', updated)
      announcementsCache.set(updated)
      console.log(`[PATCH /api/announcements/${id}] Write result:`, writeResult)
      return NextResponse.json({ id, announcement: updated[id] ?? '' }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      })
    } catch (err) {
      console.error('Error updating announcement:', err)
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
