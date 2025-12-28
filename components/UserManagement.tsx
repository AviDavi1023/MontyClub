'use client'

import { useState, useEffect } from 'react'
import { UserPlus } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { getUserFriendlyError } from '@/lib/error-messages'

interface UserManagementProps {
  currentUser: string
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

export function UserManagement({ currentUser, showToast }: UserManagementProps) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const fetchUsers = async () => {
    try {
      const resp = await fetch('/api/admin/users')
      if (!resp.ok) throw new Error('Failed to fetch users')
      const data = await resp.json()
      setUsers(data.users || [])
    } catch (err) {
      console.error('Error fetching users:', err)
      showToast(getUserFriendlyError(err), 'error')
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const resp = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword || undefined,
          createdBy: currentUser,
        }),
      })

      if (!resp.ok) {
        const data = await resp.json()
        showToast(data.error || 'Failed to create user', 'error')
        setLoading(false)
        return
      }

      const data = await resp.json()
      setGeneratedPassword(data.password)
      showToast(`User ${data.user.username} created successfully`)
      setNewUsername('')
      setNewPassword('')
      await fetchUsers()
      setShowCreateForm(false)
    } catch (err) {
      console.error('Error creating user:', err)
      showToast(getUserFriendlyError(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (username: string) => {
    if (username === currentUser) {
      showToast('Cannot delete your own account', 'error')
      return
    }

    if (!confirm(`Delete user ${username}? This cannot be undone.`)) return

    try {
      const resp = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })

      if (!resp.ok) {
        const data = await resp.json()
        showToast(data.error || 'Failed to delete user', 'error')
        return
      }

      showToast(`User ${username} deleted`)
      await fetchUsers()
    } catch (err) {
      console.error('Error deleting user:', err)
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
              <strong>Username:</strong> <code className="bg-green-100 dark:bg-green-800 px-2 py-1 rounded">{newUsername || users[users.length - 1]?.username}</code>
            </p>
            <p className="text-sm text-green-800 dark:text-green-200">
              <strong>Password:</strong> <code className="bg-green-100 dark:bg-green-800 px-2 py-1 rounded">{generatedPassword}</code>
            </p>
          </div>
          <button
            onClick={() => setGeneratedPassword(null)}
            className="mt-3 text-xs text-green-700 dark:text-green-300 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-2">
        {users.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            No admin users found
          </p>
        )}
        {users.map((user) => (
          <div
            key={user.username}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {user.username}
                {user.username === currentUser && (
                  <span className="ml-2 text-xs text-primary-600 dark:text-primary-400">
                    (You)
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
        ))}
      </div>
    </div>
  )
}
