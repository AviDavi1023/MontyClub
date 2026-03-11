import { NextRequest, NextResponse } from 'next/server'
import { getRegistrationById } from '@/lib/registrations-db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const adminKey = request.headers.get('x-admin-key')
  const expectedKey = process.env.ADMIN_API_KEY

  if (!adminKey || adminKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id parameter is required' }, { status: 400 })
  }

  try {
    const registration = await getRegistrationById(id)
    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }
    return NextResponse.json({ registration })
  } catch (err) {
    console.error('[GET /api/admin/registration-by-id] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch registration', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
