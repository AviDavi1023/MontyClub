import { NextResponse } from 'next/server'
import { readJSONFromStorage } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const COLLECTIONS_PATH = 'settings/registration-collections.json'

/**
 * PUBLIC endpoint - Returns minimal collection info for public forms (no auth required)
 * Only returns collections that are accepting registrations
 */
export async function GET() {
  try {
    console.log('[Collections Public API] GET /api/collections-public called')
    const collections = await readJSONFromStorage(COLLECTIONS_PATH)
    console.log('[Collections Public API] Read from storage:', Array.isArray(collections) ? collections.length + ' collections' : 'not an array')
    
    if (!Array.isArray(collections)) {
      console.log('[Collections Public API] Collections is not an array, returning empty')
      return NextResponse.json({ collections: [] })
    }

    // Sort by creation date (newest first)
    const sorted = [...collections]
      .filter(c => {
        const valid = c && typeof c === 'object'
        if (!valid) console.log('[Collections Public API] Filtering out invalid collection')
        return valid
      })
      .sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )

    console.log('[Collections Public API] Returning', sorted.length, 'collections')
    sorted.forEach((c, i) => {
      console.log(`[Collections Public API] Collection ${i}:`, { id: c.id, name: c.name, renewalEnabled: c.renewalEnabled })
    })

    return NextResponse.json({ collections: sorted }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('[Collections Public API] Exception:', error)
    return NextResponse.json(
      { collections: [] },
      { status: 200 } // Return empty array instead of error
    )
  }
}
