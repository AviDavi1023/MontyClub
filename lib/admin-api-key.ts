import { NextResponse } from 'next/server'

/**
 * Validates x-admin-key header against ADMIN_API_KEY.
 * Returns a NextResponse on failure, or null when authorized.
 */
export function requireAdminApiKey(request: Request): NextResponse | null {
  const expectedKey = process.env.ADMIN_API_KEY
  if (!expectedKey) {
    return NextResponse.json(
      { error: 'Server not configured: ADMIN_API_KEY not set' },
      { status: 500 }
    )
  }

  const providedKey = request.headers.get('x-admin-key')
  if (!providedKey || providedKey.trim() !== expectedKey.trim()) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return null
}
