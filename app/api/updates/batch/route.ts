import { NextResponse, NextRequest } from 'next/server'
import { readData, writeData } from '@/lib/runtime-store'
import { updatesCache } from '@/lib/caches'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface BatchBody {
  ids: string[]
  action: 'review' | 'unreview' | 'delete'
}

export async function POST(request: NextRequest) {
  return updatesCache.withLock(async () => {
    try {
      // Validate admin API key
      const adminKey = request.headers.get('x-admin-key')
      const expectedKey = process.env.ADMIN_API_KEY
      
      if (!adminKey || adminKey !== expectedKey) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      const body: BatchBody = await request.json()
      if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
        return NextResponse.json({ error: 'ids required' }, { status: 400 })
      }
      if (!['review', 'unreview', 'delete'].includes(body.action)) {
        return NextResponse.json({ error: 'invalid action' }, { status: 400 })
      }

      const current = updatesCache.get() ?? await readData('updates', [])
      const updates: any[] = Array.isArray(current) ? [...current] : []
      const idSet = new Set(body.ids.map(String))
      const touched: any[] = []

      if (body.action === 'delete') {
        for (let i = updates.length - 1; i >= 0; i--) {
          const u = updates[i]
          if (idSet.has(String(u.id))) {
            touched.push(u)
            updates.splice(i, 1)
          }
        }
      } else {
        const reviewedValue = body.action === 'review'
        for (let i = 0; i < updates.length; i++) {
          const u = updates[i]
          if (idSet.has(String(u.id))) {
            updates[i] = { ...u, reviewed: reviewedValue }
            touched.push(updates[i])
          }
        }
      }

      const writeResult = await writeData('updates', updates)
      updatesCache.set(updates)
      return NextResponse.json({
        success: true,
        action: body.action,
        count: touched.length,
        items: touched,
        write: writeResult || null
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      })
    } catch (err) {
      console.error('[POST /api/updates/batch] error', err)
      return NextResponse.json({ error: 'Batch operation failed' }, { status: 500 })
    }
  })
}
