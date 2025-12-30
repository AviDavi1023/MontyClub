import { NextResponse } from 'next/server'
import { invalidateClubsCache } from '@/lib/cache-utils'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // Verify admin API key
    const adminKey = request.headers.get('x-admin-key')
    const expectedKey = process.env.ADMIN_API_KEY
    
    if (!adminKey || !expectedKey || adminKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Clear the cache
    invalidateClubsCache()

    return NextResponse.json({ 
      success: true,
      message: 'Cache cleared successfully. Next request will fetch fresh data.',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error clearing cache:', error)
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    )
  }
}
