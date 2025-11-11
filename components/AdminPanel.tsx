'use client'

import { useState, useEffect, useRef } from 'react'
import { Lock, Unlock, RefreshCw, Settings, Database, Megaphone } from 'lucide-react'
import { Club } from '@/types/club'
import { getClubs } from '@/lib/clubs-client'

const ADMIN_PASSWORD = 'admin123' // In production, use environment variables

export function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [clubs, setClubs] = useState<Club[]>([])
  const [updates, setUpdates] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<Record<string, string>>({})
  const [showAnnouncementsPanel, setShowAnnouncementsPanel] = useState(false)
  const [savingAnnouncements, setSavingAnnouncements] = useState<Record<string, boolean>>({})
  const announcementsRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bcRef = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bcRef.current = new BroadcastChannel('montyclub')
    }
    return () => {
      bcRef.current?.close()
    }
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      setError('')
    } else {
      setError('Invalid password')
    }
  }

  const refreshData = async () => {
    setLoading(true)
    try {
      const data = await getClubs()
      setClubs(data)
    } catch (error) {
      console.error('Error refreshing data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUpdates = async () => {
    try {
      const resp = await fetch('/api/updates')
      if (!resp.ok) throw new Error('Failed to fetch updates')
      const data = await resp.json()
      setUpdates(data)
    } catch (err) {
      console.error('Error fetching updates:', err)
    }
  }

  const toggleReviewed = async (id: string, current: boolean) => {
    try {
      const resp = await fetch(`/api/updates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed: !current }),
      })
      if (!resp.ok) throw new Error('Failed to update')
      const updated = await resp.json()
      setUpdates(prev => prev.map(u => (String(u.id) === String(id) ? updated : u)))
    } catch (err) {
      console.error('Error toggling reviewed:', err)
      alert('Could not update status')
    }
  }

  const deleteUpdate = async (id: string) => {
    const ok = confirm('Delete this update request? This cannot be undone.')
    if (!ok) return

    try {
      const resp = await fetch(`/api/updates/${id}`, { method: 'DELETE' })
      if (!resp.ok) throw new Error('Failed to delete')
      const removed = await resp.json()
      setUpdates(prev => prev.filter(u => String(u.id) !== String(id)))
    } catch (err) {
      console.error('Error deleting update:', err)
      alert('Could not delete update')
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      refreshData()
      fetchUpdates()
      fetchAnnouncements()
    }
  }, [isAuthenticated])

  // When the announcements panel opens, scroll it into view and keep a fixed height
  useEffect(() => {
    if (showAnnouncementsPanel) {
      // give the DOM a tick then scroll
      setTimeout(() => {
        announcementsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }, 100)
    }
  }, [showAnnouncementsPanel])

  const fetchAnnouncements = async () => {
    try {
      const resp = await fetch('/api/announcements')
      if (!resp.ok) throw new Error('Failed to fetch announcements')
      const data = await resp.json()
      setAnnouncements(data || {})
    } catch (err) {
      console.error('Error fetching announcements:', err)
    }
  }

  const saveAnnouncement = async (id: string, text: string) => {
    try {
      setSavingAnnouncements(prev => ({ ...prev, [id]: true }))
      const resp = await fetch(`/api/announcements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcement: text || '' }),
      })
      if (!resp.ok) throw new Error('Failed to save announcement')
      const updated = await resp.json()
      setAnnouncements(prev => ({ ...prev, [id]: updated.announcement || '' }))
      alert('Announcement saved')
      // notify other tabs/windows
      try {
        bcRef.current?.postMessage({ type: 'announcements-updated', id })
      } catch (e) {
        // ignore
      }
      // localStorage fallback for cross-browser/tab notification
      try {
        localStorage.setItem('montyclub:announcementsUpdated', JSON.stringify({ id, t: Date.now() }))
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error('Error saving announcement:', err)
      alert('Could not save announcement')
    } finally {
      setSavingAnnouncements(prev => ({ ...prev, [id]: false }))
    }
  }

  const clearAnnouncement = async (id: string) => {
    if (!confirm('Clear announcement for this club?')) return
    try {
      setSavingAnnouncements(prev => ({ ...prev, [id]: true }))
      const resp = await fetch(`/api/announcements/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ announcement: '' }) })
      if (!resp.ok) throw new Error('Failed to clear')
      await resp.json()
      setAnnouncements(prev => {
        const copy = { ...prev }
        delete copy[id]
        return copy
      })
      alert('Announcement cleared')
      try {
        bcRef.current?.postMessage({ type: 'announcements-updated', id })
      } catch (e) {
        // ignore
      }
      try {
        localStorage.setItem('montyclub:announcementsUpdated', JSON.stringify({ id, t: Date.now() }))
      } catch (e) {}
    } catch (err) {
      console.error('Error clearing announcement:', err)
      alert('Could not clear announcement')
    } finally {
      setSavingAnnouncements(prev => ({ ...prev, [id]: false }))
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="card max-w-md mx-auto">
        <div className="text-center mb-6">
          <Lock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Admin Access Required
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Enter the admin password to access the management panel.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="Enter admin password"
              required
            />
          </div>

          {error && (
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          )}

          <button type="submit" className="btn-primary w-full">
            <Unlock className="h-4 w-4 mr-2" />
            Access Admin Panel
          </button>
        </form>

        <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Demo Password:</strong> admin123
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Admin Controls */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Admin Controls
          </h2>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="btn-secondary"
          >
            <Lock className="h-4 w-4 mr-2" />
            Logout
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Database className="h-5 w-5 text-blue-500" />
              <h3 className="font-medium text-gray-900 dark:text-white">Data Source</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Excel File (clubData.xlsx)
            </p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <RefreshCw className="h-5 w-5 text-green-500" />
              <h3 className="font-medium text-gray-900 dark:text-white">Last Updated</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {new Date().toLocaleString()}
            </p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Settings className="h-5 w-5 text-purple-500" />
              <h3 className="font-medium text-gray-900 dark:text-white">Total Clubs</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {clubs.length} clubs
            </p>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={refreshData}
            disabled={loading}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Update Requests */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Update Requests</h2>
          <button
            onClick={fetchUpdates}
            className="btn-secondary"
          >
            Refresh
          </button>
        </div>

        {updates.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No update requests yet.</p>
        ) : (
          <div className="space-y-4">
            {updates.map((u) => (
              <div key={u.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{u.clubName || '—'} <span className="text-sm text-gray-500">({u.updateType || 'Update'})</span></h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Submitted: {new Date(u.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.reviewed ? (
                      <span className="px-2 py-1 text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">Reviewed</span>
                    ) : (
                      <span className="px-2 py-1 text-sm bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full">Pending</span>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleReviewed(u.id, !!u.reviewed)}
                        className="btn-secondary text-xs"
                      >
                        {u.reviewed ? 'Mark Unreviewed' : 'Mark Reviewed'}
                      </button>
                      <button
                        onClick={() => deleteUpdate(u.id)}
                        className="text-red-600 dark:text-red-400 text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                  <p><strong>Current:</strong> {u.currentInfo || '—'}</p>
                  <p className="mt-1"><strong>Suggested:</strong> {u.suggestedChange || '—'}</p>
                  <p className="mt-1"><strong>Contact:</strong> {u.contactEmail || '—'}</p>
                  {u.additionalNotes && <p className="mt-1"><strong>Notes:</strong> {u.additionalNotes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Club Statistics */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Club Statistics
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">By Status</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Active</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {clubs.filter(c => c.active).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Inactive</span>
                <span className="font-medium text-gray-600 dark:text-gray-400">
                  {clubs.filter(c => !c.active).length}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">By Category</h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {Object.entries(
                clubs.reduce((acc, club) => {
                  acc[club.category] = (acc[club.category] || 0) + 1
                  return acc
                }, {} as Record<string, number>)
              ).map(([category, count]) => (
                <div key={category} className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{category}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/submit-update"
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">
              Submit Update Form
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Test the public update submission form
            </p>
          </a>

          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">
              Excel File
            </h3>
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Upload a new club data Excel file
              </p>
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={async (e) => {
                    if (!e.target.files?.[0]) return
                    
                    const file = e.target.files[0]
                    if (!file.name.endsWith('.xlsx')) {
                      alert('Please upload an Excel (.xlsx) file')
                      return
                    }

                    const formData = new FormData()
                    formData.append('file', file)

                    try {
                      setLoading(true)
                      const response = await fetch('/api/upload-excel', {
                        method: 'POST',
                        body: formData,
                      })

                      if (!response.ok) {
                        throw new Error('Upload failed')
                      }

                      await refreshData() // Refresh the club data after successful upload
                      alert('File uploaded successfully!')
                    } catch (error) {
                      console.error('Error uploading file:', error)
                      alert('Failed to upload file. Please try again.')
                    } finally {
                      setLoading(false)
                      // Clear the input
                      e.target.value = ''
                    }
                  }}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-medium
                    file:bg-primary-50 file:text-primary-700
                    dark:file:bg-primary-900/20 dark:file:text-primary-300
                    hover:file:bg-primary-100 dark:hover:file:bg-primary-900/30
                    file:cursor-pointer
                  "
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Drag and drop or click to select a file
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Announcements</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Manage club announcements without re-uploading Excel</p>
            <button
              onClick={() => setShowAnnouncementsPanel(!showAnnouncementsPanel)}
              className="btn-primary w-full sm:w-auto"
            >
              <Megaphone className="h-4 w-4 mr-2" />
              {showAnnouncementsPanel ? 'Close Announcements' : 'Manage Announcements'}
            </button>
          </div>
        </div>
      </div>

      {showAnnouncementsPanel && (
        <div ref={announcementsRef} className="card sticky bottom-4 z-10 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Announcements Manager</h2>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Search a club, edit its announcement, and save.</p>
          </div>

          <AnnounceEditor
            clubs={clubs}
            announcements={announcements}
            setAnnouncements={setAnnouncements}
            saveAnnouncement={async (id: string, text: string) => {
              await saveAnnouncement(id, text)
              // refresh clubs so the gallery reflects updated announcement values
              await refreshData()
              try { bcRef.current?.postMessage({ type: 'announcements-updated', id }) } catch (e) {}
            }}
            clearAnnouncement={async (id: string) => {
              await clearAnnouncement(id)
              await refreshData()
              try { bcRef.current?.postMessage({ type: 'announcements-updated', id }) } catch (e) {}
            }}
            savingAnnouncements={savingAnnouncements}
          />
        </div>
      )}
    </div>
  )
}

// Small helper component for searching/selecting a club and editing its announcement
function AnnounceEditor({
  clubs,
  announcements,
  setAnnouncements,
  saveAnnouncement,
  clearAnnouncement,
  savingAnnouncements,
}: {
  clubs: Club[]
  announcements: Record<string, string>
  setAnnouncements: (v: Record<string, string>) => void
  saveAnnouncement: (id: string, text: string) => Promise<void>
  clearAnnouncement: (id: string) => Promise<void>
  savingAnnouncements: Record<string, boolean>
}) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [showDropdown, setShowDropdown] = useState(false)

  const matches = clubs
    .filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 10)

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search Club</label>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowDropdown(true)
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Type club name to search..."
          className="input-field text-sm sm:text-base"
        />
        {query && showDropdown && (
          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-2">
            {matches.length === 0 && <div className="text-xs sm:text-sm text-gray-500 p-2">No matches</div>}
            {matches.map(m => (
              <button
                key={m.id}
                onClick={() => {
                  setSelectedId(m.id)
                  setShowDropdown(false)  // Hide dropdown after selection
                  setQuery(m.name)  // Set query to selected club name
                  // initialize a local draft for the selected club so edits don't
                  // immediately overwrite the saved announcements object and so
                  // we can clear the input after saving
                  setDrafts(prev => ({ ...prev, [m.id]: announcements[m.id] ?? '' }))
                  if (!(m.id in announcements)) {
                    setAnnouncements({ ...announcements, [m.id]: '' })
                  }
                }}
                className="w-full text-left p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">{m.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{m.category} — {m.meetingTime}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedId && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="mb-2">
            <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">{clubs.find(c => c.id === selectedId)?.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{clubs.find(c => c.id === selectedId)?.category}</p>
          </div>

          <textarea
            value={drafts[selectedId] ?? announcements[selectedId] ?? ''}
            onChange={(e) => setDrafts(prev => ({ ...prev, [selectedId]: e.target.value }))}
            placeholder="Enter short announcement (e.g. 'No club today')"
            className="input-field w-full mb-3 text-sm sm:text-base min-h-[80px]"
            rows={3}
          />

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={async () => {
                if (!selectedId) return
                const text = drafts[selectedId] ?? announcements[selectedId] ?? ''
                await saveAnnouncement(selectedId, text)
                // clear the local draft so the textarea is emptied after save
                setDrafts(prev => ({ ...prev, [selectedId]: '' }))
              }}
              disabled={!!savingAnnouncements[selectedId]}
              className="btn-primary text-sm sm:text-base flex-1 sm:flex-initial"
            >
              {savingAnnouncements[selectedId] ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={async () => {
                if (!selectedId) return
                await clearAnnouncement(selectedId)
                // clear any local draft as well
                setDrafts(prev => {
                  const copy = { ...prev }
                  delete copy[selectedId]
                  return copy
                })
              }}
              className="btn-secondary text-sm sm:text-base flex-1 sm:flex-initial"
            >
              Clear
            </button>
            <button
              onClick={() => {
                setSelectedId(null)
                setQuery('')  // Clear search when closing
                setShowDropdown(false)
              }}
              className="btn-secondary text-sm sm:text-base flex-1 sm:flex-initial"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
