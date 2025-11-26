import Link from 'next/link'
import { Club } from '@/types/club'
import { ClubCard } from '@/components/ClubCard'

interface SimilarClubsProps {
  currentClub: Club
  allClubs: Club[]
}

export function SimilarClubs({ currentClub, allClubs }: SimilarClubsProps) {
  // Tokenize helper: split on non-letters, lowercase, filter short words
  const tokenize = (text: string) =>
    (text || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w => w && w.length > 2)

  const currentTokens = new Set<string>([
    ...tokenize(currentClub.name),
    ...tokenize(currentClub.description),
    ...currentClub.keywords.map(k => k.toLowerCase()),
  ])

  const scoreClub = (club: Club): number => {
    let score = 0
    if (club.category === currentClub.category) score += 10
    const tokens = new Set<string>([
      ...tokenize(club.name),
      ...tokenize(club.description),
      ...club.keywords.map(k => k.toLowerCase()),
    ])
    let overlap = 0
    tokens.forEach(t => { if (currentTokens.has(t)) overlap++ })
    score += overlap // 1 point per overlapping token
    // Small boost if both have announcements
    if (club.announcement && currentClub.announcement) score += 2
    return score
  }

  const similarClubs = allClubs
    .filter(club => club.id !== currentClub.id && club.active)
    .map(club => ({ club, score: scoreClub(club) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.club)

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

