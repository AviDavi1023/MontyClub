'use client'

import { ClubFilters } from '@/types/club'

interface FilterPanelProps {
  filters: ClubFilters
  setFilters: (filters: ClubFilters) => void
  categories: string[]
  frequencies: string[]
  onClear: () => void
}

export function FilterPanel({ filters, setFilters, categories, frequencies, onClear }: FilterPanelProps) {
  const meetingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  return (
    <div className="card">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Category Filter (multi-select checkboxes) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Category
          </label>
          <div className="space-y-2 max-h-40 overflow-y-auto p-2 border border-transparent rounded">
            {categories.map(category => {
              const selected = Array.isArray(filters.category) ? filters.category.includes(category) : filters.category === category
              return (
                <label key={category} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
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
                  />
                  <span>{category}</span>
                </label>
              )
            })}
            <div>
              <button
                onClick={() => setFilters({ ...filters, category: [] })}
                className="text-xs text-primary-600 hover:underline"
                type="button"
              >
                Clear categories
              </button>
            </div>
          </div>
        </div>

        {/* Meeting Day Filter (multi-select checkboxes) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Meeting Day
          </label>
          <div className="space-y-2">
            {meetingDays.map(day => {
              const selected = Array.isArray(filters.meetingDay) ? filters.meetingDay.includes(day) : filters.meetingDay === day
              return (
                <label key={day} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
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
                  />
                  <span>{day}</span>
                </label>
              )
            })}
            <div>
              <button
                onClick={() => setFilters({ ...filters, meetingDay: [] })}
                className="text-xs text-primary-600 hover:underline"
                type="button"
              >
                Clear days
              </button>
            </div>
          </div>
        </div>

        {/* Meeting Frequency Filter (multi-select) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Meeting Frequency
          </label>
          <div className="space-y-2 max-h-40 overflow-y-auto p-2 border border-transparent rounded">
            {frequencies.map(freq => {
              const selected = Array.isArray(filters.meetingFrequency) ? filters.meetingFrequency.includes(freq) : filters.meetingFrequency === freq
              return (
                <label key={freq} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
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
                  />
                  <span>{freq}</span>
                </label>
              )
            })}
            <div>
              <button
                onClick={() => setFilters({ ...filters, meetingFrequency: [] })}
                className="text-xs text-primary-600 hover:underline"
                type="button"
              >
                Clear frequencies
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="input-field"
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {/* (Grade level removed — all clubs are for all grades) */}
      </div>
    </div>
  )
}
