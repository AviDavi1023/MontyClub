// Fetch clubs from the currently enabled registration collection
import { readData } from '@/lib/runtime-store'
import { ClubRegistration, RegistrationCollection } from '@/types/club'
import { slugifyName } from '@/lib/slug'

export async function fetchClubsFromCollection(): Promise<Club[]> {
  // 1. Get all collections and find the enabled one
  const collections: RegistrationCollection[] = await readData('settings/registration-collections', [])
  const enabled = collections.find(c => c.enabled)
  if (!enabled) return []

  // 2. Get all registrations for this collection
  const registrations: ClubRegistration[] = await readData(`registrations/${enabled.id}`, [])
  // 3. Only include approved clubs
  const approved = registrations.filter(r => r.status === 'approved')
  if (!approved.length) return []

  // 4. Map ClubRegistration to Club
  return approved.map((r, idx) => ({
    id: r.id || `club-${idx}`,
    name: r.clubName,
    category: '', // You may want to add a category field to the registration form
    description: r.statementOfPurpose,
    advisor: r.advisorName,
    studentLeader: r.studentContactName,
    meetingTime: '', // Not collected in registration, add if needed
    meetingFrequency: r.meetingFrequency,
    location: r.location,
    contact: r.studentContactEmail,
    socialMedia: '', // Not collected in registration, add if needed
    active: true,
    notes: '',
    announcement: '',
    keywords: [],
  }))
}
import { Club } from '@/types/club'
import * as ExcelJS from 'exceljs'
import fs from 'fs'
import path from 'path'
import { readFile as runtimeReadFile } from '@/lib/runtime-store'

export async function fetchClubsFromExcel(): Promise<Club[]> {
  try {
    // Prefer runtime store (KV or FS) for the clubData.xlsx blob
    let buffer: Buffer | null = null
    try {
      buffer = await runtimeReadFile('clubData.xlsx')
    } catch (e) {
      console.warn('runtimeReadFile failed:', (e as any)?.message || e)
    }

    const filePath = path.join(process.cwd(), 'clubData.xlsx')
    if (!buffer) {
      if (!fs.existsSync(filePath)) {
        console.warn('clubData.xlsx not found, using mock data')
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
      console.warn('No worksheets found in Excel file')
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
      console.warn('Excel file has no data rows')
      return getMockClubs()
    }

    // Parse the data (skip header row)
    const [, ...dataRows] = rows
    const clubs = parseExcelData(dataRows)


    // Merge admin-managed announcements (if any) from runtime-store (Supabase, KV, or FS)
    // But first check if announcements are enabled in settings
    try {
      const { readData } = require('@/lib/runtime-store')
      const settings = await readData('settings', { announcementsEnabled: true })
      
      if (settings.announcementsEnabled !== false) {
        const mapRaw = await readData('announcements', {})
        const map: Record<string, string> = {}
        // Normalize keys to strings and trim values
        if (mapRaw && typeof mapRaw === 'object') {
          Object.keys(mapRaw).forEach((k) => {
            try {
              const v = (mapRaw as any)[k]
              if (typeof v === 'string' && v.trim() !== '') map[String(k).trim()] = v.trim()
              else if (v !== null && typeof v !== 'undefined') map[String(k).trim()] = String(v)
            } catch (e) {
              // ignore malformed entries
            }
          })
        }

        if (process.env.NODE_ENV !== 'production') {
          console.log('[DEBUG] Announcements map:', map)
        }
        
        // Merge announcements where club id matches (try numeric/string variants)
        clubs.forEach((c) => {
          const idStr = String(c.id).trim()
          const idNum = String(Number(c.id))
          if (map[idStr] && map[idStr].trim() !== '') {
            c.announcement = map[idStr].trim()
          } else if (map[idNum] && map[idNum].trim() !== '') {
            c.announcement = map[idNum].trim()
          }
        })
      }
    } catch (err) {
      console.warn('Could not merge announcements:', err)
    }

    return clubs
  } catch (error) {
    console.error('Error reading Excel file:', error)
    return getMockClubs()
  }
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