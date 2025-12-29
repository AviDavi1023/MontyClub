import { memo, useMemo } from 'react'
import Link from 'next/link'
import { Club } from '@/types/club'
import { ClubCard } from '@/components/ClubCard'

interface SimilarClubsProps {
  currentClub: Club
  allClubs: Club[]
}

function SimilarClubsComponent({ currentClub, allClubs }: SimilarClubsProps) {
  // Memoized tokenization to avoid re-creating regex patterns
  const tokenize = useMemo(() => {
    return (text: string) =>
      (text || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(w => w && w.length > 2)
  }, [])

  // Memoize current club tokens
  const currentTokens = useMemo(
    () => new Set<string>([
      ...tokenize(currentClub.name),
      ...tokenize(currentClub.description),
      ...currentClub.keywords.map(k => k.toLowerCase()),
    ]),
    [currentClub.id, currentClub.name, currentClub.description, currentClub.keywords, tokenize]
  )

  // Memoize similarity scoring function
  const scoreClub = useMemo(() => {
    return (club: Club): number => {
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
  }, [currentClub, currentTokens, tokenize])

  // Memoize similar clubs calculation
  const similarClubs = useMemo(() => {
    return allClubs
      .filter(club => club.id !== currentClub.id && club.active)
      .map(club => ({ club, score: scoreClub(club) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(x => x.club)
  }, [allClubs, currentClub.id, scoreClub])

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

// Wrap in memo to prevent re-renders when parent props don't change
export const SimilarClubs = memo(SimilarClubsComponent, (prevProps, nextProps) => {
  // Only re-render if club ID or allClubs array length changes significantly
  // This prevents unnecessary re-scoring on every parent render
  return (
    prevProps.currentClub.id === nextProps.currentClub.id &&
    prevProps.allClubs.length === nextProps.allClubs.length
  )
})


