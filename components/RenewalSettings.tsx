'use client'

import { useState, useEffect } from 'react'
import { RegistrationCollection } from '@/types/club'
import { Toggle } from './Toggle'
import { RefreshCw } from 'lucide-react'

interface RenewalSettingsProps {
  adminApiKey: string
  collections: RegistrationCollection[]
}

export function RenewalSettings({ adminApiKey, collections }: RenewalSettingsProps) {
  const [enabled, setEnabled] = useState(false)
  const [sourceCollections, setSourceCollections] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/renewal-settings')
      if (response.ok) {
        const data = await response.json()
        setEnabled(data.enabled || false)
        setSourceCollections(data.sourceCollections || [])
      }
    } catch (error) {
      console.error('Failed to load renewal settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!adminApiKey) {
      alert('Admin API key is required')
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/renewal-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey,
        },
        body: JSON.stringify({ enabled, sourceCollections }),
      })

      if (!response.ok) {
        throw new Error('Failed to save renewal settings')
      }

      alert('Renewal settings saved successfully')
    } catch (error) {
      console.error('Failed to save renewal settings:', error)
      alert('Failed to save renewal settings')
    } finally {
      setSaving(false)
    }
  }

  const toggleCollection = (collectionId: string) => {
    setSourceCollections(prev => 
      prev.includes(collectionId)
        ? prev.filter(id => id !== collectionId)
        : [...prev, collectionId]
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Enable Toggle */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div>
          <div className="font-medium text-gray-900 dark:text-white text-sm">Enable Renewals</div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            Allow clubs to renew charters from previous collections
          </div>
        </div>
        <Toggle checked={enabled} onChange={() => setEnabled(!enabled)} />
      </div>

      {/* Source Collections */}
      {enabled && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Source Collections (clubs can renew from these)
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            {collections.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                No collections available. Create a collection first.
              </p>
            ) : (
              collections.map(collection => (
                <label
                  key={collection.id}
                  className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={sourceCollections.includes(collection.id)}
                    onChange={() => toggleCollection(collection.id)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">
                    {collection.name}
                  </span>
                </label>
              ))
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Select collections that contain clubs eligible for renewal
          </p>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={saveSettings}
        disabled={saving || !adminApiKey}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${saving ? 'animate-spin' : ''}`} />
        {saving ? 'Saving...' : 'Save Renewal Settings'}
      </button>
    </div>
  )
}
