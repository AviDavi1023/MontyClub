'use client'

import { useState, useEffect } from 'react'
import { UserPlus } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { getUserFriendlyError } from '@/lib/error-messages'

interface UserManagementProps {
  currentUser: string
  adminApiKey: string
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

export function UserManagement({ currentUser, adminApiKey, showToast }: UserManagementProps) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
  const [createdUsername, setCreatedUsername] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingEmail, setEditingEmail] = useState<string | null>(null)
  const [editEmailInput, setEditEmailInput] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [pendingUserChanges, setPendingUserChanges] = useState<Record<string, { deleted?: boolean; created?: boolean; username?: string }>>({})
  
  const USERS_PENDING_KEY = 'montyclub:pendingUserChanges'
  const USERS_BACKUP_KEY = 'montyclub:pendingUserChanges:backup'

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      // CRITICAL: Read pending changes from localStorage directly to avoid stale closure issues
      let currentPending: Record<string, any> = {}
      try {
        const primary = localStorage.getItem(USERS_PENDING_KEY)
        if (primary) {
          currentPending = JSON.parse(primary)
        } else {
          const backup = localStorage.getItem(USERS_BACKUP_KEY)
          if (backup) {
            const bp = JSON.parse(backup)
            if (bp && bp.data) currentPending = bp.data
          }
        }
      } catch {}
      
      const resp = await fetch('/api/admin/users')
      if (!resp.ok) throw new Error('Failed to fetch users')
      const data = await resp.json()
      
      // OPTIMISTIC: Merge server users with pending changes from localStorage
      const serverUsers: any[] = data.users || []
      const displayUsers = serverUsers.filter((u: any) => !currentPending[u.username]?.deleted)
      setUsers(displayUsers)
      
      // Auto-clear pending deletions that are confirmed on server
      const stillPending: Record<string, any> = {}
      let hasCleared = false
      for (const [key, change] of Object.entries(currentPending)) {
        if (change.deleted && !serverUsers.some((u: any) => u.username === key)) {
          // This user was deleted on server, remove from pending
          hasCleared = true
        } else if (!change.deleted || serverUsers.some((u: any) => u.username === key)) {
          // Keep pending if not deleted or still on server
          stillPending[key] = change
        }
      }
      
      if (hasCleared && Object.keys(stillPending).length === 0) {
        try {
          localStorage.removeItem(USERS_PENDING_KEY)
          localStorage.removeItem(USERS_BACKUP_KEY)
        } catch {}
        setPendingUserChanges({})
      } else if (hasCleared) {
        try {
          localStorage.setItem(USERS_PENDING_KEY, JSON.stringify(stillPending))
          localStorage.setItem(USERS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: stillPending }))
        } catch {}
        setPendingUserChanges(stillPending)
      }
    } catch (err) {
      console.error('Error fetching users:', err)
      showToast(getUserFriendlyError(err), 'error')
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    // Load pending changes from localStorage on mount
    try {
      const primary = localStorage.getItem(USERS_PENDING_KEY)
      if (primary) {
        const parsed = JSON.parse(primary)
        setPendingUserChanges(parsed)
      } else {
        const backup = localStorage.getItem(USERS_BACKUP_KEY)
        if (backup) {
          const bp = JSON.parse(backup)
          if (bp && bp.data) setPendingUserChanges(bp.data)
        }
      }
    } catch {}
    
    fetchUsers()
  }, [])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // OPTIMISTIC: Create temp user object and add to display immediately
    const tempId = `temp-user-${Date.now()}`
    const tempUser = {
      username: newUsername,
      createdAt: new Date().toISOString(),
      createdBy: currentUser,
      _isTemp: true // Mark as temporary
    }
    
    // Add to display immediately (optimistic UI)
    setUsers(prevUsers => [...prevUsers, tempUser])
    
    const newPending = {
      ...pendingUserChanges,
      [tempId]: { created: true, username: newUsername }
    }
    setPendingUserChanges(newPending)
    try {
      localStorage.setItem(USERS_PENDING_KEY, JSON.stringify(newPending))
      localStorage.setItem(USERS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
    } catch {}

    try {
      const resp = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword || undefined,
          createdBy: currentUser,
        }),
      })

      if (!resp.ok) {
        const data = await resp.json()
        // Revert optimistic update - remove temp user from display
        setUsers(prevUsers => prevUsers.filter(u => u.username !== newUsername || !u._isTemp))
        const reverted = { ...pendingUserChanges }
        delete reverted[tempId]
        setPendingUserChanges(reverted)
        try {
          if (Object.keys(reverted).length === 0) {
            localStorage.removeItem(USERS_PENDING_KEY)
            localStorage.removeItem(USERS_BACKUP_KEY)
          } else {
            localStorage.setItem(USERS_PENDING_KEY, JSON.stringify(reverted))
            localStorage.setItem(USERS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: reverted }))
          }
        } catch {}
        showToast(data.error || 'Failed to create user', 'error')
        setLoading(false)
        return
      }

      const data = await resp.json()
      setGeneratedPassword(data.password)
      setCreatedUsername(data.user.username)
      showToast(`User ${data.user.username} created successfully`)
      
      // Replace temp user with real user from server
      setUsers(prevUsers => prevUsers.map(u => 
        (u.username === newUsername && u._isTemp) ? data.user : u
      ))
      
      // Clear temp ID from pending
      const cleared = { ...pendingUserChanges }
      delete cleared[tempId]
      setPendingUserChanges(cleared)
      try {
        if (Object.keys(cleared).length === 0) {
          localStorage.removeItem(USERS_PENDING_KEY)
          localStorage.removeItem(USERS_BACKUP_KEY)
        } else {
          localStorage.setItem(USERS_PENDING_KEY, JSON.stringify(cleared))
          localStorage.setItem(USERS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: cleared }))
        }
      } catch {}
      
      setNewUsername('')
      setNewPassword('')
      setShowCreateForm(false)
    } catch (err) {
      console.error('Error creating user:', err)
      // Revert on error
      const reverted = { ...pendingUserChanges }
      delete reverted[tempId]
      setPendingUserChanges(reverted)
      try {
        if (Object.keys(reverted).length === 0) {
          localStorage.removeItem(USERS_PENDING_KEY)
          localStorage.removeItem(USERS_BACKUP_KEY)
        } else {
          localStorage.setItem(USERS_PENDING_KEY, JSON.stringify(reverted))
          localStorage.setItem(USERS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: reverted }))
        }
      } catch {}
      showToast(getUserFriendlyError(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveEmail = async (username: string) => {
    if (!editEmailInput || !editEmailInput.includes('@')) {
      showToast('Please enter a valid email address', 'error')
      return
    }

    setSavingEmail(true)
    try {
      const resp = await fetch('/api/admin/users/email', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify({
          username,
          email: editEmailInput.trim().toLowerCase()
        })
      })

      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to save email')
      }

      // Update local state
      setUsers(prevUsers => prevUsers.map(u => 
        u.username === username ? { ...u, email: editEmailInput.trim().toLowerCase() } : u
      ))

      showToast('✅ Email updated successfully', 'success')
      setEditingEmail(null)
      setEditEmailInput('')
    } catch (err: any) {
      showToast(err.message || 'Failed to save email', 'error')
    } finally {
      setSavingEmail(false)
    }
  }

  const handleDeleteUser = async (username: string) => {
    if (username === currentUser) {
      showToast('Cannot delete your own account', 'error')
      return
    }

    if (!confirm(`Delete user ${username}? This cannot be undone.`)) return

    // OPTIMISTIC: Mark as deleted immediately and remove from display
    const newPending = {
      ...pendingUserChanges,
      [username]: { deleted: true }
    }
    setPendingUserChanges(newPending)
    
    // Remove from display immediately (optimistic UI)
    setUsers(prevUsers => prevUsers.filter(u => u.username !== username))
    
    try {
      localStorage.setItem(USERS_PENDING_KEY, JSON.stringify(newPending))
      localStorage.setItem(USERS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
    } catch {}

    try {
      const resp = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify({ username }),
      })

      if (!resp.ok) {
        const data = await resp.json()
        // Revert optimistic deletion - add user back to display
        await fetchUsers()
        const reverted = { ...pendingUserChanges }
        delete reverted[username]
        setPendingUserChanges(reverted)
        try {
          if (Object.keys(reverted).length === 0) {
            localStorage.removeItem(USERS_PENDING_KEY)
            localStorage.removeItem(USERS_BACKUP_KEY)
          } else {
            localStorage.setItem(USERS_PENDING_KEY, JSON.stringify(reverted))
            localStorage.setItem(USERS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: reverted }))
          }
        } catch {}
        showToast(data.error || 'Failed to delete user', 'error')
        return
      }

      showToast(`User ${username} deleted`)
      
      // DON'T clear from pending yet - keep it so that on reload, user stays filtered out
      // fetchUsers() will auto-clear when it confirms the user is actually gone from server
      // The pending state in localStorage persists through page reload for this reason
    } catch (err) {
      console.error('Error deleting user:', err)
      // Revert on error - add user back to display
      await fetchUsers()
      const reverted = { ...pendingUserChanges }
      delete reverted[username]
      setPendingUserChanges(reverted)
      try {
        if (Object.keys(reverted).length === 0) {
          localStorage.removeItem(USERS_PENDING_KEY)
          localStorage.removeItem(USERS_BACKUP_KEY)
        } else {
          localStorage.setItem(USERS_PENDING_KEY, JSON.stringify(reverted))
          localStorage.setItem(USERS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: reverted }))
        }
      } catch {}
      showToast(getUserFriendlyError(err), 'error')
    }
  }

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz23456789!@#$%'
    let pass = ''
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setNewPassword(pass)
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Admin Users
        </h3>
        <Button
          variant="primary"
          onClick={() => setShowCreateForm(!showCreateForm)}
          icon={<UserPlus className="h-4 w-4" />}
        >
          Create User
        </Button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreateUser} className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
          <Input
            label="Username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Enter username"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password (leave empty to auto-generate)
            </label>
            <div className="flex gap-2">
              <Input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="flex-1"
                placeholder="Auto-generated if empty"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={generateRandomPassword}
              >
                Generate
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !newUsername}
              isLoading={loading}
            >
              {loading ? 'Creating...' : 'Create User'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowCreateForm(false)
                setNewUsername('')
                setNewPassword('')
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {generatedPassword && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">
            User created! Share these credentials (shown only once):
          </p>
          <div className="space-y-1">
            <p className="text-sm text-green-800 dark:text-green-200">
              <strong>Username:</strong> <code className="bg-green-100 dark:bg-green-800 px-2 py-1 rounded">{createdUsername}</code>
            </p>
            <p className="text-sm text-green-800 dark:text-green-200">
              <strong>Password:</strong> <code className="bg-green-100 dark:bg-green-800 px-2 py-1 rounded">{generatedPassword}</code>
            </p>
          </div>
          <button
            onClick={() => {
              setGeneratedPassword(null)
              setCreatedUsername(null)
            }}
            className="mt-3 text-xs text-green-700 dark:text-green-300 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-2">
        {loadingUsers && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-4">
            <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary-600" />
            Loading admins...
          </div>
        )}
        {!loadingUsers && users.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            No admin users found
          </p>
        )}
        {users.map((user) => (
          <div
            key={user.username}
            className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  {user.username}
                  {user.username === currentUser && (
                    <span className="text-xs text-primary-600 dark:text-primary-400">
                      (You)
                    </span>
                  )}
                  {user.isPrimary && (
                    <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded">
                      Primary
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Created: {new Date(user.createdAt).toLocaleDateString()}
                  {user.createdBy && ` by ${user.createdBy}`}
                </p>
              </div>
              {user.username !== currentUser && (
                <button
                  onClick={() => handleDeleteUser(user.username)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm"
                >
                  Delete
                </button>
              )}
            </div>
            
            {editingEmail === user.username ? (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <input
                  type="email"
                  value={editEmailInput}
                  onChange={(e) => setEditEmailInput(e.target.value)}
                  placeholder="user@example.com"
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveEmail(user.username)}
                  disabled={savingEmail}
                  className="px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded transition-colors"
                >
                  {savingEmail ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditingEmail(null)
                    setEditEmailInput('')
                  }}
                  className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Email:</span> {user.email ? user.email : <span className="italic text-gray-400">Not set</span>}
                </div>
                <button
                  onClick={() => {
                    setEditingEmail(user.username)
                    setEditEmailInput(user.email || '')
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
