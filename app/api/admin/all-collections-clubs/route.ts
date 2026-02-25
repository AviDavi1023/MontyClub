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
    console.log('[API] /all-collections-clubs - Starting fetch')
    const result = await fetchAllCollectionsClubs()
    console.log(`[API] /all-collections-clubs - Got ${result.length} collections with data`)
    result.forEach((item, idx) => {
      console.log(`[API] Collection ${idx}: ${item.collection?.name || 'Unknown'} has ${(item.clubs || []).length} clubs`)
    })
    
    return NextResponse.json({
      success: true,
      data: result,
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    })
  } catch (error) {
    console.error('[API] Error fetching all collections clubs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch all collections clubs', details: String(error) },
      { status: 500 }
    )
  }
}
