import Link from 'next/link'
import { Club } from '@/types/club'
import { ClubCard } from '@/components/ClubCard'

interface SimilarClubsProps {
  currentClub: Club
  allClubs: Club[]
}

export function SimilarClubs({ currentClub, allClubs }: SimilarClubsProps) {
  // Find similar clubs based on category and keywords
  const similarClubs = allClubs
    .filter(club => 
      club.id !== currentClub.id && 
      club.active && // Only show active clubs
      (club.category === currentClub.category || 
       club.keywords.some(keyword => currentClub.keywords.includes(keyword)))
    )
    .slice(0, 3)

  if (similarClubs.length === 0) {
    return null
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Similar Clubs
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {similarClubs.map(club => (
          <ClubCard key={club.id} club={club} />
        ))}
      </div>
    </div>
  )
}
