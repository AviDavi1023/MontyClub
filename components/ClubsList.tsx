'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Filter, X } from 'lucide-react'
import { Club, ClubFilters } from '@/types/club'
import formatMeetingFrequency from '@/lib/meetingFrequency'
import { getClubs } from '@/lib/clubs-client'
import { ClubCard } from '@/components/ClubCard'
import { FilterPanel } from '@/components/FilterPanel'

export function ClubsList() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  // Start with filters hidden on mobile, visible on desktop
  const [showFilters, setShowFilters] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : false)
  const [updateCounter, setUpdateCounter] = useState(0)  // Add a counter to force re-renders
  // Read filters from URL query params on mount
  function parseFiltersFromQuery(): ClubFilters {
    if (typeof window === 'undefined') return {
      search: '',
      category: [],
      meetingDay: [],
      meetingFrequency: [],
      status: '',
    }
    const params = new URLSearchParams(window.location.search)
    return {
      search: params.get('search') || '',
      category: params.getAll('category'),
      meetingDay: params.getAll('meetingDay'),
      meetingFrequency: params.getAll('meetingFrequency'),
      status: params.get('status') || '',
    }
  }
  const [filters, setFilters] = useState<ClubFilters>(parseFiltersFromQuery())

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
    } catch (error) {
      console.error('Error loading clubs:', error)
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    loadClubs()

    // Only reload clubs when a change is made (cross-tab or same-tab update)
    let bc: BroadcastChannel | null = null
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('montyclub')
      bc.onmessage = (ev) => {
        try {
          const data = ev.data
          if (data && data.type === 'announcements-updated') {
            loadClubs()
          }
        } catch (e) {
          // ignore
        }
      }
    }

    // Listen for same-tab updates (custom event)
    const onAnnouncementUpdate = () => {
      loadClubs()
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('announcements-updated', onAnnouncementUpdate)
    }

    // localStorage fallback (storage events fire across tabs/browsers)
    const onStorage = (e: StorageEvent) => {
      try {
        if (!e.key) return
        if (e.key === 'montyclub:announcementsUpdated') {
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
      if (bc) bc.close()
      if (typeof window !== 'undefined') {
        window.removeEventListener('announcements-updated', onAnnouncementUpdate)
        window.removeEventListener('storage', onStorage)
      }
    }
  }, [])

  const filteredClubs = useMemo(() => {
    // Clear console to help spot new data loads
    console.log('Filtering clubs, update counter:', updateCounter)
    // Build a frequency map using normalized labels to group variants (e.g. "1st & 3rd weeks")
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

    const outlierKeys = Array.from(freqMap.entries())
      .filter(([, v]) => v.count === 1)
      .map(([k]) => k)

    return clubs.filter(club => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()

        // Combine several club fields into a single searchable string
        const fields = [
          club.name,
          club.description,
          club.category,
          club.advisor,
          club.studentLeader,
          club.location,
        ]

        // Split the text into words and check if any word starts with the search term
        const words = fields
          .map(f => (f || '').toLowerCase())
          .join(' ')
          .split(/\s+/)
          .filter(Boolean)

        const keywordsMatch = club.keywords && 
          club.keywords.some(keyword => 
            keyword.toLowerCase().split(/\s+/).some(word => word.startsWith(searchLower))
          )

        const wordStartsMatch = words.some(word => word.startsWith(searchLower))
        const matchesSearch = wordStartsMatch || keywordsMatch

        if (!matchesSearch) return false
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
  }, [clubs, filters])

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

  // Update URL query params when filters change
  function updateQueryParams(newFilters: ClubFilters) {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams()
    if (newFilters.search) params.set('search', newFilters.search)
  const categories = Array.isArray(newFilters.category) ? newFilters.category : (newFilters.category ? [newFilters.category] : [])
  categories.forEach((c: string) => params.append('category', c))
  const meetingDays = Array.isArray(newFilters.meetingDay) ? newFilters.meetingDay : (newFilters.meetingDay ? [newFilters.meetingDay] : [])
  meetingDays.forEach((d: string) => params.append('meetingDay', d))
  const meetingFrequencies = Array.isArray(newFilters.meetingFrequency) ? newFilters.meetingFrequency : (newFilters.meetingFrequency ? [newFilters.meetingFrequency] : [])
  meetingFrequencies.forEach((f: string) => params.append('meetingFrequency', f))
    if (newFilters.status) params.set('status', newFilters.status)
    const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '')
    window.history.replaceState({}, '', newUrl)
  }

  const clearFilters = () => {
    const cleared = {
      search: '',
      category: [],
      meetingDay: [],
      meetingFrequency: [],
      status: '',
    }
    setFilters(cleared)
    updateQueryParams(cleared)
  }

  // Wrap setFilters to also update query params
  function setFiltersAndUpdate(newFilters: ClubFilters) {
    setFilters(newFilters)
    updateQueryParams(newFilters)
  }

  const hasActiveFilters = Object.values(filters).some((value) => {
    if (Array.isArray(value)) return value.length > 0
    return value !== ''
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 sm:h-5 sm:w-5" />
            <input
              type="text"
              placeholder="Search clubs..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="input-field pl-9 sm:pl-10 text-sm sm:text-base py-2.5 sm:py-2"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary flex items-center justify-center gap-2 text-sm sm:text-base whitespace-nowrap py-2.5 sm:py-2"
          >
            <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="bg-primary-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                {Object.values(filters).filter((v) => Array.isArray(v) ? v.length > 0 : v !== '').length}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <FilterPanel
            filters={filters}
            setFilters={setFiltersAndUpdate}
            categories={categories}
            frequencies={frequencies}
            onClear={clearFilters}
          />
        )}
      </div>

      {/* Results */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            {filteredClubs.length} club{filteredClubs.length !== 1 ? 's' : ''}
          </p>
          
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs sm:text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1"
            >
              <X className="h-3 w-3 sm:h-4 sm:w-4" />
              Clear
            </button>
          )}
        </div>

        {filteredClubs.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg">
              No clubs found
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm mt-2">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredClubs.map(club => (
              <ClubCard key={club.id} club={club} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
