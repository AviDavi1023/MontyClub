import { NextResponse } from 'next/server'
import { verifyPassword } from '@/lib/auth'
import { getAdminUserByUsername } from '@/lib/admin-users-db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    if (!body?.username || !body?.password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    const { username, password } = body

    const user = await getAdminUserByUsername(username)

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Verify password
    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Success - return user info and API key for authenticated admin operations.
    return NextResponse.json({
      success: true,
      apiKey: process.env.ADMIN_API_KEY,
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
