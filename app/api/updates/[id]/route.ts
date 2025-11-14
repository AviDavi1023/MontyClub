import { NextResponse } from 'next/server'
import { readData, writeData } from '@/lib/runtime-store'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    const arr = (await readData('updates', [])) || []

    const idx = arr.findIndex((e: any) => String(e.id) === String(id))
    if (idx === -1) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Only allow updating certain fields (reviewed, maybe notes)
    const allowed: any = {}
    if (typeof body.reviewed !== 'undefined') allowed.reviewed = !!body.reviewed

    arr[idx] = { ...arr[idx], ...allowed }
    
    console.log(`[PATCH /api/updates/${id}] Updating to:`, allowed)
    const writeResult = await writeData('updates', arr)
    console.log(`[PATCH /api/updates/${id}] Write result:`, writeResult)

    return NextResponse.json(arr[idx], {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Error updating updates file:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    let arr = (await readData('updates', [])) || []

    const idx = arr.findIndex((e: any) => String(e.id) === String(id))
    if (idx === -1) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const removed = arr.splice(idx, 1)[0]
    
    console.log(`[DELETE /api/updates/${id}] Deleting update`)
    const writeResult = await writeData('updates', arr)
    console.log(`[DELETE /api/updates/${id}] Write result:`, writeResult)

    return NextResponse.json(removed, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Error deleting update entry:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
