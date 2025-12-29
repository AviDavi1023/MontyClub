import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ClubDetail } from '@/components/ClubDetail'
import { ClubDetailSkeleton } from '@/components/ClubDetailSkeleton'
import { Header } from '@/components/Header'
import { slugifyName } from '@/lib/slug'
import { fetchClubs } from '@/lib/clubs'

// Don't generate static params - let Next.js handle this dynamically
export const dynamicParams = true
export const dynamic = 'force-dynamic'
export const revalidate = 0

async function ClubContent({ slug }: { slug: string }) {
  try {
    const clubs = await fetchClubs()
    
    // Find club by slug (slugified name)
    let club = clubs.find((c: any) => slugifyName(c.name) === slug)
    // Fallback: if not found by slug, try direct id match for legacy links
    if (!club) {
      club = clubs.find((c: any) => String(c.id) === String(slug))
    }
    
    if (!club) notFound()

    return <ClubDetail club={club} allClubs={clubs} />
  } catch (error) {
    console.error('Error in ClubContent:', error)
    notFound()
  }
}

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <Suspense fallback={<ClubDetailSkeleton />}>
          <ClubContent slug={slug} />
        </Suspense>
      </main>
    </div>
  )
}
