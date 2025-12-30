import { NextResponse } from 'next/server'
import { invalidateClubsCache } from '@/lib/cache-utils'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    // Verify admin authentication
    const cookieStore = await cookies()
    const adminCookie = cookieStore.get('admin-auth')
    
    if (!adminCookie?.value) {
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
