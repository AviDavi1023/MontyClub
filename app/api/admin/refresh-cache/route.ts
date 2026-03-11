import { NextResponse } from 'next/server'
import { invalidateClubsCache } from '@/lib/cache-utils'
import { requireAdminApiKey } from '@/lib/admin-api-key'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const authError = requireAdminApiKey(request)
  if (authError) return authError

  try {
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
