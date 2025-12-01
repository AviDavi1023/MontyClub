import { NextRequest, NextResponse } from 'next/server'
import { removePaths } from '@/lib/supabase'
import { registrationActionsCache } from '@/lib/caches'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return registrationActionsCache.withLock(async () => {
    try {
      const adminKey = request.headers.get('x-admin-key')
      const expectedKey = process.env.ADMIN_API_KEY

      if (!adminKey || adminKey !== expectedKey) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      const body = await request.json()
      const { registrationId, collection } = body

      if (!registrationId || !collection) {
        return NextResponse.json(
          { error: 'Missing registration ID or collection ID' },
          { status: 400 }
        )
      }

      // Delete using collection ID as folder
      const path = `registrations/${collection}/${registrationId}.json`
      const result = await removePaths([path])

      // Clear from cache if deleted
      if (result.removed > 0) {
        const cache = registrationActionsCache.get() || {}
        delete cache[path]
        registrationActionsCache.set(cache)
      }

      return NextResponse.json({ 
        success: result.removed > 0, 
        removed: result.removed 
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      })
    } catch (error) {
      console.error('Error deleting registration:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}
