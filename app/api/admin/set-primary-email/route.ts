import { NextRequest, NextResponse } from 'next/server'
import { readJSONFromStorage, writeJSONToStorage } from '@/lib/supabase'
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

    // Read admin users
    const usersData = await readJSONFromStorage('settings/admin-users.json')
    const users: AdminUser[] = Array.isArray(usersData) ? usersData : []

    // Find primary admin (or first admin if none marked as primary)
    let primaryAdmin = users.find(u => u.isPrimary)
    if (!primaryAdmin && users.length > 0) {
      primaryAdmin = users[0]
      primaryAdmin.isPrimary = true
    }

    if (!primaryAdmin) {
      return NextResponse.json(
        { error: 'No admin users found. Complete initial setup first.' },
        { status: 404 }
      )
    }

    // Update email
    primaryAdmin.email = email.trim().toLowerCase()

    // Save updated users
    const success = await writeJSONToStorage('settings/admin-users.json', users)
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update email' },
        { status: 500 }
      )
    }

    console.log(`[Admin] Primary admin email set to: ${email}`)

    return NextResponse.json({
      success: true,
      message: 'Primary admin email updated successfully',
      email: primaryAdmin.email,
    })
  } catch (error) {
    console.error('[Admin] Error setting primary email:', error)
    return NextResponse.json(
      { error: 'Failed to set primary email' },
      { status: 500 }
    )
  }
}
