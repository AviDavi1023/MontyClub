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

export async function GET() {
  try {
    const file = await ensureDataFile()
    const content = await fs.promises.readFile(file, 'utf-8')
    const data = JSON.parse(content)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error reading updates file:', error)
    return NextResponse.json({ error: 'Failed to read updates' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const file = await ensureDataFile()
    const content = await fs.promises.readFile(file, 'utf-8')
    const arr = JSON.parse(content)

    const entry = {
      id: String(Date.now()),
      ...body,
      createdAt: new Date().toISOString(),
      reviewed: false,
    }

    // Prepend newest first
    arr.unshift(entry)

    await fs.promises.writeFile(file, JSON.stringify(arr, null, 2), 'utf-8')

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error('Error writing updates file:', error)
    return NextResponse.json({ error: 'Failed to save update' }, { status: 500 })
  }
}
