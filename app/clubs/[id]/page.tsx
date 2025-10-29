import { notFound } from 'next/navigation'
import { Club } from '@/types/club'
import { fetchClubsFromExcel } from '@/lib/clubs'
import { ClubDetail } from '@/components/ClubDetail'
import { Header } from '@/components/Header'

interface ClubPageProps {
  params: {
    id: string
  }
}

export async function generateStaticParams() {
  const clubs = await fetchClubsFromExcel()
  return clubs.map((club) => ({
    id: club.id,
  }))
}

export default async function ClubPage({ params }: ClubPageProps) {
  const clubs = await fetchClubsFromExcel()
  const club = clubs.find(c => c.id === params.id)

  if (!club) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <ClubDetail club={club} allClubs={clubs} />
      </main>
    </div>
  )
}
