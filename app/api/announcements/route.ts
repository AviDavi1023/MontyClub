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
