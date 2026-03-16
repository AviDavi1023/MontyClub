import { NextRequest, NextResponse } from 'next/server'
import { getPrimaryAdmin, listAdminUsers, setPrimaryAdmin, updateAdminUser } from '@/lib/admin-users-db'
import { requireAdminApiKey } from '@/lib/admin-api-key'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/set-primary-email
 * Set or update the primary admin's email for password reset notifications
 */
export async function POST(request: NextRequest) {
  const authError = requireAdminApiKey(request)
  if (authError) return authError

  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      )
    }

    // Read admin users from runtime store
    const primaryAdmin = await getPrimaryAdmin()

    let targetUsername = primaryAdmin?.username
    if (!targetUsername) {
      const users = await listAdminUsers()
      if (users.length === 0) {
        return NextResponse.json(
          { error: 'No admin users found. Complete initial setup first.' },
          { status: 404 }
        )
      }
      targetUsername = users[0].username
      await setPrimaryAdmin(targetUsername)
    }

    const normalizedEmail = email.trim().toLowerCase()
    await updateAdminUser(targetUsername, { email: normalizedEmail })

    return NextResponse.json({
      success: true,
      message: 'Primary admin email updated successfully',
      email: normalizedEmail,
    })
  } catch (error) {
    console.error('[Admin] Error setting primary email:', error)
    return NextResponse.json(
      { error: 'Failed to set primary email' },
      { status: 500 }
    )
  }
}
