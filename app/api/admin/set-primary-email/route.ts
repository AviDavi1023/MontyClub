import { NextRequest, NextResponse } from 'next/server'
import { readData, writeData } from '@/lib/runtime-store'
import { AdminUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/set-primary-email
 * Set or update the primary admin's email for password reset notifications
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-admin-key')
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { email } = await request.json()

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      )
    }

    // Read admin users from runtime store
    const users: Record<string, AdminUser> = await readData('admin-users', {})

    // Find primary admin (or first admin if none marked as primary)
    let primaryAdminKey: string | null = null
    for (const [key, user] of Object.entries(users)) {
      if (user.isPrimary) {
        primaryAdminKey = key
        break
      }
    }

    // If no primary admin found, use the first one
    if (!primaryAdminKey) {
      const keys = Object.keys(users)
      if (keys.length === 0) {
        return NextResponse.json(
          { error: 'No admin users found. Complete initial setup first.' },
          { status: 404 }
        )
      }
      primaryAdminKey = keys[0]
      users[primaryAdminKey].isPrimary = true
    }

    // Update email
    users[primaryAdminKey].email = email.trim().toLowerCase()

    // Save updated users to runtime store
    const result = await writeData('admin-users', users)
    if (!result.ok) {
      return NextResponse.json(
        { error: 'Failed to update email' },
        { status: 500 }
      )
    }

    console.log(`[Admin] Primary admin email set to: ${email}`)

    return NextResponse.json({
      success: true,
      message: 'Primary admin email updated successfully',
      email: users[primaryAdminKey].email,
    })
  } catch (error) {
    console.error('[Admin] Error setting primary email:', error)
    return NextResponse.json(
      { error: 'Failed to set primary email' },
      { status: 500 }
    )
  }
}
