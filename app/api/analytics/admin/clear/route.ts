import { NextRequest, NextResponse } from 'next/server'
import { listPaths, removePaths } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Simple protected endpoint to clear analytics by period.
// Requires header: x-admin-key == process.env.ADMIN_API_KEY
export async function POST(req: NextRequest) {
  try {
    const key = req.headers.get('x-admin-key')
    const ok = key && process.env.ADMIN_API_KEY && key === process.env.ADMIN_API_KEY
    if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { period } = await req.json()
    const p = String(period || 'pilot').replace(/[^a-zA-Z0-9-_]/g, '')
    const prefix = `analytics/events/${p}`

    const keys = await listPaths(prefix)
    if (keys.length === 0) return NextResponse.json({ removed: 0 })

    const { removed } = await removePaths(keys)
    return NextResponse.json({ removed })
  } catch (e) {
    console.error('analytics clear error', e)
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
}
