import { NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'

function isRunningInReadOnlyEnv() {
  // Vercel typically mounts the function as read-only; a heuristic is to try to write to the project root
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
    // In production serverless environments the filesystem is read-only. Return a helpful
    // message rather than attempting to persist, or attempt and report failure.
    if (isRunningInReadOnlyEnv()) {
      // Optionally we could store in-memory (lost on redeploy). For now, inform the admin.
      return NextResponse.json({
        error: 'Uploads are disabled in this deployment (read-only filesystem). Please upload the Excel file to the repository directly.'
      }, { status: 501 })
    }

    // Write to the clubData.xlsx in the root directory (local/dev)
    const path = join(process.cwd(), 'clubData.xlsx')
    await writeFile(path, buffer)

    return NextResponse.json({ message: 'File uploaded successfully' })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Error uploading file' },
      { status: 500 }
    )
  }
}