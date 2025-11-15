'use client'

import { Club } from '@/types/club'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

interface ClubsTableProps {
  clubs: Club[]
}

export function ClubsTable({ clubs }: ClubsTableProps) {
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
              className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <Link 
                    href={`/clubs/${club.id}`}
                    className="text-sm font-medium text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    {club.name}
                  </Link>
                  {club.announcement && (
                    <div className="flex items-start gap-1 mt-0.5">
                      <Megaphone className="h-3 w-3 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">{club.announcement}</span>
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
              <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                <span className="text-sm text-gray-600 dark:text-gray-400">{club.meetingTime || '—'}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap hidden lg:table-cell">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {club.meetingFrequency 
                    ? (club.meetingFrequency.length > 30 
                        ? club.meetingFrequency.substring(0, 30) + '...' 
                        : club.meetingFrequency)
                    : '—'}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap hidden lg:table-cell">
                <span className="text-sm text-gray-600 dark:text-gray-400">{club.advisor || '—'}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap hidden xl:table-cell">
                <span className="text-sm text-gray-600 dark:text-gray-400">{club.location || '—'}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-center text-sm">
                <Link 
                  href={`/clubs/${club.id}`}
                  className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 inline-flex items-center gap-1"
                >
                  <span className="hidden sm:inline">View</span>
                  <ExternalLink className="h-4 w-4" />
                </Link>
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
