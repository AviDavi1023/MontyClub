import { NextRequest, NextResponse } from 'next/server'
import { verifyResetToken, markResetTokenAsUsed, hashPassword, invalidateUserResetTokens } from '@/lib/auth'
import { readJSONFromStorage, writeJSONToStorage } from '@/lib/supabase'
import { AdminUser } from '@/types/club'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/reset-password
 * Reset admin password using a valid reset token
 * 
 * Request: { resetToken: string, newPassword: string }
 * Validates token, updates password, marks token as used
 */
export async function POST(request: NextRequest) {
  try {
    const { resetToken, newPassword } = await request.json()

    if (!resetToken || typeof resetToken !== 'string' || resetToken.trim() === '') {
      return NextResponse.json(
        { error: 'Reset token is required' },
        { status: 400 }
      )
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Verify reset token
    const username = verifyResetToken(resetToken.trim())
    if (!username) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 401 }
      )
    }

    // Read admin users
    const usersData = await readJSONFromStorage('settings/admin-users.json')
    const users: AdminUser[] = Array.isArray(usersData) ? usersData : []

    // Find and update user
    const userIndex = users.findIndex(u => u.username === username)
    if (userIndex === -1) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Update password and mark token as used
    users[userIndex].passwordHash = hashPassword(newPassword)
    users[userIndex].lastPasswordChange = new Date().toISOString()

    // Save updated users
    const success = await writeJSONToStorage('settings/admin-users.json', users)
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      )
    }

    // Mark token as used to prevent replay
    markResetTokenAsUsed(resetToken)

    // Invalidate all other reset tokens for this user
    invalidateUserResetTokens(username)

    console.log(`[Auth] Password reset successful for user: ${username}`)

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.'
    })
  } catch (error) {
    console.error('[Auth] Error resetting password:', error)
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    )
  }
}
