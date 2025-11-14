import { NextResponse } from 'next/server'
import { readData, writeData } from '@/lib/runtime-store'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function ensureAnnouncementsFile() {
  // compatibility shim - runtime-store handles storage
  return null
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    if (!body || typeof body.announcement !== 'string') {
      return NextResponse.json({ error: 'Invalid payload, expected { announcement: string }' }, { status: 400 })
    }
    
    console.log(`[PATCH /api/announcements/${id}] Updating announcement to:`, body.announcement.substring(0, 50))
    
    const current = await readData('announcements', {})
    const updated = { ...current, [id]: body.announcement }
    if (body.announcement === '') delete updated[id]
    
    const writeResult = await writeData('announcements', updated)
    console.log(`[PATCH /api/announcements/${id}] Write result:`, writeResult)
    
    return NextResponse.json({ id, announcement: updated[id] ?? '' }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (err) {
    console.error('Error updating announcement:', err)
    return NextResponse.json({ error: 'Failed to update announcement' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const current = await readData('announcements', {})
    if (current && Object.prototype.hasOwnProperty.call(current, id)) {
      delete current[id]
      await writeData('announcements', current)
    }
    return NextResponse.json({ id })
  } catch (err) {
    console.error('Error deleting announcement:', err)
    return NextResponse.json({ error: 'Failed to delete announcement' }, { status: 500 })
  }
}
