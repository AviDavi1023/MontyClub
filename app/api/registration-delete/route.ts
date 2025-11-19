import { NextRequest, NextResponse } from 'next/server'
import { removePaths } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
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

    if (!registrationId) {
      return NextResponse.json(
        { error: 'Missing registration ID' },
        { status: 400 }
      )
    }

    const paths: string[] = []
    if (collection) {
      const collectionSlug = collection.toLowerCase().replace(/\s+/g, '-')
      paths.push(`registrations/${collectionSlug}/${registrationId}.json`)
    }
    // Also attempt legacy path without collection folder
    paths.push(`registrations/${registrationId}.json`)

    const result = await removePaths(paths)

    return NextResponse.json({ success: result.removed > 0, removed: result.removed })
  } catch (error) {
    console.error('Error deleting registration:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
