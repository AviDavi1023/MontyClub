import { NextResponse } from 'next/server'
import { getDisplayCollection } from '@/lib/collections-db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const collection = await getDisplayCollection()
    if (!collection) {
      return NextResponse.json({ collection: null })
    }

    return NextResponse.json({ collection: {
      id: collection.id,
      name: collection.name,
      statusEnabled: collection.statusEnabled ?? true,
    } })
  } catch (err) {
    console.error('Error fetching collection settings:', err)
    return NextResponse.json({ collection: null }, { status: 500 })
  }
}
