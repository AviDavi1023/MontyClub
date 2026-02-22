import { memo, useMemo } from 'react'
import { Club } from '@/types/club'
import { ClubCard } from '@/components/ClubCard'

interface SimilarClubsProps {
  currentClub: Club
  allClubs: Club[]
}

interface ScoredClub {
  club: Club
  score: number
  reasons: string[]
}

function SimilarClubsComponent({ currentClub, allClubs }: SimilarClubsProps) {
  // Category hierarchy for related clubs (groups of similar categories)
  const categoryRelations = useMemo(() => new Map<string, Set<string>>([
    ['Academic', new Set(['Academic', 'STEM', 'Education', 'Debate/Political'])],
    ['STEM', new Set(['STEM', 'Academic', 'Education', 'Business'])],
    ['Education', new Set(['Education', 'Academic', 'STEM', 'Business'])],
    ['Debate/Political', new Set(['Debate/Political', 'Academic', 'Business'])],
    ['Performing Arts', new Set(['Performing Arts', 'Culture', 'Cultural/Religious', 'Arts'])],
    ['Culture', new Set(['Culture', 'Cultural/Religious', 'Performing Arts', 'Service'])],
    ['Cultural/Religious', new Set(['Cultural/Religious', 'Culture', 'Performing Arts'])],
    ['Arts', new Set(['Arts', 'Performing Arts', 'Culture'])],
    ['Service', new Set(['Service', 'Awareness', 'Culture', 'Education'])],
    ['Awareness', new Set(['Awareness', 'Service', 'Culture', 'Business'])],
    ['Social', new Set(['Social', 'Culture', 'Service', 'Awareness'])],
    ['Business', new Set(['Business', 'Academic', 'STEM', 'Debate/Political'])],
    ['Other', new Set(['Other'])],
  ]), [])

  // Tokenization function
  const tokenize = useMemo(() => {
    return (text: string) =>
      (text || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(w => w && w.length > 2)
  }, [])

  // Extract current club features
  const currentFeatures = useMemo(() => {
    const nameTokens = new Set(tokenize(currentClub.name))
    const descTokens = new Set(tokenize(currentClub.description))
    const keywords = new Set(
      (currentClub.keywords || [])
        .flatMap(k => tokenize(k))
        .filter(t => t && t.length > 3) // Longer keywords more meaningful
    )

    return {
      nameTokens,
      descTokens,
      keywords,
      category: currentClub.category,
      meetingDay: currentClub.meetingTime?.toLowerCase() || '',
      meetingFrequency: currentClub.meetingFrequency?.toLowerCase() || '',
      hasAnnouncement: !!currentClub.announcement,
    }
  }, [currentClub, tokenize])

  // Memoized similarity scoring function with detailed reasoning
  const scoreClub = useMemo(() => {
    return (club: Club): ScoredClub => {
      const reasons: string[] = []
      let score = 0

      // 1. Category matching (up to 25 points)
      const relatedCategories = categoryRelations.get(currentClub.category) || new Set()
      if (club.category === currentClub.category) {
        score += 25
        reasons.push('exact-category')
      } else if (relatedCategories.has(club.category)) {
        score += 15
        reasons.push('related-category')
      }

      // 2. Meeting time alignment (up to 20 points)
      const clubMeetingDay = club.meetingTime?.toLowerCase() || ''
      const clubMeetingFreq = club.meetingFrequency?.toLowerCase() || ''
      
      if (currentFeatures.meetingDay && clubMeetingDay === currentFeatures.meetingDay) {
        score += 20
        reasons.push('same-day')
      } else if (currentFeatures.meetingFrequency && clubMeetingFreq === currentFeatures.meetingFrequency) {
        score += 12
        reasons.push('same-frequency')
      }

      // 3. Text similarity (up to 30 points)
      const clubNameTokens = new Set(tokenize(club.name))
      const clubDescTokens = new Set(tokenize(club.description))
      
      // Name overlap (most important) - shared words in names = very relevant
      let nameOverlap = 0
      currentFeatures.nameTokens.forEach(t => {
        if (clubNameTokens.has(t) && t.length > 3) nameOverlap += 3 // Weight longer tokens more
        else if (clubNameTokens.has(t)) nameOverlap += 1
      })
      
      // Description overlap (moderate importance)
      let descOverlap = 0
      currentFeatures.descTokens.forEach(t => {
        if (clubDescTokens.has(t)) descOverlap += 0.5
      })

      score += Math.min(nameOverlap * 2, 20) // Cap name matching at 20 points
      score += Math.min(descOverlap, 10)

      if (nameOverlap > 0) reasons.push('name-match')
      if (descOverlap > 3) reasons.push('description-match')

      // 4. Keywords matching (up to 15 points)
      const clubKeywords = new Set(
        (club.keywords || [])
          .flatMap(k => tokenize(k))
          .filter(t => t && t.length > 3)
      )
      
      let keywordOverlap = 0
      currentFeatures.keywords.forEach(k => {
        if (clubKeywords.has(k)) keywordOverlap++
      })
      
      score += Math.min(keywordOverlap * 3, 15)
      if (keywordOverlap > 0) reasons.push('shared-keywords')

      // 5. Announcement presence (bonus 5 points)
      if (currentFeatures.hasAnnouncement && club.announcement) {
        score += 5
        reasons.push('both-have-announcements')
      }

      return { club, score, reasons }
    }
  }, [currentClub.category, currentFeatures, categoryRelations, tokenize])

  // Memoized similar clubs calculation
  const similarClubs = useMemo(() => {
    return allClubs
      .filter(club => club.id !== currentClub.id && club.active)
      .map(scoreClub)
      .filter(x => x.score > 0)
      .sort((a, b) => {
        // Primary: score
        if (b.score !== a.score) return b.score - a.score
        // Tiebreaker: prioritize exact category match
        const aHasExactCategory = a.reasons.includes('exact-category')
        const bHasExactCategory = b.reasons.includes('exact-category')
        if (aHasExactCategory !== bHasExactCategory) return aHasExactCategory ? -1 : 1
        // Secondary tiebreaker: same meeting day
        const aHasSameDay = a.reasons.includes('same-day')
        const bHasSameDay = b.reasons.includes('same-day')
        if (aHasSameDay !== bHasSameDay) return aHasSameDay ? -1 : 1
        return 0
      })
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
  // This prevents unnecessary re-renders on every parent render
  return (
    prevProps.currentClub.id === nextProps.currentClub.id &&
    prevProps.allClubs.length === nextProps.allClubs.length
  )
})
