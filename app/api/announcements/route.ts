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

export async function GET() {
  try {
    const file = await ensureAnnouncementsFile()
    const content = await fs.promises.readFile(file, 'utf-8')
    const data = JSON.parse(content)
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

    const file = await ensureAnnouncementsFile()
    const content = await fs.promises.readFile(file, 'utf-8')
    const current = JSON.parse(content)
    const updated = { ...current, ...body }
    await fs.promises.writeFile(file, JSON.stringify(updated, null, 2), 'utf-8')
    return NextResponse.json(updated)
  } catch (err) {
    console.error('Error writing announcements:', err)
    return NextResponse.json({ error: 'Failed to save announcements' }, { status: 500 })
  }
}
