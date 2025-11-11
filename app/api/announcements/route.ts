import { NextResponse } from 'next/server'
import { readData, writeData } from '@/lib/runtime-store'

async function ensureAnnouncementsFile() {
  // left for compatibility; runtime-store handles file creation
  return null
}

export async function GET() {
  try {
    const data = await readData('announcements', {})
    return NextResponse.json(data)
  } catch (err) {
    console.error('Error reading announcements:', err)
    return NextResponse.json({ error: 'Failed to read announcements' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const current = await readData('announcements', {})
    const updated = { ...current, ...body }
    await writeData('announcements', updated)
    return NextResponse.json(updated)
  } catch (err) {
    console.error('Error writing announcements:', err)
    return NextResponse.json({ error: 'Failed to save announcements' }, { status: 500 })
  }
}

// Bulk delete announcements: DELETE /api/announcements with JSON body { ids: string[] }
export async function DELETE(request: Request) {
  try {
    let payload: any = null
    try {
      // Some environments may send an empty body for DELETE; handle gracefully
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

    const current = await readData('announcements', {})
    const beforeKeys = new Set(Object.keys(current || {}))
    const updated = { ...(current || {}) }

    let deletedCount = 0
    const actuallyDeleted: string[] = []
    for (const id of ids) {
      if (Object.prototype.hasOwnProperty.call(updated, id)) {
        delete (updated as any)[id]
        deletedCount += 1
        actuallyDeleted.push(id)
      }
    }

    // Only write if something changed
    if (deletedCount > 0) {
      await writeData('announcements', updated)
    }

    return NextResponse.json({ deleted: actuallyDeleted, total: deletedCount })
  } catch (err) {
    console.error('Error bulk-deleting announcements:', err)
    return NextResponse.json({ error: 'Failed to delete announcements' }, { status: 500 })
  }
}
