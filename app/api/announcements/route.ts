import { NextResponse, NextRequest } from 'next/server'
import { readData, writeData } from '@/lib/runtime-store'
import { announcementsCache } from '@/lib/caches'
import { createCachedGET } from '@/lib/api-patterns'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function ensureAnnouncementsFile() {
  // left for compatibility; runtime-store handles file creation
  return null
}

export const GET = createCachedGET<Record<string, string>>(
  announcementsCache,
  async (_request: NextRequest) => {
    const data = await readData('announcements', {})
    return (data && typeof data === 'object') ? data as Record<string, string> : {}
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
      const current = announcementsCache.get() ?? await readData('announcements', {})
      const base = (current && typeof current === 'object') ? { ...current } : {}
      const updated: Record<string, string> = { ...base, ...body }
      await writeData('announcements', updated)
      announcementsCache.set(updated)
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

      const current = announcementsCache.get() ?? await readData('announcements', {})
      const updated: Record<string, string> = { ...(current || {}) } as Record<string, string>
      let deletedCount = 0
      const actuallyDeleted: string[] = []
      for (const id of ids) {
        if (Object.prototype.hasOwnProperty.call(updated, id)) {
          delete updated[id]
          deletedCount += 1
          actuallyDeleted.push(id)
        }
      }
      if (deletedCount > 0) {
        await writeData('announcements', updated)
        announcementsCache.set(updated)
      }
      return NextResponse.json({ deleted: actuallyDeleted, total: deletedCount }, {
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
