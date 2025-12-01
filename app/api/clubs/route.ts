import { NextResponse } from 'next/server'
import { fetchClubsFromExcel, fetchClubsFromCollection } from '@/lib/clubs'
import { readFile as runtimeReadFile } from '@/lib/runtime-store'

// Ensure this route is always dynamic and never statically cached
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Try to read the persisted data source selection (default to 'excel')
    let dataSource: 'excel' | 'collection' = 'excel'
    try {
      const buf = await runtimeReadFile('clubDataSource.txt')
      const val = buf?.toString().trim()
      if (val === 'collection' || val === 'excel') dataSource = val
    } catch {}

    let clubs: any[] = []
    if (dataSource === 'collection') {
      clubs = await fetchClubsFromCollection()
    } else {
      clubs = await fetchClubsFromExcel()
    }
    return new NextResponse(JSON.stringify(clubs), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'Vary': 'Accept-Encoding',
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

