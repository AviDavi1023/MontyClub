'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Filter, ChevronDown, ChevronUp, ArrowUpDown, X, Grid3x3, List, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { track } from '@/lib/analytics'
import { Club, ClubFilters } from '@/types/club'
import formatMeetingFrequency from '@/lib/meetingFrequency'
import { getClubs } from '@/lib/clubs-client'
import { getUserFriendlyError } from '@/lib/error-messages'
import { ClubCard } from '@/components/ClubCard'
import { ClubsTable } from '@/components/ClubsTable'
import { FilterPanel } from '@/components/FilterPanel'
import { createDomainListener } from '@/lib/broadcast'
import { SkeletonGrid, SkeletonTable } from '@/components/SkeletonLoader'
import { EmptyState, LoadingState, Chip, Button } from '@/components/ui'
import { usePagination } from '@/lib/pagination'

export function ClubsList() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [localPendingAnnouncements, setLocalPendingAnnouncements] = useState<Record<string, string>>({})
  const [announcementsEnabled, setAnnouncementsEnabled] = useState<boolean>(true)
  const [clubDataSource, setClubDataSource] = useState<'excel' | 'collection'>('excel')
  const ANNOUNCEMENTS_PENDING_KEY = 'montyclub:pendingAnnouncements'
  const ANNOUNCEMENTS_BACKUP_KEY = 'montyclub:pendingAnnouncements:backup'
  // Start with filters hidden on mobile and medium screens (where they wrap 2x2), visible on large+ screens
  const [showFilters, setShowFilters] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false)
  const [updateCounter, setUpdateCounter] = useState(0)  // Add a counter to force re-renders
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 12 // Show 12 clubs per page
  const contentTopRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  function parseFiltersFromQuery(): ClubFilters {
    if (!searchParams) return {
      search: '',
      category: [],
      meetingDay: [],
      meetingFrequency: [],
      status: '',
      sort: 'relevant',
    }
    return {
      search: searchParams.get('search') || '',
      category: searchParams.getAll('category'),
      meetingDay: searchParams.getAll('meetingDay'),
      meetingFrequency: searchParams.getAll('meetingFrequency'),
      status: searchParams.get('status') || '',
      sort: searchParams.get('sort') || 'relevant',
    }
  }
  const [filters, setFilters] = useState<ClubFilters>(parseFiltersFromQuery())
  const filtersRef = useRef<ClubFilters>(parseFiltersFromQuery())
  
  // Local search state for immediate UI updates (to avoid slow typing)
  const [searchInput, setSearchInput] = useState(filters.search)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isTypingRef = useRef(false)
  const lastSearchRef = useRef(filters.search)

  // Sync filters state with URL query params
  useEffect(() => {
    const newFilters = parseFiltersFromQuery()
    setFilters(newFilters)
    filtersRef.current = newFilters
    const nextSearch = newFilters.search
    if (!isTypingRef.current || nextSearch === lastSearchRef.current) {
      setSearchInput(nextSearch)
      lastSearchRef.current = nextSearch
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    filtersRef.current = filters
  }, [filters])

  // Load view mode preference from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedView = localStorage.getItem('montyclub:viewMode')
      if (savedView === 'grid' || savedView === 'list') {
        setViewMode(savedView)
      }
    }
  }, [])

  // Save view mode preference to localStorage
  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('montyclub:viewMode', mode)
    }
    track('ViewChange', { mode })
  }

  // Exposed loader so we can re-run it from other event handlers (e.g. BroadcastChannel)
  const isMountedRef = useRef(true)
  async function loadClubs() {
    try {
      setLoading(true)  // Show loading state while refreshing
      const data = await getClubs()
      if (isMountedRef.current) {
        setClubs(data)
        setUpdateCounter(prev => prev + 1)  // Increment counter to force re-render
      }
      // Also refresh announcementsEnabled and dataSource from server
      try {
        const resp = await fetch('/api/settings', { cache: 'no-store' })
        if (resp.ok) {
          const s = await resp.json()
          setAnnouncementsEnabled(s.announcementsEnabled !== false)
          if (s.clubDataSource === 'excel' || s.clubDataSource === 'collection') {
            setClubDataSource(s.clubDataSource)
          }
        }
      } catch {}
    } catch (error) {
      console.error('Error loading clubs:', error)
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    loadClubs()

    // Listen for announcements updates across tabs
    const cleanupAnnouncements = createDomainListener('announcements', (action) => {
      loadClubs()
      try {
        const primary = localStorage.getItem(ANNOUNCEMENTS_PENDING_KEY)
        if (primary) {
          const parsed = JSON.parse(primary)
          if (parsed && typeof parsed === 'object') setLocalPendingAnnouncements(parsed)
        }
      } catch {}
    })

    // Listen for clubs domain events (e.g., collection changes)
    const cleanupClubs = createDomainListener('clubs', (action) => {
      loadClubs()
    })

    // Listen for same-tab updates (custom event)
    const onAnnouncementUpdate = () => {
      loadClubs()
      try {
        const primary = localStorage.getItem(ANNOUNCEMENTS_PENDING_KEY)
        if (primary) setLocalPendingAnnouncements(JSON.parse(primary))
      } catch {}
      // pick up immediate local override if present
      try {
        const override = localStorage.getItem('settings:announcementsEnabled')
        if (override === 'true' || override === 'false') {
          setAnnouncementsEnabled(override === 'true')
        }
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('announcements-updated', onAnnouncementUpdate)
    }

    // Listen for club data source changes (Excel/Collection)
    let dataSourceChannel: BroadcastChannel | null = null
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      dataSourceChannel = new window.BroadcastChannel('clubDataSource')
      dataSourceChannel.onmessage = (event) => {
        if (event.data === 'changed') loadClubs()
      }
    }

    // localStorage fallback (storage events fire across tabs/browsers)
    const onStorage = (e: StorageEvent) => {
      try {
        if (!e.key) return
        if (e.key === 'montyclub:announcementsUpdated') {
          loadClubs()
        } else if (e.key === ANNOUNCEMENTS_PENDING_KEY) {
          try {
            if (typeof e.newValue === 'string' && e.newValue.length > 0) {
              setLocalPendingAnnouncements(JSON.parse(e.newValue))
            } else {
              setLocalPendingAnnouncements({})
            }
          } catch {}
        } else if (e.key === 'settings:announcementsEnabled') {
          if (typeof e.newValue === 'string') {
            setAnnouncementsEnabled(e.newValue === 'true')
          }
        } else if (e.key === 'montyclub:clubDataSource') {
          loadClubs()
        }
      } catch (err) {
        // ignore
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage)
    }

    return () => {
      isMountedRef.current = false
      cleanupAnnouncements()
      cleanupClubs()
      if (typeof window !== 'undefined') {
        window.removeEventListener('announcements-updated', onAnnouncementUpdate)
        window.removeEventListener('storage', onStorage)
      }
      if (dataSourceChannel) dataSourceChannel.close()
    }
  }, [])

  // Load pending announcements overlay from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      // initial local override if present
      const override = localStorage.getItem('settings:announcementsEnabled')
      if (override === 'true' || override === 'false') {
        setAnnouncementsEnabled(override === 'true')
      }
      const primary = localStorage.getItem(ANNOUNCEMENTS_PENDING_KEY)
      if (primary) {
        const parsed = JSON.parse(primary)
        if (parsed && typeof parsed === 'object') setLocalPendingAnnouncements(parsed)
      } else {
        const backup = localStorage.getItem(ANNOUNCEMENTS_BACKUP_KEY)
        if (backup) {
          try {
            const bp = JSON.parse(backup)
            if (bp && bp.data) setLocalPendingAnnouncements(bp.data)
          } catch {}
        }
      }
    } catch {}
  }, [])

  const clubsOverlayed = useMemo(() => {
    // If announcements are disabled, don't overlay any announcements
    if (!announcementsEnabled) {
      return clubs.map(c => ({ ...c, announcement: '' }))
    }
    
    // If announcements are enabled, overlay pending announcements
    if (!localPendingAnnouncements || Object.keys(localPendingAnnouncements).length === 0) return clubs
    return clubs.map(c => ({
      ...c,
      announcement: (localPendingAnnouncements[c.id] ?? c.announcement) || ''
    }))
  }, [clubs, localPendingAnnouncements, announcementsEnabled])

  const filteredClubs = useMemo(() => {
    // Build a frequency map using normalized labels to group variants (e.g. "1st & 3rd weeks")
    const freqMap = new Map<string, { count: number; repr: string }>()
    clubsOverlayed.forEach((club) => {
      const raw = (club.meetingFrequency || '').trim()
      if (!raw) return
      const norm = formatMeetingFrequency(raw) || raw
      const key = norm.toLowerCase().trim()
      if (freqMap.has(key)) {
        freqMap.get(key)!.count += 1
      } else {
        freqMap.set(key, { count: 1, repr: norm })
      }
    })

    const outlierKeys = Array.from(freqMap.entries())
      .filter(([, v]) => v.count === 1)
      .map(([k]) => k)

    return clubsOverlayed.filter(club => {
      // Search filter - use searchInput for immediate filtering
      if (searchInput) {
        const searchLower = searchInput.toLowerCase().trim()
        // Combine several club fields into a single searchable string
        const fields = [
          club.name,
          club.description,
          club.category,
          club.advisor,
          club.studentLeader,
          club.location,
          ...(club.keywords || []),
        ]
        // Normalize whitespace and lowercase
        const haystack = fields.map(f => (f || '').toLowerCase()).join(' ').replace(/\s+/g, ' ').trim()
        if (!haystack.includes(searchLower)) return false
      }

      // Category filter (support multi-select)
      const selectedCategories = Array.isArray(filters.category)
        ? filters.category
        : (filters.category ? [filters.category] : [])
      if (selectedCategories && selectedCategories.length > 0 && !selectedCategories.includes(club.category)) {
        return false
      }

      // Meeting day filter (support multi-select)
      const selectedDays = Array.isArray(filters.meetingDay)
        ? filters.meetingDay
        : (filters.meetingDay ? [filters.meetingDay] : [])
      if (selectedDays && selectedDays.length > 0) {
        const clubMeetingLower = (club.meetingTime || '').toLowerCase()
        const matched = selectedDays.some((d) => clubMeetingLower.includes(String(d).toLowerCase()))
        if (!matched) return false
      }

      // Meeting frequency filter (support multi-select)
      const selectedFreqs = Array.isArray(filters.meetingFrequency)
        ? filters.meetingFrequency
        : (filters.meetingFrequency ? [filters.meetingFrequency] : [])
      if (selectedFreqs && selectedFreqs.length > 0) {
        const clubFreqRaw = (club.meetingFrequency || '').trim()
        const clubFreqNormLabel = (formatMeetingFrequency(clubFreqRaw) || clubFreqRaw || '')
        const clubFreqKey = clubFreqNormLabel.toLowerCase().trim()
        const clubFreqNorm = clubFreqNormLabel.toLowerCase()

        const matchedFreq = selectedFreqs.some((f) => {
          const fStr = String(f)
          if (fStr === 'Other') {
            // 'Other' matches any outlier (frequency normalized value used by only one club)
            return outlierKeys.includes(clubFreqKey)
          }
          const fLower = fStr.toLowerCase().trim()
          // Match by normalized equality, substring, or meetingTime text
          return clubFreqKey === fLower || clubFreqNorm.includes(fLower) || (club.meetingTime || '').toLowerCase().includes(fLower)
        })
        if (!matchedFreq) return false
      }

      // Status filter
      if (filters.status) {
        // status values are 'open' or 'closed'
        if (filters.status === 'open' && !club.active) return false
        if (filters.status === 'closed' && club.active) return false
      }

      // (Grade level removed — all clubs are for all grades)

      return true
    })
  }, [clubs, filters, searchInput])

  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(clubs.map(club => club.category))].filter(Boolean)
    return uniqueCategories.sort()
  }, [clubs])

  const frequencies = useMemo(() => {
    // Build frequency map using normalized labels so variants group together
    const freqMap = new Map<string, { count: number; repr: string }>()
    clubs.forEach((club) => {
      const raw = (club.meetingFrequency || '').trim()
      if (!raw) return
      const norm = formatMeetingFrequency(raw) || raw
      const key = norm.toLowerCase().trim()
      if (freqMap.has(key)) {
        freqMap.get(key)!.count += 1
      } else {
        freqMap.set(key, { count: 1, repr: norm })
      }
    })

    const frequent = Array.from(freqMap.entries())
      .filter(([, v]) => v.count > 1)
      .map(([, v]) => v.repr)
      .sort()

    const outliers = Array.from(freqMap.entries())
      .filter(([, v]) => v.count === 1)
      .map(([, v]) => v.repr)

    if (outliers.length > 0) {
      return [...frequent, 'Other']
    }

    return frequent
  }, [clubs])

  // Build a randomized order map when sort is 'random'
  const randomRankRef = useRef<Map<string, number> | null>(null)
  useEffect(() => {
    if ((filters.sort || 'relevant') === 'random') {
      const map = new Map<string, number>()
      const ids = clubs.map(c => c.id)
      // Fisher-Yates shuffle to assign ranks
      for (let i = ids.length - 1; i >= 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = ids[i]
        ids[i] = ids[j]
        ids[j] = tmp
      }
      ids.forEach((id, idx) => map.set(id, idx))
      randomRankRef.current = map
    } else {
      randomRankRef.current = null
    }
    // Rebuild when sort changes or clubs list changes
  }, [filters.sort, clubs])

  // Helper: get which week of the month a date falls into (1-5)
  // Week 1: days 1-7, Week 2: days 8-14, Week 3: days 15-21, Week 4: days 22-28, Week 5: days 29+
  function getWeekOfMonth(date: Date): number {
    return Math.ceil(date.getDate() / 7)
  }

  // Helper: parse frequency string to get allowed weeks
  function getAllowedWeeks(frequency: string): Set<number> {
    const freq = (frequency || '').toLowerCase().trim()
    // Weekly or empty = all weeks
    if (freq.includes('weekly') || freq === '') {
      return new Set([1, 2, 3, 4, 5])
    }
    
    // Extract specific weeks from patterns like "1st and 3rd weeks" or "1st & 3rd"
    const weeks = new Set<number>()
    if (freq.includes('1st')) weeks.add(1)
    if (freq.includes('2nd')) weeks.add(2)
    if (freq.includes('3rd')) weeks.add(3)
    if (freq.includes('4th')) weeks.add(4)
    if (freq.includes('5th')) weeks.add(5)
    
    // If we found specific weeks, use them; otherwise default to all
    return weeks.size > 0 ? weeks : new Set([1, 2, 3, 4, 5])
  }

  // Helper: find next occurrence of a meeting day that matches the frequency
  function getNextMeetingDate(meetingDay: string, frequency: string, currentDate: Date = new Date()): Date | null {
    if (!meetingDay || !meetingDay.trim()) return null
    
    const meetingDayLower = meetingDay.toLowerCase().trim()
    const allowedWeeks = getAllowedWeeks(frequency)
    
    // Map day names to day-of-week numbers
    const dayMap: Record<string, number> = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    }
    
    // Parse meeting days - handle multiple days separated by comma, slash, "and", or "&"
    const targetDays = new Set<number>()
    const dayPatterns = meetingDayLower.split(/[,/&]|and/).map(d => d.trim()).filter(Boolean)
    
    for (const pattern of dayPatterns) {
      // Try to match day names (remove "s" for plural variants like "Mondays" -> "Monday")
      const singularPattern = pattern.replace(/s$/, '')
      const dayNum = dayMap[pattern] ?? dayMap[singularPattern]
      if (dayNum !== undefined) {
        targetDays.add(dayNum)
      }
    }
    
    // If no days were parsed, return null
    if (targetDays.size === 0) return null
    
    // Search up to 6 weeks ahead for first matching day
    let searchDate = new Date(currentDate)
    searchDate.setHours(0, 0, 0, 0)
    
    for (let i = 0; i < 42; i++) {
      const week = getWeekOfMonth(searchDate)
      if (targetDays.has(searchDate.getDay()) && allowedWeeks.has(week)) {
        return new Date(searchDate)
      }
      searchDate.setDate(searchDate.getDate() + 1)
    }
    
    return null
  }

  // Helper: days between two dates
  function daysDifference(date1: Date, date2: Date): number {
    const d1 = new Date(date1)
    const d2 = new Date(date2)
    d1.setHours(0, 0, 0, 0)
    d2.setHours(0, 0, 0, 0)
    return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24))
  }

  // Score function for 'relevant' sorting: by next meeting date, with announcements prioritized
  function getRelevanceData(club: Club): { score: number; nextMeeting: Date | null; name: string; hasAnnouncement: boolean } {
    const hasAnnouncement = !!(club.announcement && club.announcement.trim())
    const nextMeeting = getNextMeetingDate(club.meetingTime, club.meetingFrequency || '')
    const today = new Date()
    
    // Announcements get highest priority (large boost)
    const announcementBoost = hasAnnouncement ? 10000000 : 0
    
    // Days until meeting: fewer days = higher score
    const daysUntil = nextMeeting ? daysDifference(nextMeeting, today) : 999
    const meetingScore = Math.max(0, 10000 - daysUntil) // Sooner meetings score higher
    
    const score = announcementBoost + meetingScore
    
    return {
      score,
      nextMeeting,
      name: club.name,
      hasAnnouncement,
    }
  }

  const sortedClubs = useMemo(() => {
    const sortMode = (filters.sort || 'relevant') as string
    const arr = [...filteredClubs]
    if (sortMode === 'az') {
      arr.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortMode === 'za') {
      arr.sort((a, b) => b.name.localeCompare(a.name))
    } else if (sortMode === 'random') {
      const map = randomRankRef.current
      if (map) {
        arr.sort((a, b) => (map.get(a.id) ?? 0) - (map.get(b.id) ?? 0))
      } else {
        // Fallback: simple random shuffle
        arr.sort(() => Math.random() - 0.5)
      }
    } else {
      // Relevant: by next meeting date, announcements first, then alphabetical tiebreaker
      arr.sort((a, b) => {
        const dataA = getRelevanceData(a)
        const dataB = getRelevanceData(b)
        
        // First: higher score (announcements + sooner meetings)
        if (dataA.score !== dataB.score) {
          return dataB.score - dataA.score
        }
        
        // Second: both have same score, sort by date
        if (dataA.nextMeeting && dataB.nextMeeting) {
          const dateCompare = dataA.nextMeeting.getTime() - dataB.nextMeeting.getTime()
          if (dateCompare !== 0) return dateCompare
        }
        
        // Third: same date, sort alphabetically
        return dataA.name.localeCompare(dataB.name)
      })
    }
    return arr
    // Include dependencies that affect sorting
  }, [filteredClubs, filters.sort, searchInput])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filters.sort, filters.search, filters.category, filters.meetingDay, filters.meetingFrequency, filters.status, searchInput])

  // Scroll to top when page changes
  useEffect(() => {
    if (contentTopRef.current) {
      contentTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [currentPage])

  // Paginate the sorted clubs
  const paginationResult = usePagination(sortedClubs, currentPage, ITEMS_PER_PAGE)
  const paginatedClubs = paginationResult.items

  // Update URL query params when filters change
  function updateQueryParams(newFilters: ClubFilters) {
    const params = new URLSearchParams()
    if (newFilters.search) params.set('search', newFilters.search)
    const categories = Array.isArray(newFilters.category) ? newFilters.category : (newFilters.category ? [newFilters.category] : [])
    categories.forEach((c: string) => params.append('category', c))
    const meetingDays = Array.isArray(newFilters.meetingDay) ? newFilters.meetingDay : (newFilters.meetingDay ? [newFilters.meetingDay] : [])
    meetingDays.forEach((d: string) => params.append('meetingDay', d))
    const meetingFrequencies = Array.isArray(newFilters.meetingFrequency) ? newFilters.meetingFrequency : (newFilters.meetingFrequency ? [newFilters.meetingFrequency] : [])
    meetingFrequencies.forEach((f: string) => params.append('meetingFrequency', f))
    if (newFilters.status) params.set('status', newFilters.status)
    if (newFilters.sort && newFilters.sort !== 'relevant') params.set('sort', newFilters.sort)
    const newUrl = params.toString() ? `/?${params.toString()}` : '/'
    router.replace(newUrl)

    // Track summarized filter state (no PII)
    track('FilterChange', {
      hasSearch: !!newFilters.search,
      categories: Array.isArray(newFilters.category) ? newFilters.category.length : (newFilters.category ? 1 : 0),
      meetingDays: Array.isArray(newFilters.meetingDay) ? newFilters.meetingDay.length : (newFilters.meetingDay ? 1 : 0),
      meetingFrequencies: Array.isArray(newFilters.meetingFrequency) ? newFilters.meetingFrequency.length : (newFilters.meetingFrequency ? 1 : 0),
      status: newFilters.status || 'any',
      sort: newFilters.sort || 'relevant',
    })
  }

  const clearFilters = () => {
    const cleared = {
      search: '',
      category: [],
      meetingDay: [],
      meetingFrequency: [],
      status: '',
      sort: 'relevant',
    }
    setSearchInput('')
    setFilters(cleared)
    filtersRef.current = cleared
    lastSearchRef.current = ''
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    updateQueryParams(cleared)
  }

  // Wrap setFilters to also update query params
  function setFiltersAndUpdate(newFilters: ClubFilters) {
    updateQueryParams(newFilters)
  }
  
  // Handle search input with debouncing for performance
  function handleSearchChange(value: string) {
    // Update local state immediately for fast UI response
    setSearchInput(value)
    lastSearchRef.current = value
    isTypingRef.current = true
    const nextFilters = { ...filtersRef.current, search: value }
    setFilters(nextFilters)
    filtersRef.current = nextFilters
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // Debounce URL update (300ms delay)
    searchTimeoutRef.current = setTimeout(() => {
      // Track only length, not the term
      track('Search', { qlen: value.trim().length })
      setFiltersAndUpdate(nextFilters)
      isTypingRef.current = false
    }, 300)
  }
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  const hasActiveFilters = searchInput !== '' || 
    Object.entries(filters).some(([key, value]) => {
      if (key === 'search' || key === 'sort') return false
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'string') return value !== ''
      return false
    })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Loading clubs..."
            disabled
            className="input-field w-full pl-10 pr-10 opacity-60"
          />
        </div>
        <LoadingState message="Loading clubs...">
          <p className="text-xs">This should only take a moment</p>
        </LoadingState>
        {viewMode === 'grid' ? <SkeletonGrid count={9} /> : <SkeletonTable rows={10} />}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Scroll target for pagination */}
      <div ref={contentTopRef} className="scroll-mt-4" />
      {/* Search and Filter Controls */}
      <div className="space-y-3 sm:space-y-4">
        {/* Search bar - full width */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary-500 h-5 w-5" />
          <input
            type="text"
            placeholder="Search clubs by name, keyword, advisor..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-11 pr-10 text-base py-3 rounded-lg border border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-gray-900 shadow focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition placeholder:font-medium placeholder:text-primary-600 dark:placeholder:text-primary-300"
            aria-label="Search clubs"
          />
          {searchInput && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setSearchInput('')
                setFilters(prev => ({ ...prev, search: '' }))
                filtersRef.current = { ...filtersRef.current, search: '' }
                lastSearchRef.current = ''
                isTypingRef.current = false
                if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
                setFiltersAndUpdate({ ...filtersRef.current, search: '' })
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-primary-400 hover:text-primary-600 dark:text-primary-300 dark:hover:text-primary-100 p-1 rounded"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Show Filters button - only when filters are hidden */}
        {!showFilters && (
          <button
            onClick={() => setShowFilters(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            <Filter className="h-4 w-4" />
            <span>Show Filters <span className="text-gray-500 dark:text-gray-400">(Category, Day, Frequency, Status)</span></span>
            <ChevronDown className="h-4 w-4" />
            {hasActiveFilters && (
              <span className="bg-primary-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                {Object.values(filters).filter((v) => Array.isArray(v) ? v.length > 0 : v !== '').length}
              </span>
            )}
          </button>
        )}

        {showFilters && (
          <FilterPanel
            filters={filters}
            setFilters={setFiltersAndUpdate}
            categories={categories}
            frequencies={frequencies}
            onClear={clearFilters}
            onToggle={() => setShowFilters(false)}
            showToggle={true}
            canClear={hasActiveFilters}
          />
        )}
      </div>

      {/* Results */}
      <div className="space-y-3 sm:space-y-4">
        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            {Array.isArray(filters.category) && filters.category.map((cat: string) => (
              <Chip
                key={`cat-${cat}`}
                label={`Category: ${cat}`}
                variant="primary"
                onRemove={() => {
                  const current = Array.isArray(filters.category) ? filters.category : []
                  const newCats = current.filter((c: string) => c !== cat)
                  setFiltersAndUpdate({ ...filters, category: newCats })
                }}
              />
            ))}
            {Array.isArray(filters.meetingDay) && filters.meetingDay.map((day: string) => (
              <Chip
                key={`day-${day}`}
                label={`${day}`}
                variant="primary"
                onRemove={() => {
                  const current = Array.isArray(filters.meetingDay) ? filters.meetingDay : []
                  const newDays = current.filter((d: string) => d !== day)
                  setFiltersAndUpdate({ ...filters, meetingDay: newDays })
                }}
              />
            ))}
            {Array.isArray(filters.meetingFrequency) && filters.meetingFrequency.map((freq: string) => (
              <Chip
                key={`freq-${freq}`}
                label={freq}
                variant="primary"
                onRemove={() => {
                  const current = Array.isArray(filters.meetingFrequency) ? filters.meetingFrequency : []
                  const newFreqs = current.filter((f: string) => f !== freq)
                  setFiltersAndUpdate({ ...filters, meetingFrequency: newFreqs })
                }}
              />
            ))}
            {filters.status && (
              <Chip
                key="status"
                label={`Status: ${filters.status === 'open' ? 'Open' : 'Closed'}`}
                variant="primary"
                onRemove={() => setFiltersAndUpdate({ ...filters, status: '' })}
              />
            )}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear All
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            {filteredClubs.length === 0 ? '0' : `${paginationResult.startIndex + 1}–${paginationResult.endIndex}`} of {filteredClubs.length} club{filteredClubs.length !== 1 ? 's' : ''}
          </p>
          
          <div className="flex items-center gap-3">
            {/* View switcher */}
                      {/* View Switcher */}
          <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg p-1">
            <button
              onClick={() => handleViewModeChange('grid')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Grid view"
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleViewModeChange('list')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-2 ml-6">
            <label className="flex items-center gap-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
              <ArrowUpDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Sort</span>
            </label>
            <select
              value={filters.sort || 'relevant'}
              onChange={(e) => {
                const v = e.target.value
                track('SortChange', { mode: v })
                setFiltersAndUpdate({ ...filters, sort: v })
              }}
              className="input-field text-xs sm:text-sm py-2"
            >
              <option value="relevant">Relevant</option>
              <option value="random">Random</option>
              <option value="az">A-Z</option>
              <option value="za">Z-A</option>
            </select>
          </div>
        </div>
        </div>

        {filteredClubs.length === 0 ? (
          clubs.length === 0 && clubDataSource === 'collection' ? (
            <EmptyState
              icon={<RefreshCw className="h-16 w-16 animate-spin text-amber-500" />}
              title="Collection Mode Active - No Clubs Available"
              description="The site is currently using Collection mode, but no club registrations have been approved yet. Admins can switch to Excel mode or approve registrations to display clubs."
            />
          ) : (
            <EmptyState
              icon={<Search className="h-16 w-16" />}
              title="No Clubs Found"
              description="Try adjusting your search or filters to find more clubs"
              action={
                hasActiveFilters ? (
                  <Button variant="primary" onClick={clearFilters}>
                    Clear All Filters
                  </Button>
                ) : null
              }
            />
          )
        ) : viewMode === 'grid' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {paginatedClubs.map(club => (
                <ClubCard key={club.id} club={club} hasPendingAnnouncement={localPendingAnnouncements[club.id] !== undefined} />
              ))}
            </div>
            {/* Pagination Controls */}
            {paginationResult.totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 py-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={!paginationResult.hasPrevPage}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="text-sm font-medium">Previous</span>
                </button>
                
                <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-thin">
                  {Array.from({ length: paginationResult.totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
                        page === paginationResult.currentPage
                          ? 'bg-primary-600 text-white'
                          : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(paginationResult.totalPages, prev + 1))}
                  disabled={!paginationResult.hasNextPage}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                >
                  <span className="text-sm font-medium">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <ClubsTable clubs={paginatedClubs} pendingAnnouncements={localPendingAnnouncements} />
            {/* Pagination Controls for Table View */}
            {paginationResult.totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 py-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={!paginationResult.hasPrevPage}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="text-sm font-medium">Previous</span>
                </button>
                
                <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-thin">
                  {Array.from({ length: paginationResult.totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
                        page === paginationResult.currentPage
                          ? 'bg-primary-600 text-white'
                          : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(paginationResult.totalPages, prev + 1))}
                  disabled={!paginationResult.hasNextPage}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                >
                  <span className="text-sm font-medium">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
