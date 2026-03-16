import { NextResponse } from 'next/server'
import { listCollections } from '@/lib/collections-db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * PUBLIC endpoint - Returns minimal collection info for public forms (no auth required)
 * Only returns collections that are accepting registrations
 */
export async function GET() {
  try {
    const collections = await listCollections()

    // Sort by creation date (newest first)
    const sorted = [...collections]
      .filter(c => {
        const valid = c && typeof c === 'object'
        return valid
      })
      .map((c: any) => {
        // IMPORTANT: For backwards compatibility, if accepting is undefined, check enabled
        const isAccepting = typeof c.accepting === 'boolean' ? c.accepting : Boolean(c.enabled)
        return {
          ...c,
          accepting: isAccepting,
          renewalEnabled: typeof c.renewalEnabled === 'boolean' ? c.renewalEnabled : false,
        }
      })
      .filter(c => {
        return c.accepting || c.renewalEnabled
      })
      .sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )

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
