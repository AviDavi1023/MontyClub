import { NextResponse, NextRequest } from 'next/server'
import { readData, writeData } from '@/lib/runtime-store'
import { createCachedGET } from '@/lib/api-patterns'
import { updatesCache } from '@/lib/caches'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const MIN_SUBMISSION_INTERVAL_MS = 8 * 1000
const MAX_SUBMISSIONS_PER_WINDOW = 5
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000
const MAX_URLS_PER_SUBMISSION = 4
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const REPEATED_CHAR_SPAM_RE = /(.)\1{14,}/

const recentSubmissionsByClient = new Map<string, number[]>()
const recentSignatureByClient = new Map<string, { signature: string; timestamp: number }>()

interface UpdateSubmissionBody {
  clubName: string
  updateType: string
  suggestedChange: string
  contactEmail: string
  additionalNotes: string
  website?: string
}

function getClientIdentifier(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = request.headers.get('x-real-ip')?.trim()
  return forwardedFor || realIp || 'unknown'
}

function normalizeSubmission(payload: any): UpdateSubmissionBody {
  return {
    clubName: String(payload?.clubName || '').trim(),
    updateType: String(payload?.updateType || '').trim(),
    suggestedChange: String(payload?.suggestedChange || '').trim(),
    contactEmail: String(payload?.contactEmail || '').trim().toLowerCase(),
    additionalNotes: String(payload?.additionalNotes || '').trim(),
    website: String(payload?.website || '').trim(),
  }
}

function countLinks(text: string): number {
  const matches = text.match(/https?:\/\/|www\./gi)
  return matches ? matches.length : 0
}

function noCacheHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  }
}

// Manual GET handler with auth check before using cached pattern
export async function GET(request: NextRequest) {
  // Validate admin API key BEFORE attempting to fetch
  const adminKey = request.headers.get('x-admin-key')
  const expectedKey = process.env.ADMIN_API_KEY
  
  if (!expectedKey) {
    console.error('[Updates GET] CRITICAL: ADMIN_API_KEY not configured')
    return NextResponse.json(
      { error: 'Server not configured: ADMIN_API_KEY not set' },
      { status: 500 }
    )
  }
  
  if (!adminKey || adminKey !== expectedKey) {
    console.warn('[Updates GET] Unauthorized request - invalid or missing API key')
    return NextResponse.json(
      { error: 'Unauthorized. Please re-enter your API key after factory reset.' },
      { status: 401 }
    )
  }

  // Use cached GET pattern for authorized requests
  const cachedGET = createCachedGET<any[]>(
    updatesCache,
    async (_request: NextRequest) => {
      const data = await readData('updates', [])
      // Ensure array
      return Array.isArray(data) ? data : []
    },
    { maxAge: 10000 }
  )

  return cachedGET(request)
}

export async function POST(request: NextRequest) {
  return updatesCache.withLock(async () => {
    try {
      const rawBody = await request.json().catch(() => null)
      if (!rawBody || typeof rawBody !== 'object') {
        return NextResponse.json({ error: 'Invalid submission payload' }, { status: 400, headers: noCacheHeaders() })
      }

      const body = normalizeSubmission(rawBody)

      if (body.website) {
        return NextResponse.json({ error: 'Submission rejected' }, { status: 400, headers: noCacheHeaders() })
      }

      if (!body.clubName || !body.updateType || !body.suggestedChange || !body.contactEmail) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: noCacheHeaders() })
      }

      if (!EMAIL_RE.test(body.contactEmail)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400, headers: noCacheHeaders() })
      }

      if (body.clubName.length > 120 || body.updateType.length > 80 || body.suggestedChange.length > 1200 || body.additionalNotes.length > 1200) {
        return NextResponse.json({ error: 'Submission is too long' }, { status: 400, headers: noCacheHeaders() })
      }

      const combinedText = `${body.suggestedChange}\n${body.additionalNotes}`
      if (countLinks(combinedText) > MAX_URLS_PER_SUBMISSION) {
        return NextResponse.json({ error: 'Too many links in a single submission' }, { status: 400, headers: noCacheHeaders() })
      }

      if (REPEATED_CHAR_SPAM_RE.test(body.suggestedChange)) {
        return NextResponse.json({ error: 'Submission appears to be spam' }, { status: 400, headers: noCacheHeaders() })
      }

      const now = Date.now()
      const clientId = getClientIdentifier(request)

      const recent = (recentSubmissionsByClient.get(clientId) || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS)
      if (recent.length > 0 && now - recent[recent.length - 1] < MIN_SUBMISSION_INTERVAL_MS) {
        return NextResponse.json({ error: 'Please wait a few seconds before submitting again' }, { status: 429, headers: noCacheHeaders() })
      }

      if (recent.length >= MAX_SUBMISSIONS_PER_WINDOW) {
        return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429, headers: noCacheHeaders() })
      }

      const signature = `${body.clubName.toLowerCase()}|${body.updateType.toLowerCase()}|${body.suggestedChange.toLowerCase()}|${body.contactEmail.toLowerCase()}`
      const lastSignature = recentSignatureByClient.get(clientId)
      if (lastSignature && lastSignature.signature === signature && now - lastSignature.timestamp < DUPLICATE_WINDOW_MS) {
        return NextResponse.json({ error: 'Duplicate submission detected. Please wait before resubmitting the same update.' }, { status: 409, headers: noCacheHeaders() })
      }

      const current = updatesCache.get() ?? await readData('updates', [])
      const arr: any[] = Array.isArray(current) ? [...current] : []

      const duplicateRecent = arr.some((item: any) => {
        const createdAtMs = new Date(String(item?.createdAt || item?.requestedAt || 0)).getTime()
        if (!Number.isFinite(createdAtMs) || now - createdAtMs > DUPLICATE_WINDOW_MS) return false

        return String(item?.contactEmail || '').trim().toLowerCase() === body.contactEmail &&
          String(item?.clubName || '').trim().toLowerCase() === body.clubName.toLowerCase() &&
          String(item?.suggestedChange || '').trim().toLowerCase() === body.suggestedChange.toLowerCase()
      })

      if (duplicateRecent) {
        return NextResponse.json({ error: 'A very similar update was already submitted recently.' }, { status: 409, headers: noCacheHeaders() })
      }

      const createdAt = new Date().toISOString()
      const submitterDomain = body.contactEmail.split('@')[1] || ''

      const entry = {
        id: String(Date.now()),
        clubName: body.clubName,
        updateType: body.updateType,
        suggestedChange: body.suggestedChange,
        contactEmail: body.contactEmail,
        additionalNotes: body.additionalNotes,
        submitterDomain,
        requestedBy: body.contactEmail,
        requestedAt: createdAt,
        createdAt,
        reviewed: false,
        status: 'pending',
      }

      arr.unshift(entry)
      const writeResult = await writeData('updates', arr)
      updatesCache.set(arr)

      recent.push(now)
      recentSubmissionsByClient.set(clientId, recent)
      recentSignatureByClient.set(clientId, { signature, timestamp: now })

      if (writeResult && (writeResult as any).persisted === 'memory') {
        console.warn('[POST /api/updates] Read-only environment: data will not persist across instances')
      }

      return NextResponse.json(entry, { status: 201, headers: noCacheHeaders() })
    } catch (error) {
      console.error('[POST /api/updates] Error:', error)
      return NextResponse.json({ error: 'Failed to submit update' }, { status: 500, headers: noCacheHeaders() })
    }
  })
}
