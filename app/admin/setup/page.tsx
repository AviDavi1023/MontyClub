'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Mail, CheckCircle, AlertCircle } from 'lucide-react'

export default function AdminSetupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingSetup, setCheckingSetup] = useState(true)

  useEffect(() => {
    // Check if admin users already exist
    const checkSetupStatus = async () => {
      try {
        const resp = await fetch('/api/admin/setup-status')
        const data = await resp.json()
        
        if (data.setupComplete) {
          // Admin users already exist, redirect to login
          router.push('/admin')
          return
        }
        
        setCheckingSetup(false)
      } catch (err) {
        console.error('Error checking setup status:', err)
        setCheckingSetup(false)
      }
    }
    
    checkSetupStatus()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError('')

    try {
      const resp = await fetch('/api/auth/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data.error || 'Setup failed')
      }

      // Success! Redirect to admin panel
      setTimeout(() => {
        router.push('/admin')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Setup failed. Please try again.')
      setLoading(false)
    }
  }

  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Checking setup status...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
              <Lock className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome to MontyClub
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              First-time setup
            </p>
          </div>

          {/* Default Credentials Display */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3 mb-3">
              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 text-sm mb-2">
                  Your Default Admin Credentials
                </h3>
                <div className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                  <p><span className="font-semibold">Username:</span> admin</p>
                  <p><span className="font-semibold">Password:</span> admin123</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
              ⚠️ Please change your password immediately after logging in
            </p>
          </div>

          {/* Setup Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Primary Admin Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  disabled={loading}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                This email will receive password reset codes for the primary admin account
              </p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Setting up...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Complete Setup
                </>
              )}
            </button>
          </form>

          {loading && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Creating admin account... You'll be redirected to the login page shortly.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
