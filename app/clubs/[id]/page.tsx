import { notFound } from 'next/navigation'
import { ClubDetail } from '@/components/ClubDetail'
import { Header } from '@/components/Header'
import { slugifyName } from '@/lib/slug'
import { fetchClubs } from '@/lib/clubs'
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
// Don't generate static params - let Next.js handle this dynamically
export const dynamicParams = true
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const clubs = await fetchClubs()
    
    // Find club by slug (slugified name)
    const club = clubs.find((c: any) => slugifyName(c.name) === slug)
    
    if (!club) notFound()

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
          <ClubDetail club={club} allClubs={clubs} />
        </main>
      </div>
    )
  } catch (error) {
    console.error('Error in ClubPage:', error)
    notFound()
  }
}
