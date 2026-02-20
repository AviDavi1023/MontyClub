import { NextRequest, NextResponse } from 'next/server'
import { getRegistrationById, updateRegistration } from '@/lib/registrations-db'
import { invalidateClubsCache } from '@/lib/cache-utils'

export const dynamic = 'force-dynamic'

/**
 * POST /api/registration-approve
 * Approves a pending registration and marks it as approved
 * 
 * Uses Postgres for storage, no longer depends on Storage system
 * Cache is invalidated to ensure fresh publish on next request
 */
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
    const { registrationId } = body

    if (!registrationId) {
      return NextResponse.json(
        { error: 'Missing registration ID' },
        { status: 400 }
      )
    }

    // Validate registration exists
    const registration = await getRegistrationById(registrationId)
    if (!registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      )
    }

    // Update status to approved
    await updateRegistration(registrationId, {
      status: 'approved',
      approvedAt: new Date().toISOString(),
    })

    // Invalidate cache to force refresh on next publish
    invalidateClubsCache()

    return NextResponse.json({ 
      success: true,
      message: 'Registration approved',
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    })
  } catch (error) {
    console.error('[Registration Approve] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
