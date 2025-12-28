'use client'

import { ChevronUp } from 'lucide-react'
import { ClubFilters } from '@/types/club'
import { Button } from '@/components/ui'

interface FilterPanelProps {
  filters: ClubFilters
  setFilters: (filters: ClubFilters) => void
  categories: string[]
  frequencies: string[]
  onClear: () => void
  onToggle?: () => void
  showToggle?: boolean
  canClear?: boolean
}

export function FilterPanel({ filters, setFilters, categories, frequencies, onClear, onToggle, showToggle = false, canClear = true }: FilterPanelProps) {
  const meetingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  return (
    <div className="card p-4 sm:p-6">
      {/* Mobile toggle at top */}
      {showToggle && onToggle && (
        <div className="flex sm:hidden items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Filters</h3>
          <button
            onClick={onToggle}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ChevronUp className="h-4 w-4" />
            <span>Hide</span>
          </button>
        </div>
      )}
      
      {/* Desktop toggle at top-left */}
      {showToggle && onToggle && (
        <div className="hidden sm:flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={onToggle}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ChevronUp className="h-4 w-4" />
            <span>Hide Filters</span>
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-4">
        {/* Category Filter (multi-select checkboxes) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
              Category
            </label>
            <button
              onClick={() => setFilters({ ...filters, category: [] })}
              className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors min-h-[32px] px-2 rounded"
              type="button"
              aria-label="Clear category filters"
            >
              Clear
            </button>
          </div>
          <div className="space-y-1.5 sm:space-y-2 max-h-40 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800">
            {categories.map(category => {
              const selected = Array.isArray(filters.category) ? filters.category.includes(category) : filters.category === category
              return (
                <label key={category} className="flex items-center gap-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => {
                      const prev = Array.isArray(filters.category) ? filters.category.slice() : (filters.category ? [filters.category] : [])
                      if (e.target.checked) {
                        setFilters({ ...filters, category: [...prev, category] })
                      } else {
                        setFilters({ ...filters, category: prev.filter((c) => c !== category) })
                      }
                    }}
                    className="flex-shrink-0"
                  />
                  <span className="truncate">{category}</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Meeting Day Filter (multi-select checkboxes) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
              Meeting Day
            </label>
            <button
              onClick={() => setFilters({ ...filters, meetingDay: [] })}
              className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors min-h-[32px] px-2 rounded"
              type="button"
              aria-label="Clear meeting day filters"
            >
              Clear
            </button>
          </div>
          <div className="space-y-1.5 sm:space-y-2 max-h-40 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800">
            {meetingDays.map(day => {
              const selected = Array.isArray(filters.meetingDay) ? filters.meetingDay.includes(day) : filters.meetingDay === day
              return (
                <label key={day} className="flex items-center gap-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => {
                      const prev = Array.isArray(filters.meetingDay) ? filters.meetingDay.slice() : (filters.meetingDay ? [filters.meetingDay] : [])
                      if (e.target.checked) {
                        setFilters({ ...filters, meetingDay: [...prev, day] })
                      } else {
                        setFilters({ ...filters, meetingDay: prev.filter((d) => d !== day) })
                      }
                    }}
                    className="flex-shrink-0"
                  />
                  <span>{day}</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Meeting Frequency Filter (multi-select) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
              Meeting Frequency
            </label>
            <button
              onClick={() => setFilters({ ...filters, meetingFrequency: [] })}
              className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors min-h-[32px] px-2 rounded"
              type="button"
              aria-label="Clear frequency filters"
            >
              Clear
            </button>
          </div>
          <div className="space-y-1.5 sm:space-y-2 max-h-40 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800">
            {frequencies.map(freq => {
              const selected = Array.isArray(filters.meetingFrequency) ? filters.meetingFrequency.includes(freq) : filters.meetingFrequency === freq
              return (
                <label key={freq} className="flex items-center gap-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => {
                      const prev = Array.isArray(filters.meetingFrequency) ? filters.meetingFrequency.slice() : (filters.meetingFrequency ? [filters.meetingFrequency] : [])
                      if (e.target.checked) {
                        setFilters({ ...filters, meetingFrequency: [...prev, freq] })
                      } else {
                        setFilters({ ...filters, meetingFrequency: prev.filter((c) => c !== freq) })
                      }
                    }}
                    className="flex-shrink-0"
                  />
                  <span className="truncate">{freq}</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="input-field text-xs sm:text-sm py-2"
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {/* (Grade level removed — all clubs are for all grades) */}
      </div>
      
      {/* Clear All Filters button at bottom */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="secondary"
          onClick={onClear}
          disabled={!canClear}
          className="w-full sm:w-auto"
        >
          Clear All Filters
        </Button>
      </div>
    </div>
  )
}


