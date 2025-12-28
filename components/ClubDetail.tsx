
'use client'
import Link from 'next/link'
import { ArrowLeft, Calendar, MapPin, Users, Mail, ExternalLink, User, Megaphone, Share2, Check } from 'lucide-react'
import formatMeetingFrequency from '@/lib/meetingFrequency'
import { Club } from '@/types/club'
import { SimilarClubs } from '@/components/SimilarClubs'
import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { track } from '@/lib/analytics'
import { slugifyName } from '@/lib/slug'

interface ClubDetailProps {
  club: Club
  allClubs: Club[]
}

export function ClubDetail({ club, allClubs }: ClubDetailProps) {
  const searchParams = useSearchParams()
  const queryString = searchParams?.toString() ? `/?${searchParams.toString()}` : '/'
  const [copied, setCopied] = useState(false)
  const [hasPendingAnnouncement, setHasPendingAnnouncement] = useState(false)
  const [announcementsEnabled, setAnnouncementsEnabled] = useState(true)
  const ANNOUNCEMENTS_PENDING_KEY = 'montyclub:pendingAnnouncements'

  // Check if this club has a pending announcement in localStorage
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      // pick up announcementsEnabled quick override
      try {
        const override = localStorage.getItem('settings:announcementsEnabled')
        if (override === 'true' || override === 'false') {
          setAnnouncementsEnabled(override === 'true')
        }
      } catch {}
      const pending = localStorage.getItem(ANNOUNCEMENTS_PENDING_KEY)
      if (pending) {
        const parsed = JSON.parse(pending)
        if (parsed && parsed[club.id] !== undefined) {
          setHasPendingAnnouncement(true)
        }
      }
      // Also load server setting once
      fetch('/api/settings', { cache: 'no-store' }).then(async (resp) => {
        if (resp.ok) {
          const s = await resp.json()
          setAnnouncementsEnabled(s.announcementsEnabled !== false)
        }
      }).catch(() => {})
      // Listen for storage events to update enabled flag
      const onStorage = (e: StorageEvent) => {
        try {
          if (!e.key) return
          if (e.key === 'settings:announcementsEnabled' && typeof e.newValue === 'string') {
            setAnnouncementsEnabled(e.newValue === 'true')
          }
        } catch {}
      }
      window.addEventListener('storage', onStorage)
      return () => window.removeEventListener('storage', onStorage)
    } catch {}
  }, [club.id])

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/clubs/${slugifyName(club.name)}`
    
    // Check if Web Share API is available (mobile devices)
    if (navigator.share) {
      try {
        await navigator.share({
          title: club.name,
          text: `Check out ${club.name} - ${club.description}`,
          url: shareUrl,
        })
        track('ShareClick', { id: club.id, name: club.name })
      } catch (err) {
        // User cancelled share or error occurred
        console.log('Share cancelled or failed')
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        track('ShareClick', { id: club.id, name: club.name })
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
      {/* Back Button */}
      <Link
        href={queryString}
        className="inline-flex items-center gap-2 text-sm sm:text-base text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all clubs
      </Link>

      {/* Club Header */}
      <div className="card">
        {announcementsEnabled && club.announcement && (
          <div className="mb-3 sm:mb-4 flex items-start gap-2 sm:gap-3 text-xs sm:text-sm text-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-200 p-2.5 sm:p-3 rounded">
            <Megaphone className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div>{club.announcement}</div>
              {announcementsEnabled && hasPendingAnnouncement && (
                <div className="mt-1 text-xs text-yellow-700 dark:text-yellow-300 italic">Syncing...</div>
              )}
            </div>
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-2 break-words">
              {club.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              <span className="px-2.5 sm:px-3 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded-full">
                {club.category}
              </span>
              <span
                className={`px-2.5 sm:px-3 py-1 rounded-full ${
                  club.active
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}
              >
                {club.active ? 'Open' : 'Closed'}
              </span>
            </div>
          </div>
          
          {/* Share Button */}
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors text-sm sm:text-base whitespace-nowrap"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Link copied!
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                Share
              </>
            )}
          </button>
        </div>

        <p className="text-gray-700 dark:text-gray-300 text-sm sm:text-lg leading-relaxed mb-4 sm:mb-6">
          {club.description}
        </p>

        {/* Club Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">Meeting Time</h3>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 break-words">{club.meetingTime}</p>
                  {club.meetingFrequency && (
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">{formatMeetingFrequency(club.meetingFrequency)}</p>
                  )}
              </div>
            </div>

            <div className="flex items-start gap-2 sm:gap-3">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">Location</h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 break-words">{club.location}</p>
              </div>
            </div>

              <div className="flex items-start gap-2 sm:gap-3">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">Notes</h3>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 break-words">{club.notes || '—'}</p>
                </div>
              </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <User className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">Advisor</h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 break-words">{club.advisor}</p>
              </div>
            </div>

            <div className="flex items-start gap-2 sm:gap-3">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">Student Leader</h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 break-words">{club.studentLeader}</p>
              </div>
            </div>

            {club.contact && (
              <div className="flex items-start gap-2 sm:gap-3">
                <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">Contact</h3>
                  <a
                    href={`mailto:${club.contact}`}
                    className="text-sm sm:text-base text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 break-all"
                  >
                    {club.contact}
                  </a>
                </div>
              </div>
            )}

            {club.socialMedia && (
              <div className="flex items-start gap-2 sm:gap-3">
                <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">Social Media</h3>
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
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm sm:text-base text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 break-all">
                          {club.socialMedia}
                        </a>
                      )
                    }

                    // Fallback: render as plain text
                    return <span className="text-sm sm:text-base text-gray-600 dark:text-gray-400 break-all">{club.socialMedia}</span>
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Keywords */}
        {club.keywords.length > 0 && (
          <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white mb-2 sm:mb-3">Keywords</h3>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {club.keywords.map(keyword => (
                <span
                  key={keyword}
                  className="px-2 sm:px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs sm:text-sm rounded-full"
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


