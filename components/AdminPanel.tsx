'use client'

import { useState, useEffect, useRef } from 'react'
import { Lock, Unlock, RefreshCw, Megaphone, Trash2, UserPlus, Users, BarChart3, FileSpreadsheet } from 'lucide-react'
import { Club } from '@/types/club'
import { getClubs } from '@/lib/clubs-client'
import { Toast, ToastContainer } from '@/components/Toast'
import { UserManagement } from '@/components/UserManagement'
import { RegistrationsList } from '@/components/RegistrationsList'

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
  const [announcementsEnabled, setAnnouncementsEnabled] = useState(true)
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
  const [registrationEnabled, setRegistrationEnabled] = useState(true)
  const [activeCollection, setActiveCollection] = useState('')
  const [loadingRegSettings, setLoadingRegSettings] = useState(false)
  const [selectedUpdateIds, setSelectedUpdateIds] = useState<Set<string>>(new Set())
  const [updatingBatch, setUpdatingBatch] = useState(false)
  const [singleProcessingId, setSingleProcessingId] = useState<string | null>(null)
  const [localPendingChanges, setLocalPendingChanges] = useState<Record<string, { reviewed?: boolean; deleted?: boolean }>>({})

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
  }, [])

  // Load registration settings
  useEffect(() => {
    const loadRegSettings = async () => {
      try {
        const resp = await fetch('/api/registration-settings')
        const data = await resp.json()
        setRegistrationEnabled(data.enabled)
        setActiveCollection(data.activeCollection)
      } catch (err) {
        console.error('Failed to load registration settings:', err)
      }
    }
    loadRegSettings()
  }, [])

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

  const saveRegistrationSettings = async () => {
    if (!adminApiKey) {
      showToast('Set admin API key first', 'error')
      return
    }
    if (!activeCollection.trim()) {
      showToast('Collection name is required', 'error')
      return
    }
    setLoadingRegSettings(true)
    try {
      const resp = await fetch('/api/registration-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify({
          enabled: registrationEnabled,
          activeCollection: activeCollection.trim()
        })
      })
      if (!resp.ok) throw new Error('Failed to save settings')
      showToast('Registration settings saved')
    } catch (err) {
      showToast('Failed to save registration settings', 'error')
    } finally {
      setLoadingRegSettings(false)
    }
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
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bcRef.current = new BroadcastChannel('montyclub')
    }
    return () => {
      bcRef.current?.close()
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
    setRefreshingUpdates(true)
    try {
      const resp = await fetch('/api/updates')
      if (!resp.ok) throw new Error('Failed to fetch updates')
      let data = await resp.json()
      
      console.log('=== FETCH UPDATES DEBUG ===')
      console.log('Raw data from API/DB:', data.map((item: any) => ({ id: item.id, clubName: item.clubName, reviewed: item.reviewed })))
      
      // CRITICAL: Merge with localStorage pending changes before setting state
      // This ensures pending changes always override stale database data
      try {
        const stored = localStorage.getItem('montyclub:pendingUpdateChanges')
        console.log('localStorage pending changes:', stored ? JSON.parse(stored) : 'none')
        
        if (stored) {
          const pending = JSON.parse(stored)
          const beforeMerge = [...data]
          
          // Apply pending changes to fetched data
          data = data
            .filter((item: any) => !pending[String(item.id)]?.deleted) // Hide deleted items
            .map((item: any) => {
              const itemPending = pending[String(item.id)]
              if (itemPending?.reviewed !== undefined) {
                return { ...item, reviewed: itemPending.reviewed }
              }
              return item
            })
          
          console.log('After merge with localStorage:', data.map((item: any) => ({ id: item.id, clubName: item.clubName, reviewed: item.reviewed })))
          console.log('Items filtered (deleted):', beforeMerge.filter((item: any) => !data.find((d: any) => d.id === item.id)).map((item: any) => ({ id: item.id, clubName: item.clubName })))
        }
      } catch (e) {
        console.error('Failed to merge pending changes with fetched updates', e)
      }
      
      console.log('=== END DEBUG ===')
      setUpdates(data)
    } catch (err) {
      console.error('Error fetching updates:', err)
    } finally {
      setRefreshingUpdates(false)
    }
  }

  // Fresh single-item handlers with optimistic updates
  const handleToggleSingle = async (item: any) => {
    setSingleProcessingId(String(item.id))
    const id = String(item.id)
    const nextReviewed = !item.reviewed
    const prev = updates
    // optimistic
    setUpdates(updates.map(u => String(u.id) === id ? { ...u, reviewed: nextReviewed } : u))
    
    // Save to localStorage for reload persistence
    const newPending = { ...localPendingChanges, [id]: { reviewed: nextReviewed } }
    setLocalPendingChanges(newPending)
    console.log('💾 SINGLE TOGGLE - Saving to localStorage:', newPending)
    try {
      localStorage.setItem('montyclub:pendingUpdateChanges', JSON.stringify(newPending))
      console.log('✅ localStorage saved successfully')
      // Verify it was saved
      const verify = localStorage.getItem('montyclub:pendingUpdateChanges')
      console.log('🔍 Verification read:', verify)
    } catch (e) {
      console.error('❌ Failed to save to localStorage:', e)
    }

    try {
      const resp = await fetch(`/api/updates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed: nextReviewed }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const updated = await resp.json()
      setUpdates(cur => cur.map(u => String(u.id) === id ? updated : u))
      showToast(`Marked ${nextReviewed ? 'reviewed' : 'unreviewed'}`)
    } catch (e) {
      console.error('Single toggle failed', e)
      setUpdates(prev) // revert
      // Clear from pending on error
      const revertPending = { ...localPendingChanges }
      delete revertPending[id]
      setLocalPendingChanges(revertPending)
      console.log('⚠️ REVERTING - Clearing from localStorage:', revertPending)
      try {
        if (Object.keys(revertPending).length === 0) {
          localStorage.removeItem('montyclub:pendingUpdateChanges')
          console.log('🗑️ localStorage cleared (no pending changes)')
        } else {
          localStorage.setItem('montyclub:pendingUpdateChanges', JSON.stringify(revertPending))
          console.log('💾 localStorage updated after revert')
        }
      } catch (e) {
        console.error('❌ Failed to update localStorage on revert:', e)
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
    const prev = updates
    setUpdates(updates.filter(u => String(u.id) !== id))
    
    // Save to localStorage for reload persistence
    const newPending = { ...localPendingChanges, [id]: { deleted: true } }
    setLocalPendingChanges(newPending)
    try {
      localStorage.setItem('montyclub:pendingUpdateChanges', JSON.stringify(newPending))
    } catch (e) {}

    try {
      const resp = await fetch(`/api/updates/${id}`, { method: 'DELETE' })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      await resp.json()
      showToast('Update request deleted')
    } catch (e) {
      console.error('Single delete failed', e)
      setUpdates(prev) // revert
      // Clear from pending on error
      const revertPending = { ...localPendingChanges }
      delete revertPending[id]
      setLocalPendingChanges(revertPending)
      try {
        if (Object.keys(revertPending).length === 0) {
          localStorage.removeItem('montyclub:pendingUpdateChanges')
        } else {
          localStorage.setItem('montyclub:pendingUpdateChanges', JSON.stringify(revertPending))
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
    const prev = updates
    // optimistic transform
    let optimistic: any[]
    const newPending = { ...localPendingChanges }
    if (action === 'delete') {
      optimistic = prev.filter(u => !ids.includes(String(u.id)))
      ids.forEach(id => { newPending[id] = { deleted: true } })
    } else {
      const reviewedVal = action === 'review'
      optimistic = prev.map(u => ids.includes(String(u.id)) ? { ...u, reviewed: reviewedVal } : u)
      ids.forEach(id => { newPending[id] = { reviewed: reviewedVal } })
    }
    setUpdates(optimistic)
    
    // Save to localStorage for reload persistence
    setLocalPendingChanges(newPending)
    try {
      localStorage.setItem('montyclub:pendingUpdateChanges', JSON.stringify(newPending))
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
      // Integrate authoritative server values for non-delete actions to prevent stale revert
      if (action !== 'delete' && Array.isArray(data.items)) {
        setUpdates(cur => cur.map(u => {
          const found = data.items.find((i: any) => String(i.id) === String(u.id))
          return found ? found : u
        }))
      } else if (action === 'delete' && Array.isArray(data.items)) {
        // Remove deleted items from state
        const deletedIds = new Set(data.items.map((i: any) => String(i.id)))
        setUpdates(cur => cur.filter(u => !deletedIds.has(String(u.id))))
      }
      showToast(`${action === 'delete' ? 'Deleted' : 'Updated'} ${data.count} item${data.count === 1 ? '' : 's'}`)
      // Do NOT trigger a delayed fetch that could overwrite with stale data
    } catch (e) {
      console.error('Batch op failed', e)
      setUpdates(prev) // revert
      // Clear from pending on error
      const revertPending = { ...localPendingChanges }
      ids.forEach(id => { delete revertPending[id] })
      setLocalPendingChanges(revertPending)
      try {
        if (Object.keys(revertPending).length === 0) {
          localStorage.removeItem('montyclub:pendingUpdateChanges')
        } else {
          localStorage.setItem('montyclub:pendingUpdateChanges', JSON.stringify(revertPending))
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

  // Load pending changes from localStorage on mount (survives reloads)
  useEffect(() => {
    console.log('🔄 MOUNT - Loading pending changes from localStorage...')
    try {
      const stored = localStorage.getItem('montyclub:pendingUpdateChanges')
      console.log('📖 Read from localStorage:', stored)
      if (stored) {
        const parsed = JSON.parse(stored)
        console.log('✅ Parsed pending changes:', parsed)
        setLocalPendingChanges(parsed)
      } else {
        console.log('ℹ️ No pending changes found in localStorage')
      }
    } catch (e) {
      console.error('❌ Failed to load pending changes from localStorage', e)
    }
  }, [])

  // Auto-clear pending changes that now match database state
  useEffect(() => {
    if (Object.keys(localPendingChanges).length === 0) return
    if (updates.length === 0) return

    console.log('🔍 AUTO-CLEAR CHECK - Pending changes:', localPendingChanges)
    console.log('🔍 Current updates from DB:', updates.map(u => ({ id: u.id, reviewed: u.reviewed })))

    const stillPending = { ...localPendingChanges }
    let hasCleared = false

    Object.keys(stillPending).forEach(id => {
      const pending = stillPending[id]
      const dbItem = updates.find(u => String(u.id) === id)

      // If marked deleted locally but no longer exists in DB, clear it
      if (pending.deleted && !dbItem) {
        console.log(`🗑️ Clearing deleted item ${id} - no longer in DB`)
        delete stillPending[id]
        hasCleared = true
      }
      // If reviewed state matches DB, clear it
      else if (dbItem && pending.reviewed !== undefined && dbItem.reviewed === pending.reviewed) {
        console.log(`✅ Clearing item ${id} - DB now matches (reviewed: ${pending.reviewed})`)
        delete stillPending[id]
        hasCleared = true
      } else if (dbItem && pending.reviewed !== undefined) {
        console.log(`⏳ Keeping item ${id} - DB mismatch (pending: ${pending.reviewed}, db: ${dbItem.reviewed})`)
      }
    })

    if (hasCleared) {
      console.log('📝 Updating localStorage with remaining pending:', stillPending)
      setLocalPendingChanges(stillPending)
      try {
        if (Object.keys(stillPending).length === 0) {
          localStorage.removeItem('montyclub:pendingUpdateChanges')
          console.log('🗑️ All pending changes synced - localStorage cleared')
        } else {
          localStorage.setItem('montyclub:pendingUpdateChanges', JSON.stringify(stillPending))
          console.log('💾 localStorage updated with remaining pending changes')
        }
      } catch (e) {
        console.error('❌ Failed to update localStorage', e)
      }
    } else {
      console.log('ℹ️ No changes to clear')
    }
  }, [updates, localPendingChanges])

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
      const resp = await fetch('/api/announcements')
      if (!resp.ok) throw new Error('Failed to fetch announcements')
      const data = await resp.json()
      setAnnouncements(data || {})
    } catch (err) {
      console.error('Error fetching announcements:', err)
    }
  }

  const saveAnnouncement = async (id: string, text: string) => {
    try {
      setSavingAnnouncements(prev => ({ ...prev, [id]: true }))
      const resp = await fetch(`/api/announcements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcement: text || '' }),
      })
      
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}))
        throw new Error(errorData.error || `Server returned ${resp.status}`)
      }
      
      const updated = await resp.json()
      setAnnouncements(prev => ({ ...prev, [id]: updated.announcement || '' }))
      showToast('Announcement saved successfully')
      
      // notify other tabs/windows
      try {
        bcRef.current?.postMessage({ type: 'announcements-updated', id })
      } catch (e) {
        // ignore
      }
      // localStorage fallback for cross-browser/tab notification
      try {
        localStorage.setItem('montyclub:announcementsUpdated', JSON.stringify({ id, t: Date.now() }))
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error('Error saving announcement:', err)
      showToast(`Could not save announcement: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
    } finally {
      setSavingAnnouncements(prev => ({ ...prev, [id]: false }))
    }
  }

  const clearAnnouncement = async (id: string) => {
    try {
      setSavingAnnouncements(prev => ({ ...prev, [id]: true }))
      const resp = await fetch(`/api/announcements/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ announcement: '' }) })
      if (!resp.ok) throw new Error('Failed to clear')
      await resp.json()
      setAnnouncements(prev => {
        const copy = { ...prev }
        delete copy[id]
        return copy
      })
      // Don't show toast for individual clears during bulk delete
      if (!savingAnnouncements[`bulk-${id}`]) {
        showToast('Announcement cleared successfully')
      }
      try {
        bcRef.current?.postMessage({ type: 'announcements-updated', id })
      } catch (e) {
        // ignore
      }
      try {
        localStorage.setItem('montyclub:announcementsUpdated', JSON.stringify({ id, t: Date.now() }))
      } catch (e) {}
    } catch (err) {
      console.error('Error clearing announcement:', err)
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
      const resp = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcementsEnabled: newValue }),
      })
      
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}))
        throw new Error(errorData.error || `Server returned ${resp.status}`)
      }
      
      setAnnouncementsEnabled(newValue)
      showToast(`Announcements ${newValue ? 'enabled' : 'disabled'}`)
      
      // Refresh club data to apply changes
      await refreshData()
    } catch (err) {
      console.error('Error toggling announcements:', err)
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
            onClick={fetchUpdates}
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
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Manage club announcements without re-uploading Excel</p>
            <button
              onClick={() => setShowAnnouncementsPanel(!showAnnouncementsPanel)}
              className="btn-primary w-full sm:w-auto"
            >
              <Megaphone className="h-4 w-4 mr-2" />
              {showAnnouncementsPanel ? 'Close Announcements' : 'Manage Announcements'}
            </button>
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
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Club Registrations</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">View submissions and manage registration form</p>
            <div className="space-y-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Collection Name</label>
                <input
                  type="text"
                  value={activeCollection}
                  onChange={(e) => setActiveCollection(e.target.value)}
                  placeholder="e.g., 2025 Club Requests"
                  className="input-field text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRegistrationEnabled(!registrationEnabled)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    registrationEnabled 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  {registrationEnabled ? 'Form Enabled' : 'Form Disabled'}
                </button>
                <button
                  onClick={saveRegistrationSettings}
                  disabled={loadingRegSettings}
                  className="btn-primary px-4 py-2 text-sm"
                >
                  {loadingRegSettings ? 'Saving...' : 'Save'}
                </button>
              </div>
              <button
                onClick={() => setShowRegistrations(!showRegistrations)}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {showRegistrations ? 'Close Registrations' : 'View Registrations'}
              </button>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Share: <a href={`${typeof window !== 'undefined' ? window.location.origin : ''}/register-club`} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline break-all">/register-club</a>
              </div>
            </div>
          </div>

          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Announcements Feature</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {announcementsEnabled ? 'Announcements are currently shown on the site' : 'Announcements are currently hidden from the site'}
            </p>
            <button
              onClick={toggleAnnouncements}
              disabled={savingSettings}
              className={`w-full sm:w-auto flex items-center gap-2 ${announcementsEnabled ? 'btn-secondary' : 'btn-primary'}`}
            >
              {savingSettings ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Megaphone className="h-4 w-4" />
              )}
              {announcementsEnabled ? 'Disable Announcements' : 'Enable Announcements'}
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
                <div className="flex gap-2">
                  <button onClick={saveAnalyticsPeriod} className="btn-secondary whitespace-nowrap">Save Period</button>
                  <button onClick={toggleAnalyticsEnabled} className={`whitespace-nowrap flex items-center gap-2 ${analyticsEnabled ? 'btn-secondary' : 'btn-primary'}`}>{analyticsEnabled ? 'Disable Analytics' : 'Enable Analytics'}</button>
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

          {/* Club Registrations */}
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Club Registrations</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">View and manage club charter requests</p>
            <button
              onClick={() => setShowRegistrations(!showRegistrations)}
              className="btn-primary w-full sm:w-auto flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {showRegistrations ? 'Close Registrations' : 'View Registrations'}
            </button>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div 
              ref={userManagementRef} 
              className="card max-w-3xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto animate-in zoom-in-95 fade-in duration-200"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div 
              ref={announcementsRef} 
              className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto animate-in zoom-in-95 fade-in duration-200"
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

              <AnnounceEditor
            clubs={clubs}
            announcements={announcements}
            setAnnouncements={setAnnouncements}
            saveAnnouncement={async (id: string, text: string) => {
              await saveAnnouncement(id, text)
              // refresh clubs so the gallery reflects updated announcement values
              await refreshData()
              try { bcRef.current?.postMessage({ type: 'announcements-updated', id }) } catch (e) {}
              // Also dispatch a custom event for same-tab updates
              window.dispatchEvent(new CustomEvent('announcements-updated', { detail: { id } }))
            }}
            clearAnnouncement={async (id: string) => {
              await clearAnnouncement(id)
              await refreshData()
              try { bcRef.current?.postMessage({ type: 'announcements-updated', id }) } catch (e) {}
              // Also dispatch a custom event for same-tab updates
              window.dispatchEvent(new CustomEvent('announcements-updated', { detail: { id } }))
            }}
            savingAnnouncements={savingAnnouncements}
            showToast={showToast}
            onRequestClear={(id: string) => setConfirmClearId(id)}
          />
          
          {/* Bulk Delete Section */}
          <BulkDeleteAnnouncements
            clubs={clubs}
            announcements={announcements}
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
                  try { bcRef.current?.postMessage({ type: 'announcements-updated', id }) } catch (e) {}
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
                  try { bcRef.current?.postMessage({ type: 'announcements-updated', id }) } catch (e) {}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div 
              ref={registrationsRef} 
              className="card max-w-7xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto animate-in zoom-in-95 fade-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Club Registrations</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Share this link: <a href={`${typeof window !== 'undefined' ? window.location.origin : ''}/register-club`} target="_blank" className="text-primary-600 dark:text-primary-400 hover:underline">{typeof window !== 'undefined' ? window.location.origin : ''}/register-club</a>
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
              <RegistrationsList adminApiKey={adminApiKey} />
            </div>
          </div>
        </>
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