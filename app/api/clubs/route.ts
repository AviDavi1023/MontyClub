import { NextResponse } from 'next/server'
import { fetchClubs } from '@/lib/clubs'
import { getCachedClubs, setClubsCache } from '@/lib/cache-utils'

// Ensure this route is always dynamic and never statically cached
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Check if cache is still valid
    const cached = getCachedClubs()
    if (cached) {
      console.log(`[API /clubs] Returning cached clubs (${cached.data.length} clubs), age: ${cached.age}ms`)
      const json = JSON.stringify(cached.data)
      return new NextResponse(json, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store, max-age=0',
          'X-Cache': 'HIT',
          'X-Cache-Age': String(cached.age),
        },
      })
    }

    // Cache miss - fetch fresh data
    console.log(`[API /clubs] Cache miss, fetching fresh clubs...`)
    const clubs = await fetchClubs()
    console.log(`[API /clubs] Fetched ${clubs.length} clubs, storing in cache`)
    clubs.forEach((c, i) => {
      console.log(`[API /clubs]   ${i + 1}. ${c.id} - ${c.name}`)
    })
    setClubsCache(clubs)

    const json = JSON.stringify(clubs)
    return new NextResponse(json, {
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


