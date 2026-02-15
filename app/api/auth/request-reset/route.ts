import { NextRequest, NextResponse } from 'next/server'
import { createPasswordResetToken } from '@/lib/auth'
import { readJSONFromStorage } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/request-reset
 * Request a password reset token for a username
 * 
 * Returns a short code that the user can use to reset their password
 * In production, this would send an email; for now, we return the token
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
    const userExists = users && Array.isArray(users) && users.some((u: any) => u.username === username.trim())

    if (!userExists) {
      // Don't reveal whether user exists for security
      return NextResponse.json(
        { 
          success: true,
          message: 'If the username exists, a reset code has been generated. Check your email or contact administrator.'
        }
      )
    }

    // Generate reset token (valid for 15 minutes)
    const token = createPasswordResetToken(username.trim(), 15)

    console.log(`[Auth] Reset token generated for user: ${username}`)

    // In production, send this via email
    // For now, return it so admin can share/test
    return NextResponse.json({
      success: true,
      message: 'Reset code generated. In production, this would be sent via email.',
      resetCode: token, // Only return in development - in production never expose
      note: 'This token expires in 15 minutes'
    })
  } catch (error) {
    console.error('[Auth] Error requesting password reset:', error)
    return NextResponse.json(
      { error: 'Failed to generate reset token' },
      { status: 500 }
    )
  }
}
