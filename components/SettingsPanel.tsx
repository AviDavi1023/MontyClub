'use client'

import { FileSpreadsheet, Plus } from 'lucide-react'
import { InfoTooltip } from '@/components/ui'
import { RegistrationCollection } from '@/types/club'

interface SettingsPanelProps {
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
    <div className="space-y-8 max-w-full">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Advanced Settings</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">Additional configuration options and data import</p>
      </div>

      {/* Excel Import */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Import from Excel
          <InfoTooltip text="Upload an Excel file to import clubs into the selected collection. Select a collection in the Registrations section first." />
        </h2>
        
        {activeCollectionId ? (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-gray-900 dark:text-white mb-2">
                <strong>Selected Collection:</strong> {collections.find(c => c.id === activeCollectionId)?.name}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                Upload an Excel file to import clubs into this collection
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
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No collection selected. Go to the Registrations section to select or create a collection first.
            </p>
            <button
              onClick={() => {
                // Navigate to registrations if we have a way to do it
                if (showToast) {
                  showToast('Please select a collection in the Registrations section', 'info')
                }
              }}
              className="btn-secondary"
            >
              Go to Registrations
            </button>
          </div>
        )}
      </div>

      {/* Additional Info */}
      <div className="card p-6 bg-gray-50 dark:bg-gray-800">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Note</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          System settings (API Key, Cache, Catalog Publishing) and Collection Management have been moved:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mt-2 space-y-1">
          <li><strong>System Settings:</strong> Now available in the Dashboard</li>
          <li><strong>Collections Management:</strong> Now available in the Registrations section</li>
        </ul>
      </div>
    </div>
  )
}
