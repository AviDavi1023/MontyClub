'use client'

import { useState } from 'react'
import { Lock, RefreshCw, Megaphone, FileSpreadsheet, Plus } from 'lucide-react'
import { Toggle } from '@/components/Toggle'
import { InfoTooltip } from '@/components/ui'
import { RegistrationCollection } from '@/types/club'

interface SettingsPanelProps {
  adminApiKey: string
  setAdminApiKey: (key: string) => void
  saveAdminApiKey: () => void
  announcementsEnabled: boolean | null
  toggleAnnouncements: () => void
  savingSettings: boolean
  refreshCache: () => void
  refreshingCache: boolean
  publishSnapshotNow: () => void
  publishingCatalog: boolean
  catalogStatus: { exists: boolean; generatedAt?: string; clubCount?: number; collectionName?: string } | null
  collections: RegistrationCollection[]
  localPendingCollectionChanges: Record<string, any>
  toggleCollectionDisplay: (id: string) => void
  toggleCollectionAccepting: (id: string) => void
  toggleCollectionRenewal: (id: string) => void
  deleteCollection: (id: string) => void
  togglingCollection: string | null
  newCollectionName: string
  setNewCollectionName: (name: string) => void
  createCollection: () => void
  creatingCollection: boolean
  setActiveCollectionId: (id: string) => void
  activeCollectionId: string | null
  importingExcel: boolean
  handleExcelImport: (e: React.ChangeEvent<HTMLInputElement>) => void
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

export function SettingsPanel({
  adminApiKey,
  setAdminApiKey,
  saveAdminApiKey,
  announcementsEnabled,
  toggleAnnouncements,
  savingSettings,
  refreshCache,
  refreshingCache,
  publishSnapshotNow,
  publishingCatalog,
  catalogStatus,
  collections,
  localPendingCollectionChanges,
  toggleCollectionDisplay,
  toggleCollectionAccepting,
  toggleCollectionRenewal,
  deleteCollection,
  togglingCollection,
  newCollectionName,
  setNewCollectionName,
  createCollection,
  creatingCollection,
  setActiveCollectionId,
  activeCollectionId,
  importingExcel,
  handleExcelImport,
  showToast,
}: SettingsPanelProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Configure system settings and manage collections</p>
      </div>

      {/* System Settings */}
      <div className="card">
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
              ? `✅ Published: ${catalogStatus.clubCount} clubs from "${catalogStatus.collectionName}"` 
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

      {/* Feature Toggles */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          Feature Toggles
          <InfoTooltip text="Enable or disable site-wide features" />
        </h2>

        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Announcements
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {announcementsEnabled === null ? 'Loading...' : (announcementsEnabled ? 'Announcements are currently shown on the site' : 'Announcements are currently hidden from the site')}
              </p>
            </div>
            {announcementsEnabled !== null && (
              <Toggle
                checked={announcementsEnabled}
                onChange={() => { if (!savingSettings) toggleAnnouncements() }}
                disabled={savingSettings}
              />
            )}
          </div>
        </div>
      </div>

      {/* Collections Management */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          Registration Collections
          <InfoTooltip text="Manage multiple registration form collections (e.g., different years). Public Catalog selects which collection appears in the club directory. Registration Form controls which collections accept submissions." />
        </h2>

        {/* Create New Collection */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Create New Collection</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createCollection()}
              placeholder="e.g., 2026 Club Requests"
              className="input-field text-sm flex-1"
            />
            <button
              onClick={createCollection}
              disabled={creatingCollection || !newCollectionName.trim()}
              className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {creatingCollection ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>

        {/* Import from Excel */}
        {activeCollectionId && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Import from Excel
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Upload an Excel file to import clubs into the selected collection
            </p>
            {activeCollectionId.startsWith('temp-col-') && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2 font-medium">
                ⏳ Collection is being created... Please wait a moment before importing.
              </p>
            )}
            <input
              type="file"
              accept=".xlsx"
              disabled={importingExcel || activeCollectionId.startsWith('temp-col-')}
              onChange={handleExcelImport}
              className="text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        )}

        {/* Collections List */}
        <div className="space-y-3">
          {collections.filter(c => !localPendingCollectionChanges[c.id]?.deleted).length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-8">
              No collections yet. Create one above to get started.
            </p>
          ) : (
            collections
              .filter(c => !localPendingCollectionChanges[c.id]?.deleted)
              .map((collection) => {
                const isDisplay = collection.display || (!collection.display && !collection.accepting && collection.enabled)
                const isAccepting = collection.accepting ?? collection.enabled ?? false
                const isRenewal = collection.renewalEnabled ?? false
                const isPending = localPendingCollectionChanges[collection.id]
                
                return (
                  <div
                    key={collection.id}
                    onClick={() => setActiveCollectionId(collection.id)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      activeCollectionId === collection.id
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-gray-900 dark:text-white truncate">
                            {collection.name}
                          </h4>
                          {isDisplay && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              Displayed
                            </span>
                          )}
                          {isAccepting && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              Accepting
                            </span>
                          )}
                          {isRenewal && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                              Renewal
                            </span>
                          )}
                          {isPending && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 italic">Syncing...</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Created {new Date(collection.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="flex flex-col gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="radio"
                            name="displayCollection"
                            checked={isDisplay}
                            onChange={() => toggleCollectionDisplay(collection.id)}
                            disabled={togglingCollection === collection.id}
                            className="w-3.5 h-3.5"
                          />
                          <span className="text-gray-700 dark:text-gray-300">Public Catalog</span>
                        </label>
                        
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isAccepting}
                            onChange={() => toggleCollectionAccepting(collection.id)}
                            disabled={togglingCollection === collection.id}
                            className="w-3.5 h-3.5"
                          />
                          <span className="text-gray-700 dark:text-gray-300">Accept Registrations</span>
                        </label>
                        
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isRenewal}
                            onChange={() => toggleCollectionRenewal(collection.id)}
                            disabled={togglingCollection === collection.id}
                            className="w-3.5 h-3.5"
                          />
                          <span className="text-gray-700 dark:text-gray-300">Enable Renewals</span>
                        </label>
                        
                        <button
                          onClick={() => {
                            if (confirm(`Delete collection "${collection.name}"? This cannot be undone.`)) {
                              deleteCollection(collection.id)
                            }
                          }}
                          disabled={togglingCollection === collection.id}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
          )}
        </div>
      </div>
    </div>
  )
}
