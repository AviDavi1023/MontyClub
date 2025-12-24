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

    // Verify collection exists
    const collections: RegistrationCollection[] = await readData('settings/registration-collections', [])
    const targetCollection = collections.find(c => c.id === collectionId)
    if (!targetCollection) {
      return NextResponse.json(
        { error: 'Collection not found' },
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
    
    for (const regData of registrations) {
      try {
        const registration: ClubRegistration = {
          id: nanoid(),
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

        await writeJSONToStorage(`registrations/${collectionId}/${registration.id}.json`, registration)
        successCount++
      } catch (err) {
        console.error('Error creating registration:', err)
        errorCount++
      }
    }

    return NextResponse.json({
      message: `Imported ${successCount} clubs into ${targetCollection.name}`,
      successCount,
      errorCount,
      totalProcessed: registrations.length
    })
  } catch (error) {
    console.error('Error importing Excel file:', error)
    return NextResponse.json(
      { error: 'Error importing file', detail: String(error) },
      { status: 500 }
    )
  }
}