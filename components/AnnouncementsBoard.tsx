'use client'

import { useState, useMemo } from 'react'
import { Search, Megaphone, Trash2, Edit2, X, Check } from 'lucide-react'
import { Club } from '@/types/club'
import { Toggle } from '@/components/Toggle'
import { InfoTooltip } from '@/components/ui'
import { logActivity } from '@/components/ActivityLog'

interface AnnouncementsBoardProps {
  clubs: Club[]
  announcements: Record<string, string>
  saveAnnouncement: (id: string, text: string) => Promise<void>
  clearAnnouncement: (id: string) => Promise<void>
  savingAnnouncements: Record<string, boolean>
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  // Announcements feature toggle
  announcementsEnabled: boolean | null
  toggleAnnouncements: () => void
  savingSettings: boolean
}

export function AnnouncementsBoard({
  clubs,
  announcements,
  saveAnnouncement,
  clearAnnouncement,
  savingAnnouncements,
  showToast,
  announcementsEnabled,
  toggleAnnouncements,
  savingSettings,
}: AnnouncementsBoardProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set())

  const clubsWithAnnouncements = clubs.filter(club => announcements[club.id])
  
  const filteredClubs = useMemo(() => {
    if (!searchQuery.trim()) return clubs
    
    const query = searchQuery.toLowerCase().trim()
    return clubs.filter(club => 
      club.name.toLowerCase().includes(query) ||
      club.category.toLowerCase().includes(query) ||
      club.advisor.toLowerCase().includes(query)
    )
  }, [clubs, searchQuery])

  const handleStartEdit = (clubId: string) => {
    setEditingId(clubId)
    setEditText(announcements[clubId] || '')
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    
    try {
      await saveAnnouncement(editingId, editText)
      setEditingId(null)
      setEditText('')
      showToast('Announcement saved')
      
      logActivity({
        type: 'announcement',
        action: 'Announcement Updated',
        details: `Updated announcement for club ${editingId}`,
        status: 'success'
      })
    } catch (error) {
      logActivity({
        type: 'announcement',
        action: 'Announcement Save Failed',
        details: `Failed to save announcement: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'error'
      })
      showToast('Failed to save announcement', 'error')
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  const toggleSelectForDelete = (clubId: string) => {
    const newSet = new Set(selectedForDelete)
    if (newSet.has(clubId)) {
      newSet.delete(clubId)
    } else {
      newSet.add(clubId)
    }
    setSelectedForDelete(newSet)
  }

  const handleBulkDelete = async () => {
    if (selectedForDelete.size === 0) return
    
    if (!confirm(`Delete ${selectedForDelete.size} announcement(s)? This cannot be undone.`)) {
      return
    }
    
    try {
      await Promise.all(
        Array.from(selectedForDelete).map(id => clearAnnouncement(id))
      )
      setSelectedForDelete(new Set())
      showToast(`Deleted ${selectedForDelete.size} announcement(s)`)
      
      logActivity({
        type: 'announcement',
        action: 'Bulk Delete Announcements',
        details: `Deleted ${selectedForDelete.size} announcement(s)`,
        status: 'info'
      })
    } catch (error) {
      logActivity({
        type: 'announcement',
        action: 'Bulk Delete Failed',
        details: `Failed to delete announcements: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'error'
      })
      showToast('Failed to delete announcements', 'error')
    }
  }

  return (
    <div className="space-y-8 max-w-full">
      {/* Header with Feature Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Announcements</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Manage club announcements. Search for a club to add or edit announcements.
          </p>
        </div>
        
        <div className="card p-4 flex items-center gap-3 self-start">
          <Toggle
            checked={announcementsEnabled ?? false}
            onChange={toggleAnnouncements}
            disabled={savingSettings}
          />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Announcements Feature
            </span>
            <InfoTooltip text="When enabled, club announcements will be displayed on the public clubs page" />
          </div>
        </div>
      </div>

      {/* Active Announcements Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Megaphone className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {clubsWithAnnouncements.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Active Announcements</div>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Megaphone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {clubs.length - clubsWithAnnouncements.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Without Announcements</div>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Megaphone className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {clubs.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Clubs</div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Announcements Section */}
      {clubsWithAnnouncements.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Active Announcements ({clubsWithAnnouncements.length})
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (selectedForDelete.size === clubsWithAnnouncements.length) {
                    setSelectedForDelete(new Set())
                  } else {
                    setSelectedForDelete(new Set(clubsWithAnnouncements.map(c => c.id)))
                  }
                }}
                className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                {selectedForDelete.size === clubsWithAnnouncements.length ? 'Deselect All' : 'Select All'}
              </button>
              {selectedForDelete.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete ({selectedForDelete.size})
                </button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {clubsWithAnnouncements.map(club => (
              <div
                key={club.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedForDelete.has(club.id)}
                    onChange={() => toggleSelectForDelete(club.id)}
                    className="mt-1 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-1">{club.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{club.category}</p>
                    
                    {editingId === club.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="input-field text-sm min-h-[80px]"
                          placeholder="Enter announcement..."
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            disabled={savingAnnouncements[club.id]}
                            className="btn-primary text-xs flex items-center gap-1"
                          >
                            <Check className="h-3 w-3" />
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="btn-secondary text-xs flex items-center gap-1"
                          >
                            <X className="h-3 w-3" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 line-clamp-3">
                          {announcements[club.id]}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleStartEdit(club.id)}
                            className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1"
                          >
                            <Edit2 className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Clear announcement for "${club.name}"?`)) {
                                clearAnnouncement(club.id)
                              }
                            }}
                            disabled={savingAnnouncements[club.id]}
                            className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            Clear
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Add Section */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Search Clubs & Add Announcements
        </h2>
        
        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by club name, category, or advisor..."
              className="input-field pl-10"
            />
          </div>
        </div>

        {/* Results */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredClubs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No clubs found</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            filteredClubs.map(club => (
              <div
                key={club.id}
                className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white">{club.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {club.category} • {club.advisor}
                    </p>
                    {announcements[club.id] && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic line-clamp-2">
                        Current: {announcements[club.id]}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleStartEdit(club.id)}
                    className="btn-primary text-xs flex items-center gap-1 whitespace-nowrap"
                  >
                    {announcements[club.id] ? (
                      <>
                        <Edit2 className="h-3 w-3" />
                        Edit
                      </>
                    ) : (
                      <>
                        <Megaphone className="h-3 w-3" />
                        Add
                      </>
                    )}
                  </button>
                </div>
                
                {editingId === club.id && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="input-field text-sm min-h-[80px]"
                      placeholder="Enter announcement..."
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        disabled={savingAnnouncements[club.id]}
                        className="btn-primary text-xs flex items-center gap-1"
                      >
                        <Check className="h-3 w-3" />
                        {savingAnnouncements[club.id] ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="btn-secondary text-xs flex items-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
