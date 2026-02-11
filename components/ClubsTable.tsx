'use client'

import { Club } from '@/types/club'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useCallback } from 'react'
import { slugifyName } from '@/lib/slug'

interface ClubsTableProps {
  clubs: Club[]
  pendingAnnouncements?: Record<string, string>
}

export function ClubsTable({ clubs, pendingAnnouncements = {} }: ClubsTableProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryString = searchParams?.toString() ? `?${searchParams.toString()}` : ''
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const navigateToClub = useCallback((club: Club) => {
    setLoadingId(club.id)
    // navigation will unmount component shortly; spinner gives immediate feedback
    const slug = slugifyName(club.name)
    router.push(`/clubs/${slug}${queryString}`)
  }, [router, queryString])
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Club Name
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Category
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
              Meeting Time
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
              Frequency
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
              Advisor
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden xl:table-cell">
              Location
            </th>
            <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <span className="sr-only">View</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {clubs.map((club) => (
            <tr
              key={club.id}
              role="link"
              tabIndex={0}
              aria-label={`View details for ${club.name}`}
              onClick={() => navigateToClub(club)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigateToClub(club)
                }
              }}
              className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
            >
              <td className="px-4 py-3 max-w-xs">
                <div className="flex flex-col">
                  <span 
                    className="text-sm font-medium text-gray-900 dark:text-white transition-colors"
                  >
                    {club.name}
                  </span>
                  {club.announcement && (
                    <div className="flex items-start gap-1 mt-0.5">
                      <Megaphone className="h-3 w-3 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">{club.announcement}</span>
                        {pendingAnnouncements[club.id] !== undefined && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 italic ml-1">Syncing...</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  club.active 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {club.active ? 'Open' : 'Closed'}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="text-sm text-gray-600 dark:text-gray-400">{club.category}</span>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 break-words">{club.meetingTime || '—'}</span>
              </td>
              <td className="px-4 py-3 hidden lg:table-cell">
                <span className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 break-words">{club.meetingFrequency || '—'}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap hidden lg:table-cell">
                <span className="text-sm text-gray-600 dark:text-gray-400">{club.advisor || '—'}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap hidden xl:table-cell">
                <span className="text-sm text-gray-600 dark:text-gray-400">{club.location || '—'}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-center text-sm">
                {loadingId === club.id ? (
                  <div className="inline-flex items-center justify-center">
                    <span className="sr-only">Loading</span>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"></div>
                  </div>
                ) : (
                  <span className="text-primary-600 dark:text-primary-400 inline-flex items-center gap-1">
                    <span className="hidden sm:inline">View</span>
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {clubs.length === 0 && (
        <div className="text-center py-12 px-4">
          <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg">
            No clubs found
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm mt-2">
            Try adjusting your search or filters
          </p>
        </div>
      )}
    </div>
  )
}

function Megaphone({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  )
}
