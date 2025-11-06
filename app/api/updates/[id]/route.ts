import { NextResponse } from 'next/server'
import { readData, writeData } from '@/lib/runtime-store'


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
    await writeData('updates', arr)

    return NextResponse.json(arr[idx])
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
    await writeData('updates', arr)

    return NextResponse.json(removed)
  } catch (error) {
    console.error('Error deleting update entry:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
