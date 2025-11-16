'use client'

// Lightweight client analytics that POSTs events to our API.
// Can be disabled by setting localStorage 'analytics:enabled' to 'false'
// or NEXT_PUBLIC_ANALYTICS_ENABLED='false'.

export type AnalyticsEvent = {
  type: string
  sid?: string
  ts?: number
  props?: Record<string, any>
  period?: string
}

let cachedEnabled: boolean | null = null

export function analyticsEnabled(): boolean {
  if (cachedEnabled !== null) return cachedEnabled
  try {
    const env = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED
    const local = typeof window !== 'undefined' ? localStorage.getItem('analytics:enabled') : null
    const enabled = (local === null ? (env === undefined ? 'true' : env) : local)
    cachedEnabled = enabled !== 'false'
    return cachedEnabled
  } catch {
    cachedEnabled = true
    return true
  }
}

export function getSessionId(): string | undefined {
  try {
    const k = 'analytics:sid'
    let sid = localStorage.getItem(k)
    if (!sid) {
      sid = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem(k, sid)
    }
    return sid || undefined
  } catch {
    return undefined
  }
}

export function getPeriod(): string {
  try {
    return localStorage.getItem('analytics:period') || 'pilot'
  } catch {
    return 'pilot'
  }
}

export async function track(type: string, props?: Record<string, any>) {
  if (typeof window === 'undefined') return
  if (!analyticsEnabled()) return

  const evt: AnalyticsEvent = {
    type,
    sid: getSessionId(),
    ts: Date.now(),
    props: sanitizeProps(props),
    period: getPeriod(),
  }
  try {
    await fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evt),
      keepalive: true, // allow during unload
    })
  } catch {
    // ignore
  }
}

function sanitizeProps(input?: Record<string, any>) {
  if (!input) return undefined
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v == null) continue
    // limit strings to 200 chars
    if (typeof v === 'string') {
      out[k] = v.length > 200 ? v.slice(0, 200) + '…' : v
    } else {
      out[k] = v
    }
  }
  return out
}
