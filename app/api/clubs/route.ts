import { NextResponse } from 'next/server'
import { fetchClubsFromExcel } from '@/lib/clubs'

// Ensure this route is always dynamic and never statically cached
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const clubs = await fetchClubsFromExcel()
    return new NextResponse(JSON.stringify(clubs), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Error fetching clubs:', error)
    return NextResponse.json({ error: 'Failed to fetch clubs' }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      }
    })
  }
}
