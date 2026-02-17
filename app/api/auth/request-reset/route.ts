import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createPasswordResetToken, AdminUser } from '@/lib/auth'
import { readData } from '@/lib/runtime-store'

export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY || '')

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
    const users: Record<string, AdminUser> = await readData('admin-users', {})
    const normalizedUsername = username.trim().toLowerCase()
    const userKey = Object.keys(users).find(
      key => key.toLowerCase() === normalizedUsername
    )

    if (!userKey) {
      // Don't reveal whether user exists for security
      return NextResponse.json(
        { 
          success: true,
          message: 'If the username exists, a reset request has been sent to the primary administrator.'
        }
      )
    }

    // Find primary admin
    const primaryAdmin = Object.values(users).find((u: AdminUser) => u.isPrimary)
    
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
    console.log(`[Auth] Sending reset email to primary admin: ${primaryAdmin.email}`)

    if (!process.env.RESEND_API_KEY) {
      console.error('[Auth] RESEND_API_KEY is not configured')
      return NextResponse.json(
        { error: 'Email provider is not configured' },
        { status: 500 }
      )
    }

    const { data, error: sendError } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: primaryAdmin.email,
      subject: `Password Reset Request for ${username.trim()}`,
      html: `
        <p>Admin user <strong>${username.trim()}</strong> has requested a password reset.</p>
        <p>Forward this reset code to them:</p>
        <p style="font-size: 20px; font-weight: bold; letter-spacing: 1px;">${token}</p>
        <p>This code expires in 60 minutes.</p>
      `
    })

    if (sendError) {
      console.error('[Auth] Resend failed:', sendError)
      return NextResponse.json(
        { error: 'Failed to send reset email' },
        { status: 502 }
      )
    }

    if (!data?.id) {
      console.warn('[Auth] Resend response missing email id')
    }

    const includeToken = process.env.NODE_ENV !== 'production'

    return NextResponse.json({
      success: true,
      message: `Reset request sent to primary administrator (${primaryAdmin.email}). They will receive a reset code to forward to you.`,
      ...(includeToken ? { resetCode: token } : {}),
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
