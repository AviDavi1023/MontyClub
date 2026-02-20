import { NextResponse } from 'next/server'
import * as ExcelJS from 'exceljs'
import { listCollections } from '@/lib/collections-db'
import { createRegistration, listRegistrations, deleteRegistration } from '@/lib/registrations-db'
import { ClubRegistration } from '@/types/club'
import { parseExcelToRegistrations } from '@/lib/clubs'
import { nanoid } from 'nanoid'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const collectionId = formData.get('collectionId') as string
    const importModeRaw = formData.get('importMode') as string
    const importMode: 'append' | 'replace' = importModeRaw === 'replace' ? 'replace' : 'append'
    
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

    // Get collection to verify it exists and get its name
    const collections = await listCollections()
    console.log(`[Upload Excel] Found ${collections.length} collections`)
    const collection = collections.find(c => c.id === collectionId)
    if (!collection) {
      console.error(`[Upload Excel] Collection not found with ID: "${collectionId}". Available IDs:`, collections.map(c => c.id))
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    console.log(`[Upload Excel] Using collection: ${collection.name} (ID: ${collection.id})`)

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

    // If replace mode, delete existing registrations for this collection
    let removedCount = 0
    if (importMode === 'replace') {
      try {
        const existingRegs = await listRegistrations({ collectionId })
        removedCount = existingRegs.length
        
        // Delete all existing registrations for this collection
        for (const reg of existingRegs) {
          await deleteRegistration(reg.id)
        }
      } catch (err) {
        console.error('Error deleting existing registrations:', err)
        // Continue anyway - the new ones will be added
      }
    }

    // Insert registrations into Postgres
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []
    
    console.log(`[Upload Excel] Starting import of ${registrations.length} registrations in batches`)
    
    // Process in optimized batches based on file size
    const batchSize = Math.max(3, Math.min(10, Math.ceil(100 / Math.sqrt(registrations.length))))
    const interBatchDelayMs = registrations.length > 100 ? 300 : 100
    
    console.log(`[Upload Excel] Batch size: ${batchSize}, inter-batch delay: ${interBatchDelayMs}ms`)
    
    for (let i = 0; i < registrations.length; i += batchSize) {
      const batch = registrations.slice(i, i + batchSize)
      
      // Process batch in parallel
      const batchPromises = batch.map(async (regData) => {
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

          await createRegistration(registration)
          successCount++
        } catch (err) {
          console.error('Error creating registration:', err)
          errors.push(`${regData.clubName || 'Unknown'}: ${err}`)
          errorCount++
        }
      })
      
      await Promise.all(batchPromises)
      
      console.log(`[Upload Excel] Batch complete: success=${successCount}, errors=${errorCount}`)
      
      // Delay between batches to avoid rate limiting (but not after last batch)
      if (i + batchSize < registrations.length) {
        await new Promise(resolve => setTimeout(resolve, interBatchDelayMs))
      }
    }

    // Verify registrations were actually saved
    let verifyRegs: typeof registrations = []
    let verifyError: string | null = null
    try {
      verifyRegs = await listRegistrations({ collectionId })
      console.log(`[Upload Excel] Verification: found ${verifyRegs.length} total registrations in collection (${verifyRegs.filter(r => r.status === 'approved').length} approved)`)
    } catch (err) {
      verifyError = String(err)
      console.error('[Upload Excel] Failed to verify registrations:', err)
    }
    
    return NextResponse.json({
      message: `Imported ${successCount} clubs into ${collection.name}${importMode === 'replace' ? ` (replaced ${removedCount} existing)` : ''}${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
      successCount,
      errorCount,
      totalProcessed: registrations.length,
      importMode,
      removedCount,
      errors: errorCount > 0 ? errors.slice(0, 5) : undefined, // Include first 5 errors if any
      verification: {
        totalInCollection: verifyRegs.length,
        approvedInCollection: verifyRegs.filter(r => r.status === 'approved').length,
        regsWithoutCollectionId: successCount > 0 ? registrations.slice(0, 1).map(r => r.collectionId) : [], // Debug: show collection ID
        verifyError: verifyError || undefined,
        searchedCollectionId: collectionId, // Let user see what collection ID we searched for
      }
    })
  } catch (error) {
    console.error('Error importing Excel file:', error)
    return NextResponse.json(
      { error: 'Error importing file', detail: String(error) },
      { status: 500 }
    )
  }
}