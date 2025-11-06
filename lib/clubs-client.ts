import { Club } from '@/types/club'

// Mock data for client-side components
function getMockClubs(): Club[] {
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

// This will be used for client-side components
export async function getClubs(): Promise<Club[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
    // Add timestamp to URL to bust cache and ensure no-cache headers
    const timestamp = new Date().getTime()
    const response = await fetch(`${baseUrl}/api/clubs?_=${timestamp}`, { 
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    if (!response.ok) {
      throw new Error('Failed to fetch clubs')
    }
    const data = await response.json();
    console.log('[DEBUG] Clubs data from API:', {
      totalClubs: data.length,
      clubsWithAnnouncements: data.filter((c: any) => c.announcement).length,
      announcements: data.map((c: any) => ({
        id: c.id,
        name: c.name,
        announcement: c.announcement
      }))
    });
    return data
  } catch (error) {
    console.error('Error fetching clubs from API:', error)
    // Fallback to mock data
    return getMockClubs()
  }
}