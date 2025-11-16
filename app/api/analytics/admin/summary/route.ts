import { NextRequest, NextResponse } from 'next/server'
import { listPaths, readJSONFromStorage } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Basic summary of analytics by period. Protected by ADMIN_API_KEY header.
export async function GET(req: NextRequest) {
  try {
    const key = req.headers.get('x-admin-key')
    const ok = key && process.env.ADMIN_API_KEY && key === process.env.ADMIN_API_KEY
    if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const period = (searchParams.get('period') || 'pilot').replace(/[^a-zA-Z0-9-_]/g, '')
    const max = Math.min(Number(searchParams.get('max') || '5000'), 20000)

    const prefix = `analytics/events/${period}`
    const keys = await listPaths(prefix)

    const summary: any = {
      period,
      totalEvents: 0,
      byType: {} as Record<string, number>,
      clubOpens: {} as Record<string, number>,
      shares: {} as Record<string, number>,
      sample: [] as any[],
    }

    let processed = 0
    for (const k of keys) {
      if (processed >= max) break
      const evt = await readJSONFromStorage(k)
      if (!evt) continue
      processed++
      summary.totalEvents++
      const t = String(evt.type || 'unknown')
      summary.byType[t] = (summary.byType[t] || 0) + 1
      if (t === 'ClubOpen' && evt.props?.id) {
        summary.clubOpens[evt.props.id] = (summary.clubOpens[evt.props.id] || 0) + 1
      }
      if (t === 'ShareClick' && evt.props?.id) {
        summary.shares[evt.props.id] = (summary.shares[evt.props.id] || 0) + 1
      }
      if (summary.sample.length < 25) summary.sample.push(evt)
    }

    return NextResponse.json(summary)
  } catch (e) {
    console.error('analytics summary error', e)
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
}
