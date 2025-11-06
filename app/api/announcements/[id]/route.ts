import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

async function ensureAnnouncementsFile() {
  const dir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir)
  const file = path.join(dir, 'announcements.json')
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({}))
  return file
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    if (!body || typeof body.announcement !== 'string') {
      return NextResponse.json({ error: 'Invalid payload, expected { announcement: string }' }, { status: 400 })
    }

    const file = await ensureAnnouncementsFile()
    const content = await fs.promises.readFile(file, 'utf-8')
    const current = JSON.parse(content)
    const updated = { ...current, [id]: body.announcement }
    // If empty string, remove the key
    if (body.announcement === '') {
      delete updated[id]
    }
    await fs.promises.writeFile(file, JSON.stringify(updated, null, 2), 'utf-8')
    return NextResponse.json({ id, announcement: updated[id] ?? '' })
  } catch (err) {
    console.error('Error updating announcement:', err)
    return NextResponse.json({ error: 'Failed to update announcement' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const file = await ensureAnnouncementsFile()
    const content = await fs.promises.readFile(file, 'utf-8')
    const current = JSON.parse(content)
    if (current && Object.prototype.hasOwnProperty.call(current, id)) {
      delete current[id]
      await fs.promises.writeFile(file, JSON.stringify(current, null, 2), 'utf-8')
    }
    return NextResponse.json({ id })
  } catch (err) {
    console.error('Error deleting announcement:', err)
    return NextResponse.json({ error: 'Failed to delete announcement' }, { status: 500 })
  }
}
