import { NextRequest, NextResponse } from 'next/server'
import { writeJSONToStorage } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const now = Date.now()

    // Basic validation
    const type = String(payload?.type || '').trim()
    if (!type) return NextResponse.json({ error: 'invalid type' }, { status: 400 })

    const sid = String(payload?.sid || '').trim() || 'anon'
    const ts = Number(payload?.ts || now)
    const period = String(payload?.period || 'pilot').replace(/[^a-zA-Z0-9-_]/g, '') || 'pilot'
    const props = payload?.props && typeof payload.props === 'object' ? payload.props : {}

    // Server-side enrichment (non-PII)
    const ua = req.headers.get('user-agent') || ''
    const ref = req.headers.get('referer') || ''

    const event = {
      type,
      sid,
      ts,
      props,
      meta: {
        ua: truncate(ua, 200),
        ref: truncate(ref, 300),
      },
    }

    // Unique key per event to avoid write contention
    const date = new Date(ts).toISOString().slice(0, 10) // YYYY-MM-DD
    const key = `analytics/events/${period}/${date}/${sid}/${ts}-${Math.random().toString(36).slice(2)}.json`

    const ok = await writeJSONToStorage(key, event)
    if (!ok) return NextResponse.json({ error: 'write-failed' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('analytics POST error', e)
    return NextResponse.json({ error: 'server-error' }, { status: 500 })
  }
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + '…' : s
}
