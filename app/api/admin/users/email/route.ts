import { NextRequest, NextResponse } from 'next/server'
import { readData, writeData } from '@/lib/runtime-store'
import { AdminUser } from '@/lib/auth'

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

    // Read admin users
    const users: Record<string, AdminUser> = await readData('admin-users', {})

    // Find the user
    if (!users[username]) {
      return NextResponse.json(
        { error: `User ${username} not found` },
        { status: 404 }
      )
    }

    // Update email
    users[username].email = email.trim().toLowerCase()

    // Save updated users
    const result = await writeData('admin-users', users)
    if (!result.ok) {
      return NextResponse.json(
        { error: 'Failed to update email' },
        { status: 500 }
      )
    }

    console.log(`[Admin] Updated email for user ${username} to ${email}`)

    return NextResponse.json({
      success: true,
      message: 'Email updated successfully',
      user: {
        username,
        email: users[username].email,
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
