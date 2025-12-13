'use client'

import { useState, useEffect, useRef } from 'react'
import { Lock, Unlock, RefreshCw, Megaphone, Trash2, UserPlus, Users, BarChart3, FileSpreadsheet, Plus, ExternalLink } from 'lucide-react'
import { Club, RegistrationCollection } from '@/types/club'
import { getClubs } from '@/lib/clubs-client'
import { Toast, ToastContainer } from '@/components/Toast'
import { UserManagement } from '@/components/UserManagement'
import { RegistrationsList } from '@/components/RegistrationsList'
import { Toggle } from '@/components/Toggle'
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
      }
    }
    console.group('=== COMPLETE SYNC DIAGNOSTICS ===')
    console.log(JSON.stringify(report, null, 2))
    console.groupEnd()
    return report
  }
}

export function AdminPanel() {
  // Club data source: 'excel' or 'collection'
  const [clubDataSource, setClubDataSource] = useState<'excel' | 'collection'>('excel')
  // Persisted selection
  useEffect(() => {
    const stored = localStorage.getItem('montyclub:clubDataSource')
    if (stored === 'excel' || stored === 'collection') setClubDataSource(stored)
  }, [])
  useEffect(() => {
    localStorage.setItem('montyclub:clubDataSource', clubDataSource)
    // Persist to backend for API
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubDataSource }),
    }).catch(() => {})
    // Broadcast to other tabs/components that data source changed
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new window.BroadcastChannel('clubDataSource')
        bc.postMessage('changed')
        bc.close()
      } catch {}
    }
  }, [clubDataSource])
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
  // Analytics Pilot State
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true)
  const [analyticsPeriod, setAnalyticsPeriod] = useState('pilot')
  const [analyticsSummary, setAnalyticsSummary] = useState<any | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [clearingAnalytics, setClearingAnalytics] = useState(false)
  const [adminApiKey, setAdminApiKey] = useState('')
  const [showRegistrations, setShowRegistrations] = useState(false)
  const registrationsRef = useRef<HTMLDivElement | null>(null)
  const [collections, setCollections] = useState<RegistrationCollection[]>([])
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [creatingCollection, setCreatingCollection] = useState(false)
  const [togglingCollection, setTogglingCollection] = useState<string | null>(null)
  type PendingCollection = { deleted?: boolean; created?: boolean; enabled?: boolean; name?: string }
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

    try {
      console.log(JSON.stringify({ tag: 'collections-autoclear', step: 'start', pending: localPendingCollectionChanges, db: collections.map(c => ({ id: c.id, enabled: c.enabled })) }))
    } catch {}

    const newPending = { ...localPendingCollectionChanges }
    let hasChanges = false

    for (const collectionId in newPending) {
      const pending = newPending[collectionId]
      const found = collections.find(c => c.id === collectionId)
      // If marked deleted locally but no longer exists in DB, clear it
      if (pending.deleted && !found) {
        try { console.log(JSON.stringify({ tag: 'collections-autoclear', step: 'clear-deleted', id: collectionId })) } catch {}
        delete newPending[collectionId]
        hasChanges = true
        continue
      }
      if (found) {
        // If enabled matches DB, clear enabled flag
        if (pending.enabled !== undefined && found.enabled === pending.enabled) {
          try { console.log(JSON.stringify({ tag: 'collections-autoclear', step: 'clear-enabled', id: collectionId, value: pending.enabled })) } catch {}
          delete newPending[collectionId].enabled
          hasChanges = true
        } else if (pending.enabled !== undefined) {
          try { console.log(JSON.stringify({ tag: 'collections-autoclear', step: 'still-pending', id: collectionId, pending: pending.enabled, db: found.enabled })) } catch {}
        }
        // If name matches DB, clear name flag
        if (pending.name && found.name === pending.name) {
          delete newPending[collectionId].name
          hasChanges = true
        }
        // If no remaining flags, remove entry
        const entry = newPending[collectionId]
        if (entry && !entry.deleted && entry.enabled === undefined && !entry.name && !entry.created) {
          delete newPending[collectionId]
          hasChanges = true
        }
      }
    }

    if (hasChanges) {
      try { console.log(JSON.stringify({ tag: 'collections-autoclear', step: 'updated', pending: newPending })) } catch {}
      setLocalPendingCollectionChanges(newPending)
    } else {
      try { console.log(JSON.stringify({ tag: 'collections-autoclear', step: 'no-change' })) } catch {}
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
      try { console.log(JSON.stringify({ tag: 'collections-refresh', step: 'execute' })) } catch {}
      loadCollections()
      collectionsRefreshTimerRef.current = null
    }, 500)
    try { console.log(JSON.stringify({ tag: 'collections-refresh', step: 'scheduled', delayMs: 500 })) } catch {}
  }

  const loadCollections = async () => {
    if (!adminApiKey) return
    try { console.log(JSON.stringify({ tag: 'collections-load', step: 'start' })) } catch {}
    try {
      const resp = await fetch('/api/registration-collections', {
        headers: { 'x-admin-key': adminApiKey }
      })
      if (!resp.ok) throw new Error('Failed to load collections')
      const data = await resp.json()
      try {
        console.log(JSON.stringify({ tag: 'collections-load', step: 'db', collections: (data.collections || []).map((c: any) => ({ id: c.id, enabled: c.enabled })) }))
        console.log(JSON.stringify({ tag: 'collections-load', step: 'pending', pendingIds: Object.keys(localPendingCollectionChanges) }))
      } catch {}
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
              createdAt: new Date().toISOString()
            } as RegistrationCollection)
          }
          const obj = overlayMap.get(id)
          if (obj) {
            if (typeof change.enabled !== 'undefined') obj.enabled = !!change.enabled
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

  const toggleCollectionEnabled = async (collectionId: string) => {
    const toggleId = `TOGGLE-${collectionId}-${Date.now()}`
    const log = (payload: any) => {
      try {
        console.log(JSON.stringify({ tag: 'collections-toggle', toggleId, ...payload }))
      } catch {}
    }
    log({ step: 'start', collectionId })
    
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
      log({ step: 'error', message: 'collection-not-found', collectionId })
      return
    }

    setTogglingCollection(collectionId)
    // Determine effective current enabled state (prefer pending override over server snapshot)
    const effectiveCurrentEnabled = (localPendingCollectionChanges[collectionId]?.enabled !== undefined)
      ? !!localPendingCollectionChanges[collectionId]?.enabled
      : !!collection.enabled
    const nextEnabled = !effectiveCurrentEnabled
    
    log({ step: 'calc', dbEnabled: !!collection.enabled, pendingEnabled: localPendingCollectionChanges[collectionId]?.enabled, effective: effectiveCurrentEnabled, next: nextEnabled })

    // Optimistically update localStorage immediately using functional updater to avoid stale closure
    setLocalPendingCollectionChanges(prev => {
      const next = { ...prev, [collectionId]: { ...(prev[collectionId] || {}), enabled: nextEnabled } }
      log({ step: 'local-save', pending: next[collectionId] })
      try {
        localStorage.setItem(COLLECTIONS_PENDING_KEY, JSON.stringify(next))
        localStorage.setItem(COLLECTIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: next }))
        broadcast('collections', 'update', { id: collectionId })
        localStorage.setItem('montyclub:collectionsUpdated', JSON.stringify({ id: collectionId, t: Date.now() }))
        log({ step: 'local-save-ok' })
      } catch (e) {
        log({ step: 'local-save-fail', error: String(e) })
      }
      return next
    })
    
    log({ step: 'patch-send' })
    try {
      const resp = await fetch('/api/registration-collections', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify({ id: collectionId, enabled: nextEnabled })
      })
      if (!resp.ok) {
        let errText = 'Failed to update collection'
        try { const j = await resp.json(); if (j && j.error) errText = `${j.error}${j.detail ? ` (${j.detail})` : ''}` } catch {}
        throw new Error(errText)
      }
      const data = await resp.json()
      log({ step: 'patch-ok', collection: { id: data.collection.id, enabled: data.collection.enabled } })
      // Do NOT immediately update collections state to avoid premature auto-clear
      // Keep pending change in localStorage until a subsequent GET confirms the DB state matches
      // This prevents showing stale DB state on reload due to eventual consistency
      try {
        broadcast('collections', 'update', { id: collectionId })
        localStorage.setItem('montyclub:collectionsUpdated', JSON.stringify({ id: collectionId, t: Date.now() }))
      } catch {}
      showToast(`Collection ${nextEnabled ? 'enabled' : 'disabled'}`)
      // Immediately refresh collections to ensure auto-clear runs with fresh DB state
      log({ step: 'refresh-now' })
      await loadCollections()
    } catch (err) {
      log({ step: 'patch-fail', error: String(err) })
      // Revert on error using functional update to avoid clobbering subsequent rapid toggles
      setLocalPendingCollectionChanges(prev => {
        const revert = { ...prev }
        delete revert[collectionId]
        log({ step: 'local-revert' })
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
    }
  }

  const deleteCollection = async (collectionId: string) => {
    if (!adminApiKey) {
      showToast('Set admin API key first', 'error')
      return
    }
    if (!confirm('Are you sure you want to delete this collection? This cannot be undone.')) return

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
    const ok = confirm(`Clear ALL analytics data for period '${analyticsPeriod}'? This cannot be undone.`)
    if (!ok) return
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

  const fetchUpdates = async (forceFresh: boolean = false) => {
    setRefreshingUpdates(true)
    try {
      const url = forceFresh ? '/api/updates?nocache=1' : '/api/updates'
      const resp = await fetch(url)
      if (!resp.ok) throw new Error('Failed to fetch updates')
      const data = await resp.json()
      // Keep `updates` as the last known server snapshot. We overlay
      // localPendingChanges at render time so that we can reliably compare
      // server vs local state when deciding when to clear pending changes.
      try {
        console.log(JSON.stringify({ tag: 'updates-load', step: 'db', items: data.map((item: any) => ({ id: String(item.id), reviewed: !!item.reviewed })) }))
      } catch {}
      setUpdates(data)
    } catch (err) {
      console.error('Error fetching updates:', err)
    } finally {
      setRefreshingUpdates(false)
    }
  }

  // Fresh single-item handlers with optimistic UI via localPendingChanges only
  const handleToggleSingle = async (item: any) => {
    setSingleProcessingId(String(item.id))
    const id = String(item.id)
    const nextReviewed = !item.reviewed

    // Do NOT mutate `updates` optimistically; we want it to remain the last
    // server snapshot. The UI overlay and badges come from localPendingChanges.
    const newPending = {
      ...localPendingChanges,
      [id]: { ...(localPendingChanges[id] || {}), reviewed: nextReviewed },
    }
    setLocalPendingChanges(newPending)
    try { console.log(JSON.stringify({ tag: 'updates-toggle', step: 'local-save', id, pending: newPending[id] })) } catch {}
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(newPending))
      localStorage.setItem(PENDING_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
      try { console.log(JSON.stringify({ tag: 'updates-toggle', step: 'local-save-ok' })) } catch {}
    } catch (e) {
      try { console.log(JSON.stringify({ tag: 'updates-toggle', step: 'local-save-fail', error: String(e) })) } catch {}
    }

    try {
      const resp = await fetch(`/api/updates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed: nextReviewed }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      await resp.json()
      // Success: fetch fresh data to trigger auto-clear
      showToast(`Marked ${nextReviewed ? 'reviewed' : 'unreviewed'}`)
      // Fetch fresh data with no-cache to ensure we get the latest state, but don't block
      fetchUpdates(true).catch(() => {})
    } catch (e) {
      try { console.log(JSON.stringify({ tag: 'updates-toggle', step: 'patch-fail', error: String(e) })) } catch {}
      // Clear from pending on error (revert local override)
      const revertPending = { ...localPendingChanges }
      delete revertPending[id]
      setLocalPendingChanges(revertPending)
      try {
        if (Object.keys(revertPending).length === 0) {
          localStorage.removeItem(PENDING_KEY)
          localStorage.removeItem(PENDING_BACKUP_KEY)
        } else {
          localStorage.setItem(PENDING_KEY, JSON.stringify(revertPending))
          localStorage.setItem(PENDING_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: revertPending }))
        }
      } catch (e) {
        try { console.log(JSON.stringify({ tag: 'updates-toggle', step: 'local-revert-fail', error: String(e) })) } catch {}
      }
      showToast('Failed to update status', 'error')
    } finally {
      setSingleProcessingId(null)
    }
  }

  const handleDeleteSingle = async (item: any) => {
    const ok = confirm('Delete this update request? This cannot be undone.')
    if (!ok) return
    setSingleProcessingId(String(item.id))
    const id = String(item.id)
    
    // Mark as deleted in local pending changes; the render layer will hide
    // it immediately while we wait for the server & database to catch up.
    const newPending = {
      ...localPendingChanges,
      [id]: { ...(localPendingChanges[id] || {}), deleted: true },
    }
    setLocalPendingChanges(newPending)
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(newPending))
      localStorage.setItem(PENDING_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
    } catch (e) {}

    try {
      const resp = await fetch(`/api/updates/${id}`, { method: 'DELETE' })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      await resp.json()
      showToast('Update request deleted')
      // Fetch fresh data to trigger auto-clear, but don't block
      fetchUpdates(true).catch(() => {})
    } catch (e) {
      console.error('Single delete failed', e)
      // Clear from pending on error (undo the local delete)
      const revertPending = { ...localPendingChanges }
      delete revertPending[id]
      setLocalPendingChanges(revertPending)
      try {
        if (Object.keys(revertPending).length === 0) {
          localStorage.removeItem(PENDING_KEY)
          localStorage.removeItem(PENDING_BACKUP_KEY)
        } else {
          localStorage.setItem(PENDING_KEY, JSON.stringify(revertPending))
          localStorage.setItem(PENDING_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: revertPending }))
        }
      } catch (e) {}
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
      const ok = confirm(`Delete ${ids.length} update request(s)? This cannot be undone.`)
      if (!ok) return
    }
    setUpdatingBatch(true)

    // Apply the batch intent only to localPendingChanges so that the UI
    // reflects it immediately but `updates` stays as the last server fetch.
    const newPending = { ...localPendingChanges }
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

    // Save to localStorage for reload persistence
    setLocalPendingChanges(newPending)
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(newPending))
      localStorage.setItem(PENDING_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
    } catch (e) {}
    try {
      const resp = await fetch('/api/updates/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action })
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      if (!data.success) throw new Error('Batch failed')

      // Success: fetch fresh data to trigger auto-clear
      showToast(`${action === 'delete' ? 'Deleted' : 'Updated'} ${data.count} item${data.count === 1 ? '' : 's'}`)
      // Fetch fresh data to trigger auto-clear, but don't block
      fetchUpdates(true).catch(() => {})
    } catch (e) {
      console.error('Batch op failed', e)
      // Clear from pending on error
      const revertPending = { ...localPendingChanges }
      ids.forEach(id => { delete revertPending[id] })
      setLocalPendingChanges(revertPending)
      try {
        if (Object.keys(revertPending).length === 0) {
          localStorage.removeItem(PENDING_KEY)
          localStorage.removeItem(PENDING_BACKUP_KEY)
        } else {
          localStorage.setItem(PENDING_KEY, JSON.stringify(revertPending))
          localStorage.setItem(PENDING_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: revertPending }))
        }
      } catch (e) {}
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
    }
  }, [isAuthenticated])

  // Load pending changes from localStorage on mount (primary + backup fallback)
  useEffect(() => {
    const actionId = `UPDATES-MOUNT-${Date.now()}`
    try {
      const primary = localStorage.getItem(PENDING_KEY)
      if (primary) {
        const parsed = JSON.parse(primary)
        try { console.log(JSON.stringify({ tag: 'updates-pending', step: 'primary', actionId, count: Object.keys(parsed||{}).length })) } catch {}
        setLocalPendingChanges(parsed)
      } else {
        const backup = localStorage.getItem(PENDING_BACKUP_KEY)
        if (backup) {
          try {
            const backupParsed = JSON.parse(backup)
            if (backupParsed && backupParsed.data) {
              try { console.log(JSON.stringify({ tag: 'updates-pending', step: 'backup', actionId, count: Object.keys(backupParsed.data||{}).length })) } catch {}
              setLocalPendingChanges(backupParsed.data)
            } else {
              try { console.log(JSON.stringify({ tag: 'updates-pending', step: 'backup-malformed', actionId })) } catch {}
            }
          } catch (e) {
            try { console.log(JSON.stringify({ tag: 'updates-pending', step: 'backup-parse-fail', actionId, error: String(e) })) } catch {}
          }
        } else {
          try { console.log(JSON.stringify({ tag: 'updates-pending', step: 'none', actionId })) } catch {}
        }
      }
    } catch (e) {
      try { console.log(JSON.stringify({ tag: 'updates-pending', step: 'load-fail', actionId, error: String(e) })) } catch {}
    } finally {
      setLocalStorageLoaded(true)
      try { console.log(JSON.stringify({ tag: 'updates-pending', step: 'loaded', actionId })) } catch {}
    }
  }, [])

  // Redundant persistence effect (writes both keys after any change once loaded)
  useEffect(() => {
    if (!localStorageLoaded) return
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
    // CRITICAL: Don't run until localStorage has been loaded on mount
    if (!localStorageLoaded) return
    if (Object.keys(localPendingChanges).length === 0) return
    if (updates.length === 0) return
    try { console.log(JSON.stringify({ tag: 'updates-autoclear', step: 'start', pendingIds: Object.keys(localPendingChanges), dbIds: updates.map(u=>String(u.id)) })) } catch {}

    const stillPending = { ...localPendingChanges }
    let hasCleared = false

    Object.keys(stillPending).forEach(id => {
      const pending = stillPending[id]
      const dbItem = updates.find(u => String(u.id) === id)

      // If marked deleted locally but no longer exists in DB, clear it
      if (pending.deleted && !dbItem) {
        try { console.log(JSON.stringify({ tag: 'updates-autoclear', step: 'clear-deleted', id })) } catch {}
        delete stillPending[id]
        hasCleared = true
      }
      // If reviewed state matches DB, clear it
      else if (dbItem && pending.reviewed !== undefined && dbItem.reviewed === pending.reviewed) {
        try { console.log(JSON.stringify({ tag: 'updates-autoclear', step: 'clear-reviewed', id, value: pending.reviewed })) } catch {}
        delete stillPending[id]
        hasCleared = true
      } else if (dbItem && pending.reviewed !== undefined) {
        try { console.log(JSON.stringify({ tag: 'updates-autoclear', step: 'still-pending', id, pending: pending.reviewed, db: dbItem.reviewed })) } catch {}
      }
    })

    if (hasCleared) {
      setLocalPendingChanges(stillPending)
      try {
        if (Object.keys(stillPending).length === 0) {
          localStorage.removeItem(PENDING_KEY)
          localStorage.removeItem(PENDING_BACKUP_KEY)
          try { console.log(JSON.stringify({ tag: 'updates-autoclear', step: 'cleared-all' })) } catch {}
        } else {
          localStorage.setItem(PENDING_KEY, JSON.stringify(stillPending))
          localStorage.setItem(PENDING_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: stillPending }))
          try { console.log(JSON.stringify({ tag: 'updates-autoclear', step: 'updated-remaining', count: Object.keys(stillPending).length })) } catch {}
        }
      } catch (e) {
        try { console.log(JSON.stringify({ tag: 'updates-autoclear', step: 'update-fail', error: String(e) })) } catch {}
      }
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
      setAnnouncementsEnabled(data.announcementsEnabled !== false)
    } catch (err) {
      console.error('Error fetching settings:', err)
    }
  }

  const toggleAnnouncements = async () => {
    try {
      setSavingSettings(true)
      const newValue = !announcementsEnabled
      
      // Optimistically update localStorage immediately
      setAnnouncementsEnabled(newValue)
      try { 
        localStorage.setItem('settings:announcementsEnabled', String(newValue))
        // Dispatch event to notify ClubsList component
        window.dispatchEvent(new CustomEvent('announcements-updated', { detail: { settingsChanged: true } }))
        broadcast('announcements', 'update', { settingsChanged: true })
      } catch {}
      
      const resp = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcementsEnabled: newValue }),
      })
      
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}))
        throw new Error(errorData.error || `Server returned ${resp.status}`)
      }
      
      showToast(`Announcements ${newValue ? 'enabled' : 'disabled'}`)
      
      // Refresh club data to apply changes
      await refreshData()
    } catch (err) {
      console.error('Error toggling announcements:', err)
      // Revert on error
      setAnnouncementsEnabled(!announcementsEnabled)
      try { 
        localStorage.setItem('settings:announcementsEnabled', String(!announcementsEnabled))
        window.dispatchEvent(new CustomEvent('announcements-updated', { detail: { settingsChanged: true } }))
        broadcast('announcements', 'update', { settingsChanged: true })
      } catch {}
      showToast(`Could not update settings: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
    } finally {
      setSavingSettings(false)
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
    )
  }

  return (
    <div className="space-y-6">

      {/* Update Requests */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Update Requests {updates.length > 0 && `(${updates.length})`}
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
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>

        {/* Club Data Source Selector */}
        <div className="p-4 border border-primary-300 dark:border-primary-700 rounded-lg mb-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Club Data Source
          </h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="clubDataSource"
                value="excel"
                checked={clubDataSource === 'excel'}
                onChange={() => setClubDataSource('excel')}
                className="accent-primary-600"
              />
              <span className="text-sm">Excel File</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="clubDataSource"
                value="collection"
                checked={clubDataSource === 'collection'}
                onChange={() => setClubDataSource('collection')}
                className="accent-primary-600"
              />
              <span className="text-sm">Registration Collection</span>
            </label>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            This controls which clubs are shown on the main site. "Excel File" uses the uploaded spreadsheet; "Registration Collection" uses the currently enabled collection below.
          </p>
        </div>
        
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg md:col-span-2">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Club Registration Collections</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Manage multiple registration form collections (e.g., different years). Each has a unique form link and can be toggled on/off.
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
                          createdAt: new Date().toISOString()
                        })
                      }
                    }
                    const obj = map.get(id)
                    if (obj) {
                      if (change.enabled !== undefined) obj.enabled = change.enabled
                      if (change.name) obj.name = change.name
                    }
                  }
                  return Array.from(map.values())
                })()
                return overlayed.filter(c => !localPendingCollectionChanges[c.id]?.deleted).length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No collections yet. Create one above.</p>
              ) : (
                overlayed.filter(c => !localPendingCollectionChanges[c.id]?.deleted).map((collection) => (
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
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            collection.enabled
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {collection.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                          {(localPendingCollectionChanges[collection.id]?.created || localPendingCollectionChanges[collection.id]?.enabled !== undefined || localPendingCollectionChanges[collection.id]?.deleted) && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 italic ml-1">Syncing...</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Created {new Date(collection.createdAt).toLocaleDateString()}
                        </p>
                        {collection.enabled && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400">Form link:</span>
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
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Toggle
                          checked={!!collection.enabled}
                          onChange={() => toggleCollectionEnabled(collection.id)}
                          disabled={togglingCollection === collection.id}
                        />
                        {collections.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteCollection(collection.id)
                            }}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Delete collection"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
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
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Admin API Key</label>
                  <input
                    type="password"
                    value={adminApiKey}
                    onChange={(e) => setAdminApiKey(e.target.value)}
                    className="input-field text-sm"
                    placeholder="Enter your ADMIN_API_KEY"
                  />
                </div>
                <button onClick={saveAdminApiKey} className="btn-secondary whitespace-nowrap">Save Key</button>
              </div>
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
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">User Management</h2>
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
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Club Statistics</h2>
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
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Club Registrations</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Share this link: <a href={`${typeof window !== 'undefined' ? window.location.origin : ''}/register-club?collection=${(() => {
                      const pending = activeCollectionId ? localPendingCollectionChanges[activeCollectionId] : undefined
                      const baseName = pending?.name || (collections.find(c => c.id === activeCollectionId)?.name || '')
                      return slugifyName(baseName)
                    })()}`} target="_blank" className="text-primary-600 dark:text-primary-400 hover:underline">{typeof window !== 'undefined' ? window.location.origin : ''}/register-club?collection={(() => {
                      const pending = activeCollectionId ? localPendingCollectionChanges[activeCollectionId] : undefined
                      const baseName = pending?.name || (collections.find(c => c.id === activeCollectionId)?.name || '')
                      return slugifyName(baseName)
                    })()}</a>
                  </p>
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
              />
            </div>
          </div>
        </>
      )}

      {/* Clear Data Section - at bottom */}
      <div className="card">
        <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">System Maintenance</h3>
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
