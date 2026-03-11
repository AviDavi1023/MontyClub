import { NextResponse } from 'next/server'
import { readData, writeData } from '@/lib/runtime-store'
import { requireAdminApiKey } from '@/lib/admin-api-key'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const data = await readData('settings', { announcementsEnabled: true })
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (err) {
    console.error('Error reading settings:', err)
    return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const authError = requireAdminApiKey(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const current = await readData('settings', { announcementsEnabled: true })
    const updated = { ...current, ...body }
    
    console.log('[PATCH /api/settings] Updating settings to:', updated)
    const writeResult = await writeData('settings', updated)
    console.log('[PATCH /api/settings] Write result:', writeResult)
    
    return NextResponse.json(updated, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (err) {
    console.error('Error updating settings:', err)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
