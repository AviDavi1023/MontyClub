'use client'

import { useState, useEffect, useRef } from 'react'
import { Lock, Unlock, RefreshCw, Megaphone, Trash2, UserPlus, Users, BarChart3, FileSpreadsheet, Plus, ExternalLink } from 'lucide-react'
import { Club, RegistrationCollection } from '@/types/club'
import { getClubs } from '@/lib/clubs-client'
import { Toast, ToastContainer } from '@/components/Toast'
import { ConfirmDialog } from '@/components/ui'
import { useConfirm } from '@/lib/hooks/useConfirm'
import { UserManagement } from '@/components/UserManagement'
import { RegistrationsList } from '@/components/RegistrationsList'
import { Toggle } from '@/components/Toggle'
import { InfoTooltip } from '@/components/ui'
import { slugifyName } from '@/lib/slug'
import { createBroadcastListener, broadcast } from '@/lib/broadcast'

/**
 * DEBUGGING: Paste these commands in the browser console to collect logs
 */
if (typeof window !== 'undefined') {
  (window as any).getLogs = () => {
    console.group('=== SYNC DEBUG LOGS ===')
    console.log('Copy the entire console output above to share with support')
    console.groupEnd()
  }

  (window as any).getAnnouncementsPending = () => {
    const pending = localStorage.getItem('montyclub:pendingAnnouncements')
    const announcements = localStorage.getItem('montyclub:announcements')
    console.group('=== ANNOUNCEMENTS STATE ===')
    console.log('Pending announcements:', JSON.parse(pending || '{}'))
    console.log('Current announcements:', JSON.parse(announcements || '{}'))
    console.groupEnd()
  }

  (window as any).getUpdatesPending = () => {
    const pending = localStorage.getItem('montyclub:pendingUpdateChanges')
    console.group('=== UPDATES PENDING STATE ===')
    console.log('Pending updates:', JSON.parse(pending || '{}'))
    console.groupEnd()
  }

  (window as any).getCollectionsPending = () => {
    const pending = localStorage.getItem('montyclub:pendingCollectionChanges')
    console.group('=== COLLECTIONS PENDING STATE ===')
    console.log('Pending collections:', JSON.parse(pending || '{}'))
    console.groupEnd()
  }

  (window as any).getAllPending = () => {
    console.group('=== ALL PENDING CHANGES ===')
    const pending1 = localStorage.getItem('montyclub:pendingAnnouncements')
    const pending2 = localStorage.getItem('montyclub:pendingUpdateChanges')
    const pending3 = localStorage.getItem('montyclub:pendingCollectionChanges')
    console.log('Announcements pending:', JSON.parse(pending1 || '{}'))
    console.log('Updates pending:', JSON.parse(pending2 || '{}'))
    console.log('Collections pending:', JSON.parse(pending3 || '{}'))
    console.groupEnd()
  }

  (window as any).syncDiagnostics = () => {
    const report = {
      timestamp: new Date().toISOString(),
      announcements: {
        pending: localStorage.getItem('montyclub:pendingAnnouncements') ? JSON.parse(localStorage.getItem('montyclub:pendingAnnouncements')!) : {},
        current: localStorage.getItem('montyclub:announcements') ? JSON.parse(localStorage.getItem('montyclub:announcements')!) : {}
      },
      updates: {
        pending: localStorage.getItem('montyclub:pendingUpdateChanges') ? JSON.parse(localStorage.getItem('montyclub:pendingUpdateChanges')!) : {}
      },
      collections: {
        pending: localStorage.getItem('montyclub:pendingCollectionChanges') ? JSON.parse(localStorage.getItem('montyclub:pendingCollectionChanges')!) : {}
      },
      registrations: {
        pending: localStorage.getItem('montyclub:pendingRegistrationChanges') ? JSON.parse(localStorage.getItem('montyclub:pendingRegistrationChanges')!) : {}
      }
    }
    console.group('=== COMPLETE SYNC DIAGNOSTICS ===')
    console.log(JSON.stringify(report, null, 2))
    console.groupEnd()
    return report
  }

  // Helper to export all console logs for debugging
  (window as any).exportLogs = () => {
    console.log(JSON.stringify({ 
      tag: 'log-export', 
      step: 'instructions',
      message: 'To export logs: 1) Open DevTools Console, 2) Right-click and "Save as...", or 3) Copy all JSON log lines and paste them here'
    }))
    return 'Check console for instructions. All logs are in JSON format with tags: toggle-single, fetch-updates, autoclear, collection-toggle, registration-approve, reg-autoclear'
  }
}

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
  const userManagementRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bcRef = useRef<BroadcastChannel | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmClearId, setConfirmClearId] = useState<string | null>(null)
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false)
  const [refreshingUpdates, setRefreshingUpdates] = useState(false)
  const [showStatistics, setShowStatistics] = useState(false)
  const statisticsRef = useRef<HTMLDivElement | null>(null)
  const [announcementsEnabled, setAnnouncementsEnabled] = useState<boolean | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [refreshingCache, setRefreshingCache] = useState(false)
  const [publishingCatalog, setPublishingCatalog] = useState(false)
  const [catalogStatus, setCatalogStatus] = useState<{ exists: boolean; generatedAt?: string; clubCount?: number } | null>(null)
  // Analytics Pilot State
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true)
  const [analyticsPeriod, setAnalyticsPeriod] = useState('pilot')
  const [analyticsSummary, setAnalyticsSummary] = useState<any | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [clearingAnalytics, setClearingAnalytics] = useState(false)
  const [adminApiKey, setAdminApiKey] = useState('')
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false)
  const [apiKeyPromptInput, setApiKeyPromptInput] = useState('')
  const [showRegistrations, setShowRegistrations] = useState(false)
  const registrationsRef = useRef<HTMLDivElement | null>(null)
  const [collections, setCollections] = useState<RegistrationCollection[]>([])
    // Section navigation refs
    const updatesRef = useRef<HTMLDivElement | null>(null)
    // announcementsRef, userManagementRef, statisticsRef, registrationsRef already defined above

    // Confirm dialog hook
    const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm()
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [importingExcel, setImportingExcel] = useState(false)
  const [creatingCollection, setCreatingCollection] = useState(false)
  const [togglingCollection, setTogglingCollection] = useState<string | null>(null)
  type PendingCollection = { deleted?: boolean; created?: boolean; enabled?: boolean; display?: boolean; accepting?: boolean; renewalEnabled?: boolean; name?: string }
  const [localPendingCollectionChanges, setLocalPendingCollectionChanges] = useState<Record<string, PendingCollection>>({})
  const [collectionsStorageLoaded, setCollectionsStorageLoaded] = useState(false)
  const COLLECTIONS_PENDING_KEY = 'montyclub:pendingCollectionChanges'
  const COLLECTIONS_BACKUP_KEY = 'montyclub:pendingCollectionChanges:backup'
  const collectionsRefreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [selectedUpdateIds, setSelectedUpdateIds] = useState<Set<string>>(new Set())
  const [updatingBatch, setUpdatingBatch] = useState(false)
  const [singleProcessingId, setSingleProcessingId] = useState<string | null>(null)
  const [localPendingChanges, setLocalPendingChanges] = useState<Record<string, { reviewed?: boolean; deleted?: boolean }>>({})
  const [localStorageLoaded, setLocalStorageLoaded] = useState(false)
  // Track confirmed operations - operations where API confirmed success
  // This is the source of truth - if API says it succeeded, we trust it
  const confirmedOperationsRef = useRef<Map<string, { reviewed?: boolean; deleted?: boolean; timestamp: number }>>(new Map())
  const PENDING_KEY = 'montyclub:pendingUpdateChanges'
  const PENDING_BACKUP_KEY = 'montyclub:pendingUpdateChanges:backup'
  const [localPendingAnnouncements, setLocalPendingAnnouncements] = useState<Record<string, string>>({})
  const [announcementsStorageLoaded, setAnnouncementsStorageLoaded] = useState(false)
  const ANNOUNCEMENTS_PENDING_KEY = 'montyclub:pendingAnnouncements'
  const ANNOUNCEMENTS_BACKUP_KEY = 'montyclub:pendingAnnouncements:backup'
  
  // Data clearing state
  const [showClearDataModal, setShowClearDataModal] = useState(false)
  const [clearDataPassword, setClearDataPassword] = useState('')
  const [clearDataApiKey, setClearDataApiKey] = useState('')
  const [clearOptions, setClearOptions] = useState({
    localStorage: true,
    updateRequests: false,
    announcements: false,
    registrationCollections: false,
    registrations: false,
    analytics: false,
  })
  const [clearingData, setClearingData] = useState(false)

  // Load analytics settings from localStorage
  useEffect(() => {
    try {
      const enabled = localStorage.getItem('analytics:enabled')
      if (enabled === 'false') setAnalyticsEnabled(false)
      const period = localStorage.getItem('analytics:period')
      if (period) setAnalyticsPeriod(period)
      const key = localStorage.getItem('analytics:adminKey')
      if (key) setAdminApiKey(key)
    } catch {}
    // Announcements enabled: load from localStorage first, then server
    try {
      const local = localStorage.getItem('settings:announcementsEnabled')
      if (local === 'true' || local === 'false') {
        setAnnouncementsEnabled(local === 'true')
      } else {
        // fallback: fetch from server
        fetch('/api/settings').then(async resp => {
          if (resp.ok) {
            const data = await resp.json()
            setAnnouncementsEnabled(data.announcementsEnabled !== false)
          } else {
            setAnnouncementsEnabled(true)
          }
        }).catch(() => setAnnouncementsEnabled(true))
      }
    } catch {
      setAnnouncementsEnabled(true)
    }
  }, [])

  // Load collections only after local pending storage is loaded to avoid flash of server-only state
  useEffect(() => {
    if (!isAuthenticated || !adminApiKey || !collectionsStorageLoaded) return
    loadCollections()
  }, [isAuthenticated, adminApiKey, collectionsStorageLoaded])

  // Reload collections when localStorage changes are detected (cross-tab or after operations)
  useEffect(() => {
    if (!collectionsStorageLoaded || !isAuthenticated || !adminApiKey) return
    
    const handleStorageUpdate = (e: StorageEvent) => {
      if (e.key === 'montyclub:collectionsUpdated') {
        // Small delay to ensure the pending changes are updated first
        setTimeout(() => loadCollections(), 50)
      }
    }
    
    window.addEventListener('storage', handleStorageUpdate)
    return () => window.removeEventListener('storage', handleStorageUpdate)
  }, [collectionsStorageLoaded, isAuthenticated, adminApiKey])

  // Load pending collection changes from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const primary = localStorage.getItem(COLLECTIONS_PENDING_KEY)
      if (primary) {
        const parsed = JSON.parse(primary)
        if (parsed && typeof parsed === 'object') setLocalPendingCollectionChanges(parsed)
      } else {
        const backup = localStorage.getItem(COLLECTIONS_BACKUP_KEY)
        if (backup) {
          try {
            const bp = JSON.parse(backup)
            if (bp && bp.data) setLocalPendingCollectionChanges(bp.data)
          } catch {}
        }
      }
    } catch {}
    finally {
      setCollectionsStorageLoaded(true)
    }
  }, [])

  // Redundant persistence for collection changes
  useEffect(() => {
    if (!collectionsStorageLoaded) return
    try {
      if (Object.keys(localPendingCollectionChanges).length === 0) {
        localStorage.removeItem(COLLECTIONS_PENDING_KEY)
        localStorage.removeItem(COLLECTIONS_BACKUP_KEY)
      } else {
        const serialized = JSON.stringify(localPendingCollectionChanges)
        localStorage.setItem(COLLECTIONS_PENDING_KEY, serialized)
        localStorage.setItem(COLLECTIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: localPendingCollectionChanges }))
      }
    } catch (e) {}
  }, [localPendingCollectionChanges, collectionsStorageLoaded])

  // Auto-clear pending collection changes that now match database state
  useEffect(() => {
    if (!collectionsStorageLoaded) return
    if (Object.keys(localPendingCollectionChanges).length === 0) return

    // Debug logging removed for cleaner console

    const newPending = { ...localPendingCollectionChanges }
    let hasChanges = false

    for (const collectionId in newPending) {
      const pending = newPending[collectionId]
      const found = collections.find(c => c.id === collectionId)
      // If marked deleted locally but no longer exists in DB, clear it
      if (pending.deleted && !found) {
        // Debug logging removed
        delete newPending[collectionId]
        hasChanges = true
        continue
      }
      if (found) {
        // If enabled matches DB, clear enabled flag
        if (pending.enabled !== undefined && found.enabled === pending.enabled) {
          // Debug logging removed
          delete newPending[collectionId].enabled
          hasChanges = true
        } else if (pending.enabled !== undefined) {
          // Debug logging removed
        }
        // If accepting matches DB, clear accepting flag
        if (pending.accepting !== undefined && found.accepting === pending.accepting) {
          delete newPending[collectionId].accepting
          hasChanges = true
        }
        // If renewalEnabled matches DB, clear renewalEnabled flag
        if (pending.renewalEnabled !== undefined && found.renewalEnabled === pending.renewalEnabled) {
          delete newPending[collectionId].renewalEnabled
          hasChanges = true
        }
        // If name matches DB, clear name flag
        if (pending.name && found.name === pending.name) {
          delete newPending[collectionId].name
          hasChanges = true
        }
        // If no remaining flags, remove entry
        const entry = newPending[collectionId]
        if (entry && !entry.deleted && entry.enabled === undefined && entry.accepting === undefined && entry.renewalEnabled === undefined && !entry.name && !entry.created) {
          delete newPending[collectionId]
          hasChanges = true
        }
      }
    }

    if (hasChanges) {
      // Debug logging removed
      setLocalPendingCollectionChanges(newPending)
    } else {
      // Debug logging removed
    }
  }, [collections, localPendingCollectionChanges, collectionsStorageLoaded])

  // Debounced refresh function to batch multiple rapid toggles
  const scheduleCollectionsRefresh = () => {
    // Clear any existing timer
    if (collectionsRefreshTimerRef.current) {
      clearTimeout(collectionsRefreshTimerRef.current)
    }
    // Schedule a new refresh after 500ms of inactivity
    collectionsRefreshTimerRef.current = setTimeout(() => {
      loadCollections()
      collectionsRefreshTimerRef.current = null
    }, 500)
  }

  const loadCollections = async () => {
    if (!adminApiKey) return
    // Debug logging removed
    try {
      const resp = await fetch('/api/registration-collections', {
        headers: { 'x-admin-key': adminApiKey }
      })
      if (!resp.ok) throw new Error('Failed to load collections')
      const data = await resp.json()
      // Debug logging removed
      setCollections(data.collections || [])
      // Choose active collection using localStorage overlay precedence
      // Build an overlay that prioritizes locally pending created/enabled state
      try {
        const overlayMap = new Map<string, RegistrationCollection>()
        for (const c of (data.collections || [])) overlayMap.set(c.id, { ...c })
        for (const [id, change] of Object.entries(localPendingCollectionChanges)) {
          if (change.deleted) {
            overlayMap.delete(id)
            continue
          }
          if (change.created && !overlayMap.has(id)) {
            overlayMap.set(id, {
              id,
              name: change.name || 'New Collection',
              enabled: change.enabled ?? false,
              display: change.display ?? false,
              accepting: change.accepting ?? false,
              createdAt: new Date().toISOString()
            } as RegistrationCollection)
          }
          const obj = overlayMap.get(id)
          if (obj) {
            if (typeof change.enabled !== 'undefined') obj.enabled = !!change.enabled
            if (typeof change.display !== 'undefined') obj.display = !!change.display
            if (typeof change.accepting !== 'undefined') obj.accepting = !!change.accepting
            if (change.name) obj.name = change.name
          }
        }
        const overlayList = Array.from(overlayMap.values())
        if (overlayList.length > 0) {
          // Prefer previously active if it still exists
          if (activeCollectionId && overlayMap.has(activeCollectionId)) {
            setActiveCollectionId(activeCollectionId)
          } else {
            const enabledFirst = overlayList.find(c => c.enabled)
            setActiveCollectionId((enabledFirst || overlayList[0]).id)
          }
        } else {
          setActiveCollectionId(null)
        }
      } catch {
        // Fallback to server-only selection
        if (data.collections && data.collections.length > 0) {
          const enabledCol = data.collections.find((c: RegistrationCollection) => c.enabled)
          setActiveCollectionId(enabledCol?.id || data.collections[0].id)
        } else {
          setActiveCollectionId(null)
        }
      }
    } catch (err) {
      console.error('Failed to load collections:', err)
    }
  }

  const createCollection = async () => {
    if (!adminApiKey) {
      showToast('Set admin API key first', 'error')
      return
    }
    if (!newCollectionName.trim()) {
      showToast('Collection name is required', 'error')
      return
    }
    setCreatingCollection(true)
    const name = newCollectionName.trim()
    const tempId = `temp-col-${Date.now()}-${Math.random().toString(36).substring(2,7)}`
    // Add local pending created collection so it shows immediately
    setLocalPendingCollectionChanges(prev => {
      const next = { ...prev, [tempId]: { created: true, name, enabled: false } }
      try {
        localStorage.setItem(COLLECTIONS_PENDING_KEY, JSON.stringify(next))
        localStorage.setItem(COLLECTIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: next }))
      } catch {}
      return next
    })
    // Select it right away
    setActiveCollectionId(tempId)
    setNewCollectionName('')
    try {
      const resp = await fetch('/api/registration-collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify({ name, enabled: false })
      })
      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.error || 'Failed to create collection')
      }
      const data = await resp.json()
      // Add the server-created collection to server snapshot
      setCollections(prev => [data.collection, ...prev])
      // Migrate any pending created state from tempId to real id
      setLocalPendingCollectionChanges(prev => {
        const temp = prev[tempId]
        if (!temp) return prev
        const rest = { ...prev }
        delete rest[tempId]
        // If user toggled enabled while creating, carry it forward as pending for real id
        if (temp.enabled !== undefined && temp.enabled !== data.collection.enabled) {
          rest[data.collection.id] = { ...(rest[data.collection.id] || {}), enabled: temp.enabled }
        }
        try {
          if (Object.keys(rest).length === 0) {
            localStorage.removeItem(COLLECTIONS_PENDING_KEY)
            localStorage.removeItem(COLLECTIONS_BACKUP_KEY)
          } else {
            localStorage.setItem(COLLECTIONS_PENDING_KEY, JSON.stringify(rest))
            localStorage.setItem(COLLECTIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: rest }))
          }
        } catch {}
        return rest
      })
      // Select the real id now
      setActiveCollectionId(data.collection.id)
      // Broadcast creation so other tabs pick up overlay quickly
      try {
        broadcast('collections', 'update', { id: data.collection.id })
        localStorage.setItem('montyclub:collectionsUpdated', JSON.stringify({ id: data.collection.id, t: Date.now() }))
      } catch {}
      showToast('Collection created successfully')
    } catch (err: any) {
      // Revert local pending temp on error
      setLocalPendingCollectionChanges(prev => {
        const rest = { ...prev }
        delete rest[tempId]
        try {
          if (Object.keys(rest).length === 0) {
            localStorage.removeItem(COLLECTIONS_PENDING_KEY)
            localStorage.removeItem(COLLECTIONS_BACKUP_KEY)
          } else {
            localStorage.setItem(COLLECTIONS_PENDING_KEY, JSON.stringify(rest))
            localStorage.setItem(COLLECTIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: rest }))
          }
        } catch {}
        return rest
      })
      showToast(err.message || 'Failed to create collection', 'error')
    } finally {
      setCreatingCollection(false)
    }
  }

  const toggleCollectionDisplay = async (collectionId: string) => {
    if (!adminApiKey) {
      showToast('Set admin API key first', 'error')
      return
    }
    const collection = collections.find(c => c.id === collectionId)
    if (!collection) return

    setTogglingCollection(collectionId)
    const effectiveCurrentDisplay = (localPendingCollectionChanges[collectionId]?.display !== undefined)
      ? !!localPendingCollectionChanges[collectionId]?.display
      : !!(collection.display || (!collection.display && !collection.accepting && collection.enabled)) // back-compat: legacy enabled means display
    const nextDisplay = !effectiveCurrentDisplay

    // Optimistically update display
    setLocalPendingCollectionChanges(prev => {
      const next = { ...prev, [collectionId]: { ...(prev[collectionId] || {}), display: nextDisplay } }
      try {
        localStorage.setItem(COLLECTIONS_PENDING_KEY, JSON.stringify(next))
        localStorage.setItem(COLLECTIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: next }))
        broadcast('collections', 'update', { id: collectionId })
        localStorage.setItem('montyclub:collectionsUpdated', JSON.stringify({ id: collectionId, t: Date.now() }))
      } catch {}
      return next
    })

    try {
      const resp = await fetch('/api/registration-collections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminApiKey },
        body: JSON.stringify({ id: collectionId, display: nextDisplay })
      })
      if (!resp.ok) {
        let errText = 'Failed to update display'
        try { const j = await resp.json(); if (j?.error) errText = j.error } catch {}
        throw new Error(errText)
      }
      try {
        broadcast('collections', 'update', { id: collectionId })
        localStorage.setItem('montyclub:collectionsUpdated', JSON.stringify({ id: collectionId, t: Date.now() }))
      } catch {}
      showToast(`Display ${nextDisplay ? 'enabled' : 'disabled'}`)
      await loadCollections()
      try { broadcast('clubs', 'refresh', { reason: 'collection-display-toggled' }) } catch {}
    } catch (err) {
      setLocalPendingCollectionChanges(prev => {
        const revert = { ...prev }
        delete revert[collectionId]?.display
        if (Object.keys(revert[collectionId] || {}).length === 0) delete revert[collectionId]
        try {
          if (Object.keys(revert).length === 0) {
            localStorage.removeItem(COLLECTIONS_PENDING_KEY)
            localStorage.removeItem(COLLECTIONS_BACKUP_KEY)
          } else {
            localStorage.setItem(COLLECTIONS_PENDING_KEY, JSON.stringify(revert))
            localStorage.setItem(COLLECTIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: revert }))
          }
        } catch {}
        return revert
      })
      showToast('Failed to update display', 'error')
    } finally {
      setTogglingCollection(null)
    }
  }

  const toggleCollectionAccepting = async (collectionId: string) => {
    if (!adminApiKey) {
      showToast('Set admin API key first', 'error')
      return
    }
    const collection = collections.find(c => c.id === collectionId)
    if (!collection) return

    setTogglingCollection(collectionId)
    const effectiveCurrentAccepting = (localPendingCollectionChanges[collectionId]?.accepting !== undefined)
      ? !!localPendingCollectionChanges[collectionId]?.accepting
      : (collection.accepting ?? collection.enabled ?? false) // back-compat
    const nextAccepting = !effectiveCurrentAccepting

    setLocalPendingCollectionChanges(prev => {
      const next = { ...prev, [collectionId]: { ...(prev[collectionId] || {}), accepting: nextAccepting } }
      try {
        localStorage.setItem(COLLECTIONS_PENDING_KEY, JSON.stringify(next))
        localStorage.setItem(COLLECTIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: next }))
        broadcast('collections', 'update', { id: collectionId })
        localStorage.setItem('montyclub:collectionsUpdated', JSON.stringify({ id: collectionId, t: Date.now() }))
      } catch {}
      return next
    })

    try {
      const resp = await fetch('/api/registration-collections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminApiKey },
        body: JSON.stringify({ id: collectionId, accepting: nextAccepting })
      })
      if (!resp.ok) {
        let errText = 'Failed to update accepting'
        try { const j = await resp.json(); if (j?.error) errText = j.error } catch {}
        throw new Error(errText)
      }
      try {
        broadcast('collections', 'update', { id: collectionId })
        localStorage.setItem('montyclub:collectionsUpdated', JSON.stringify({ id: collectionId, t: Date.now() }))
      } catch {}
      showToast(`Accepting ${nextAccepting ? 'enabled' : 'disabled'}`)
      await loadCollections()
    } catch (err) {
      setLocalPendingCollectionChanges(prev => {
        const revert = { ...prev }
        delete revert[collectionId]?.accepting
        if (Object.keys(revert[collectionId] || {}).length === 0) delete revert[collectionId]
        try {
          if (Object.keys(revert).length === 0) {
            localStorage.removeItem(COLLECTIONS_PENDING_KEY)
            localStorage.removeItem(COLLECTIONS_BACKUP_KEY)
          } else {
            localStorage.setItem(COLLECTIONS_PENDING_KEY, JSON.stringify(revert))
            localStorage.setItem(COLLECTIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: revert }))
          }
        } catch {}
        return revert
      })
      showToast('Failed to update accepting', 'error')
    } finally {
      setTogglingCollection(null)
    }
  }

  const toggleCollectionRenewal = async (collectionId: string) => {
    if (!adminApiKey) {
      showToast('Set admin API key first', 'error')
      return
    }
    const collection = collections.find(c => c.id === collectionId)
    if (!collection) return

    setTogglingCollection(collectionId)
    const effectiveCurrentRenewal = (localPendingCollectionChanges[collectionId]?.renewalEnabled !== undefined)
      ? !!localPendingCollectionChanges[collectionId]?.renewalEnabled
      : (collection.renewalEnabled ?? false)
    const nextRenewal = !effectiveCurrentRenewal

    setLocalPendingCollectionChanges(prev => {
      const next = { ...prev, [collectionId]: { ...(prev[collectionId] || {}), renewalEnabled: nextRenewal } }
      try {
        localStorage.setItem(COLLECTIONS_PENDING_KEY, JSON.stringify(next))
        localStorage.setItem(COLLECTIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: next }))
        broadcast('collections', 'update', { id: collectionId })
        localStorage.setItem('montyclub:collectionsUpdated', JSON.stringify({ id: collectionId, t: Date.now() }))
      } catch {}
      return next
    })

    try {
      const resp = await fetch('/api/registration-collections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminApiKey },
        body: JSON.stringify({ id: collectionId, renewalEnabled: nextRenewal })
      })
      if (!resp.ok) {
        let errText = 'Failed to update renewal'
        try { const j = await resp.json(); if (j?.error) errText = j.error } catch {}
        throw new Error(errText)
      }
      try {
        broadcast('collections', 'update', { id: collectionId })
        localStorage.setItem('montyclub:collectionsUpdated', JSON.stringify({ id: collectionId, t: Date.now() }))
      } catch {}
      showToast(`Renewal ${nextRenewal ? 'enabled' : 'disabled'}`)
      await loadCollections()
    } catch (err) {
      setLocalPendingCollectionChanges(prev => {
        const revert = { ...prev }
        delete revert[collectionId]?.renewalEnabled
        if (Object.keys(revert[collectionId] || {}).length === 0) delete revert[collectionId]
        try {
          if (Object.keys(revert).length === 0) {
            localStorage.removeItem(COLLECTIONS_PENDING_KEY)
            localStorage.removeItem(COLLECTIONS_BACKUP_KEY)
          } else {
            localStorage.setItem(COLLECTIONS_PENDING_KEY, JSON.stringify(revert))
            localStorage.setItem(COLLECTIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: revert }))
          }
        } catch {}
        return revert
      })
      showToast('Failed to update renewal', 'error')
    } finally {
      setTogglingCollection(null)
    }
  }

  const toggleCollectionEnabled = async (collectionId: string) => {
    const toggleId = `TOGGLE-${collectionId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    console.log(JSON.stringify({ tag: 'collection-toggle', step: 'start', toggleId, collectionId }))
    
    if (!adminApiKey) {
      showToast('Set admin API key first', 'error')
      return
    }
    // If it's a temp ID or the collection hasn't been confirmed by server yet, toggle locally only
    const collection = collections.find(c => c.id === collectionId)
    const isTemp = collectionId.startsWith('temp-col-') || (!collection && localPendingCollectionChanges[collectionId]?.created)
    if (isTemp) {
      const current = localPendingCollectionChanges[collectionId]?.enabled ?? false
      const nextEnabled = !current
      setLocalPendingCollectionChanges(prev => {
        const next = { ...prev, [collectionId]: { ...(prev[collectionId]||{}), created: true, enabled: nextEnabled } }
        try {
          localStorage.setItem(COLLECTIONS_PENDING_KEY, JSON.stringify(next))
          localStorage.setItem(COLLECTIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: next }))
          broadcast('collections', 'update', { id: collectionId })
          localStorage.setItem('montyclub:collectionsUpdated', JSON.stringify({ id: collectionId, t: Date.now() }))
        } catch {}
        return next
      })
      showToast(`Collection will be ${nextEnabled ? 'enabled' : 'disabled'} once saved`) 
      return
    }
    if (!collection) {
      console.log(JSON.stringify({ tag: 'collection-toggle', step: 'error', toggleId, message: 'collection-not-found', collectionId }))
      return
    }

    setTogglingCollection(collectionId)
    // Determine effective current enabled state (prefer pending override over server snapshot)
    const effectiveCurrentEnabled = (localPendingCollectionChanges[collectionId]?.enabled !== undefined)
      ? !!localPendingCollectionChanges[collectionId]?.enabled
      : !!collection.enabled
    const nextEnabled = !effectiveCurrentEnabled
    
    console.log(JSON.stringify({ 
      tag: 'collection-toggle', 
      step: 'calc', 
      toggleId, 
      dbEnabled: !!collection.enabled, 
      pendingEnabled: localPendingCollectionChanges[collectionId]?.enabled, 
      effective: effectiveCurrentEnabled, 
      next: nextEnabled 
    }))

    // Optimistically update localStorage immediately using functional updater to avoid stale closure
    setLocalPendingCollectionChanges(prev => {
      const next = { ...prev, [collectionId]: { ...(prev[collectionId] || {}), enabled: nextEnabled } }
      console.log(JSON.stringify({ 
        tag: 'collection-toggle', 
        step: 'local-save', 
        toggleId, 
        pending: next[collectionId],
        allPendingIds: Object.keys(next)
      }))
      try {
        localStorage.setItem(COLLECTIONS_PENDING_KEY, JSON.stringify(next))
        localStorage.setItem(COLLECTIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: next }))
        broadcast('collections', 'update', { id: collectionId })
        localStorage.setItem('montyclub:collectionsUpdated', JSON.stringify({ id: collectionId, t: Date.now() }))
        console.log(JSON.stringify({ tag: 'collection-toggle', step: 'local-save-ok', toggleId }))
      } catch (e) {
        console.error(JSON.stringify({ tag: 'collection-toggle', step: 'local-save-fail', toggleId, error: String(e) }))
      }
      return next
    })
    
    console.log(JSON.stringify({ tag: 'collection-toggle', step: 'patch-send', toggleId, nextEnabled }))
    try {
      const apiStartTime = Date.now()
      const resp = await fetch('/api/registration-collections', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify({ id: collectionId, enabled: nextEnabled })
      })
      const apiDuration = Date.now() - apiStartTime
      console.log(JSON.stringify({ 
        tag: 'collection-toggle', 
        step: 'patch-response', 
        toggleId, 
        status: resp.status, 
        duration: apiDuration 
      }))
      
      if (!resp.ok) {
        let errText = 'Failed to update collection'
        try { const j = await resp.json(); if (j && j.error) errText = `${j.error}${j.detail ? ` (${j.detail})` : ''}` } catch {}
        throw new Error(errText)
      }
      const data = await resp.json()
      console.log(JSON.stringify({ 
        tag: 'collection-toggle', 
        step: 'patch-ok', 
        toggleId, 
        collection: { id: data.collection.id, enabled: data.collection.enabled } 
      }))
      // Do NOT immediately update collections state to avoid premature auto-clear
      // Keep pending change in localStorage until a subsequent GET confirms the DB state matches
      // This prevents showing stale DB state on reload due to eventual consistency
      try {
        broadcast('collections', 'update', { id: collectionId })
        localStorage.setItem('montyclub:collectionsUpdated', JSON.stringify({ id: collectionId, t: Date.now() }))
      } catch {}
      showToast(`Collection ${nextEnabled ? 'enabled' : 'disabled'}`)
      // Immediately refresh collections to ensure auto-clear runs with fresh DB state
      console.log(JSON.stringify({ tag: 'collection-toggle', step: 'refresh-now', toggleId }))
      await loadCollections()
      
      // Broadcast to ClubsList to refresh if in Collection mode
      try {
        broadcast('clubs', 'refresh', { reason: 'collection-toggled' })
      } catch {}
    } catch (err) {
      console.error(JSON.stringify({ tag: 'collection-toggle', step: 'patch-fail', toggleId, error: String(err) }))
      // Revert on error using functional update to avoid clobbering subsequent rapid toggles
      setLocalPendingCollectionChanges(prev => {
        const revert = { ...prev }
        delete revert[collectionId]
        console.log(JSON.stringify({ tag: 'collection-toggle', step: 'local-revert', toggleId }))
        try {
          if (Object.keys(revert).length === 0) {
            localStorage.removeItem(COLLECTIONS_PENDING_KEY)
            localStorage.removeItem(COLLECTIONS_BACKUP_KEY)
          } else {
            localStorage.setItem(COLLECTIONS_PENDING_KEY, JSON.stringify(revert))
            localStorage.setItem(COLLECTIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: revert }))
          }
          broadcast('collections', 'update', { id: collectionId })
          localStorage.setItem('montyclub:collectionsUpdated', JSON.stringify({ id: collectionId, t: Date.now() }))
        } catch {}
        return revert
      })
      showToast('Failed to update collection', 'error')
    } finally {
      setTogglingCollection(null)
      console.log(JSON.stringify({ tag: 'collection-toggle', step: 'complete', toggleId }))
    }
  }

  const deleteCollection = async (collectionId: string) => {
    if (!adminApiKey) {
      showToast('Set admin API key first', 'error')
      return
    }
    {
      const ok = await confirm({
        title: 'Delete Collection',
        message: 'Are you sure you want to delete this collection? This cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        variant: 'danger',
      })
      if (!ok) return
    }

    // If it's a temp/pending-created collection, just clear it locally
    if (collectionId.startsWith('temp-col-') || localPendingCollectionChanges[collectionId]?.created) {
      setLocalPendingCollectionChanges(prev => {
        const rest = { ...prev }
        delete rest[collectionId]
        try {
          if (Object.keys(rest).length === 0) {
            localStorage.removeItem(COLLECTIONS_PENDING_KEY)
            localStorage.removeItem(COLLECTIONS_BACKUP_KEY)
          } else {
            localStorage.setItem(COLLECTIONS_PENDING_KEY, JSON.stringify(rest))
            localStorage.setItem(COLLECTIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: rest }))
          }
          broadcast('collections', 'update', { id: collectionId })
          localStorage.setItem('montyclub:collectionsUpdated', JSON.stringify({ id: collectionId, t: Date.now() }))
        } catch {}
        return rest
      })
      if (activeCollectionId === collectionId) setActiveCollectionId(null)
      showToast('New collection creation canceled')
      return
    }
    // Mark as deleted in local pending changes (do not mutate server snapshot yet)
    const newPending = { ...localPendingCollectionChanges, [collectionId]: { deleted: true } }
    setLocalPendingCollectionChanges(newPending)
    try {
      localStorage.setItem(COLLECTIONS_PENDING_KEY, JSON.stringify(newPending))
      localStorage.setItem(COLLECTIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
      broadcast('collections', 'update', { id: collectionId })
      localStorage.setItem('montyclub:collectionsUpdated', JSON.stringify({ id: collectionId, t: Date.now() }))
    } catch {}

    // Adjust active collection immediately if needed (choose an enabled non-deleted replacement)
    if (activeCollectionId === collectionId) {
      const replacement = collections.find(c => c.id !== collectionId && !newPending[c.id]?.deleted && c.enabled) ||
        collections.find(c => c.id !== collectionId && !newPending[c.id]?.deleted) || null
      setActiveCollectionId(replacement ? replacement.id : null)
    }

    try {
      const resp = await fetch(`/api/registration-collections?id=${collectionId}&deleteRegistrations=false`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminApiKey }
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to delete collection')
      }
      showToast('Deletion requested. Syncing…', 'info')
      // Poll until collection disappears from server snapshot (eventual consistency)
      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise(r => setTimeout(r, 200 * (attempt + 1)))
        await loadCollections()
        const stillExists = collections.some(c => c.id === collectionId)
        if (!stillExists) {
          showToast('Collection deleted')
          break
        } else if (attempt === 4) {
          showToast('Still pending deletion; will clear automatically when server updates', 'info')
        }
      }
    } catch (err: any) {
      // Revert local pending deletion
      const revertPending = { ...localPendingCollectionChanges }
      delete revertPending[collectionId]
      setLocalPendingCollectionChanges(revertPending)
      try {
        if (Object.keys(revertPending).length === 0) {
          localStorage.removeItem(COLLECTIONS_PENDING_KEY)
          localStorage.removeItem(COLLECTIONS_BACKUP_KEY)
        } else {
          localStorage.setItem(COLLECTIONS_PENDING_KEY, JSON.stringify(revertPending))
          localStorage.setItem(COLLECTIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: revertPending }))
        }
      } catch {}
      showToast(err.message || 'Failed to delete collection', 'error')
    }
  }

  const toggleAnalyticsEnabled = () => {
    const next = !analyticsEnabled
    setAnalyticsEnabled(next)
    try { localStorage.setItem('analytics:enabled', String(next)) } catch {}
    showToast(`Analytics ${next ? 'enabled' : 'disabled'}`)
  }

  const saveAnalyticsPeriod = () => {
    const p = analyticsPeriod.trim() || 'pilot'
    setAnalyticsPeriod(p)
    try { localStorage.setItem('analytics:period', p) } catch {}
    showToast(`Period set to '${p}'`)
  }

  const saveAdminApiKey = () => {
    const k = adminApiKey.trim()
    setAdminApiKey(k)
    try { localStorage.setItem('analytics:adminKey', k) } catch {}
    showToast('Admin API key saved')
  }

  const saveApiKeyFromPrompt = () => {
    const k = apiKeyPromptInput.trim()
    if (k) {
      setAdminApiKey(k)
      try { localStorage.setItem('analytics:adminKey', k) } catch {}
      showToast('Admin API key saved')
    }
    setShowApiKeyPrompt(false)
    setApiKeyPromptInput('')
  }

  const skipApiKeyPrompt = () => {
    setShowApiKeyPrompt(false)
    setApiKeyPromptInput('')
  }

  const fetchAnalyticsSummary = async () => {
    if (!adminApiKey) {
      showToast('Set admin API key first', 'error')
      return
    }
    setLoadingSummary(true)
    setAnalyticsSummary(null)
    try {
      const resp = await fetch(`/api/analytics/admin/summary?period=${encodeURIComponent(analyticsPeriod)}&max=5000`, {
        headers: { 'x-admin-key': adminApiKey }
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }
      const data = await resp.json()
      setAnalyticsSummary(data)
      showToast('Analytics summary loaded', 'info')
    } catch (e) {
      console.error('Summary error', e)
      showToast(`Could not load summary: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error')
    } finally {
      setLoadingSummary(false)
    }
  }

  const clearAnalyticsPeriod = async () => {
    if (!adminApiKey) {
      showToast('Set admin API key first', 'error')
      return
    }
    {
      const ok = await confirm({
        title: 'Clear Analytics Data',
        message: `Clear ALL analytics data for period '${analyticsPeriod}'? This cannot be undone.`,
        confirmText: 'Clear',
        cancelText: 'Cancel',
        variant: 'danger',
      })
      if (!ok) return
    }
    setClearingAnalytics(true)
    try {
      const resp = await fetch('/api/analytics/admin/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminApiKey },
        body: JSON.stringify({ period: analyticsPeriod })
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }
      const data = await resp.json()
      showToast(`Removed ${data.removed || 0} event files`)  
      setAnalyticsSummary(null)
    } catch (e) {
      console.error('Clear error', e)
      showToast(`Could not clear analytics: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error')
    } finally {
      setClearingAnalytics(false)
    }
  }

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, type }])
  }

  const closeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  useEffect(() => {
    const cleanup = createBroadcastListener((message) => {
      // Handle updates domain messages
      if (message.domain === 'updates' && message.action === 'create') {
        fetchUpdates(true)
      }
      // Handle announcements domain messages
      if (message.domain === 'announcements') {
        fetchAnnouncements()
      }
      // Handle clubs domain messages
      if (message.domain === 'clubs') {
        refreshData()
      }
      // Handle collections domain messages
      if (message.domain === 'collections') {
        loadCollections()
      }
    })

    return () => {
      cleanup()
      if (collectionsRefreshTimerRef.current) {
        clearTimeout(collectionsRefreshTimerRef.current)
      }
    }
  }, [])

  // Check if this is first-time setup
  useEffect(() => {
    const checkFirstTime = async () => {
      try {
        const resp = await fetch('/api/admin/users')
        if (resp.ok) {
          const data = await resp.json()
          setIsFirstTimeSetup(!data.users || data.users.length === 0)
        }
      } catch (err) {
        // If error, assume first time
        setIsFirstTimeSetup(true)
      }
    }
    checkFirstTime()
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
        // Check if admin API key is already set
        const savedKey = localStorage.getItem('analytics:adminKey')
        if (!savedKey || savedKey.trim() === '') {
          setShowApiKeyPrompt(true)
        }
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

  const toggleUserManagement = () => {
    const newState = !showUserManagement
    setShowUserManagement(newState)
    
    // Scroll to user management section when opening
    if (newState) {
      setTimeout(() => {
        userManagementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }

  const handleClearData = async () => {
    if (!clearDataPassword || !clearDataApiKey) {
      showToast('Please enter both password and API key', 'error')
      return
    }

    const hasSelections = Object.values(clearOptions).some(v => v)
    if (!hasSelections) {
      showToast('Please select at least one data type to clear', 'error')
      return
    }

    setClearingData(true)
    try {
      const resp = await fetch('/api/admin/clear-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: clearDataPassword,
          adminApiKey: clearDataApiKey,
          clearOptions,
        }),
      })

      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data.error || 'Failed to clear data')
      }

      // Clear client-side localStorage if selected
      if (clearOptions.localStorage) {
        try {
          localStorage.clear()
          showToast('Client localStorage cleared', 'success')
        } catch (e) {
          showToast('Failed to clear client localStorage', 'error')
        }
      }

      // Show detailed success message
      const clearedItems = Object.entries(data.cleared)
        .filter(([_, count]) => (count as number) > 0)
        .map(([key, count]) => `${key}: ${count}`)
        .join(', ')
      
      showToast(
        clearedItems 
          ? `Data cleared successfully! ${clearedItems}` 
          : 'Data cleared successfully',
        'success'
      )

      // Reset form
      setClearDataPassword('')
      setClearDataApiKey('')
      setClearOptions({
        localStorage: true,
        updateRequests: false,
        announcements: false,
        registrationCollections: false,
        registrations: false,
        analytics: false,
      })
      setShowClearDataModal(false)

      // Refresh all data after clearing
      setTimeout(() => {
        refreshData()
        fetchUpdates(true)
        loadCollections()
      }, 500)

    } catch (err: any) {
      showToast(err.message || 'Failed to clear data', 'error')
    } finally {
      setClearingData(false)
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

  const fetchUpdates = async (forceFresh: boolean = false, retryCount: number = 0) => {
    const fetchId = `fetch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    console.log(JSON.stringify({ 
      tag: 'fetch-updates', 
      step: 'start', 
      fetchId, 
      forceFresh,
      retryCount,
      currentPendingIds: Object.keys(localPendingChanges),
      currentUpdatesCount: updates.length
    }))
    
    setRefreshingUpdates(true)
    try {
      const url = forceFresh ? '/api/updates?nocache=1' : '/api/updates'
      const fetchStartTime = Date.now()
      
      // Add timeout to prevent hanging
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout
      
      const resp = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)
      
      const fetchDuration = Date.now() - fetchStartTime
      
      console.log(JSON.stringify({ 
        tag: 'fetch-updates', 
        step: 'response-received', 
        fetchId, 
        status: resp.status, 
        duration: fetchDuration 
      }))
      
      if (!resp.ok) throw new Error(`Failed to fetch updates: ${resp.status}`)
      const data = await resp.json()
      
      console.log(JSON.stringify({ 
        tag: 'fetch-updates', 
        step: 'data-parsed', 
        fetchId, 
        updatesCount: Array.isArray(data) ? data.length : 0,
        updates: Array.isArray(data) ? data.map((u: any) => ({ id: String(u.id), reviewed: u.reviewed })) : []
      }))
      
      // Keep `updates` as the last known server snapshot. We overlay
      // localPendingChanges at render time so that we can reliably compare
      // server vs local state when deciding when to clear pending changes.
      setUpdates(data)
      
      console.log(JSON.stringify({
        tag: 'fetch-updates', 
        step: 'state-updated', 
        fetchId,
        pendingIds: Object.keys(localPendingChanges)
      }))
    } catch (err) {
      console.error(JSON.stringify({ 
        tag: 'fetch-updates', 
        step: 'error', 
        fetchId,
        retryCount,
        error: String(err) 
      }))
      
      // Retry with exponential backoff (max 2 retries)
      if (retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s
        console.log(JSON.stringify({ 
          tag: 'fetch-updates', 
          step: 'retry-scheduled', 
          fetchId, 
          delay 
        }))
        setTimeout(() => {
          fetchUpdates(forceFresh, retryCount + 1).catch(() => {
            // Final retry failed - clear syncing state to prevent infinite trap
            console.error(JSON.stringify({ 
              tag: 'fetch-updates', 
              step: 'all-retries-failed', 
              fetchId 
            }))
          })
        }, delay)
      } else {
        // All retries exhausted - show error toast
        showToast('Failed to refresh updates. Some changes may not sync.', 'error')
      }
    } finally {
      setRefreshingUpdates(false)
      console.log(JSON.stringify({ 
        tag: 'fetch-updates', 
        step: 'complete', 
        fetchId 
      }))
    }
  }

  // Fresh single-item handlers with optimistic UI via localPendingChanges only
  const handleToggleSingle = async (item: any) => {
    const operationId = `toggle-${item.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    console.log(JSON.stringify({ 
      tag: 'toggle-single', 
      step: 'start', 
      operationId, 
      itemId: item.id, 
      currentReviewed: item.reviewed,
      pendingReviewed: localPendingChanges[String(item.id)]?.reviewed 
    }))
    
    setSingleProcessingId(String(item.id))
    const id = String(item.id)
    // Get current state from pending changes or server state
    const currentReviewed = localPendingChanges[id]?.reviewed !== undefined
      ? localPendingChanges[id].reviewed
      : item.reviewed
    const nextReviewed = !currentReviewed

    console.log(JSON.stringify({ 
      tag: 'toggle-single', 
      step: 'calculated-next', 
      operationId, 
      currentReviewed, 
      nextReviewed 
    }))

    // Use functional update to avoid stale closures and race conditions
    setLocalPendingChanges(prev => {
      const newPending = {
        ...prev,
        [id]: { ...(prev[id] || {}), reviewed: nextReviewed, _timestamp: Date.now() },
      }
      console.log(JSON.stringify({ 
        tag: 'toggle-single', 
        step: 'pending-set', 
        operationId, 
        id, 
        nextReviewed,
        allPendingIds: Object.keys(newPending),
        pendingState: newPending[id]
      }))
      try {
        localStorage.setItem(PENDING_KEY, JSON.stringify(newPending))
        localStorage.setItem(PENDING_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
        console.log(JSON.stringify({ 
          tag: 'toggle-single', 
          step: 'localStorage-saved', 
          operationId, 
          id 
        }))
      } catch (e) {
        console.error(JSON.stringify({ 
          tag: 'toggle-single', 
          step: 'localStorage-error', 
          operationId, 
          id, 
          error: String(e) 
        }))
      }
      return newPending
    })

    try {
      console.log(JSON.stringify({ 
        tag: 'toggle-single', 
        step: 'api-call-start', 
        operationId, 
        id, 
        nextReviewed 
      }))
      const apiStartTime = Date.now()
      const resp = await fetch(`/api/updates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed: nextReviewed }),
      })
      const apiDuration = Date.now() - apiStartTime
      console.log(JSON.stringify({ 
        tag: 'toggle-single', 
        step: 'api-call-complete', 
        operationId, 
        id, 
        status: resp.status, 
        duration: apiDuration 
      }))
      
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const updated = await resp.json()
      const confirmedReviewed = !!updated.reviewed
      console.log(JSON.stringify({ 
        tag: 'toggle-single', 
        step: 'api-success', 
        operationId, 
        id, 
        confirmedReviewed, 
        serverResponse: updated 
      }))
      
      // CRITICAL: Mark this operation as confirmed - API response is source of truth
      confirmedOperationsRef.current.set(id, { reviewed: confirmedReviewed, timestamp: Date.now() })
      console.log(JSON.stringify({ 
        tag: 'toggle-single', 
        step: 'operation-confirmed', 
        operationId, 
        id, 
        confirmedReviewed 
      }))
      
      showToast(`Marked ${confirmedReviewed ? 'reviewed' : 'unreviewed'}`)
      
      // IMMEDIATELY clear pending - we trust the API response
      setLocalPendingChanges(prev => {
        const cleared = { ...prev }
        delete cleared[id]
        console.log(JSON.stringify({ 
          tag: 'toggle-single', 
          step: 'immediate-clear', 
          operationId, 
          id, 
          confirmedReviewed,
          remainingPending: Object.keys(cleared)
        }))
        try {
          if (Object.keys(cleared).length === 0) {
            localStorage.removeItem(PENDING_KEY)
            localStorage.removeItem(PENDING_BACKUP_KEY)
          } else {
            localStorage.setItem(PENDING_KEY, JSON.stringify(cleared))
            localStorage.setItem(PENDING_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: cleared }))
          }
        } catch (e) {
          console.error(JSON.stringify({ 
            tag: 'toggle-single', 
            step: 'immediate-clear-localStorage-error', 
            operationId, 
            error: String(e) 
          }))
        }
        return cleared
      })
      
      // Fetch fresh data in background (non-blocking) for eventual consistency
      // But we don't wait for it - we've already cleared based on API response
      setTimeout(() => {
        fetchUpdates(true).catch(() => {})
      }, 1000)
    } catch (e) {
      console.error(JSON.stringify({ 
        tag: 'toggle-single', 
        step: 'api-error', 
        operationId, 
        id, 
        error: String(e) 
      }))
      // Revert on error using functional update to avoid stale closures
      setLocalPendingChanges(prev => {
        const revertPending = { ...prev }
        delete revertPending[id]
        console.log(JSON.stringify({ 
          tag: 'toggle-single', 
          step: 'revert-pending', 
          operationId, 
          id, 
          remainingPendingIds: Object.keys(revertPending) 
        }))
        try {
          if (Object.keys(revertPending).length === 0) {
            localStorage.removeItem(PENDING_KEY)
            localStorage.removeItem(PENDING_BACKUP_KEY)
          } else {
            localStorage.setItem(PENDING_KEY, JSON.stringify(revertPending))
            localStorage.setItem(PENDING_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: revertPending }))
          }
        } catch (e) {
          console.error(JSON.stringify({ 
            tag: 'toggle-single', 
            step: 'revert-localStorage-error', 
            operationId, 
            id, 
            error: String(e) 
          }))
        }
        return revertPending
      })
      showToast('Failed to update status', 'error')
    } finally {
      setSingleProcessingId(null)
      console.log(JSON.stringify({ 
        tag: 'toggle-single', 
        step: 'complete', 
        operationId, 
        id 
      }))
    }
  }

  const handleDeleteSingle = async (item: any) => {
    {
      const ok = await confirm({
        title: 'Delete Update Request',
        message: 'Delete this update request? This cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        variant: 'danger',
      })
      if (!ok) return
    }
    setSingleProcessingId(String(item.id))
    const id = String(item.id)
    
    // Mark as deleted in local pending changes using functional update
    setLocalPendingChanges(prev => {
      const newPending = {
        ...prev,
        [id]: { ...(prev[id] || {}), deleted: true },
      }
      try {
        localStorage.setItem(PENDING_KEY, JSON.stringify(newPending))
        localStorage.setItem(PENDING_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
      } catch (e) {
        // Ignore localStorage errors
      }
      return newPending
    })

    try {
      const resp = await fetch(`/api/updates/${id}`, { method: 'DELETE' })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      await resp.json()
      
      // CRITICAL: Mark this operation as confirmed - API response is source of truth
      confirmedOperationsRef.current.set(id, { deleted: true, timestamp: Date.now() })
      
      showToast('Update request deleted')
      
      // IMMEDIATELY clear pending - we trust the API response
      setLocalPendingChanges(prev => {
        const cleared = { ...prev }
        delete cleared[id]
        try {
          if (Object.keys(cleared).length === 0) {
            localStorage.removeItem(PENDING_KEY)
            localStorage.removeItem(PENDING_BACKUP_KEY)
          } else {
            localStorage.setItem(PENDING_KEY, JSON.stringify(cleared))
            localStorage.setItem(PENDING_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: cleared }))
          }
        } catch (e) {
          // Ignore localStorage errors
        }
        return cleared
      })
      
      // Fetch fresh data in background (non-blocking)
      setTimeout(() => {
        fetchUpdates(true).catch(() => {})
      }, 1000)
    } catch (e) {
      console.error('Single delete failed', e)
      // Revert on error using functional update
      setLocalPendingChanges(prev => {
        const revertPending = { ...prev }
        delete revertPending[id]
        try {
          if (Object.keys(revertPending).length === 0) {
            localStorage.removeItem(PENDING_KEY)
            localStorage.removeItem(PENDING_BACKUP_KEY)
          } else {
            localStorage.setItem(PENDING_KEY, JSON.stringify(revertPending))
            localStorage.setItem(PENDING_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: revertPending }))
          }
        } catch (e) {
          // Ignore localStorage errors
        }
        return revertPending
      })
      showToast('Failed to delete update', 'error')
    } finally {
      setSingleProcessingId(null)
    }
  }

  // Bulk operations via new batch endpoint
  const performBatch = async (action: 'review' | 'unreview' | 'delete') => {
    const ids = Array.from(selectedUpdateIds)
    if (ids.length === 0) return
    if (action === 'delete') {
      {
        const ok = await confirm({
          title: 'Delete Selected Requests',
          message: `Delete ${ids.length} update request(s)? This cannot be undone.`,
          confirmText: 'Delete',
          cancelText: 'Cancel',
          variant: 'danger',
        })
        if (!ok) return
      }
    }
    setUpdatingBatch(true)

    // Apply the batch intent using functional update to avoid stale closures
    setLocalPendingChanges(prev => {
      const newPending = { ...prev }
      if (action === 'delete') {
        ids.forEach(id => {
          newPending[id] = { ...(newPending[id] || {}), deleted: true }
        })
      } else {
        const reviewedVal = action === 'review'
        ids.forEach(id => {
          newPending[id] = { ...(newPending[id] || {}), reviewed: reviewedVal }
        })
      }
      try {
        localStorage.setItem(PENDING_KEY, JSON.stringify(newPending))
        localStorage.setItem(PENDING_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
      } catch (e) {
        // Ignore localStorage errors
      }
      return newPending
    })

    try {
      const resp = await fetch('/api/updates/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action })
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      if (!data.success) throw new Error('Batch failed')

      // CRITICAL: Mark all successful operations as confirmed
      const batchOperationId = `batch-${action}-${Date.now()}`
      const timestamp = Date.now()
      
      if (data.items && Array.isArray(data.items)) {
        data.items.forEach((item: any) => {
          const itemId = String(item.id)
          if (action === 'delete') {
            confirmedOperationsRef.current.set(itemId, { deleted: true, timestamp })
          } else {
            const reviewedVal = action === 'review'
            confirmedOperationsRef.current.set(itemId, { reviewed: reviewedVal, timestamp })
          }
        })
      }
      
      console.log(JSON.stringify({ 
        tag: 'batch', 
        step: 'operations-confirmed', 
        batchOperationId, 
        action, 
        count: data.count,
        confirmedIds: data.items ? data.items.map((i: any) => String(i.id)) : []
      }))
      
      // IMMEDIATELY clear pending for all confirmed items
      setLocalPendingChanges(prev => {
        const cleared = { ...prev }
        let hasCleared = false
        
        ids.forEach(id => {
          if (cleared[id]) {
            delete cleared[id]
            hasCleared = true
          }
        })
        
        if (hasCleared) {
          console.log(JSON.stringify({ 
            tag: 'batch', 
            step: 'immediate-clear', 
            batchOperationId, 
            remainingIds: Object.keys(cleared) 
          }))
          try {
            if (Object.keys(cleared).length === 0) {
              localStorage.removeItem(PENDING_KEY)
              localStorage.removeItem(PENDING_BACKUP_KEY)
            } else {
              localStorage.setItem(PENDING_KEY, JSON.stringify(cleared))
              localStorage.setItem(PENDING_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: cleared }))
            }
          } catch (e) {
            console.error(JSON.stringify({ 
              tag: 'batch', 
              step: 'immediate-clear-localStorage-error', 
              batchOperationId, 
              error: String(e) 
            }))
          }
        }
        
        return cleared
      })
      
      showToast(`${action === 'delete' ? 'Deleted' : 'Updated'} ${data.count} item${data.count === 1 ? '' : 's'}`)
      
      // Fetch fresh data in background (non-blocking)
      setTimeout(() => {
        fetchUpdates(true).catch(() => {})
      }, 1000)
    } catch (e) {
      console.error('Batch op failed', e)
      // Revert on error using functional update
      setLocalPendingChanges(prev => {
        const revertPending = { ...prev }
        ids.forEach(id => { delete revertPending[id] })
        try {
          if (Object.keys(revertPending).length === 0) {
            localStorage.removeItem(PENDING_KEY)
            localStorage.removeItem(PENDING_BACKUP_KEY)
          } else {
            localStorage.setItem(PENDING_KEY, JSON.stringify(revertPending))
            localStorage.setItem(PENDING_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: revertPending }))
          }
        } catch (e) {
          // Ignore localStorage errors
        }
        return revertPending
      })
      showToast('Batch operation failed', 'error')
    } finally {
      setSelectedUpdateIds(new Set())
      setUpdatingBatch(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      refreshData()
      fetchUpdates()
      fetchAnnouncements()
      fetchSettings()
      checkCatalogStatus()
    }
  }, [isAuthenticated])

  // Load pending changes from localStorage on mount (primary + backup fallback)
  useEffect(() => {
    const actionId = `UPDATES-MOUNT-${Date.now()}`
    try {
      const primary = localStorage.getItem(PENDING_KEY)
      if (primary) {
        const parsed = JSON.parse(primary)
        setLocalPendingChanges(parsed)
      } else {
        const backup = localStorage.getItem(PENDING_BACKUP_KEY)
        if (backup) {
          try {
            const backupParsed = JSON.parse(backup)
            if (backupParsed && backupParsed.data) {
              setLocalPendingChanges(backupParsed.data)
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
    finally {
      setLocalStorageLoaded(true)
    }
  }, [])

  // Redundant persistence effect (writes both keys after any change once loaded)
  useEffect(() => {
    if (!localStorageLoaded) return
    
    // Clean up old pending changes (older than 5 minutes) to prevent infinite syncing
    const now = Date.now()
    const staleThreshold = 5 * 60 * 1000 // 5 minutes
    const cleaned = { ...localPendingChanges }
    let hasStale = false
    
    Object.keys(cleaned).forEach(id => {
      const pending = cleaned[id]
      // Check if pending has a timestamp and if it's stale
      const pendingTimestamp = (pending as any)._timestamp
      if (pendingTimestamp && (now - pendingTimestamp) > staleThreshold) {
        console.log(JSON.stringify({ 
          tag: 'updates-pending', 
          step: 'remove-stale', 
          id, 
          age: now - pendingTimestamp 
        }))
        delete cleaned[id]
        hasStale = true
      }
    })
    
    // If we cleaned stale entries, update state
    if (hasStale) {
      setLocalPendingChanges(cleaned)
      return // The updated state will trigger this effect again to persist
    }
    
    try {
      if (Object.keys(localPendingChanges).length === 0) {
        localStorage.removeItem(PENDING_KEY)
        localStorage.removeItem(PENDING_BACKUP_KEY)
        try { console.log(JSON.stringify({ tag: 'updates-pending', step: 'cleared' })) } catch {}
      } else {
        const serialized = JSON.stringify(localPendingChanges)
        localStorage.setItem(PENDING_KEY, serialized)
        localStorage.setItem(PENDING_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: localPendingChanges }))
        try { console.log(JSON.stringify({ tag: 'updates-pending', step: 'persisted', count: Object.keys(localPendingChanges).length })) } catch {}
      }
    } catch (e) {
      try { console.log(JSON.stringify({ tag: 'updates-pending', step: 'persist-fail', error: String(e) })) } catch {}
    }
  }, [localPendingChanges, localStorageLoaded])

  // Auto-clear pending changes that now match database state
  useEffect(() => {
    const autoClearId = `autoclear-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    
    // CRITICAL: Don't run until localStorage has been loaded on mount
    if (!localStorageLoaded) {
      console.log(JSON.stringify({ 
        tag: 'autoclear', 
        step: 'skip-not-loaded', 
        autoClearId 
      }))
      return
    }
    if (Object.keys(localPendingChanges).length === 0) {
      console.log(JSON.stringify({ 
        tag: 'autoclear', 
        step: 'skip-no-pending', 
        autoClearId 
      }))
      return
    }
    if (updates.length === 0) {
      // If we have pending changes, check if any are confirmed
      const pendingIds = Object.keys(localPendingChanges)
      const hasConfirmed = pendingIds.some(id => {
        const confirmed = confirmedOperationsRef.current.get(id)
        return confirmed && (Date.now() - confirmed.timestamp) < 300000 // Within last 5 minutes
      })
      
      if (hasConfirmed) {
        // We have confirmed operations - clear them even without database data
        console.log(JSON.stringify({ 
          tag: 'autoclear', 
          step: 'clear-confirmed-without-db', 
          autoClearId,
          pendingIds
        }))
        // This will be handled in the main loop
      } else {
        console.log(JSON.stringify({ 
          tag: 'autoclear', 
          step: 'skip-no-updates', 
          autoClearId 
        }))
        return
      }
    }

    console.log(JSON.stringify({ 
      tag: 'autoclear', 
      step: 'start', 
      autoClearId,
      pendingIds: Object.keys(localPendingChanges),
      pendingDetails: Object.entries(localPendingChanges).map(([id, p]) => ({ id, ...p })),
      updatesCount: updates.length,
      updatesDetails: updates.map((u: any) => ({ id: String(u.id), reviewed: u.reviewed }))
    }))

    const stillPending = { ...localPendingChanges }
    let hasCleared = false
    const clearedIds: string[] = []
    const stillPendingIds: string[] = []

    Object.keys(stillPending).forEach(id => {
      const pending = stillPending[id]
      const dbItem = updates.find(u => String(u.id) === id)
      const confirmed = confirmedOperationsRef.current.get(id)

      console.log(JSON.stringify({ 
        tag: 'autoclear', 
        step: 'checking', 
        autoClearId,
        id,
        pending: { reviewed: pending.reviewed, deleted: pending.deleted },
        dbItem: dbItem ? { id: String(dbItem.id), reviewed: dbItem.reviewed } : null,
        confirmed: confirmed ? { reviewed: confirmed.reviewed, timestamp: confirmed.timestamp } : null
      }))

      // PRIORITY 1: If operation was confirmed by API, clear it immediately
      // API response is source of truth - don't wait for database
      if (confirmed) {
        const age = Date.now() - confirmed.timestamp
        // Clear if confirmed within last 5 minutes (safety window)
        if (age < 300000) {
          // Check if pending matches confirmed state
          if (pending.reviewed !== undefined && confirmed.reviewed === pending.reviewed) {
            console.log(JSON.stringify({ 
              tag: 'autoclear', 
              step: 'clear-confirmed', 
              autoClearId, 
              id,
              reviewed: confirmed.reviewed,
              age
            }))
            delete stillPending[id]
            hasCleared = true
            clearedIds.push(id)
            // Keep confirmed for a bit longer in case of page refresh
            return
          } else if (pending.deleted && confirmed.deleted) {
            console.log(JSON.stringify({ 
              tag: 'autoclear', 
              step: 'clear-confirmed-deleted', 
              autoClearId, 
              id 
            }))
            delete stillPending[id]
            hasCleared = true
            clearedIds.push(id)
            return
          }
        } else {
          // Confirmed operation is old, remove it
          confirmedOperationsRef.current.delete(id)
        }
      }

      // PRIORITY 2: If marked deleted locally but no longer exists in DB, clear it
      // OR if deletion was confirmed by API
      if (pending.deleted) {
        if (!dbItem || confirmed?.deleted) {
          console.log(JSON.stringify({ 
            tag: 'autoclear', 
            step: 'clear-deleted', 
            autoClearId, 
            id,
            reason: confirmed?.deleted ? 'confirmed' : 'not-in-db'
          }))
          delete stillPending[id]
          hasCleared = true
          clearedIds.push(id)
        }
      }
      // PRIORITY 3: If reviewed state matches DB, clear it
      else if (dbItem && pending.reviewed !== undefined && dbItem.reviewed === pending.reviewed) {
        console.log(JSON.stringify({ 
          tag: 'autoclear', 
          step: 'clear-match', 
          autoClearId, 
          id,
          reviewed: pending.reviewed
        }))
        delete stillPending[id]
        hasCleared = true
        clearedIds.push(id)
      } else {
        console.log(JSON.stringify({ 
          tag: 'autoclear', 
          step: 'still-pending', 
          autoClearId, 
          id,
          pendingReviewed: pending.reviewed,
          dbReviewed: dbItem?.reviewed,
          hasConfirmed: !!confirmed
        }))
        stillPendingIds.push(id)
      }
    })

    if (hasCleared) {
      console.log(JSON.stringify({ 
        tag: 'autoclear', 
        step: 'updating-state', 
        autoClearId,
        clearedIds,
        stillPendingIds,
        remainingCount: Object.keys(stillPending).length
      }))
      
      setLocalPendingChanges(stillPending)
      try {
        if (Object.keys(stillPending).length === 0) {
          localStorage.removeItem(PENDING_KEY)
          localStorage.removeItem(PENDING_BACKUP_KEY)
          console.log(JSON.stringify({ 
            tag: 'autoclear', 
            step: 'localStorage-cleared', 
            autoClearId 
          }))
        } else {
          localStorage.setItem(PENDING_KEY, JSON.stringify(stillPending))
          localStorage.setItem(PENDING_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: stillPending }))
          console.log(JSON.stringify({ 
            tag: 'autoclear', 
            step: 'localStorage-updated', 
            autoClearId,
            remainingIds: Object.keys(stillPending)
          }))
        }
      } catch (e) {
        console.error(JSON.stringify({ 
          tag: 'autoclear', 
          step: 'localStorage-error', 
          autoClearId, 
          error: String(e) 
        }))
      }
    } else {
      console.log(JSON.stringify({ 
        tag: 'autoclear', 
        step: 'no-changes', 
        autoClearId,
        stillPendingIds
      }))
    }
  }, [updates, localPendingChanges, localStorageLoaded])

  // Load pending announcements from localStorage on mount
  useEffect(() => {
    const actionId = `ANNOUNCEMENTS-MOUNT-${Date.now()}`
    try {
      const primary = localStorage.getItem(ANNOUNCEMENTS_PENDING_KEY)
      if (primary) {
        const parsed = JSON.parse(primary)
        try { console.log(JSON.stringify({ tag: 'ann-pending', step: 'primary', actionId, count: Object.keys(parsed||{}).length })) } catch {}
        setLocalPendingAnnouncements(parsed)
      } else {
        const backup = localStorage.getItem(ANNOUNCEMENTS_BACKUP_KEY)
        if (backup) {
          try {
            const backupParsed = JSON.parse(backup)
            if (backupParsed && backupParsed.data) {
              try { console.log(JSON.stringify({ tag: 'ann-pending', step: 'backup', actionId, count: Object.keys(backupParsed.data||{}).length })) } catch {}
              setLocalPendingAnnouncements(backupParsed.data)
            } else {
              try { console.log(JSON.stringify({ tag: 'ann-pending', step: 'backup-malformed', actionId })) } catch {}
            }
          } catch (e) {
            try { console.log(JSON.stringify({ tag: 'ann-pending', step: 'backup-parse-fail', actionId, error: String(e) })) } catch {}
          }
        } else {
          try { console.log(JSON.stringify({ tag: 'ann-pending', step: 'none', actionId })) } catch {}
        }
      }
    } catch (e) {
      try { console.log(JSON.stringify({ tag: 'ann-pending', step: 'load-fail', actionId, error: String(e) })) } catch {}
    } finally {
      setAnnouncementsStorageLoaded(true)
      try { console.log(JSON.stringify({ tag: 'ann-pending', step: 'loaded', actionId })) } catch {}
    }
  }, [])

  // Redundant persistence for announcements
  useEffect(() => {
    if (!announcementsStorageLoaded) return
    try {
      if (Object.keys(localPendingAnnouncements).length === 0) {
        localStorage.removeItem(ANNOUNCEMENTS_PENDING_KEY)
        localStorage.removeItem(ANNOUNCEMENTS_BACKUP_KEY)
        try { console.log(JSON.stringify({ tag: 'ann-pending', step: 'cleared' })) } catch {}
      } else {
        const serialized = JSON.stringify(localPendingAnnouncements)
        localStorage.setItem(ANNOUNCEMENTS_PENDING_KEY, serialized)
        localStorage.setItem(ANNOUNCEMENTS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: localPendingAnnouncements }))
        try { console.log(JSON.stringify({ tag: 'ann-pending', step: 'persisted', count: Object.keys(localPendingAnnouncements).length })) } catch {}
      }
    } catch (e) {
      try { console.log(JSON.stringify({ tag: 'ann-pending', step: 'persist-fail', error: String(e) })) } catch {}
    }
  }, [localPendingAnnouncements, announcementsStorageLoaded])

  // Auto-clear pending announcements that now match database state
  useEffect(() => {
    if (!announcementsStorageLoaded) {
      try { console.log(JSON.stringify({ tag: 'ann-autoclear', step: 'skip-not-loaded' })) } catch {}
      return
    }
    if (Object.keys(localPendingAnnouncements).length === 0) return

    console.log('🔍 ANNOUNCEMENTS AUTO-CLEAR CHECK - Pending:', localPendingAnnouncements)
    console.log('🔍 Current announcements from DB:', announcements)

    const stillPending = { ...localPendingAnnouncements }
    let hasCleared = false

    Object.keys(stillPending).forEach(id => {
      const pendingText = stillPending[id]
      const dbText = announcements[id] || ''

      // If announcement text matches DB (including both being empty), clear it
      if (pendingText === dbText) {
        console.log(`✅ Clearing announcement ${id} - DB now matches ("${pendingText}")`)
        delete stillPending[id]
        hasCleared = true
      } else {
        console.log(`⏳ Keeping announcement ${id} - DB mismatch (pending: "${pendingText}", db: "${dbText}")`)
      }
    })

    if (hasCleared) {
      console.log('📝 Updating announcements localStorage with remaining pending:', stillPending)
      setLocalPendingAnnouncements(stillPending)
      try {
        if (Object.keys(stillPending).length === 0) {
          localStorage.removeItem(ANNOUNCEMENTS_PENDING_KEY)
          localStorage.removeItem(ANNOUNCEMENTS_BACKUP_KEY)
          console.log('🗑️ All pending announcements synced - localStorage cleared')
        } else {
          localStorage.setItem(ANNOUNCEMENTS_PENDING_KEY, JSON.stringify(stillPending))
          localStorage.setItem(ANNOUNCEMENTS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: stillPending }))
          console.log('💾 Announcements localStorage updated with remaining pending')
        }
      } catch (e) {
        console.error('❌ Failed to update announcements localStorage', e)
      }
    } else {
      console.log('ℹ️ No announcements to clear')
    }
  }, [announcements, localPendingAnnouncements, announcementsStorageLoaded])

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

  // When the statistics modal opens, handle ESC and body scroll
  useEffect(() => {
    if (showStatistics) {
      document.body.style.overflow = 'hidden'
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setShowStatistics(false)
      }
      document.addEventListener('keydown', handleEscape)
      return () => {
        document.body.style.overflow = 'unset'
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [showStatistics])

  // When the user management modal opens, handle ESC and body scroll
  useEffect(() => {
    if (showUserManagement) {
      document.body.style.overflow = 'hidden'
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setShowUserManagement(false)
      }
      document.addEventListener('keydown', handleEscape)
      return () => {
        document.body.style.overflow = 'unset'
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [showUserManagement])

  // When the registrations modal opens, handle ESC and body scroll
  useEffect(() => {
    if (showRegistrations) {
      document.body.style.overflow = 'hidden'
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setShowRegistrations(false)
      }
      document.addEventListener('keydown', handleEscape)
      return () => {
        document.body.style.overflow = 'unset'
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [showRegistrations])

  const fetchAnnouncements = async () => {
    try {
      console.group('[FETCH] Getting fresh announcements from server')
      console.log(`Timestamp: ${new Date().toISOString()}`)
      const fetchStartTime = Date.now()
      const resp = await fetch('/api/announcements')
      const fetchEndTime = Date.now()
      console.log(`Response status: ${resp.status}`)
      console.log(`Time taken: ${fetchEndTime - fetchStartTime}ms`)
      
      if (!resp.ok) throw new Error('Failed to fetch announcements')
      const data = await resp.json()
      // Keep announcements as pure server snapshot; overlay happens at render
      console.log(`[FETCH] Fresh announcements from server:`, data)
      console.log(`[FETCH] Keys: ${Object.keys(data||{}).join(', ')}`)
      console.groupEnd()
      
      setAnnouncements(data || {})
    } catch (err) {
      console.error('Error fetching announcements:', err)
      console.groupEnd()
    }

  }

  const saveAnnouncement = async (id: string, text: string) => {
    const requestId = `ann-${id}-${Date.now()}`
    console.group(`[CHECKPOINT 1] Saving announcement ${id}`)
    console.log(`Request ID: ${requestId}`)
    console.log(`Text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`)
    console.log(`Timestamp: ${new Date().toISOString()}`)
    console.groupEnd()

    setSavingAnnouncements(prev => ({ ...prev, [id]: true }))
    
    // Do NOT mutate announcements optimistically; only update localPendingAnnouncements
    const newPending = { ...localPendingAnnouncements, [id]: text || '' }
    setLocalPendingAnnouncements(newPending)
    console.log('💾 SAVE ANNOUNCEMENT - Saving to localStorage:', newPending)
    try {
      localStorage.setItem(ANNOUNCEMENTS_PENDING_KEY, JSON.stringify(newPending))
      localStorage.setItem(ANNOUNCEMENTS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
      console.log('✅ Announcements localStorage saved successfully')
    } catch (e) {
      console.error('❌ Failed to save announcements to localStorage:', e)
    }

    try {
      console.group(`[API CALL] Sending PATCH request for announcement ${id}`)
      console.log(`URL: /api/announcements/${id}`)
      console.log(`Method: PATCH`)
      console.log(`Body: ${JSON.stringify({ announcement: text || '' })}`)
      console.log(`Timestamp: ${new Date().toISOString()}`)
      console.groupEnd()

      const fetchStartTime = Date.now()
      const resp = await fetch(`/api/announcements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcement: text || '' }),
      })
      const fetchEndTime = Date.now()
      
      console.group(`[API RESPONSE] Response received for announcement ${id}`)
      console.log(`Status: ${resp.status} ${resp.statusText}`)
      console.log(`Time taken: ${fetchEndTime - fetchStartTime}ms`)
      console.log(`Timestamp: ${new Date().toISOString()}`)
      console.groupEnd()

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}))
        throw new Error(errorData.error || `Server returned ${resp.status}`)
      }
      
      const responseData = await resp.json()
      console.log(`[API SUCCESS] Announcement ${id} response data:`, responseData)
      
      // Success: fetch fresh data to trigger auto-clear
      showToast('Announcement saved successfully')
      
      // notify other tabs/windows
      try {
        broadcast('announcements', 'update', { id })
      } catch (e) {
        // ignore
      }
      try {
        localStorage.setItem('montyclub:announcementsUpdated', JSON.stringify({ id, t: Date.now() }))
      } catch (e) {
        // ignore
      }
      
      console.log(`[FETCH] Fetching fresh announcements after save...`)
      // Fetch fresh data to trigger auto-clear, but don't block
      fetchAnnouncements()
    } catch (err) {
      console.error('Error saving announcement:', err)
      console.group(`[ERROR] Announcement save failed for ${id}`)
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
      console.log(`Stack: ${err instanceof Error ? err.stack : 'N/A'}`)
      console.log(`Timestamp: ${new Date().toISOString()}`)
      console.groupEnd()

      // Clear from pending on error (revert)
      const revertPending = { ...localPendingAnnouncements }
      delete revertPending[id]
      setLocalPendingAnnouncements(revertPending)
      try {
        if (Object.keys(revertPending).length === 0) {
          localStorage.removeItem(ANNOUNCEMENTS_PENDING_KEY)
          localStorage.removeItem(ANNOUNCEMENTS_BACKUP_KEY)
        } else {
          localStorage.setItem(ANNOUNCEMENTS_PENDING_KEY, JSON.stringify(revertPending))
          localStorage.setItem(ANNOUNCEMENTS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: revertPending }))
        }
      } catch (e) {}
      showToast(`Could not save announcement: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
    } finally {
      setSavingAnnouncements(prev => ({ ...prev, [id]: false }))
      console.log(`[DONE] Saving announcement ${id} completed`)

    }
  }

  const clearAnnouncement = async (id: string) => {
    setSavingAnnouncements(prev => ({ ...prev, [id]: true }))
    
    // Mark as cleared (empty string) in localPendingAnnouncements
    const newPending = { ...localPendingAnnouncements, [id]: '' }
    setLocalPendingAnnouncements(newPending)
    try {
      localStorage.setItem(ANNOUNCEMENTS_PENDING_KEY, JSON.stringify(newPending))
      localStorage.setItem(ANNOUNCEMENTS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
    } catch (e) {}

    try {
      const resp = await fetch(`/api/announcements/${id}`, { 
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ announcement: '' }) 
      })
      if (!resp.ok) throw new Error('Failed to clear')
      await resp.json()
      // Success: fetch fresh data to trigger auto-clear
      if (!savingAnnouncements[`bulk-${id}`]) {
        showToast('Announcement cleared successfully')
      }
      try {
        broadcast('announcements', 'update', { id })
      } catch (e) {
        // ignore
      }
      try {
        localStorage.setItem('montyclub:announcementsUpdated', JSON.stringify({ id, t: Date.now() }))
      } catch (e) {}
      
      // Fetch fresh data to trigger auto-clear, but don't block
      fetchAnnouncements()
    } catch (err) {
      console.error('Error clearing announcement:', err)
      // Clear from pending on error (revert)
      const revertPending = { ...localPendingAnnouncements }
      delete revertPending[id]
      setLocalPendingAnnouncements(revertPending)
      try {
        if (Object.keys(revertPending).length === 0) {
          localStorage.removeItem(ANNOUNCEMENTS_PENDING_KEY)
          localStorage.removeItem(ANNOUNCEMENTS_BACKUP_KEY)
        } else {
          localStorage.setItem(ANNOUNCEMENTS_PENDING_KEY, JSON.stringify(revertPending))
          localStorage.setItem(ANNOUNCEMENTS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: revertPending }))
        }
      } catch (e) {}
      if (!savingAnnouncements[`bulk-${id}`]) {
        showToast('Could not clear announcement', 'error')
      }
    } finally {
      setSavingAnnouncements(prev => ({ ...prev, [id]: false }))
    }
  }

  const fetchSettings = async () => {
    try {
      const resp = await fetch('/api/settings')
      if (!resp.ok) throw new Error('Failed to fetch settings')
      const data = await resp.json()
      const enabled = data.announcementsEnabled !== false
      setAnnouncementsEnabled(enabled)
      // Persist to localStorage so it survives reloads
      try {
        localStorage.setItem('settings:announcementsEnabled', String(enabled))
      } catch (e) {
        // Ignore localStorage errors
      }
    } catch (err) {
      console.error('Error fetching settings:', err)
    }
  }

  const toggleAnnouncements = async () => {
    try {
      setSavingSettings(true)
      // Use functional update to get current value and avoid stale closures
      let previousValue: boolean
      setAnnouncementsEnabled(prev => {
        previousValue = prev !== null ? prev : true
        const newValue = !previousValue
        
        // Optimistically update localStorage immediately
        try { 
          localStorage.setItem('settings:announcementsEnabled', String(newValue))
          // Dispatch event to notify ClubsList component
          window.dispatchEvent(new CustomEvent('announcements-updated', { detail: { settingsChanged: true } }))
          broadcast('announcements', 'update', { settingsChanged: true })
        } catch {}
        
        return newValue
      })
      
      const newValue = !previousValue!
      
      const resp = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcementsEnabled: newValue }),
      })
      
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}))
        throw new Error(errorData.error || `Server returned ${resp.status}`)
      }
      
      // Verify the setting was saved correctly
      const savedData = await resp.json()
      if (savedData.announcementsEnabled !== newValue) {
        console.error('Verification failed: expected', newValue, 'but server has', savedData.announcementsEnabled)
        throw new Error('Setting saved but verification failed')
      }
      
      showToast(`Announcements ${newValue ? 'enabled' : 'disabled'}`)
      
      // Refresh club data to apply changes
      await refreshData()
    } catch (err) {
      console.error('Error toggling announcements:', err)
      // Revert on error using functional update with captured previous value
      setAnnouncementsEnabled(prev => {
        const revertedValue = !prev
        try { 
          localStorage.setItem('settings:announcementsEnabled', String(revertedValue))
          window.dispatchEvent(new CustomEvent('announcements-updated', { detail: { settingsChanged: true } }))
          broadcast('announcements', 'update', { settingsChanged: true })
        } catch {}
        return revertedValue
      })
      showToast(`Could not update settings: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
    } finally {
      setSavingSettings(false)
    }
  }

  const refreshCache = async () => {
    try {
      setRefreshingCache(true)
      
      const resp = await fetch('/api/admin/refresh-cache', {
        method: 'POST',
        headers: {
          'x-admin-key': adminApiKey
        }
      })
      
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to refresh cache')
      }
      
      const data = await resp.json()
      showToast('Cache cleared! The next page load will fetch fresh data.', 'success')
      
      // Optionally refresh clubs data in this panel too
      await refreshData()
    } catch (err) {
      console.error('Error refreshing cache:', err)
      showToast(`Failed to refresh cache: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
    } finally {
      setRefreshingCache(false)
    }
  }

  const publishCatalog = async () => {
    try {
      setPublishingCatalog(true)
      const response = await fetch('/api/admin/publish-catalog', {
        method: 'POST',
        headers: {
          'x-admin-key': adminApiKey,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to publish catalog')
      }

      const data = await response.json()
      showToast(`Catalog published! ${data.clubCount} clubs now instantly available.`, 'success')
      
      // Update status
      setCatalogStatus({
        exists: true,
        generatedAt: data.generatedAt,
        clubCount: data.clubCount,
      })
      
      // Refresh clubs to show updated catalog
      await refreshData()
    } catch (err) {
      showToast(`Failed to publish catalog: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
    } finally {
      setPublishingCatalog(false)
    }
  }

  const checkCatalogStatus = async () => {
    try {
      const response = await fetch('/api/admin/publish-catalog', {
        method: 'GET',
        headers: {
          'x-admin-key': adminApiKey,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCatalogStatus(data)
      }
    } catch (err) {
      console.error('Failed to check catalog status:', err)
    }
  }

  if (!isAuthenticated) {
    return (
      <>
        {showApiKeyPrompt && (
          <>
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={skipApiKeyPrompt} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-3">
                    <Lock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Set Admin API Key
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    To manage analytics, registrations, and other admin features, please enter your admin API key.
                  </p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Admin API Key
                  </label>
                  <input
                    type="password"
                    value={apiKeyPromptInput}
                    onChange={(e) => setApiKeyPromptInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveApiKeyFromPrompt()}
                    className="input-field"
                    placeholder="Enter your ADMIN_API_KEY"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={skipApiKeyPrompt}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    Skip for Now
                  </button>
                  <button
                    onClick={saveApiKeyFromPrompt}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    Save Key
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
                  You can always set this later in the admin panel.
                </p>
              </div>
            </div>
          </>
        )}
        <div className="card max-w-md mx-auto">
          <div className="text-center mb-6">
            <Lock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Admin Login
            </h2>
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

        {isFirstTimeSetup && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>First-time setup:</strong> Default admin account will be created automatically. Use username: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">admin</code> and password: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">admin123</code>
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
              After logging in, change the password and create additional admin accounts.
            </p>
          </div>
        )}
      </div>
      </>
    )
  }

  return (
    <div className="space-y-6">
      {/* Section Navigation */}
      <div className="sticky top-0 z-30 -mt-2 pt-2 pb-3 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur supports-[backdrop-filter]:bg-gray-50/60 dark:supports-[backdrop-filter]:bg-gray-900/60">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => updatesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="px-3 py-1.5 text-sm rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Review and manage user-submitted update requests"
          >
            Update Requests
          </button>
          <button
            onClick={() => {
              setShowAnnouncementsPanel(true)
              setTimeout(() => announcementsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
            }}
            className="px-3 py-1.5 text-sm rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Create and manage club announcements"
          >
            Announcements
          </button>
          <button
            onClick={() => {
              // Ensure a collection is selected before opening registrations
              if (!activeCollectionId && collections.length > 0) {
                const enabledCol = collections.find(c => c.enabled && !localPendingCollectionChanges[c.id]?.deleted)
                setActiveCollectionId(enabledCol?.id || collections[0].id)
              }
              setShowRegistrations(true)
              setTimeout(() => registrationsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
            }}
            className="px-3 py-1.5 text-sm rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="View and manage club registrations"
          >
            Registrations
          </button>
          <button
            onClick={() => {
              setShowStatistics(true)
              setTimeout(() => statisticsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
            }}
            className="px-3 py-1.5 text-sm rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Analytics and usage statistics"
          >
            Analytics
          </button>
          <button
            onClick={() => {
              setShowUserManagement(true)
              setTimeout(() => userManagementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
            }}
            className="px-3 py-1.5 text-sm rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Manage admin accounts"
          >
            Admin Users
          </button>
        </div>
      </div>

      {/* Admin API Key */}
      <div className="card">
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

      {/* Update Requests */}
      <div ref={updatesRef} className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <span>Update Requests {updates.length > 0 && `(${updates.length})`}</span>
            <InfoTooltip text="Review, mark reviewed/unreviewed, and delete user-submitted change requests. Use Select All for batch operations." />
          </h2>
          <button
            onClick={() => fetchUpdates()}
            className="btn-secondary p-2"
            title="Refresh requests"
            disabled={refreshingUpdates}
          >
            <RefreshCw className={`h-4 w-4 ${refreshingUpdates ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {updates.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No update requests yet.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (updatingBatch) return
                    if (selectedUpdateIds.size === updates.length) setSelectedUpdateIds(new Set())
                    else setSelectedUpdateIds(new Set(updates.map(u => String(u.id))))
                  }}
                  disabled={updatingBatch}
                  className="btn-secondary text-xs"
                >
                  {selectedUpdateIds.size === updates.length ? 'Deselect All' : 'Select All'}
                </button>
                {selectedUpdateIds.size > 0 && (
                  <>
                    <button
                      onClick={() => performBatch('review')}
                      disabled={updatingBatch}
                      className="btn-secondary text-xs"
                    >Mark Reviewed</button>
                    <button
                      onClick={() => performBatch('unreview')}
                      disabled={updatingBatch}
                      className="btn-secondary text-xs"
                    >Mark Unreviewed</button>
                    <button
                      onClick={() => performBatch('delete')}
                      disabled={updatingBatch}
                      className="text-red-600 dark:text-red-400 text-xs"
                    >Delete</button>
                  </>
                )}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {selectedUpdateIds.size > 0 ? `${selectedUpdateIds.size} selected` : `${updates.length} total`}
              </div>
            </div>

            {updates
              .map((u) => {
                const pending = localPendingChanges[String(u.id)]
                // If marked as deleted locally, hide it
                if (pending?.deleted) return null
                // Apply pending reviewed state if it exists
                const displayItem = pending?.reviewed !== undefined ? { ...u, reviewed: pending.reviewed } : u
                return { ...displayItem, _originalId: u.id }
              })
              .filter(item => item !== null)
              .map((u: any) => (
              <div key={u._originalId} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        disabled={updatingBatch || singleProcessingId === String(u.id)}
                        checked={selectedUpdateIds.has(String(u.id))}
                        onChange={() => {
                          const id = String(u.id)
                          const next = new Set(selectedUpdateIds)
                          if (next.has(id)) next.delete(id); else next.add(id)
                          setSelectedUpdateIds(next)
                        }}
                        className="mt-1"
                      />
                    </label>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-900 dark:text-white">{u.clubName || '—'}</h3>
                      <span className="text-sm text-gray-500">({u.updateType || 'Update'})</span>
                      {u.reviewed ? (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">Reviewed</span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full">Pending</span>
                      )}
                      {singleProcessingId === String(u.id) && (
                        <span className="text-xs text-gray-500">Processing...</span>
                      )}
                      {localPendingChanges[String(u.id)] && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">Syncing...</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Submitted: {new Date(u.createdAt).toLocaleString()}</p>
                  </div>
                  </div>
                  <div className="flex items-center gap-2 md:flex-shrink-0 mt-2 md:mt-0">
                    <button
                      onClick={() => handleToggleSingle(u)}
                      disabled={updatingBatch || singleProcessingId === String(u.id)}
                      className="btn-secondary text-xs whitespace-nowrap flex-1 md:flex-initial"
                    >
                      {u.reviewed ? 'Mark Unreviewed' : 'Mark Reviewed'}
                    </button>
                    <button
                      onClick={() => handleDeleteSingle(u)}
                      disabled={updatingBatch || singleProcessingId === String(u.id)}
                      className="text-red-600 dark:text-red-400 text-xs flex-1 md:flex-initial"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                  <p><strong>Suggested:</strong> {u.suggestedChange || '—'}</p>
                  <p className="mt-1"><strong>Contact:</strong> {u.contactEmail || '—'}</p>
                  {u.additionalNotes && <p className="mt-1"><strong>Notes:</strong> {u.additionalNotes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div ref={announcementsRef} className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>Quick Actions</span>
          <InfoTooltip text="Toggle announcements visibility, manage analytics, and open statistics. These actions affect site-wide behavior." />
        </h2>
        
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Announcements</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {announcementsEnabled === null ? '' : (announcementsEnabled ? 'Announcements are currently shown on the site' : 'Announcements are currently hidden from the site')}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex items-center justify-between w-full sm:w-auto sm:flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <Megaphone className="h-4 w-4" />
                  <span>Show on site</span>
                </div>
                {announcementsEnabled !== null && (
                  <Toggle
                    checked={announcementsEnabled}
                    onChange={() => { if (!savingSettings) toggleAnnouncements() }}
                    disabled={savingSettings}
                  />
                )}
              </div>
              <button
                onClick={() => setShowAnnouncementsPanel(!showAnnouncementsPanel)}
                className="btn-primary flex items-center justify-center gap-2"
              >
                <Megaphone className="h-4 w-4" />
                {showAnnouncementsPanel ? 'Close' : 'Manage'}
              </button>
            </div>
          </div>

          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">User Management</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Manage admin users and permissions</p>
            <button
              onClick={toggleUserManagement}
              className="btn-primary w-full sm:w-auto flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              {showUserManagement ? 'Close Users' : 'Manage Users'}
            </button>
          </div>

          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Club Statistics</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">View club data analytics and stats</p>
            <button
              onClick={() => setShowStatistics(!showStatistics)}
              className="btn-primary w-full sm:w-auto flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              {showStatistics ? 'Close Statistics' : 'View Statistics'}
            </button>
          </div>

          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Refresh Cache</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Force fresh data after updates (24hr cache)</p>
            <button
              onClick={refreshCache}
              disabled={refreshingCache}
              className="btn-primary w-full sm:w-auto flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshingCache ? 'animate-spin' : ''}`} />
              {refreshingCache ? 'Refreshing...' : 'Refresh Now'}
            </button>
          </div>

          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg md:col-span-2">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Club Registration Collections</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Manage multiple registration form collections (e.g., different years). <strong>Public Catalog</strong> (one only) selects which collection appears in the club directory. <strong>Registration Form</strong> (multiple allowed) controls which collections accept submissions.
            </p>
            
            {/* Create New Collection */}
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Create New Collection</h4>
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
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Import from Excel
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
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
                  onChange={async (e) => {
                    if (!e.target.files?.[0] || !activeCollectionId) return
                    
                    // Prevent import on temporary collections
                    if (activeCollectionId.startsWith('temp-col-')) {
                      showToast('Please wait for the collection to be created before importing', 'error')
                      return
                    }
                    
                    const file = e.target.files[0]
                    if (!file.name.endsWith('.xlsx')) {
                      showToast('Please upload an Excel (.xlsx) file', 'error')
                      return
                    }

                    const formData = new FormData()
                    formData.append('file', file)
                    formData.append('collectionId', activeCollectionId)

                    try {
                      setImportingExcel(true)
                      const response = await fetch('/api/upload-excel', {
                        method: 'POST',
                        body: formData,
                      })

                      if (!response.ok) {
                        const error = await response.json()
                        throw new Error(error.error || 'Upload failed')
                      }

                      const result = await response.json()
                      showToast(result.message || 'Import successful!', 'success')
                      
                      // Clear the input
                      e.target.value = ''
                      
                      // Broadcast club data change
                      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
                        try {
                          const bc = new window.BroadcastChannel('clubData')
                          bc.postMessage('changed')
                          bc.close()
                        } catch {}
                      }
                    } catch (error) {
                      console.error('Excel import error:', error)
                      showToast(String(error), 'error')
                    } finally {
                      setImportingExcel(false)
                    }
                  }}
                  className="text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            )}

            {/* Collections List */}
            <div className="space-y-2 mb-4">
              {(() => {
                const overlayed = (() => {
                  const map = new Map<string, RegistrationCollection>()
                  // start with server snapshot
                  for (const c of collections) map.set(c.id, { ...c })
                  // apply pending changes
                  for (const [id, change] of Object.entries(localPendingCollectionChanges)) {
                    if (change.deleted) {
                      map.delete(id)
                      continue
                    }
                    if (change.created) {
                      if (!map.has(id)) {
                        map.set(id, {
                          id,
                          name: change.name || 'New Collection',
                          enabled: change.enabled ?? false,
                          display: change.display ?? false,
                          accepting: change.accepting ?? false,
                          createdAt: new Date().toISOString()
                        })
                      }
                    }
                    const obj = map.get(id)
                    if (obj) {
                      if (change.enabled !== undefined) obj.enabled = change.enabled
                      if (change.display !== undefined) obj.display = change.display
                      if (change.accepting !== undefined) obj.accepting = change.accepting
                      if (change.name) obj.name = change.name
                    }
                  }
                  return Array.from(map.values())
                })()
                return overlayed.filter(c => !localPendingCollectionChanges[c.id]?.deleted).length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">No collections yet. Create one above.</p>
                ) : (
                  <>{overlayed.filter(c => !localPendingCollectionChanges[c.id]?.deleted).map((collection) => (
                    <div
                      key={collection.id}
                      onClick={() => setActiveCollectionId(collection.id)}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        activeCollectionId === collection.id
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:bg-primary-50/50 dark:hover:border-primary-700 dark:hover:bg-primary-900/10'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h5 className="font-medium text-gray-900 dark:text-white truncate">{collection.name}</h5>
                          {(() => {
                            const isDisplay = collection.display || (!collection.display && !collection.accepting && collection.enabled)
                            const isAccepting = collection.accepting ?? collection.enabled ?? false
                            return (
                              <>
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
                              </>
                            )
                          })()}
                          {(localPendingCollectionChanges[collection.id]?.created || localPendingCollectionChanges[collection.id]?.enabled !== undefined || localPendingCollectionChanges[collection.id]?.display !== undefined || localPendingCollectionChanges[collection.id]?.accepting !== undefined || localPendingCollectionChanges[collection.id]?.deleted) && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 italic ml-1">Syncing...</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Created {new Date(collection.createdAt).toLocaleDateString()}
                        </p>
                        {(() => {
                          const isAccepting = collection.accepting ?? collection.enabled ?? false
                          const isRenewalEnabled = collection.renewalEnabled ?? false
                          return (
                            <>
                              {isAccepting && (
                                <div className="mt-2 flex items-center gap-2">
                                  <span className="text-xs text-gray-600 dark:text-gray-400">Registration form:</span>
                                  <a
                                    href={`${typeof window !== 'undefined' ? window.location.origin : ''}/register-club?collection=${slugifyName(collection.name)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    /register-club?collection={slugifyName(collection.name)}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              )}
                              {isRenewalEnabled && (
                                <div className="mt-2 flex items-center gap-2">
                                  <span className="text-xs text-gray-600 dark:text-gray-400">Renewal form:</span>
                                  <a
                                    href={`${typeof window !== 'undefined' ? window.location.origin : ''}/renew-club/${collection.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    /renew-club/{collection.id}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </div>
                      <div className="flex flex-col gap-3 flex-shrink-0 w-48" onClick={(e) => e.stopPropagation()}>
                        <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Public Catalog</div>
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                            <input
                              type="radio"
                              name="displayCollection"
                              checked={(() => {
                                const pending = localPendingCollectionChanges[collection.id]?.display
                                if (pending !== undefined) return pending
                                return collection.display || (!collection.display && !collection.accepting && collection.enabled)
                              })()}
                              onChange={() => toggleCollectionDisplay(collection.id)}
                              disabled={togglingCollection === collection.id}
                              className="w-3.5 h-3.5"
                            />
                            <span className="text-gray-700 dark:text-gray-300">Display?</span>
                          </label>
                        </div>
                        <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Registration Form</div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-700 dark:text-gray-300">Enable</span>
                            <Toggle
                              checked={(() => {
                                const pending = localPendingCollectionChanges[collection.id]?.accepting
                                if (pending !== undefined) return pending
                                return collection.accepting ?? collection.enabled ?? false
                              })()}
                              onChange={() => toggleCollectionAccepting(collection.id)}
                              disabled={togglingCollection === collection.id}
                            />
                          </div>
                        </div>
                        <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Renewal Form</div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-700 dark:text-gray-300">Enable</span>
                            <Toggle
                              checked={(() => {
                                const pending = localPendingCollectionChanges[collection.id]?.renewalEnabled
                                if (pending !== undefined) return pending
                                return collection.renewalEnabled ?? false
                              })()}
                              onChange={() => toggleCollectionRenewal(collection.id)}
                              disabled={togglingCollection === collection.id}
                            />
                          </div>
                        </div>
                        {collections.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteCollection(collection.id)
                            }}
                            className="mt-2 p-1.5 w-full text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors text-xs font-medium"
                            title="Delete collection"
                          >
                            <Trash2 className="h-4 w-4 inline mr-1" />
                            Delete Collection
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}</> 
                )
              })()}
            </div>

            {/* View Registrations Button */}
              <button
                onClick={() => setShowRegistrations(!showRegistrations)}
                disabled={!activeCollectionId}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {showRegistrations ? 'Close Registrations' : 'View Registrations'}
                {activeCollectionId && (() => {
                  const overlayedName = (() => {
                    // prefer overlay name if present
                    const pending = localPendingCollectionChanges[activeCollectionId]
                    if (pending?.name) return pending.name
                    const found = collections.find(c => c.id === activeCollectionId)
                    return found?.name || ''
                  })()
                  return ` (${overlayedName})`
                })()}
              </button>
          </div>

          {/* Pilot Analytics */}
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg md:col-span-2">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">Pilot Analytics</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Manage temporary usage analytics for pilot testing. Data is anonymous and stored as JSON files you can clear anytime.</p>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Period Label</label>
                  <input
                    value={analyticsPeriod}
                    onChange={(e) => setAnalyticsPeriod(e.target.value)}
                    className="input-field text-sm"
                    placeholder="e.g. pilot-1"
                  />
                </div>
                <div className="flex gap-3 items-center">
                  <button onClick={saveAnalyticsPeriod} className="btn-secondary whitespace-nowrap">Save Period</button>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Enable Analytics</span>
                    <Toggle checked={analyticsEnabled} onChange={toggleAnalyticsEnabled} />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={fetchAnalyticsSummary}
                disabled={loadingSummary}
                className="btn-primary flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loadingSummary ? 'animate-spin' : ''}`} />
                {loadingSummary ? 'Loading Summary...' : 'Load Summary'}
              </button>
              <button
                onClick={clearAnalyticsPeriod}
                disabled={clearingAnalytics}
                className="btn-secondary flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {clearingAnalytics ? 'Clearing...' : 'Clear Period'}
              </button>
            </div>
            {analyticsSummary && (
              <div className="mt-6 space-y-4">
                {(() => {
                  const byTypeEntries = (Object.entries(analyticsSummary.byType || {}) as [string, unknown][])
                  const clubOpenEntries = (Object.entries(analyticsSummary.clubOpens || {}) as [string, unknown][])
                  const shareEntries = (Object.entries(analyticsSummary.shares || {}) as [string, unknown][])
                  const totalClubOpens = clubOpenEntries.reduce((a, [, v]) => a + Number(v), 0)
                  return (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                          <div className="text-xs text-gray-500 dark:text-gray-400">Total Events</div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-white">{analyticsSummary.totalEvents}</div>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                          <div className="text-xs text-gray-500 dark:text-gray-400">Distinct Types</div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-white">{byTypeEntries.length}</div>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                          <div className="text-xs text-gray-500 dark:text-gray-400">Club Opens</div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-white">{totalClubOpens}</div>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Events By Type</h4>
                        <div className="space-y-1 max-h-40 overflow-y-auto pr-2 text-xs" style={{ scrollbarGutter: 'stable' }}>
                          {byTypeEntries.sort((a, b) => Number(b[1]) - Number(a[1])).map(([t, c]) => (
                            <div key={t} className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">{t}</span>
                              <span className="font-medium text-gray-900 dark:text-white">{Number(c)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {clubOpenEntries.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Top Club Opens</h4>
                          <div className="space-y-1 max-h-40 overflow-y-auto pr-2 text-xs" style={{ scrollbarGutter: 'stable' }}>
                            {clubOpenEntries.sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 10).map(([id, c]) => (
                              <div key={id} className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400 truncate">{id}</span>
                                <span className="font-medium text-gray-900 dark:text-white">{Number(c)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {shareEntries.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Top Shares</h4>
                          <div className="space-y-1 max-h-32 overflow-y-auto pr-2 text-xs" style={{ scrollbarGutter: 'stable' }}>
                            {shareEntries.sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 10).map(([id, c]) => (
                              <div key={id} className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400 truncate">{id}</span>
                                <span className="font-medium text-gray-900 dark:text-white">{Number(c)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {analyticsSummary.sample && analyticsSummary.sample.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Sample Events (first {analyticsSummary.sample.length})</h4>
                          <pre className="text-[11px] bg-gray-900/80 text-gray-100 p-3 rounded overflow-x-auto max-h-64" style={{ scrollbarGutter: 'stable' }}>
{JSON.stringify(analyticsSummary.sample, null, 2)}
                          </pre>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
            {!analyticsSummary && !loadingSummary && (
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">No summary loaded yet.</p>
            )}
          </div>

        </div>
      </div>

      {/* User Management Modal */}
      {showUserManagement && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 animate-in fade-in duration-200"
            onClick={() => setShowUserManagement(false)}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 pointer-events-none overflow-y-auto">
            <div 
              ref={userManagementRef} 
              className="card max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto pointer-events-auto animate-in zoom-in-95 fade-in duration-200 my-4 sm:my-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>User Management</span>
                  <InfoTooltip text="Create and remove admin accounts. Use strong passwords and keep the admin API key secure." />
                </h2>
                <button
                  onClick={() => setShowUserManagement(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <UserManagement currentUser={currentUser!} showToast={showToast} />
            </div>
          </div>
        </>
      )}

      {showAnnouncementsPanel && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 animate-in fade-in duration-200"
            onClick={() => setShowAnnouncementsPanel(false)}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 pointer-events-none overflow-y-auto">
            <div 
              ref={announcementsRef} 
              className="card max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto pointer-events-auto animate-in zoom-in-95 fade-in duration-200 my-4 sm:my-0"
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

              {(() => {
                const mergedAnnouncements = { ...announcements, ...localPendingAnnouncements }
                return (
              <AnnounceEditor
            clubs={clubs}
            announcements={mergedAnnouncements}
            setAnnouncements={setAnnouncements}
            saveAnnouncement={async (id: string, text: string) => {
              await saveAnnouncement(id, text)
              // refresh clubs so the gallery reflects updated announcement values
              await refreshData()
              try { broadcast('announcements', 'update', { id }) } catch (e) {}
              // Also dispatch a custom event for same-tab updates
              window.dispatchEvent(new CustomEvent('announcements-updated', { detail: { id } }))
            }}
            clearAnnouncement={async (id: string) => {
              await clearAnnouncement(id)
              await refreshData()
              try { broadcast('announcements', 'update', { id }) } catch (e) {}
              // Also dispatch a custom event for same-tab updates
              window.dispatchEvent(new CustomEvent('announcements-updated', { detail: { id } }))
            }}
            savingAnnouncements={savingAnnouncements}
            showToast={showToast}
            onRequestClear={(id: string) => setConfirmClearId(id)}
          />
                )
              })()}
          
          {/* Bulk Delete Section */}
          {(() => {
            const mergedAnnouncements = { ...announcements, ...localPendingAnnouncements }
            return (
          <BulkDeleteAnnouncements
            clubs={clubs}
            announcements={mergedAnnouncements}
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
                  try { broadcast('announcements', 'update', { id }) } catch (e) {}
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
            )
          })()}
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
                  try { broadcast('announcements', 'update', { id }) } catch (e) {}
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

      {/* Club Statistics Modal */}
      {showStatistics && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 animate-in fade-in duration-200"
            onClick={() => setShowStatistics(false)}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div 
              ref={statisticsRef} 
              className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto animate-in zoom-in-95 fade-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>Club Statistics</span>
                  <InfoTooltip text="Overview of active/inactive clubs and categories. Helpful for reporting and auditing." />
                </h2>
                <button
                  onClick={() => setShowStatistics(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

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
                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="font-medium text-gray-900 dark:text-white">Total</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {clubs.length}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3">By Category</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-2" style={{ scrollbarGutter: 'stable' }}>
                    {Object.entries(
                      clubs.reduce((acc, club) => {
                        acc[club.category] = (acc[club.category] || 0) + 1
                        return acc
                      }, {} as Record<string, number>)
                    )
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, count]) => (
                      <div key={category} className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">{category}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Registrations Modal */}
      {showRegistrations && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 animate-in fade-in duration-200"
            onClick={() => setShowRegistrations(false)}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 pointer-events-none overflow-y-auto">
            <div 
              ref={registrationsRef} 
              className="card max-w-7xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto pointer-events-auto animate-in zoom-in-95 fade-in duration-200 my-4 sm:my-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>Club Registrations</span>
                  <InfoTooltip text="Review and manage registration requests for the active collection. Links above open public registration and renewal." />
                </h2>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                    <div>
                      <span className="text-gray-500 dark:text-gray-500">Registration:</span> <a href={`${typeof window !== 'undefined' ? window.location.origin : ''}/register-club?collection=${(() => {
                        const pending = activeCollectionId ? localPendingCollectionChanges[activeCollectionId] : undefined
                        const baseName = pending?.name || (collections.find(c => c.id === activeCollectionId)?.name || '')
                        return slugifyName(baseName)
                      })()}`} target="_blank" className="text-primary-600 dark:text-primary-400 hover:underline">{typeof window !== 'undefined' ? window.location.origin : ''}/register-club?collection={(() => {
                        const pending = activeCollectionId ? localPendingCollectionChanges[activeCollectionId] : undefined
                        const baseName = pending?.name || (collections.find(c => c.id === activeCollectionId)?.name || '')
                        return slugifyName(baseName)
                      })()}</a>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-500">Renewal:</span> <a href={`${typeof window !== 'undefined' ? window.location.origin : ''}/renew-club/${activeCollectionId}`} target="_blank" className="text-primary-600 dark:text-primary-400 hover:underline">{typeof window !== 'undefined' ? window.location.origin : ''}/renew-club/{activeCollectionId}</a>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowRegistrations(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <RegistrationsList 
                adminApiKey={adminApiKey} 
                collectionSlug={( (() => {
                  const pending = activeCollectionId ? localPendingCollectionChanges[activeCollectionId] : undefined
                  const baseName = pending?.name || (collections.find(c => c.id === activeCollectionId)?.name || '')
                  return slugifyName(baseName)
                })() )}
                collectionName={( (() => {
                  const pending = activeCollectionId ? localPendingCollectionChanges[activeCollectionId] : undefined
                  return pending?.name || (collections.find(c => c.id === activeCollectionId)?.name || '')
                })() )}
                collectionId={activeCollectionId || ''}
                collections={collections}
              />
            </div>
          </div>
        </>
      )}

      {/* Clear Data Section - at bottom */}
      <div ref={userManagementRef} className="card">
        <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <span>System Maintenance</span>
            <InfoTooltip text="Permanently clear selected data for testing or maintenance. Requires authentication." />
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            Clear selected data for testing or maintenance. Requires authentication.
          </p>
          <button
            onClick={() => setShowClearDataModal(true)}
            className="bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium py-2 px-3 rounded-md transition-colors text-sm flex items-center gap-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Data
          </button>
        </div>
      </div>

      {/* Clear Data Modal */}
      {showClearDataModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Clear Data (Factory Reset)
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mb-4 font-semibold">
              ⚠️ WARNING: This action permanently deletes selected data and cannot be undone!
            </p>

            {/* Authentication */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Admin Password *
                </label>
                <input
                  type="password"
                  value={clearDataPassword}
                  onChange={(e) => setClearDataPassword(e.target.value)}
                  placeholder="Enter your admin password"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  disabled={clearingData}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Admin API Key *
                </label>
                <input
                  type="password"
                  value={clearDataApiKey}
                  onChange={(e) => setClearDataApiKey(e.target.value)}
                  placeholder="Enter admin API key"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  disabled={clearingData}
                />
              </div>
            </div>

            {/* Data Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Select data to clear:
              </label>
              <div className="space-y-2 pl-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearOptions.localStorage}
                    onChange={(e) => setClearOptions({ ...clearOptions, localStorage: e.target.checked })}
                    disabled={clearingData}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Client LocalStorage</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Clear all client-side cached data</div>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearOptions.updateRequests}
                    onChange={(e) => setClearOptions({ ...clearOptions, updateRequests: e.target.checked })}
                    disabled={clearingData}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Update Requests</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Delete all club update submissions</div>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearOptions.announcements}
                    onChange={(e) => setClearOptions({ ...clearOptions, announcements: e.target.checked })}
                    disabled={clearingData}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Announcements</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Clear all club announcements</div>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearOptions.registrationCollections}
                    onChange={(e) => setClearOptions({ ...clearOptions, registrationCollections: e.target.checked })}
                    disabled={clearingData}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Registration Collections</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Reset to single default collection</div>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearOptions.registrations}
                    onChange={(e) => setClearOptions({ ...clearOptions, registrations: e.target.checked })}
                    disabled={clearingData}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-red-600 dark:text-red-400 font-semibold">All Registrations</div>
                    <div className="text-xs text-red-700 dark:text-red-300">⚠️ Delete all club registration submissions</div>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearOptions.analytics}
                    onChange={(e) => setClearOptions({ ...clearOptions, analytics: e.target.checked })}
                    disabled={clearingData}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Analytics Events</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Clear all analytics tracking data</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowClearDataModal(false)
                  setClearDataPassword('')
                  setClearDataApiKey('')
                }}
                disabled={clearingData}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClearData}
                disabled={clearingData || !clearDataPassword || !clearDataApiKey}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {clearingData ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Clear Selected Data
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Confirm Dialog */}
      {isOpen && options && (
        <ConfirmDialog
          {...options}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
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
