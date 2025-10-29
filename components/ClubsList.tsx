'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, Filter, X } from 'lucide-react'
import { Club, ClubFilters } from '@/types/club'
import formatMeetingFrequency from '@/lib/meetingFrequency'
import { getClubs } from '@/lib/clubs-client'
import { ClubCard } from '@/components/ClubCard'
import { FilterPanel } from '@/components/FilterPanel'

export function ClubsList() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(true)
  const [filters, setFilters] = useState<ClubFilters>({
    search: '',
    category: [],
    meetingDay: [],
    meetingFrequency: [],
    status: '',
    gradeLevel: '',
  })

  useEffect(() => {
    async function loadClubs() {
      try {
        const data = await getClubs()
        setClubs(data)
      } catch (error) {
        console.error('Error loading clubs:', error)
      } finally {
        setLoading(false)
      }
    }

    loadClubs()
  }, [])

  const filteredClubs = useMemo(() => {
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

        const combined = fields.map(f => (f || '')).join(' ').toLowerCase()
        const keywordsMatch = club.keywords && club.keywords.some(keyword => keyword.toLowerCase().includes(searchLower))

        const matchesSearch = combined.includes(searchLower) || keywordsMatch

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
        const clubFreqRaw = (club.meetingFrequency || '')
        const clubFreqNorm = (formatMeetingFrequency(clubFreqRaw) || clubFreqRaw || '').toLowerCase()
        const matchedFreq = selectedFreqs.some((f) => {
          const fLower = String(f).toLowerCase()
          return clubFreqNorm.includes(fLower) || (club.meetingTime || '').toLowerCase().includes(fLower)
        })
        if (!matchedFreq) return false
      }

      // Status filter
      if (filters.status) {
        const isActive = filters.status === 'active'
        if (club.active !== isActive) {
          return false
        }
      }

      // Grade level filter
      if (filters.gradeLevel && club.gradeLevel !== filters.gradeLevel) {
        return false
      }

      return true
    })
  }, [clubs, filters])

  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(clubs.map(club => club.category))].filter(Boolean)
    return uniqueCategories.sort()
  }, [clubs])

  const gradeLevels = useMemo(() => {
    const uniqueGrades = [...new Set(clubs.map(club => club.gradeLevel))].filter(Boolean)
    return uniqueGrades.sort()
  }, [clubs])

  const clearFilters = () => {
    setFilters({
      search: '',
      category: [],
      meetingDay: [],
      meetingFrequency: [],
      status: '',
      gradeLevel: '',
    })
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
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search clubs by name, description, or keywords..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="input-field pl-10"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary flex items-center gap-2"
          >
            <Filter className="h-5 w-5" />
            Filters
            {hasActiveFilters && (
              <span className="bg-primary-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {Object.values(filters).filter((v) => Array.isArray(v) ? v.length > 0 : v !== '').length}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <FilterPanel
            filters={filters}
            setFilters={setFilters}
            categories={categories}
            gradeLevels={gradeLevels}
            onClear={clearFilters}
          />
        )}
      </div>

      {/* Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-gray-600 dark:text-gray-400">
            {filteredClubs.length} club{filteredClubs.length !== 1 ? 's' : ''} found
          </p>
          
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1"
            >
              <X className="h-4 w-4" />
              Clear filters
            </button>
          )}
        </div>

        {filteredClubs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              No clubs found matching your criteria
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClubs.map(club => (
              <ClubCard key={club.id} club={club} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
