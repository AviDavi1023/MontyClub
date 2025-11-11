'use client'

import { useState, useEffect, useRef } from 'react'
import { Lock, Unlock, RefreshCw, Settings, Database, Megaphone, Trash2, UserPlus, Users } from 'lucide-react'
import { Club } from '@/types/club'
import { getClubs } from '@/lib/clubs-client'
import { Toast, ToastContainer } from '@/components/Toast'
import { UserManagement } from '@/components/UserManagement'

export function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showUserManagement, setShowUserManagement] = useState(false)
  const [clubs, setClubs] = useState<Club[]>([])
  const [updates, setUpdates] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<Record<string, string>>({})
  const [showAnnouncementsPanel, setShowAnnouncementsPanel] = useState(false)
  const [savingAnnouncements, setSavingAnnouncements] = useState<Record<string, boolean>>({})
  const announcementsRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bcRef = useRef<BroadcastChannel | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmClearId, setConfirmClearId] = useState<string | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, type }])
  }

  const closeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bcRef.current = new BroadcastChannel('montyclub')
    }
    return () => {
      bcRef.current?.close()
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // First, ensure default admin exists (for first-time setup)
      await fetch('/api/auth/init', { method: 'POST' })

      // Attempt login
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!resp.ok) {
        const data = await resp.json()
        setError(data.error || 'Invalid credentials')
        setLoading(false)
        return
      }

      const data = await resp.json()
      if (data.success) {
        setIsAuthenticated(true)
        setCurrentUser(data.user.username)
        setError('')
        setPassword('')
      } else {
        setError('Invalid credentials')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setCurrentUser(null)
    setUsername('')
    setPassword('')
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
      showToast(`Marked as ${!current ? 'reviewed' : 'unreviewed'}`)
    } catch (err) {
      console.error('Error toggling reviewed:', err)
      showToast('Could not update status', 'error')
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
      showToast('Update request deleted')
    } catch (err) {
      console.error('Error deleting update:', err)
      showToast('Could not delete update', 'error')
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
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
      
      // Handle escape key to close modal
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setShowAnnouncementsPanel(false)
        }
      }
      document.addEventListener('keydown', handleEscape)
      
      return () => {
        document.body.style.overflow = 'unset'
        document.removeEventListener('keydown', handleEscape)
      }
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
      showToast('Announcement saved successfully')
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
      showToast('Could not save announcement', 'error')
    } finally {
      setSavingAnnouncements(prev => ({ ...prev, [id]: false }))
    }
  }

  const clearAnnouncement = async (id: string) => {
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
      // Don't show toast for individual clears during bulk delete
      if (!savingAnnouncements[`bulk-${id}`]) {
        showToast('Announcement cleared successfully')
      }
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
      if (!savingAnnouncements[`bulk-${id}`]) {
        showToast('Could not clear announcement', 'error')
      }
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
            Admin Login
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Sign in to access the management panel
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field"
              placeholder="Enter username"
              required
              autoComplete="username"
            />
          </div>

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
              placeholder="Enter password"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            <Unlock className="h-4 w-4 mr-2" />
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>First-time setup:</strong> Default admin account will be created automatically. Use username: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">admin</code> and password: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">admin123</code>
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
            After logging in, change the password and create additional admin accounts.
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
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Admin Controls
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Logged in as: <span className="font-medium">{currentUser}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUserManagement(!showUserManagement)}
              className="btn-secondary flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Manage Users</span>
            </button>
            <button
              onClick={handleLogout}
              className="btn-secondary"
            >
              <Lock className="h-4 w-4 mr-2" />
              Logout
            </button>
          </div>
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
                      showToast('File uploaded successfully!')
                    } catch (error) {
                      console.error('Error uploading file:', error)
                      showToast('Failed to upload file. Please try again.', 'error')
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

      {/* User Management */}
      {showUserManagement && (
        <UserManagement currentUser={currentUser!} showToast={showToast} />
      )}

      {showAnnouncementsPanel && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 animate-in fade-in duration-200"
            onClick={() => setShowAnnouncementsPanel(false)}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div 
              ref={announcementsRef} 
              className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto animate-in zoom-in-95 fade-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Announcements Manager</h2>
                <button
                  onClick={() => setShowAnnouncementsPanel(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 absolute top-4 right-4 sm:static"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">Search a club, edit its announcement, and save.</p>

              <AnnounceEditor
            clubs={clubs}
            announcements={announcements}
            setAnnouncements={setAnnouncements}
            saveAnnouncement={async (id: string, text: string) => {
              await saveAnnouncement(id, text)
              // refresh clubs so the gallery reflects updated announcement values
              await refreshData()
              try { bcRef.current?.postMessage({ type: 'announcements-updated', id }) } catch (e) {}
              // Also dispatch a custom event for same-tab updates
              window.dispatchEvent(new CustomEvent('announcements-updated', { detail: { id } }))
            }}
            clearAnnouncement={async (id: string) => {
              await clearAnnouncement(id)
              await refreshData()
              try { bcRef.current?.postMessage({ type: 'announcements-updated', id }) } catch (e) {}
              // Also dispatch a custom event for same-tab updates
              window.dispatchEvent(new CustomEvent('announcements-updated', { detail: { id } }))
            }}
            savingAnnouncements={savingAnnouncements}
            showToast={showToast}
            onRequestClear={(id: string) => setConfirmClearId(id)}
          />
          
          {/* Bulk Delete Section */}
          <BulkDeleteAnnouncements
            clubs={clubs}
            announcements={announcements}
            onDelete={async (ids: string[]) => {
              // Call new bulk delete API for atomic removal
              if (ids.length === 0) return
              try {
                const resp = await fetch('/api/announcements', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ids }),
                })
                if (!resp.ok) throw new Error('Bulk delete failed')
                const result = await resp.json()
                const deletedIds: string[] = result.deleted || []

                // Update local state
                setAnnouncements(prev => {
                  const copy = { ...prev }
                  deletedIds.forEach(id => { delete copy[id] })
                  return copy
                })

                // Notify other tabs and same tab
                deletedIds.forEach(id => {
                  try { bcRef.current?.postMessage({ type: 'announcements-updated', id }) } catch (e) {}
                  window.dispatchEvent(new CustomEvent('announcements-updated', { detail: { id } }))
                  try { localStorage.setItem('montyclub:announcementsUpdated', JSON.stringify({ id, t: Date.now() })) } catch (e) {}
                })

                await refreshData()
                showToast(`Deleted ${deletedIds.length} announcement${deletedIds.length !== 1 ? 's' : ''}`)
              } catch (e) {
                console.error('Bulk deletion failed:', e)
                showToast('Failed to delete announcements', 'error')
              }
            }}
          />
            </div>
          </div>
        </>
      )}

      {/* Clear Announcement Confirmation Dialog */}
      {confirmClearId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Clear Announcement
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to clear this announcement? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmClearId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const id = confirmClearId
                  setConfirmClearId(null)
                  await clearAnnouncement(id)
                  await refreshData()
                  try { bcRef.current?.postMessage({ type: 'announcements-updated', id }) } catch (e) {}
                  window.dispatchEvent(new CustomEvent('announcements-updated', { detail: { id } }))
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onClose={closeToast} />
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
  showToast,
  onRequestClear,
}: {
  clubs: Club[]
  announcements: Record<string, string>
  setAnnouncements: (v: Record<string, string>) => void
  saveAnnouncement: (id: string, text: string) => Promise<void>
  clearAnnouncement: (id: string) => Promise<void>
  savingAnnouncements: Record<string, boolean>
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  onRequestClear: (id: string) => void
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
                // Deselect the club and reset search
                setSelectedId(null)
                setQuery('')
                setShowDropdown(false)
              }}
              disabled={!!savingAnnouncements[selectedId]}
              className="btn-primary text-sm sm:text-base flex-1 sm:flex-initial"
            >
              {savingAnnouncements[selectedId] ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => {
                if (!selectedId) return
                onRequestClear(selectedId)
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

// Bulk delete announcements component
function BulkDeleteAnnouncements({
  clubs,
  announcements,
  onDelete,
}: {
  clubs: Club[]
  announcements: Record<string, string>
  onDelete: (ids: string[]) => Promise<void>
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const clubsWithAnnouncements = clubs.filter(club => announcements[club.id])

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const toggleAll = () => {
    if (selectedIds.size === clubsWithAnnouncements.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(clubsWithAnnouncements.map(c => c.id)))
    }
  }

  const [showConfirm, setShowConfirm] = useState(false)

  const handleDelete = async () => {
    if (selectedIds.size === 0) return
    setShowConfirm(false)
    
    setDeleting(true)
    try {
      await onDelete(Array.from(selectedIds))
      setSelectedIds(new Set())
    } finally {
      setDeleting(false)
    }
  }

  if (clubsWithAnnouncements.length === 0) {
    return (
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white mb-3">Current Announcements</h3>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">No active announcements</p>
      </div>
    )
  }

  return (
    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">
          Current Announcements ({clubsWithAnnouncements.length})
        </h3>
        <div className="flex gap-2">
          <button
            onClick={toggleAll}
            className="text-xs sm:text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            {selectedIds.size === clubsWithAnnouncements.length ? 'Deselect All' : 'Select All'}
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={deleting}
              className="btn-secondary text-xs sm:text-sm flex items-center gap-1 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
              Delete ({selectedIds.size})
            </button>
          )}
        </div>
      </div>
      
      <div className="space-y-2 max-h-60 overflow-y-auto bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
        {clubsWithAnnouncements.map(club => (
          <label
            key={club.id}
            className="flex items-start gap-3 p-2 hover:bg-white dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(club.id)}
              onChange={() => toggleSelection(club.id)}
              className="mt-0.5 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900 dark:text-white">{club.name}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                {announcements[club.id]}
              </div>
            </div>
          </label>
        ))}
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Confirm Deletion
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete {selectedIds.size} announcement{selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}