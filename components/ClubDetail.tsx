import Link from 'next/link'
import { ArrowLeft, Calendar, MapPin, Users, Mail, ExternalLink, User } from 'lucide-react'
import formatMeetingFrequency from '@/lib/meetingFrequency'
import { Club } from '@/types/club'
import { SimilarClubs } from '@/components/SimilarClubs'

interface ClubDetailProps {
  club: Club
  allClubs: Club[]
}

export function ClubDetail({ club, allClubs }: ClubDetailProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back Button */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all clubs
      </Link>

      {/* Club Header */}
      <div className="card">
        {club.announcement && (
          <div className="mb-4 flex items-center gap-3 text-sm text-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-200 p-3 rounded">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3" /></svg>
            <div>{club.announcement}</div>
          </div>
        )}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {club.name}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded-full">
                {club.category}
              </span>
              <span
                className={`px-3 py-1 rounded-full ${
                  club.active
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}
              >
                {club.active ? 'Open' : 'Closed'}
              </span>
            </div>
          </div>
        </div>

        <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed mb-6">
          {club.description}
        </p>

        {/* Club Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5" />
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Meeting Time</h3>
                  <p className="text-gray-600 dark:text-gray-400">{club.meetingTime}</p>
                  {club.meetingFrequency && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{formatMeetingFrequency(club.meetingFrequency)}</p>
                  )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5" />
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Location</h3>
                <p className="text-gray-600 dark:text-gray-400">{club.location}</p>
              </div>
            </div>

              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Notes</h3>
                  <p className="text-gray-600 dark:text-gray-400">{club.notes || '—'}</p>
                </div>
              </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5" />
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Advisor</h3>
                <p className="text-gray-600 dark:text-gray-400">{club.advisor}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5" />
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Student Leader</h3>
                <p className="text-gray-600 dark:text-gray-400">{club.studentLeader}</p>
              </div>
            </div>

            {club.contact && (
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Contact</h3>
                  <a
                    href={`mailto:${club.contact}`}
                    className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    {club.contact}
                  </a>
                </div>
              </div>
            )}

            {club.socialMedia && (
              <div className="flex items-start gap-3">
                <ExternalLink className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Social Media</h3>
                  {(() => {
                    const s = String(club.socialMedia).trim()
                    let href: string | null = null

                    if (/^https?:\/\//i.test(s)) {
                      href = s
                    } else if (/^www\./i.test(s)) {
                      href = `https://${s}`
                    } else if (s.startsWith('@')) {
                      href = `https://instagram.com/${s.replace('@', '')}`
                    } else if (s.includes('.') && !s.includes(' ')) {
                      href = `https://${s}`
                    }

                    if (href) {
                      return (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
                          {club.socialMedia}
                        </a>
                      )
                    }

                    // Fallback: render as plain text
                    return <span className="text-gray-600 dark:text-gray-400">{club.socialMedia}</span>
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Keywords */}
        {club.keywords.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">Keywords</h3>
            <div className="flex flex-wrap gap-2">
              {club.keywords.map(keyword => (
                <span
                  key={keyword}
                  className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm rounded-full"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Similar Clubs */}
      <SimilarClubs currentClub={club} allClubs={allClubs} />
    </div>
  )
}
