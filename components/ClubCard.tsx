import Link from 'next/link'
import { Club } from '@/types/club'
import { Calendar, MapPin, Users } from 'lucide-react'
import formatMeetingFrequency from '@/lib/meetingFrequency'
import { Megaphone } from 'lucide-react'

interface ClubCardProps {
  club: Club
}

export function ClubCard({ club }: ClubCardProps) {
  // Debug log when club card renders
  console.log(`[DEBUG] ClubCard rendering for ${club.name}:`, {
    id: club.id,
    hasAnnouncement: !!club.announcement,
    announcement: club.announcement
  });

  return (
    <Link href={`/clubs/${club.id}`} className="block">
      <div className="card hover:shadow-md transition-shadow duration-200">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
              {club.name}
            </h3>
          </div>

          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              club.active
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            {club.active ? 'Open' : 'Closed'}
          </span>
        </div>

        {club.announcement && (
          <div className="mb-3 flex items-center gap-2 text-sm text-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-200 p-2 rounded">
            <Megaphone className="h-4 w-4" />
            <span className="line-clamp-2">{club.announcement}</span>
          </div>
        )}

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
          {club.description}
        </p>

        <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-accent-blue dark:text-accent-blue/80" />
            <div className="flex flex-col">
              <span>{club.meetingTime}</span>
              {club.meetingFrequency && (
                <span className="text-xs text-gray-500 dark:text-gray-400">{formatMeetingFrequency(club.meetingFrequency)}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-accent-pink dark:text-accent-pink/80" />
            <span>{club.location}</span>
          </div>

          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-accent-purple dark:text-accent-purple/80" />
            <span>{club.category}</span>
          </div>
        </div>

        {club.keywords && club.keywords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
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
