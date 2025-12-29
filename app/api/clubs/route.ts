import { NextResponse } from 'next/server'
import { fetchClubs } from '@/lib/clubs'

// Ensure this route is always dynamic and never statically cached
export const dynamic = 'force-dynamic'
export const revalidate = 0

// In-memory cache for clubs with 30 second TTL
// This prevents expensive repeated fetches during rapid successive requests
let clubsCache: { data: any[]; timestamp: number } | null = null
const CACHE_TTL = 30000 // 30 seconds

export async function GET() {
  try {
    const now = Date.now()
    
    // Check if cache is still valid
    if (clubsCache && (now - clubsCache.timestamp) < CACHE_TTL) {
      return new NextResponse(JSON.stringify(clubsCache.data), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store, max-age=0',
          'X-Cache': 'HIT',
          'X-Cache-Age': String(Math.round((now - clubsCache.timestamp) / 1000)),
        },
      })
    }

    // Cache miss - fetch fresh data
    const clubs = await fetchClubs()
    clubsCache = { data: clubs, timestamp: now }

    return new NextResponse(JSON.stringify(clubs), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    console.error('Error fetching clubs:', error)
    return NextResponse.json({ error: 'Failed to fetch clubs' }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'X-Content-Type-Options': 'nosniff',
      }
    })
  }
}

// Export function to invalidate cache (called by admin operations)
export function invalidateClubsCache() {
  clubsCache = null
}


