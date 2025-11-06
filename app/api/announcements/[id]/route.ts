import { NextResponse } from 'next/server'
import { readData, writeData } from '@/lib/runtime-store'

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
    const current = await readData('announcements', {})
    const updated = { ...current, [id]: body.announcement }
    if (body.announcement === '') delete updated[id]
    await writeData('announcements', updated)
    return NextResponse.json({ id, announcement: updated[id] ?? '' })
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
