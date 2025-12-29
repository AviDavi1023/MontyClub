import { NextResponse } from 'next/server'
import { readData, writeData } from '@/lib/runtime-store'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const data = await readData('renewal-settings', {} as Record<string, { sourceCollections: string[] }>)
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (err) {
    console.error('Error reading renewal settings:', err)
    return NextResponse.json({ error: 'Failed to read renewal settings' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const adminKey = request.headers.get('x-admin-key')
    if (!adminKey) {
      return NextResponse.json({ error: 'Admin key required' }, { status: 401 })
    }

    const body = await request.json()
    const current = await readData('renewal-settings', {} as Record<string, { sourceCollections: string[] }>)
    const updated = { ...current, ...body }
    
    console.log('[PATCH /api/renewal-settings] Updating renewal settings to:', updated)
    const writeResult = await writeData('renewal-settings', updated)
    console.log('[PATCH /api/renewal-settings] Write result:', writeResult)
    
    return NextResponse.json(updated, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (err) {
    console.error('Error updating renewal settings:', err)
    return NextResponse.json({ error: 'Failed to update renewal settings' }, { status: 500 })
  }
}
