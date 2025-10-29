'use client'

import { useState, useEffect } from 'react'
import { Lock, Unlock, RefreshCw, Settings, Database } from 'lucide-react'
import { Club } from '@/types/club'
import { getClubs } from '@/lib/clubs-client'

const ADMIN_PASSWORD = 'admin123' // In production, use environment variables

export function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [clubs, setClubs] = useState<Club[]>([])
  const [updates, setUpdates] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    }
  }, [isAuthenticated])

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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Edit club data in clubData.xlsx
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
