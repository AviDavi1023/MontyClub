import { NextResponse } from 'next/server'
import { verifyPassword } from '@/lib/auth'
import { getAdminUserByUsername } from '@/lib/admin-users-db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    if (!body?.username || !body?.password || !body?.adminApiKey) {
      return NextResponse.json({ error: 'Username, password, and admin API key required' }, { status: 400 })
    }

    const { username, password, adminApiKey } = body

    if (!process.env.ADMIN_API_KEY || adminApiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const user = await getAdminUserByUsername(username)

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Verify password
    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Success - return user info only
    return NextResponse.json({
      success: true,
      user: {
        username: user.username,
        createdAt: user.createdAt,
        email: user.email,
        isPrimary: user.isPrimary,
      }
    })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
