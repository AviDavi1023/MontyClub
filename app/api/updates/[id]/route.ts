import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

async function ensureDataFile() {
  const dir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir)
  }

  const file = path.join(dir, 'updates.json')
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '[]')
  }

  return file
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()
    const file = await ensureDataFile()
    const content = await fs.promises.readFile(file, 'utf-8')
    const arr = JSON.parse(content)

    const idx = arr.findIndex((e: any) => String(e.id) === String(id))
    if (idx === -1) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Only allow updating certain fields (reviewed, maybe notes)
    const allowed: any = {}
    if (typeof body.reviewed !== 'undefined') allowed.reviewed = !!body.reviewed

    arr[idx] = { ...arr[idx], ...allowed }

    await fs.promises.writeFile(file, JSON.stringify(arr, null, 2), 'utf-8')

    return NextResponse.json(arr[idx])
  } catch (error) {
    console.error('Error updating updates file:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const file = await ensureDataFile()
    const content = await fs.promises.readFile(file, 'utf-8')
    let arr = JSON.parse(content)

    const idx = arr.findIndex((e: any) => String(e.id) === String(id))
    if (idx === -1) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const removed = arr.splice(idx, 1)[0]
    await fs.promises.writeFile(file, JSON.stringify(arr, null, 2), 'utf-8')

    return NextResponse.json(removed)
  } catch (error) {
    console.error('Error deleting update entry:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
