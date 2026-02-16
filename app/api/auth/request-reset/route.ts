import { NextRequest, NextResponse } from 'next/server'
import { createPasswordResetToken, AdminUser } from '@/lib/auth'
import { readJSONFromStorage } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/request-reset
 * Request a password reset - sends notification to primary admin's email
 * 
 * In production, this sends an email to the primary admin for approval
 */
export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json()

    if (!username || typeof username !== 'string' || username.trim() === '') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    // Verify user exists
    const users = await readJSONFromStorage('settings/admin-users.json')
    const userList: AdminUser[] = Array.isArray(users) ? users : []
    const userExists = userList.some((u: AdminUser) => u.username === username.trim())

    if (!userExists) {
      // Don't reveal whether user exists for security
      return NextResponse.json(
        { 
          success: true,
          message: 'If the username exists, a reset request has been sent to the primary administrator.'
        }
      )
    }

    // Find primary admin
    const primaryAdmin = userList.find((u: AdminUser) => u.isPrimary)
    
    if (!primaryAdmin?.email) {
      console.error('[Auth] No primary admin email configured for password reset')
      return NextResponse.json(
        { 
          success: true,
          message: 'Password reset request received. Contact your system administrator.'
        }
      )
    }

    // Generate reset token (valid for 60 minutes since admin needs to approve)
    const token = createPasswordResetToken(username.trim(), 60)

    console.log(`[Auth] Reset request for user: ${username}`)
    console.log(`[Auth] Token generated: ${token}`)
    console.log(`[Auth] Would send email to primary admin: ${primaryAdmin.email}`)

    // TODO: In production, send email to primaryAdmin.email with:
    // - Username requesting reset
    // - Reset token to forward
    // - Link to reset page with pre-filled token
    // Example email template:
    // Subject: Password Reset Request for ${username}
    // Body: Admin user "${username}" has requested a password reset.
    //       Forward this code to them: ${token}
    //       This code expires in 60 minutes.

    // For now (development/testing), return the token
    return NextResponse.json({
      success: true,
      message: `Reset request sent to primary administrator (${primaryAdmin.email}). They will receive a reset code to forward to you.`,
      resetCode: token, // Remove this in production - only send via email
      note: 'Token expires in 60 minutes'
    })
  } catch (error) {
    console.error('[Auth] Error requesting password reset:', error)
    return NextResponse.json(
      { error: 'Failed to process reset request' },
      { status: 500 }
    )
  }
}
