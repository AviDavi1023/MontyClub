import { NextResponse, NextRequest } from 'next/server'
import { readData, writeData } from '@/lib/runtime-store'
import { createCachedGET, createLockedPOST } from '@/lib/api-patterns'
import { updatesCache } from '@/lib/caches'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

// Locked POST prevents races when many updates are submitted rapidly
export const POST = createLockedPOST<any>(
  updatesCache,
  async (request: NextRequest) => {
    const body = await request.json()
    const current = updatesCache.get() ?? await readData('updates', [])
    const arr: any[] = Array.isArray(current) ? [...current] : []

    const entry = {
      id: String(Date.now()),
      ...body,
      createdAt: new Date().toISOString(),
      reviewed: false,
    }

    arr.unshift(entry)
    const writeResult = await writeData('updates', arr)
    updatesCache.set(arr)
    if (writeResult && (writeResult as any).persisted === 'memory') {
      console.warn('[POST /api/updates] Read-only environment: data will not persist across instances')
    }
    return entry
  }
)
