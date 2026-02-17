import { NextResponse } from 'next/server'
import { countAdminUsers } from '@/lib/admin-users-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const hasSupabaseUrl = Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)

  if (!hasServiceKey || !hasSupabaseUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Supabase admin client not configured',
        details: {
          hasSupabaseUrl,
          hasServiceRoleKey: hasServiceKey
        }
      },
      { status: 500 }
    )
  }

  try {
    const count = await countAdminUsers()
    return NextResponse.json({ ok: true, adminUserCount: count })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to query admin users',
        details: String(error)
      },
      { status: 500 }
    )
  }
}
