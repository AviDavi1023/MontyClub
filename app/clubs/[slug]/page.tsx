import { notFound } from 'next/navigation'
import { ClubDetail } from '@/components/ClubDetail'
import { Header } from '@/components/Header'
import { slugifyName } from '@/lib/slug'
import { fetchClubs } from '@/lib/clubs'

// Don't generate static params - let Next.js handle this dynamically
export const dynamicParams = true
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const clubs = await fetchClubs()
    
    // Find club by slug (slugified name)
    let club = clubs.find((c: any) => slugifyName(c.name) === slug)
    // Fallback: if not found by slug, try direct id match for legacy links
    if (!club) {
      club = clubs.find((c: any) => String(c.id) === String(slug))
    }
    
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
