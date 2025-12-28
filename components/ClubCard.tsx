'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Club } from '@/types/club'
import { Calendar, MapPin, Users } from 'lucide-react'
import formatMeetingFrequency from '@/lib/meetingFrequency'
import { Megaphone } from 'lucide-react'
import { track } from '@/lib/analytics'

interface ClubCardProps {
  club: Club
  hasPendingAnnouncement?: boolean
}

export function ClubCard({ club, hasPendingAnnouncement }: ClubCardProps) {
  const searchParams = useSearchParams()
  const queryString = searchParams?.toString() ? `?${searchParams.toString()}` : ''
  
  return (
    <Link href={`/clubs/${club.id}${queryString}`} className="block group animate-fadeIn" onClick={() => track('ClubOpen', { id: club.id, name: club.name })}>
      <div className="card hover:shadow-lg transition-all duration-300 p-4 sm:p-6 group-hover:ring-2 group-hover:ring-primary-200 dark:group-hover:ring-primary-800 group-hover:bg-gradient-to-br group-hover:from-primary-50/30 group-hover:to-transparent dark:group-hover:from-primary-900/10 hover-lift">
        <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
          <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
              {club.name}
            </h3>
          </div>

          <span
            className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap flex-shrink-0 ${
              club.active
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            {club.active ? 'Open' : 'Closed'}
          </span>
        </div>

        {club.announcement && (
          <div className="mb-2 sm:mb-3 flex items-start gap-2 text-xs sm:text-sm text-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-200 p-2 rounded">
            <Megaphone className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="line-clamp-2">{club.announcement}</span>
              {hasPendingAnnouncement && (
                <span className="inline-block mt-1 text-xs text-yellow-700 dark:text-yellow-300 italic">Syncing...</span>
              )}
            </div>
          </div>
        )}

        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2 sm:mb-3 line-clamp-2">
          {club.description}
        </p>

        <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent-blue dark:text-accent-blue/80 flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="truncate">{club.meetingTime}</span>
              {club.meetingFrequency && (
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{formatMeetingFrequency(club.meetingFrequency)}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent-pink dark:text-accent-pink/80 flex-shrink-0" />
            <span className="truncate">{club.location}</span>
          </div>

          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent-purple dark:text-accent-purple/80 flex-shrink-0" />
            <span className="truncate">{club.category}</span>
          </div>
        </div>

        {club.keywords && club.keywords.length > 0 && (
          <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5">
            {club.keywords.slice(0, 3).map((keyword, idx) => (
              <span
                key={keyword}
                className={`px-2 py-1 text-xs rounded-full transition-colors ${
                  idx === 0 ? 'bg-accent-blue/10 text-accent-blue dark:text-accent-blue/90 ring-1 ring-accent-blue/20' :
                  idx === 1 ? 'bg-accent-purple/10 text-accent-purple dark:text-accent-purple/90 ring-1 ring-accent-purple/20' :
                  'bg-accent-pink/10 text-accent-pink dark:text-accent-pink/90 ring-1 ring-accent-pink/20'
                }`}
              >
                {keyword}
              </span>
            ))}
            {club.keywords.length > 3 && (
              <span className="px-2 py-1 text-gray-400 text-xs">
                +{club.keywords.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}


