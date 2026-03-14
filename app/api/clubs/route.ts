import { NextResponse } from 'next/server'
import { fetchClubs } from '@/lib/clubs'

// Ensure this route is always dynamic and never statically cached
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Always fetch from current source-of-truth to avoid cross-instance stale data.
    const clubs = await fetchClubs()

    const json = JSON.stringify(clubs)
    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
        'X-Cache': 'BYPASS',
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


