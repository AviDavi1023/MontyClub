import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/validate-key
 * Test if an API key is valid
 * 
 * Used by admin panel to validate the API key before operations
 * Request: { apiKey: string }
 * Returns: { valid: true } or { valid: false }
 */
export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json()

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return NextResponse.json(
        { valid: false, error: 'API key is required' },
        { status: 400 }
      )
    }

    const expectedKey = process.env.ADMIN_API_KEY

    if (!expectedKey) {
      console.error('[ValidateKey] CRITICAL: ADMIN_API_KEY not configured in environment')
      console.error('[ValidateKey] Please set ADMIN_API_KEY in your Vercel environment variables')
      return NextResponse.json(
        { valid: false, error: 'Server configuration error: ADMIN_API_KEY not set. Contact administrator.' },
        { status: 500 }
      )
    }

    const isValid = apiKey.trim() === expectedKey.trim()

    if (isValid) {
      console.log('[ValidateKey] ✅ Valid API key provided')
      return NextResponse.json({ valid: true })
    } else {
      console.log('[ValidateKey] ❌ Invalid API key provided')
      console.log(`[ValidateKey] Key length: ${apiKey.trim().length}, Expected length: ${expectedKey.trim().length}`)
      return NextResponse.json(
        { valid: false, error: 'Invalid API key. After factory reset, keys must be re-entered.' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('[ValidateKey] Error validating key:', error)
    return NextResponse.json(
      { valid: false, error: 'Validation failed' },
      { status: 500 }
    )
  }
}
