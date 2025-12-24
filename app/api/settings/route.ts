import { NextResponse } from 'next/server'
import { readData, writeData } from '@/lib/runtime-store'

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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (body.clubDataSource === 'excel' || body.clubDataSource === 'collection') {
      // Store clubDataSource in settings object for reliable persistence
      const current = await readData('settings', { announcementsEnabled: true })
      const updated = { ...current, clubDataSource: body.clubDataSource }
      const writeResult = await writeData('settings', updated)
      console.log('[POST /api/settings] Updated clubDataSource to:', body.clubDataSource, 'Result:', writeResult)
      
      // Verify the write was successful by reading back
      const verification = await readData('settings', {})
      if (verification.clubDataSource !== body.clubDataSource) {
        console.warn('[POST /api/settings] Verification failed! Written:', body.clubDataSource, 'Read back:', verification.clubDataSource)
        // Non-fatal: report unverified but include current server value so clients can decide
        return NextResponse.json({ ok: true, verified: false, current: verification.clubDataSource })
      }
      
      return NextResponse.json({ ok: true, verified: true })
    }
    return NextResponse.json({ error: 'Invalid clubDataSource' }, { status: 400 })
  } catch (err) {
    console.error('Error persisting clubDataSource:', err)
    return NextResponse.json({ error: 'Failed to persist clubDataSource', detail: String(err) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
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
