import { NextResponse } from 'next/server'
import * as ExcelJS from 'exceljs'
import { readData } from '@/lib/runtime-store'
import { writeJSONToStorage } from '@/lib/supabase'
import { RegistrationCollection, ClubRegistration } from '@/types/club'
import { parseExcelToRegistrations } from '@/lib/clubs'
import { nanoid } from 'nanoid'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const collectionId = formData.get('collectionId') as string
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    if (!collectionId) {
      return NextResponse.json(
        { error: 'No collection ID provided' },
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

    // Verify collection exists with retry for eventual consistency
    // This handles the case where a collection was just created and hasn't synced to storage yet
    let targetCollection: RegistrationCollection | undefined
    const maxRetries = 5
    const retryDelay = 300 // ms
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const collectionsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/registration-collections`)
      if (collectionsResponse.ok) {
        const collectionsData = await collectionsResponse.json()
        targetCollection = collectionsData.collections?.find((c: RegistrationCollection) => c.id === collectionId)
        if (targetCollection) break
      }
      
      // If not found and not last attempt, wait before retry
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
      }
    }
    
    if (!targetCollection) {
      return NextResponse.json(
        { error: 'Collection not found. If you just created this collection, please wait a moment and try again.' },
        { status: 404 }
      )
    }

    // Parse Excel file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as any)
    
    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      return NextResponse.json(
        { error: 'No worksheets found in Excel file' },
        { status: 400 }
      )
    }

    // Convert worksheet to array of rows
    const rows: any[][] = []
    worksheet.eachRow((row, rowNumber) => {
      const rowData: any[] = []
      row.eachCell((cell, colNumber) => {
        rowData[colNumber - 1] = cell.value
      })
      rows.push(rowData)
    })

    if (rows.length < 2) {
      return NextResponse.json(
        { error: 'Excel file has no data rows' },
        { status: 400 }
      )
    }

    // Skip header row and parse data
    const [headerRow, ...dataRows] = rows
    const registrations = parseExcelToRegistrations(dataRows)

    if (registrations.length === 0) {
      return NextResponse.json(
        { error: 'No valid club data found in Excel file' },
        { status: 400 }
      )
    }

    // Create registrations in the collection
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []
    
    // Helper function to write with retry logic
    const writeWithRetry = async (path: string, data: any, retries = 3): Promise<boolean> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          await writeJSONToStorage(path, data)
          return true
        } catch (err: any) {
          const is502 = err?.originalError?.status === 502 || err?.message?.includes('502')
          const isRateLimit = err?.originalError?.status === 429 || err?.message?.includes('429')
          
          if ((is502 || isRateLimit) && attempt < retries) {
            // Wait with exponential backoff for transient errors
            await new Promise(resolve => setTimeout(resolve, attempt * 1000))
            continue
          }
          throw err
        }
      }
      return false
    }
    
    // Process in batches to avoid overwhelming Supabase
    const batchSize = 5
    for (let i = 0; i < registrations.length; i += batchSize) {
      const batch = registrations.slice(i, i + batchSize)
      
      await Promise.all(batch.map(async (regData) => {
        try {
          const registration: ClubRegistration = {
            id: nanoid(),
            collectionId: collectionId,
            email: regData.studentContactEmail || '',
            clubName: regData.clubName || '',
            advisorName: regData.advisorName || '',
            statementOfPurpose: regData.statementOfPurpose || '',
            location: regData.location || '',
            meetingDay: regData.meetingDay || '',
            meetingFrequency: regData.meetingFrequency || '',
            studentContactName: regData.studentContactName || '',
            studentContactEmail: regData.studentContactEmail || '',
            advisorAgreementDate: new Date().toISOString(),
            clubAgreementDate: new Date().toISOString(),
            submittedAt: regData.submittedAt || new Date().toISOString(),
            status: 'approved',
            category: regData.category || '',
            socialMedia: regData.socialMedia || '',
            notes: regData.notes || '',
            approvedAt: new Date().toISOString(),
          }

          await writeWithRetry(`registrations/${collectionId}/${registration.id}.json`, registration)
          successCount++
        } catch (err) {
          console.error('Error creating registration:', err)
          errors.push(`${regData.clubName || 'Unknown'}: ${err}`)
          errorCount++
        }
      }))
      
      // Delay between batches to avoid rate limiting
      if (i + batchSize < registrations.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    return NextResponse.json({
      message: `Imported ${successCount} clubs into ${targetCollection.name}${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
      successCount,
      errorCount,
      totalProcessed: registrations.length,
      errors: errorCount > 0 ? errors.slice(0, 5) : undefined // Include first 5 errors if any
    })
  } catch (error) {
    console.error('Error importing Excel file:', error)
    return NextResponse.json(
      { error: 'Error importing file', detail: String(error) },
      { status: 500 }
    )
  }
}