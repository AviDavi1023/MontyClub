import { NextResponse } from 'next/server'
import { fetchClubsFromExcel } from '@/lib/clubs'

export async function GET() {
  try {
    const clubs = await fetchClubsFromExcel()
    return NextResponse.json(clubs)
  } catch (error) {
    console.error('Error fetching clubs:', error)
    return NextResponse.json({ error: 'Failed to fetch clubs' }, { status: 500 })
  }
}
