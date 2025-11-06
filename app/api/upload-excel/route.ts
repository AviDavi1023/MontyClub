import { NextResponse } from 'next/server'
import { writeFile as fsWriteFile } from 'fs/promises'
import { join } from 'path'
import { writeFile as runtimeWriteFile } from '@/lib/runtime-store'

function isRunningInReadOnlyEnv() {
  return !!process.env.VERCEL
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Verify file type
    if (!file.name.endsWith('.xlsx')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an Excel (.xlsx) file.' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    // Try to persist using runtime store (KV preferred). If KV is configured this will
    // persist on Vercel. Otherwise, attempt local filesystem write (dev).
    try {
      const res = await runtimeWriteFile('clubData.xlsx', buffer)
      if (res.persisted === 'kv') {
        return NextResponse.json({ message: 'File uploaded successfully (stored in KV)' })
      }
      if (res.persisted === 'fs') {
        return NextResponse.json({ message: 'File uploaded successfully (stored on disk)' })
      }
      // persisted to memory fallback
      return NextResponse.json({ message: 'File uploaded to in-memory store (non-durable in this environment)' })
    } catch (err) {
      console.error('Upload persistence failed, attempting filesystem write fallback:', err)
      // Last resort: try writing directly to disk (may fail on Vercel)
      const path = join(process.cwd(), 'clubData.xlsx')
      await fsWriteFile(path, buffer)
      return NextResponse.json({ message: 'File uploaded (fs fallback)' })
    }
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Error uploading file' },
      { status: 500 }
    )
  }
}