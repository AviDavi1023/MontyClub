import { NextResponse } from 'next/server'
import { readData, writeData, isReadOnlyFallback } from '@/lib/runtime-store'

export async function GET() {
  try {
    const data = await readData('updates', [])
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error reading updates file:', error)
    return NextResponse.json({ error: 'Failed to read updates' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const arr = (await readData('updates', [])) || []

    const entry = {
      id: String(Date.now()),
      ...body,
      createdAt: new Date().toISOString(),
      reviewed: false,
    }

    // Prepend newest first
    arr.unshift(entry)
    const res = await writeData('updates', arr)
    if (res.persisted === 'memory') {
      console.warn('Running in read-only environment; updates are stored in-memory and will not persist across instances')
    }

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error('Error writing updates file:', error)
    return NextResponse.json({ error: 'Failed to save update' }, { status: 500 })
  }
}
