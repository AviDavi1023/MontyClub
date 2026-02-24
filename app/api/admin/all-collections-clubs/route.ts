import { NextResponse } from 'next/server'
import { fetchAllCollectionsClubs } from '@/lib/clubs'

/**
 * GET /api/admin/all-collections-clubs
 * 
 * Returns clubs from all collections with collection metadata.
 * Used by admin analytics page to show stats across all collections.
 */
export async function GET() {
  try {
    const result = await fetchAllCollectionsClubs()
    
    return NextResponse.json({
      success: true,
      data: result,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    })
  } catch (error) {
    console.error('Error fetching all collections clubs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch all collections clubs' },
      { status: 500 }
    )
  }
}
