'use client'

import { ClipboardList, CheckCircle, XCircle, Clock, TrendingUp, AlertCircle, Lock, RefreshCw } from 'lucide-react'
import { Club, RegistrationCollection } from '@/types/club'
import { InfoTooltip } from '@/components/ui'

interface DashboardOverviewProps {
  clubs: Club[]
  collections: RegistrationCollection[]
  catalogStatus: { exists: boolean; generatedAt?: string; clubCount?: number } | null
  onNavigate: (section: string) => void
  pendingRegistrationsCount?: number
  approvedRegistrationsCount?: number
  rejectedRegistrationsCount?: number
  adminApiKey: string
  setAdminApiKey: (key: string) => void
  saveAdminApiKey: () => void
  refreshCache: () => void
  refreshingCache: boolean
  publishSnapshotNow: () => void
  publishingCatalog: boolean
}

export function DashboardOverview({
  clubs,
  collections,
  catalogStatus,
  onNavigate,
  pendingRegistrationsCount = 0,
  approvedRegistrationsCount = 0,
  rejectedRegistrationsCount = 0,
  adminApiKey,
  setAdminApiKey,
  saveAdminApiKey,
  refreshCache,
  refreshingCache,
  publishSnapshotNow,
  publishingCatalog,
}: DashboardOverviewProps) {
  const activeClubs = clubs.filter(c => c.active).length
  const inactiveClubs = clubs.filter(c => !c.active).length
  const displayCollection = collections.find(c => c.display)
  const acceptingCollections = collections.filter(c => c.accepting).length

  const getHealthStatus = () => {
    if (!catalogStatus?.exists) return { status: 'warning', message: 'No catalog published', color: 'yellow' }
    if (pendingRegistrationsCount > 20) return { status: 'warning', message: `${pendingRegistrationsCount} pending registrations`, color: 'orange' }
    if (acceptingCollections === 0) return { status: 'info', message: 'No collections accepting registrations', color: 'blue' }
    return { status: 'healthy', message: 'All systems operational', color: 'green' }
  }

  const health = getHealthStatus()

  return (
    <div className="space-y-8 max-w-full">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Dashboard</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">Welcome to the admin panel. Here's your overview.</p>
      </div>

      {/* Health Status */}
      <div className={`card border-l-4 p-6 ${
        health.color === 'green' ? 'border-l-green-500 bg-green-50 dark:bg-green-900/10' :
        health.color === 'yellow' ? 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10' :
        health.color === 'orange' ? 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/10' :
        'border-l-blue-500 bg-blue-50 dark:bg-blue-900/10'
      }`}>
        <div className="flex items-center gap-4">
          <AlertCircle className={`h-8 w-8 flex-shrink-0 ${
            health.color === 'green' ? 'text-green-600' :
            health.color === 'yellow' ? 'text-yellow-600' :
            health.color === 'orange' ? 'text-orange-600' :
            'text-blue-600'
          }`} />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">System Status</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{health.message}</p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <button
          onClick={() => onNavigate('registrations')}
          className="card p-6 hover:shadow-lg transition-shadow text-left group"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:scale-110 transition-transform">
              <ClipboardList className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {pendingRegistrationsCount}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending</div>
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Click to review registrations
          </div>
        </button>

        <div className="card p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {approvedRegistrationsCount}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Approved</div>
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Total approved registrations
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <TrendingUp className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {activeClubs}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Clubs</div>
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {inactiveClubs} inactive
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Clock className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {collections.length}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Collections</div>
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {acceptingCollections} accepting
          </div>
        </div>
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Current Catalog */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Current Catalog</h3>
          {catalogStatus?.exists ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Status</span>
                <span className="font-medium text-green-600 dark:text-green-400">✓ Published</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Clubs</span>
                <span className="font-medium text-gray-900 dark:text-white">{catalogStatus.clubCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Collection</span>
                <span className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                  {displayCollection?.name || 'Unknown'}
                </span>
              </div>
              {catalogStatus.generatedAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Last Updated</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {new Date(catalogStatus.generatedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-yellow-600 dark:text-yellow-400">
              ⚠️ No catalog published yet. Go to Settings to publish.
            </div>
          )}
        </div>

        {/* Recent Activity Preview */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Collections Status</h3>
          {collections.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No collections yet</p>
          ) : (
            <div className="space-y-2">
              {collections.slice(0, 3).map((collection) => (
                <div key={collection.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                    {collection.name}
                  </span>
                  <div className="flex gap-1">
                    {collection.display && (
                      <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        Display
                      </span>
                    )}
                    {collection.accepting && (
                      <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {collections.length > 3 && (
                <button
                  onClick={() => onNavigate('registrations')}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >
                  View all {collections.length} collections →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* System Settings */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          System Settings
          <InfoTooltip text="Core system configuration including API access and data management" />
        </h2>

        {/* Admin API Key */}
        <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Admin API Key
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Required for managing registrations, analytics, announcements, and other admin features.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
              <input
                type="password"
                value={adminApiKey}
                onChange={(e) => setAdminApiKey(e.target.value)}
                className="input-field text-sm"
                placeholder="Enter your ADMIN_API_KEY"
              />
            </div>
            <button onClick={saveAdminApiKey} className="btn-primary whitespace-nowrap">
              <Lock className="h-4 w-4 mr-2" />
              Save Key
            </button>
          </div>
        </div>

        {/* Cache Management */}
        <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">Cache Management</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Force fresh data after updates. Cache refreshes automatically every 24 hours.
          </p>
          <button
            onClick={refreshCache}
            disabled={refreshingCache}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshingCache ? 'animate-spin' : ''}`} />
            {refreshingCache ? 'Refreshing...' : 'Refresh Cache Now'}
          </button>
        </div>

        {/* Snapshot Publishing */}
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">Catalog Snapshot</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {!catalogStatus ? 'Loading...' : catalogStatus.exists 
              ? `✅ Published: ${catalogStatus.clubCount} clubs` 
              : '⚠️ No catalog published yet'}
          </p>
          {catalogStatus?.exists && catalogStatus.generatedAt && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Last updated: {new Date(catalogStatus.generatedAt).toLocaleString()}
            </p>
          )}
          <button
            onClick={publishSnapshotNow}
            disabled={publishingCatalog}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${publishingCatalog ? 'animate-spin' : ''}`} />
            {publishingCatalog ? 'Publishing...' : 'Publish Catalog Now'}
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('registrations')}
            className="btn-primary text-sm"
          >
            Review Registrations
          </button>
          <button
            onClick={() => onNavigate('announcements')}
            className="btn-secondary text-sm"
          >
            Manage Announcements
          </button>
          <button
            onClick={() => onNavigate('users')}
            className="btn-secondary text-sm"
          >
            User Management
          </button>
          <button
            onClick={() => onNavigate('activity')}
            className="btn-secondary text-sm"
          >
            View Activity Log
          </button>
        </div>
      </div>
    </div>
  )
}