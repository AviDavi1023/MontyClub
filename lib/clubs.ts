import { readData } from '@/lib/runtime-store'
import { Club, ClubRegistration, RegistrationCollection } from '@/types/club'
import { slugifyName } from '@/lib/slug'
import { listPaths, readJSONFromStorage } from '@/lib/supabase'
import { readFile as runtimeReadFile } from '@/lib/runtime-store'
import { createClient } from '@supabase/supabase-js'
import { getAllAnnouncements } from '@/lib/announcements-db'

let syncChecked = false

async function syncClubsToPostgres(clubs: Club[]): Promise<void> {
  // Only try to sync once per server instance
  if (syncChecked) return
  syncChecked = true

  try {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return
    }

    const client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Check if we've already synced all clubs for this batch
    const { count: existingCount } = await (client.from('clubs') as any)
      .select('*', { count: 'exact', head: true })

    if (existingCount === clubs.length) {
      return
    }

    if (clubs.length === 0) {
      return
    }

    // Insert clubs into Postgres
    for (const club of clubs) {
      try {
        await (client.from('clubs') as any)
          .insert({
            id: club.id,
            name: club.name,
            category: club.category,
            description: club.description,
            advisor: club.advisor,
            student_leader: club.studentLeader,
            meeting_time: club.meetingTime,
            meeting_frequency: club.meetingFrequency || null,
            location: club.location,
            contact: club.contact,
            social_media: club.socialMedia,
            active: club.active,
            notes: club.notes || null,
            announcement: club.announcement || null,
            keywords: club.keywords || [],
          })
      } catch (e: any) {
        // Club insertion failed or already exists
      }
    }
  } catch (error) {
    console.error('[clubs-sync] Error syncing clubs to Postgres:', error)
    // Don't throw - this is a background sync operation
  }
}

export async function fetchClubsFromCollection(): Promise<Club[]> {
  // OPTIMIZATION: Try snapshot first for instant loading (100x faster)
  // Snapshot is generated via admin "Publish Catalog" action
  const snapshot = await readJSONFromStorage('settings/clubs-snapshot.json')
  if (snapshot && snapshot.clubs && Array.isArray(snapshot.clubs)) {
    const clubs: Club[] = snapshot.clubs
    
    // Merge announcements from Postgres
    try {
      const settings = await readData('settings', { announcementsEnabled: true })
      if (settings.announcementsEnabled !== false) {
        const announcements = await getAllAnnouncements()
        
        // Merge announcements into club objects
        clubs.forEach((c: Club) => {
          const idStr = String(c.id).trim()
          if (announcements[idStr]) {
            c.announcement = announcements[idStr]
          }
        })
      }
    } catch (err) {
      // Could not merge announcements from Postgres
    }
    
    // Sync to Postgres asynchronously (don't await - let it happen in background)
    syncClubsToPostgres(clubs).catch(e => console.error('[clubs-sync] Background sync failed:', e))
    
    return clubs
  }

  // FALLBACK: Dynamic fetch from registrations (used if snapshot doesn't exist)
  // This is normal if admin hasn't clicked "Publish Catalog" yet
  
  // 1. Get all collections and choose display collection (fallback to legacy enabled)
  const collections: RegistrationCollection[] = await readData('settings/registration-collections', [])
  const display = collections.find(c => c.display)
  const legacy = collections.find(c => c.enabled)
  const selected = display || legacy
  if (!selected) {
    return []
  }

  // 2. List all registration files for this collection
  const regPaths = await listPaths(`registrations/${selected.id}`)
  const jsonPaths = regPaths.filter(p => p.endsWith('.json'))
  
  // 3. Read all registrations in parallel for performance
  const registrationPromises = jsonPaths.map(path => readJSONFromStorage(path))
  const allRegs = await Promise.all(registrationPromises)
  
  const registrations: ClubRegistration[] = allRegs.filter(
    reg => reg && typeof reg === 'object' && reg.status === 'approved'
  )
  
  if (!registrations.length) {
    return []
  }

  // 3. Sort by approvedAt timestamp (newest first), fallback to submittedAt
  registrations.sort((a, b) => {
    const timeA = a.approvedAt ? new Date(a.approvedAt).getTime() : new Date(a.submittedAt).getTime()
    const timeB = b.approvedAt ? new Date(b.approvedAt).getTime() : new Date(b.submittedAt).getTime()
    return timeB - timeA
  })

  // 4. Map ClubRegistration to Club using the registration ID directly (unique and stable)
  // Prevents ID changes and avoids collisions entirely
  const clubs = registrations.map((r) => ({
    id: r.id,
    name: r.clubName,
    category: r.category || '',
    description: r.statementOfPurpose,
    advisor: r.advisorName,
    studentLeader: r.studentContactName,
    meetingTime: r.meetingDay,
    meetingFrequency: r.meetingFrequency,
    location: r.location,
    contact: r.studentContactEmail,
    socialMedia: r.socialMedia || '',
    active: true,
    notes: r.notes || '',
    announcement: '',
    keywords: [],
  }))

  // 5. Merge admin-managed announcements (if enabled) from Postgres
  try {
    const settings = await readData('settings', { announcementsEnabled: true })
    
    if (settings.announcementsEnabled !== false) {
      const announcements = await getAllAnnouncements()
      
      // Merge announcements where club id matches
      clubs.forEach((c: Club) => {
        const idStr = String(c.id).trim()
        if (announcements[idStr]) {
          c.announcement = announcements[idStr]
        }
      })
    }
  } catch (err) {
    // Could not merge announcements from Postgres
  }

  // Sync to Postgres asynchronously (don't await - let it happen in background)
  syncClubsToPostgres(clubs).catch(e => console.error('[clubs-sync] Background sync failed:', e))

  return clubs
}

import * as ExcelJS from 'exceljs'
import fs from 'fs'
import path from 'path'

// Fetch clubs from the active collection
export async function fetchClubs(): Promise<Club[]> {
  try {
    return await fetchClubsFromCollection()
  } catch (error) {
    console.error('Error fetching clubs:', error)
    return getMockClubs()
  }
}

/**
 * Fetch clubs from ALL collections with collection metadata.
 * Used for admin analytics to show stats across all collections.
 */
export async function fetchAllCollectionsClubs(): Promise<Array<{ collection: RegistrationCollection; clubs: Club[] }>> {
  try {
    // Import Postgres functions
    const { listCollections } = await import('@/lib/collections-db')
    const { listRegistrations } = await import('@/lib/registrations-db')

    // Get all collections from Postgres (the source of truth)
    const collections = await listCollections()
    
    if (!collections.length) {
      return []
    }

    // Fetch approved clubs for each collection in parallel from Postgres
    const results = await Promise.all(
      collections.map(async (collection) => {
        try {
          // Get approved registrations from Postgres for this collection
          const registrations = await listRegistrations({
            collectionId: collection.id,
            status: 'approved'
          })

          // Convert to Club objects
          const clubs = registrations.map((r) => ({
            id: r.id,
            name: r.clubName,
            category: r.category || '',
            description: r.statementOfPurpose,
            advisor: r.advisorName,
            studentLeader: r.studentContactName,
            meetingTime: r.meetingDay,
            meetingFrequency: r.meetingFrequency,
            location: r.location,
            contact: r.studentContactEmail,
            socialMedia: r.socialMedia || '',
            active: true,
            notes: r.notes || '',
            announcement: '',
            keywords: [],
          }))

          return { collection, clubs }
        } catch (error) {
          // Failed to fetch clubs for collection
          return { collection, clubs: [] }
        }
      })
    )

    const totalClubs = results.reduce((sum, r) => sum + r.clubs.length, 0)

    return results
  } catch (error) {
    return []
  }
}

export async function fetchClubsFromExcel(): Promise<Club[]> {
  try {
    // Prefer runtime store (KV or FS) for the clubData.xlsx blob
    let buffer: Buffer | null = null
    try {
      buffer = await runtimeReadFile('clubData.xlsx')
    } catch (e) {
      // runtimeReadFile not available
    }

    const filePath = path.join(process.cwd(), 'clubData.xlsx')
    if (!buffer) {
      if (!fs.existsSync(filePath)) {
        return getMockClubs()
      }
      buffer = await fs.promises.readFile(filePath)
    }

    // Read the Excel file using ExcelJS from buffer
    const workbook = new ExcelJS.Workbook()
  // ExcelJS expects a Node Buffer. Ensure we have one.
  const nodeBuffer = Buffer.isBuffer(buffer) ? (buffer as Buffer) : Buffer.from(buffer as any)
  await workbook.xlsx.load(nodeBuffer as any)
    
    const worksheet = workbook.worksheets[0] // Use first worksheet
    
    if (!worksheet) {
      return getMockClubs()
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
      return getMockClubs()
    }

    // Validate header row before parsing
    const [headerRow, ...dataRows] = rows
    const isValidHeader = validateExcelHeaders(headerRow)
    if (!isValidHeader) {
      return getMockClubs()
    }

    // Parse the data
    const clubs = parseExcelData(dataRows)


    // Merge admin-managed announcements (if any) from Postgres
    // But first check if announcements are enabled in settings
    try {
      const { readData } = require('@/lib/runtime-store')
      const settings = await readData('settings', { announcementsEnabled: true })
      
      if (settings.announcementsEnabled !== false) {
        const announcements = await getAllAnnouncements()
        
        // Merge announcements where club id matches
        clubs.forEach((c: Club) => {
          const idStr = String(c.id).trim()
          if (announcements[idStr]) {
            c.announcement = announcements[idStr]
          }
        })
      }
    } catch (err) {
      // Could not merge announcements from Postgres
    }

    return clubs
  } catch (error) {
    return getMockClubs()
  }
}

function validateExcelHeaders(headerRow: any[]): boolean {
  if (!headerRow || headerRow.length < 10) {
    return false
  }

  const cellToString = (v: any) => {
    if (v === null || typeof v === 'undefined') return ''
    if (typeof v === 'string') return v.trim().toLowerCase()
    if (typeof v === 'object' && 'text' in v) return String(v.text).trim().toLowerCase()
    return String(v).trim().toLowerCase()
  }

  // Expected headers with flexible matching
  const expectedHeaders = [
    { col: 0, names: ['id', 'club id', 'clubid'] },
    { col: 1, names: ['name', 'club name', 'clubname'] },
    { col: 2, names: ['category'] },
    { col: 3, names: ['description'] },
    { col: 4, names: ['advisor'] },
    { col: 5, names: ['student leader', 'studentleader', 'leader'] },
    { col: 6, names: ['meeting time', 'meetingtime', 'time'] },
    { col: 7, names: ['location', 'room'] },
    { col: 8, names: ['contact', 'email'] },
    { col: 9, names: ['social media', 'socialmedia', 'social'] },
  ]

  let matchCount = 0
  for (const expected of expectedHeaders) {
    const cellValue = cellToString(headerRow[expected.col])
    if (expected.names.some(name => cellValue.includes(name) || name.includes(cellValue))) {
      matchCount++
    }
  }

  // Require at least 8 out of 10 core headers to match
  if (matchCount < 8) {
    return false
  }

  return true
}

function parseExcelData(rows: any[][]): Club[] {
  const cellToString = (v: any) => {
    if (v === null || typeof v === 'undefined') return ''
    if (typeof v === 'string') return v
    if (typeof v === 'number') return String(v)
    if (typeof v === 'object') {
      // ExcelJS hyperlink/text object
      if ('hyperlink' in v && v.hyperlink) return String(v.hyperlink)
      if ('text' in v && v.text) return String(v.text)
      if (Array.isArray((v as any).richText)) return (v as any).richText.map((r: any) => r.text || '').join('')
      if ('result' in v && v.result) return String((v as any).result)
      try {
        return JSON.stringify(v)
      } catch (e) {
        return String(v)
      }
    }
    return String(v)
  }

  return rows.map((row, index) => ({
    id: cellToString(row[0]) || `club-${index}`,
    name: cellToString(row[1]),
    category: cellToString(row[2]),
    description: cellToString(row[3]),
    advisor: cellToString(row[4]),
    studentLeader: cellToString(row[5]),
    meetingTime: cellToString(row[6]),
    // Optional meetingFrequency column (if present in Excel it can be used to capture
    // patterns like "Weekly", "1st and 3rd weeks", "Once per quarter", etc.)
    meetingFrequency: row[13] ? cellToString(row[13]) : '',
    location: cellToString(row[7]),
    contact: cellToString(row[8]),
    socialMedia: cellToString(row[9]),
    // Accept both legacy 'active' and new 'open' wording (and truthy values)
    active: cellToString(row[10]).toLowerCase() === 'active' || 
      cellToString(row[10]).toLowerCase() === 'open' || 
      cellToString(row[10]).toLowerCase() === 'true' || 
            row[10] === 1 || row[10] === '1',
    // Notes are expected to be in the same column where gradeLevel used to be (column 12, index 11)
    // We also support an 'announcement' extracted from the notes if the notes include
    // a line prefixed with ANNOUNCE:, ANNOUNCEMENT:, ALERT:, or AN:
    notes: (() => {
      const raw = cellToString(row[11])
      return raw
    })(),
    // Announcements are taken from column Q (index 16) when present
    announcement: row[16] ? cellToString(row[16]).trim() : '',
  keywords: row[12] ? cellToString(row[12]).split(',').map((k: string) => k.trim()).filter((k: string) => k) : [],
  })).filter(club => club.name) // Filter out empty rows
}

// Parse Excel rows into ClubRegistration objects for importing into a collection
export function parseExcelToRegistrations(rows: any[][]): Partial<ClubRegistration>[] {
  const cellToString = (v: any) => {
    if (v === null || typeof v === 'undefined') return ''
    if (typeof v === 'string') return v
    if (typeof v === 'number') return String(v)
    if (typeof v === 'object') {
      if ('hyperlink' in v && v.hyperlink) return String(v.hyperlink)
      if ('text' in v && v.text) return String(v.text)
      if (Array.isArray((v as any).richText)) return (v as any).richText.map((r: any) => r.text || '').join('')
      if ('result' in v && v.result) return String((v as any).result)
      try {
        return JSON.stringify(v)
      } catch (e) {
        return String(v)
      }
    }
    return String(v)
  }

  return rows.map((row, index) => {
    const clubName = cellToString(row[1])
    if (!clubName) return null // Skip empty rows
    
    return {
      clubName,
      category: cellToString(row[2]),
      statementOfPurpose: cellToString(row[3]),
      advisorName: cellToString(row[4]),
      studentContactName: cellToString(row[5]),
      meetingDay: cellToString(row[6]),
      location: cellToString(row[7]),
      studentContactEmail: cellToString(row[8]),
      socialMedia: cellToString(row[9]),
      meetingFrequency: row[13] ? cellToString(row[13]) : '',
      notes: cellToString(row[11]),
      status: 'approved' as const,
      submittedAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
    }
  }).filter(Boolean) as Partial<ClubRegistration>[]
}

export function getMockClubs(): Club[] {
  return [
    {
      id: '1',
      name: 'Debate Club',
      category: 'Academic',
      description: 'Develop public speaking and critical thinking skills through competitive debate.',
      advisor: 'Ms. Johnson',
      studentLeader: 'Alex Chen',
      meetingTime: 'Tuesdays 3:30 PM',
      meetingFrequency: 'Weekly',
      location: 'Room 201',
      notes: 'Runs weekly; check announcements for tournament dates.',
      contact: 'debate@school.edu',
      socialMedia: '@schooldebate',
      active: true,
      keywords: ['speaking', 'competition', 'academic'],
    },
    {
      id: '2',
      name: 'Robotics Team',
      category: 'STEM',
      description: 'Build and program robots for competitions and projects.',
      advisor: 'Mr. Smith',
      studentLeader: 'Sarah Kim',
      meetingTime: 'Wednesdays 4:00 PM',
      meetingFrequency: '1st and 3rd weeks of the month',
      location: 'Tech Lab',
      notes: 'Tryouts in September; competition season in winter.',
      contact: 'robotics@school.edu',
      socialMedia: '@schoolrobotics',
      active: true,
      keywords: ['engineering', 'programming', 'competition'],
    },
    {
      id: '3',
      name: 'Art Society',
      category: 'Arts',
      description: 'Explore various art forms and showcase student creativity.',
      advisor: 'Ms. Davis',
      studentLeader: 'Maya Patel',
      meetingTime: 'Thursdays 3:45 PM',
      meetingFrequency: '2nd and 4th weeks of the month',
      location: 'Art Studio',
      notes: 'Gallery night planned for November 12.',
      contact: 'art@school.edu',
      socialMedia: '@schoolart',
      active: true,
      keywords: ['creativity', 'visual arts', 'exhibition'],
    },
    {
      id: '4',
      name: 'Environmental Club',
      category: 'Service',
      description: 'Promote environmental awareness and sustainability initiatives.',
      advisor: 'Mr. Green',
      studentLeader: 'Jordan Lee',
      meetingTime: 'Mondays 3:30 PM',
      meetingFrequency: 'Once per quarter',
      location: 'Room 105',
      notes: 'Planting event on 10/15; sign up required.',
      contact: 'environment@school.edu',
      socialMedia: '@schoolgreen',
      active: true,
      keywords: ['sustainability', 'environment', 'service'],
    },
    {
      id: '5',
      name: 'Chess Club',
      category: 'Academic',
      description: 'Learn and play chess, participate in tournaments.',
      advisor: 'Ms. Wilson',
      studentLeader: 'David Park',
      meetingTime: 'Fridays 3:30 PM',
      meetingFrequency: '4th week only',
      location: 'Library',
      notes: 'Casual play; tournaments announced when available.',
      contact: 'chess@school.edu',
      socialMedia: '@schoolchess',
      active: false,
      keywords: ['strategy', 'games', 'tournament'],
    },
  ]
}