import { Club } from '@/types/club'
import * as ExcelJS from 'exceljs'
import fs from 'fs'
import path from 'path'

export async function fetchClubsFromExcel(): Promise<Club[]> {
  try {
    const filePath = path.join(process.cwd(), 'clubData.xlsx')
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.warn('clubData.xlsx not found, using mock data')
      return getMockClubs()
    }

    // Read the Excel file using ExcelJS
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(filePath)
    
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
    return parseExcelData(dataRows)
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
    active: cellToString(row[10]).toLowerCase() === 'active' || 
            cellToString(row[10]).toLowerCase() === 'true' || 
            row[10] === 1 || row[10] === '1',
    gradeLevel: cellToString(row[11]),
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
      contact: 'debate@school.edu',
      socialMedia: '@schooldebate',
      active: true,
      gradeLevel: '9-12',
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
      contact: 'robotics@school.edu',
      socialMedia: '@schoolrobotics',
      active: true,
      gradeLevel: '9-12',
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
      contact: 'art@school.edu',
      socialMedia: '@schoolart',
      active: true,
      gradeLevel: '9-12',
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
      contact: 'environment@school.edu',
      socialMedia: '@schoolgreen',
      active: true,
      gradeLevel: '9-12',
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
      contact: 'chess@school.edu',
      socialMedia: '@schoolchess',
      active: false,
      gradeLevel: '9-12',
      keywords: ['strategy', 'games', 'tournament'],
    },
  ]
}