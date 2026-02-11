import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST() {
  return NextResponse.json({ error: 'Not Found' }, { status: 404 })
}
