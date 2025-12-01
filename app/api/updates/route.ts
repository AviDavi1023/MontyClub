import { NextResponse, NextRequest } from 'next/server'
import { readData, writeData } from '@/lib/runtime-store'
import { createCachedGET, createLockedPOST } from '@/lib/api-patterns'
import { updatesCache } from '@/lib/caches'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Cache-backed GET: serves cached data if < maxAge, otherwise refreshes storage
export const GET = createCachedGET<any[]>(
  updatesCache,
  async (_request: NextRequest) => {
    const data = await readData('updates', [])
    // Ensure array
    return Array.isArray(data) ? data : []
  },
  { maxAge: 10000 }
)

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
