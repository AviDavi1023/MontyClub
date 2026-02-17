import { NextRequest, NextResponse } from 'next/server'
import { getAdminUserByUsername, updateAdminUser } from '@/lib/admin-users-db'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/admin/users/email
 * Update an admin user's email address
 */
export async function PUT(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-admin-key')
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { username, email } = await request.json()

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      )
    }

    const existingUser = await getAdminUserByUsername(username)

    if (!existingUser) {
      return NextResponse.json(
        { error: `User ${username} not found` },
        { status: 404 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()
    await updateAdminUser(existingUser.username, { email: normalizedEmail })

    console.log(`[Admin] Updated email for user ${existingUser.username} to ${normalizedEmail}`)

    return NextResponse.json({
      success: true,
      message: 'Email updated successfully',
      user: {
        username: existingUser.username,
        email: normalizedEmail,
      }
    })
  } catch (error) {
    console.error('[Admin] Error updating user email:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
