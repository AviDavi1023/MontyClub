'use client'

import { useState, useEffect, useRef } from 'react'
import { Lock, Unlock, RefreshCw, Megaphone, Trash2, UserPlus, Users, BarChart3, FileSpreadsheet, Plus, ExternalLink, Edit3, ChevronDown, AlertTriangle } from 'lucide-react'
import { Club, RegistrationCollection } from '@/types/club'
import { getClubs } from '@/lib/clubs-client'
import { Toast, ToastContainer } from '@/components/Toast'
import { Button, ConfirmDialog, Modal } from '@/components/ui'
import { useConfirm } from '@/lib/hooks/useConfirm'
import { UserManagement } from '@/components/UserManagement'
import { RegistrationsList } from '@/components/RegistrationsList'
import { Toggle } from '@/components/Toggle'
import { InfoTooltip } from '@/components/ui'
import { slugifyName } from '@/lib/slug'
import { createBroadcastListener, broadcast } from '@/lib/broadcast'
import { AdminSidebar } from '@/components/AdminSidebar'
import { ActivityLog, logActivity } from '@/components/ActivityLog'
import { AnnouncementsBoard } from '@/components/AnnouncementsBoard'
import { DashboardOverview } from '@/components/DashboardOverview'
import { UpdateRequestsPanel } from '@/components/UpdateRequestsPanel'
import { AnalyticsPanel } from '@/components/AnalyticsPanel'

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
  const [loginApiKey, setLoginApiKey] = useState('')
  const [activeSection, setActiveSection] = useState('dashboard')
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
  const [showPrimaryEmailSetup, setShowPrimaryEmailSetup] = useState(false)
  const [primaryEmail, setPrimaryEmail] = useState('')
  const [savingPrimaryEmail, setSavingPrimaryEmail] = useState(false)
  const [refreshingUpdates, setRefreshingUpdates] = useState(false)
  const [showStatistics, setShowStatistics] = useState(false)
  const statisticsRef = useRef<HTMLDivElement | null>(null)
  const [announcementsEnabled, setAnnouncementsEnabled] = useState<boolean | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [refreshingCache, setRefreshingCache] = useState(false)
  const [publishingCatalog, setPublishingCatalog] = useState(false)
  const [catalogStatus, setCatalogStatus] = useState<{ exists: boolean; generatedAt?: string; clubCount?: number } | null>(null)
  const [adminApiKey, setAdminApiKey] = useState('')
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false)
  const [apiKeyPromptInput, setApiKeyPromptInput] = useState('')
  const [validatingApiKey, setValidatingApiKey] = useState(false)
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [resetUsername, setResetUsername] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [requestingReset, setRequestingReset] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [resetStep, setResetStep] = useState<'request' | 'reset'>('request')
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
  const [showExcelImportModal, setShowExcelImportModal] = useState(false)
  const [pendingExcelFile, setPendingExcelFile] = useState<File | null>(null)
  const [excelImportCollectionId, setExcelImportCollectionId] = useState<string | null>(null)
  const [creatingCollection, setCreatingCollection] = useState(false)
  const [togglingCollection, setTogglingCollection] = useState<string | null>(null)
  const [loadingCollections, setLoadingCollections] = useState(false)
  const [selectedUpdateIds, setSelectedUpdateIds] = useState<Set<string>>(new Set())
  const [updatingBatch, setUpdatingBatch] = useState(false)
  const [singleProcessingId, setSingleProcessingId] = useState<string | null>(null)
  const [localPendingChanges, setLocalPendingChanges] = useState<Record<string, { reviewed?: boolean; deleted?: boolean; _timestamp?: number }>>({})
  const [localStorageLoaded, setLocalStorageLoaded] = useState(false)
  // Track confirmed operations - operations where API confirmed success
  // This is the source of truth - if API says it succeeded, we trust it
  const confirmedOperationsRef = useRef<Map<string, { reviewed?: boolean; deleted?: boolean; timestamp: number }>>(new Map())
  const PENDING_KEY = 'montyclub:pendingUpdateChanges'
  const PENDING_BACKUP_KEY = 'montyclub:pendingUpdateChanges:backup'
  const [localPendingAnnouncements, setLocalPendingAnnouncements] = useState<Record<string, string | number>>({})
  const [announcementsStorageLoaded, setAnnouncementsStorageLoaded] = useState(false)
  const announcementsAutoClearcheckRef = useRef<string>('') // Track last processed state
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
    adminUsers: false,
  })
  const [clearingData, setClearingData] = useState(false)
  
  // Pending registrations count across ALL collections
  const [pendingRegistrationsCount, setPendingRegistrationsCount] = useState(0)

  // Collection edit modal state
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null)
  const [editingCollectionName, setEditingCollectionName] = useState('')
  const [savingCollectionEdit, setSavingCollectionEdit] = useState(false)

  // Registration collections panel collapsed state
  const [isCollectionsCollapsed, setIsCollectionsCollapsed] = useState(true)

  // Load admin API key from localStorage and pre-fill login form
  useEffect(() => {
    try {
      const key = localStorage.getItem('analytics:adminKey')
      if (key) {
        setAdminApiKey(key)
        // Pre-fill login form if not yet authenticated
        if (!isAuthenticated) {
          setLoginApiKey(key)
        }
      }
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

  // Load collections on auth - Postgres is instantly consistent
  useEffect(() => {
    if (!isAuthenticated || !adminApiKey) return
    loadCollections()
  }, [isAuthenticated, adminApiKey])

  // Calculate pending registrations count across ALL collections using aggregated endpoint
  // CRITICAL FIX: Replaced N individual API calls with single aggregated call
  useEffect(() => {
    if (!adminApiKey) {
      setPendingRegistrationsCount(0)
      return
    }
    
    const fetchPendingCount = async () => {
      try {
        // Single aggregated call instead of N individual calls
        const resp = await fetch('/api/admin/dashboard-summary', {
          headers: { 'x-admin-key': adminApiKey }
        })
        
        if (!resp.ok) {
          console.error('Failed to fetch dashboard summary')
        }
        
        const data = await resp.json()
        
        // Calculate total pending across all active collections
        const totalPending = Object.values(data.pendingCounts || {}).reduce((sum: number, count) => sum + (typeof count === 'number' ? count : 0), 0)
        setPendingRegistrationsCount(totalPending)
      } catch (err) {
        console.error('Failed to calculate pending registrations:', err)
      }
    }
    
    fetchPendingCount()
  }, [adminApiKey])

  const loadCollections = async () => {
    if (!adminApiKey) return
    try {
      setLoadingCollections(true)
      const resp = await fetch('/api/registration-collections', {
        headers: { 'x-admin-key': adminApiKey }
      })
      if (!resp.ok) throw new Error('Failed to load collections')
      const data = await resp.json()
      setCollections(data.collections || [])
      
      // Auto-select: prefer display → enabled → first
      if (data.collections && data.collections.length > 0) {
        const displayCol = data.collections.find((c: RegistrationCollection) => c.display)
        const enabledCol = data.collections.find((c: RegistrationCollection) => c.enabled)
        setActiveCollectionId(displayCol?.id || enabledCol?.id || data.collections[0].id)
      } else {
        setActiveCollectionId(null)
      }
    } catch (err) {
      showToast(`Failed to load collections: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
    } finally {
      setLoadingCollections(false)
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
      showToast('Collection created successfully')
      // Refetch collections - Postgres is instant
      await loadCollections()
    } catch (err: any) {
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
    const nextDisplay = !collection.display

    try {
      const resp = await fetch('/api/registration-collections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminApiKey },
        body: JSON.stringify({ id: collectionId, display: nextDisplay })
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update display')
      }
      showToast(`Display ${nextDisplay ? 'enabled' : 'disabled'}`)
      await loadCollections()
      
      // Auto-republish if enabling display
      if (nextDisplay) {
        try {
          setPublishingCatalog(true)
          await publishSnapshotNow()
          showToast('Catalog republished', 'success')
        } catch (publishErr) {
          console.error('Auto-republish failed:', publishErr)
          showToast('Display updated but catalog republish failed', 'error')
        } finally {
          setPublishingCatalog(false)
        }
      }
    } catch (err) {
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
    const nextAccepting = !collection.accepting

    try {
      const resp = await fetch('/api/registration-collections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminApiKey },
        body: JSON.stringify({ id: collectionId, accepting: nextAccepting })
      })
      
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update accepting')
      }
      showToast(`Accepting ${nextAccepting ? 'enabled' : 'disabled'}`)
      await loadCollections()
    } catch (err: any) {
      showToast(err.message || 'Failed to update accepting', 'error')
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
    const nextRenewal = !collection.renewalEnabled

    try {
      const resp = await fetch('/api/registration-collections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminApiKey },
        body: JSON.stringify({ id: collectionId, renewalEnabled: nextRenewal })
      })
      
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update renewal')
      }
      showToast(`Renewal ${nextRenewal ? 'enabled' : 'disabled'}`)
      await loadCollections()
    } catch (err: any) {
      showToast(err.message || 'Failed to update renewal', 'error')
    } finally {
      setTogglingCollection(null)
    }
  }

  const toggleCollectionEnabled = async (collectionId: string) => {
    const collection = collections.find(c => c.id === collectionId)
    if (!collection) {
      showToast('Collection not found', 'error')
      return
    }
    if (!adminApiKey) {
      showToast('Set admin API key first', 'error')
      return
    }

    setTogglingCollection(collectionId)
    try {
      const nextEnabled = !collection.enabled
      await fetch('/api/registration-collections', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify({ id: collectionId, enabled: nextEnabled })
      })
      await loadCollections()
      showToast(`Collection ${nextEnabled ? 'enabled' : 'disabled'}`)
    } catch (err: any) {
      showToast(err.message || 'Failed to update collection', 'error')
    } finally {
      setTogglingCollection(null)
    }
  }

  const deleteCollection = async (collectionId: string) => {
    if (!adminApiKey) {
      showToast('Set admin API key first', 'error')
      return
    }

    // Check registration count
    let registrationCount = 0
    try {
      const resp = await fetch(`/api/registrations/${collectionId}`, {
        headers: { 'x-admin-key': adminApiKey }
      })
      if (resp.ok) {
        const data = await resp.json()
        registrationCount = (data.registrations || []).length
      }
    } catch (err) {
      console.log('Could not check registration count')
    }

    // Build confirmation message
    let confirmMessage = 'Are you sure you want to delete this collection?'
    if (registrationCount > 0) {
      confirmMessage = `⚠️ This collection has ${registrationCount} registration(s). These will also be deleted. Are you sure?`
    }
    confirmMessage += '\n\nThis cannot be undone.'

    const ok = await confirm({
      title: 'Delete Collection',
      message: confirmMessage,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    })
    if (!ok) return

    try {
      const resp = await fetch(`/api/registration-collections?id=${collectionId}&deleteRegistrations=false`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminApiKey }
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to delete collection')
      }

      // Adjust active collection immediately if needed
      if (activeCollectionId === collectionId) {
        const replacement = collections.find(c => c.id !== collectionId && c.enabled) ||
          collections.find(c => c.id !== collectionId) || null
        setActiveCollectionId(replacement ? replacement.id : null)
      }

      showToast('Collection deleted')
      await loadCollections()
    } catch (err: any) {
      showToast(err.message || 'Failed to delete collection', 'error')
    }
  }

  const renameCollection = async (collectionId: string, newName: string) => {
    if (!adminApiKey) {
      showToast('Set admin API key first', 'error')
      return
    }

    if (!newName.trim()) {
      showToast('Collection name cannot be empty', 'error')
      return
    }

    const collection = collections.find(c => c.id === collectionId)
    if (!collection) return

    if (newName.trim().toLowerCase() === collection.name.toLowerCase()) {
      // No change needed
      setEditingCollectionId(null)
      setEditingCollectionName('')
      return
    }

    setSavingCollectionEdit(true)
    try {
      const resp = await fetch('/api/registration-collections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminApiKey },
        body: JSON.stringify({ id: collectionId, name: newName.trim() })
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Failed to rename collection' }))
        throw new Error(err.error || err.detail || 'Failed to rename collection')
      }

      const data = await resp.json()
      showToast(`Collection renamed to "${data.collection.name}"`)
      
      setEditingCollectionId(null)
      setEditingCollectionName('')
      
      // Refresh collections to get updated data
      await loadCollections()
    } catch (err) {
      showToast(String(err).replace('Error: ', ''), 'error')
    } finally {
      setSavingCollectionEdit(false)
    }
  }

  const saveAdminApiKey = async () => {
    const k = adminApiKey.trim()
    if (!k) {
      showToast('API key cannot be empty', 'error')
      return
    }
    
    setValidatingApiKey(true)
    try {
      const resp = await fetch('/api/admin/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: k })
      })
      
      if (resp.ok) {
        setAdminApiKey(k)
        try { localStorage.setItem('analytics:adminKey', k) } catch {}
        showToast('✅ API key validated and saved successfully')
        // Reload collections to test the key works
        await loadCollections()
      } else {
        showToast('❌ Invalid API key. Please check and try again.', 'error')
      }
    } catch (err) {
      showToast('Failed to validate API key. Check your connection.', 'error')
      console.error('API key validation error:', err)
    } finally {
      setValidatingApiKey(false)
    }
  }

  const saveApiKeyFromPrompt = async () => {
    const k = apiKeyPromptInput.trim()
    if (!k) {
      showToast('API key cannot be empty', 'error')
      return
    }
    
    setValidatingApiKey(true)
    try {
      const resp = await fetch('/api/admin/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: k })
      })
      
      if (resp.ok) {
        setAdminApiKey(k)
        try { localStorage.setItem('analytics:adminKey', k) } catch {}
        showToast('✅ API key validated and saved')
        setShowApiKeyPrompt(false)
        setApiKeyPromptInput('')
        // Reload collections to test
        await loadCollections()
      } else {
        showToast('❌ Invalid API key', 'error')
      }
    } catch (err) {
      showToast('Failed to validate API key', 'error')
    } finally {
      setValidatingApiKey(false)
    }
  }

  const skipApiKeyPrompt = () => {
    setShowApiKeyPrompt(false)
    setApiKeyPromptInput('')
  }

  const savePrimaryEmail = async () => {
    const email = primaryEmail.trim()
    if (!email || !email.includes('@')) {
      showToast('Please enter a valid email address', 'error')
      return
    }
    
    setSavingPrimaryEmail(true)
    try {
      const resp = await fetch('/api/admin/set-primary-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey || '',
        },
        body: JSON.stringify({ email })
      })
      
      const data = await resp.json()
      if (resp.ok) {
        showToast('✅ Primary admin email set successfully')
        setShowPrimaryEmailSetup(false)
        setPrimaryEmail('')
      } else {
        showToast(data.error || 'Failed to set email', 'error')
      }
    } catch (err) {
      showToast('Failed to set email', 'error')
    } finally {
      setSavingPrimaryEmail(false)
    }
  }

  const requestPasswordReset = async () => {
    const u = resetUsername.trim()
    if (!u) {
      showToast('Please enter your username', 'error')
      return
    }
    
    setRequestingReset(true)
    try {
      const resp = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u })
      })
      
      const data = await resp.json()
      if (resp.ok) {
        setResetToken('')
        setResetStep('reset')
        showToast(data.message || 'If the username exists, a reset code was emailed to the primary admin.', 'info')
      } else {
        showToast(data.error || 'Failed to request password reset', 'error')
      }
    } catch (err) {
      showToast('Failed to request password reset', 'error')
    } finally {
      setRequestingReset(false)
    }
  }

  const executePasswordReset = async () => {
    if (!resetToken.trim()) {
      showToast('Reset code is required', 'error')
      return
    }
    if (!newPassword.trim()) {
      showToast('New password is required', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error')
      return
    }
    if (newPassword.length < 8) {
      showToast('Password must be at least 8 characters', 'error')
      return
    }
    
    setResettingPassword(true)
    try {
      const resp = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken: resetToken.trim(), newPassword })
      })
      
      const data = await resp.json()
      if (resp.ok) {
        showToast('✅ Password reset successfully! Please log in with your new password.', 'success')
        handleLogout()
        setShowPasswordReset(false)
        setResetUsername('')
        setResetToken('')
        setNewPassword('')
        setConfirmPassword('')
        setResetStep('request')
      } else {
        showToast(data.error || 'Failed to reset password', 'error')
      }
    } catch (err) {
      showToast('Failed to reset password', 'error')
    } finally {
      setResettingPassword(false)
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

  // Load snapshot status on mount and periodically
  useEffect(() => {
    if (!isAuthenticated || !adminApiKey) return
    
    checkSnapshotStatus()
    
    // Check every 30 seconds
    const interval = setInterval(() => {
      checkSnapshotStatus()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [isAuthenticated, adminApiKey])

  // Handle collection change events from RegistrationsList
  useEffect(() => {
    const handleCollectionChange = (e: CustomEvent) => {
      setActiveCollectionId(e.detail)
    }
    window.addEventListener('changeCollection' as any, handleCollectionChange as any)
    return () => window.removeEventListener('changeCollection' as any, handleCollectionChange as any)
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
        
        // Save API key if provided in login form
        if (loginApiKey && loginApiKey.trim()) {
          try {
            localStorage.setItem('analytics:adminKey', loginApiKey)
            setAdminApiKey(loginApiKey)
          } catch {}
        }
        
        // Check if primary admin needs email setup
        if (data.user.isPrimary && !data.user.email) {
          setShowPrimaryEmailSetup(true)
        }
        
        // Check if admin API key is now set (either from login form or already saved)
        const apiKey = loginApiKey?.trim() || localStorage.getItem('analytics:adminKey')
        if (!apiKey) {
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
    setLoginApiKey('')
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
          ? `Data cleared successfully! ${clearedItems}. Please expect a slight delay for complete data erasure.` 
          : 'Data cleared successfully! Please expect a slight delay for complete data erasure.',
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
        adminUsers: false,
      })
      setShowClearDataModal(false)

      // Redirect to dashboard
      setActiveSection('dashboard')

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

  const handleFullFactoryReset = async () => {
    // Require both password and API key for factory reset
    if (!clearDataPassword || !clearDataApiKey) {
      showToast('Please enter both admin password and API key before factory reset', 'error')
      return
    }

    const confirmed = await confirm({
      title: 'Complete Factory Reset',
      message: '⚠️ This will DELETE EVERYTHING including all admin users, clubs, registrations, and settings. You will need to start from scratch with the default admin account (admin/admin123). This CANNOT be undone. Are you absolutely sure?',
      confirmText: 'DELETE EVERYTHING',
      cancelText: 'Cancel',
      variant: 'danger',
    })

    if (!confirmed) return

    setClearingData(true)
    try {
      const resp = await fetch('/api/admin/factory-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: clearDataPassword,
          adminApiKey: clearDataApiKey,
        }),
      })

      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data.error || 'Factory reset failed')
      }

      showToast(`✨ Complete factory reset successful! ${data.filesDeleted} files deleted. Redirecting to setup...`, 'success')
      
      // Clear all localStorage
      localStorage.clear()
      
      // Close modal
      setShowClearDataModal(false)
      
      // Redirect to setup page after 2 seconds
      setTimeout(() => {
        window.location.href = '/admin/setup'
      }, 2000)

    } catch (err: any) {
      showToast(err.message || 'Factory reset failed', 'error')
    } finally {
      setClearingData(false)
    }
  }

  const refreshData = async () => {
    // Skip if not authenticated yet
    if (!isAuthenticated) {
      console.log('Skipping refreshData: not authenticated')
      return
    }
    
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
    // Skip fetch if not authenticated or API key not set
    if (!isAuthenticated || !adminApiKey) {
      console.log(JSON.stringify({ 
        tag: 'fetch-updates', 
        step: 'skipped', 
        reason: !isAuthenticated ? 'not-authenticated' : 'no-api-key'
      }))
      return
    }

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
      
      const resp = await fetch(url, { 
        signal: controller.signal,
        headers: { 'x-admin-key': adminApiKey }
      })
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
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
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
        [id]: { ...(prev[id] || {}), deleted: true, _timestamp: Date.now() },
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
      const resp = await fetch(`/api/updates/${id}`, { 
        method: 'DELETE',
        headers: { 'x-admin-key': adminApiKey }
      })
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
      const timestamp = Date.now()
      if (action === 'delete') {
        ids.forEach(id => {
          newPending[id] = { ...(newPending[id] || {}), deleted: true, _timestamp: timestamp }
        })
      } else {
        const reviewedVal = action === 'review'
        ids.forEach(id => {
          newPending[id] = { ...(newPending[id] || {}), reviewed: reviewedVal, _timestamp: timestamp }
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
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
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
      const pendingTimestamp = pending._timestamp
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
      
      // SAFETY: Only auto-clear if confirmed by API OR older than 5 seconds
      const pendingTimestamp = pending._timestamp || 0
      const age = pendingTimestamp > 0 ? Date.now() - pendingTimestamp : Infinity
      const MIN_AGE_MS = 5000 // 5 seconds minimum before auto-clear
      
      const canAutoClear = confirmed || age >= MIN_AGE_MS

      console.log(JSON.stringify({ 
        tag: 'autoclear', 
        step: 'checking', 
        autoClearId,
        id,
        pending: { reviewed: pending.reviewed, deleted: pending.deleted },
        dbItem: dbItem ? { id: String(dbItem.id), reviewed: dbItem.reviewed } : null,
        age,
        canAutoClear,
        confirmed: confirmed ? { reviewed: confirmed.reviewed, timestamp: confirmed.timestamp } : null
      }))
      
      // Skip auto-clear if not confirmed and too recent
      if (!canAutoClear) {
        console.log(JSON.stringify({ 
          tag: 'autoclear', 
          step: 'skip-too-recent', 
          autoClearId, 
          id,
          age
        }))
        stillPendingIds.push(id)
        return
      }

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
  // CONSERVATIVE: Only clear if announcement matches DB AND is at least 3 seconds old
  useEffect(() => {
    if (!announcementsStorageLoaded) return
    const pendingCount = Object.keys(localPendingAnnouncements).filter(k => !k.endsWith('_timestamp')).length
    if (pendingCount === 0) return

    const now = Date.now()
    const MIN_AGE_BEFORE_CLEAR = 3000 // 3 seconds - gives Supabase time to propagate

    // Create a hash of current state to detect actual changes
    const stateHash = JSON.stringify({ announcements, localPendingAnnouncements })
    if (announcementsAutoClearcheckRef.current === stateHash) {
      // No change since last check - skip processing
      return
    }

    console.log('🔍 ANNOUNCEMENTS AUTO-CLEAR CHECK - Pending:', localPendingAnnouncements)
    console.log('🔍 Current announcements from DB:', announcements)

    const stillPending = { ...localPendingAnnouncements }
    let hasCleared = false

    Object.keys(stillPending).forEach(id => {
      // Skip timestamp keys
      if (id.endsWith('_timestamp')) return
      
      const pendingText = stillPending[id]
      const pendingTimestampRaw = stillPending[`${id}_timestamp`]
      const pendingTimestamp = typeof pendingTimestampRaw === 'number' ? pendingTimestampRaw : 0
      const age = pendingTimestamp > 0 ? now - pendingTimestamp : Infinity
      const dbText = announcements[id] || ''

      // Skip if too recent - still propagating to Supabase
      if (pendingTimestamp > 0 && age < MIN_AGE_BEFORE_CLEAR) {
        console.log(`⏳ Keeping announcement ${id} - too recent (age: ${age}ms)`)
        return
      }

      // If announcement text matches DB (including both being empty), clear it
      if (pendingText === dbText) {
        console.log(`✅ Clearing announcement ${id} - DB now matches ("${pendingText}")`)
        delete stillPending[id]
        delete stillPending[`${id}_timestamp`]
        hasCleared = true
      } else {
        console.log(`⏳ Keeping announcement ${id} - DB mismatch (pending: "${pendingText}", db: "${dbText}")`)
      }
    })

    // Only update state if something actually changed
    if (hasCleared) {
      const newPendingCount = Object.keys(stillPending).filter(k => !k.endsWith('_timestamp')).length
      // Ensure we're actually removing something (prevents state thrashing)
      if (newPendingCount < pendingCount) {
        console.log('📝 Updating announcements localStorage with remaining pending:', stillPending)
        setLocalPendingAnnouncements(stillPending)
        try {
          if (newPendingCount === 0) {
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
      }
    } else {
      console.log('ℹ️ No announcements to clear')
    }
    
    // Update hash after processing
    announcementsAutoClearcheckRef.current = stateHash
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
    // Skip if not authenticated yet
    if (!isAuthenticated) {
      console.log('Skipping fetchAnnouncements: not authenticated')
      return
    }

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
    const timestamp = Date.now()
    const newPending = { ...localPendingAnnouncements, [id]: text || '', [`${id}_timestamp`]: timestamp }
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
      const serverEnabled = data.announcementsEnabled !== false
      
      // Check if we have a pending optimistic update in localStorage
      // If localStorage differs from server, trust localStorage (optimistic update in progress)
      try {
        const localValue = localStorage.getItem('settings:announcementsEnabled')
        if (localValue !== null) {
          const localEnabled = localValue === 'true'
          // Only override with server value if they match (confirming the update completed)
          // Otherwise, keep the optimistic local value
          if (localEnabled !== serverEnabled) {
            console.log('[Settings] Using optimistic local value during sync:', localEnabled)
            setAnnouncementsEnabled(localEnabled)
            return // Don't overwrite localStorage with stale server data
          }
        }
      } catch (e) {}
      
      // No conflict - use server value as source of truth
      setAnnouncementsEnabled(serverEnabled)
      try {
        localStorage.setItem('settings:announcementsEnabled', String(serverEnabled))
      } catch (e) {}
    } catch (err) {
      console.error('Error fetching settings:', err)
    }
  }

  const toggleAnnouncements = async () => {
    try {
      setSavingSettings(true)
      
      // Capture the current value before toggling
      const currentValue = announcementsEnabled !== null ? announcementsEnabled : true
      const newValue = !currentValue
      
      // Optimistically update state and localStorage
      setAnnouncementsEnabled(newValue)
      try { 
        localStorage.setItem('settings:announcementsEnabled', String(newValue))
        // Dispatch event to notify ClubsList component
        window.dispatchEvent(new CustomEvent('announcements-updated', { detail: { settingsChanged: true } }))
        broadcast('announcements', 'update', { settingsChanged: true })
      } catch {}
      
      // Send update to server
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
      
      // Show correct message based on the NEW state
      showToast(`Announcements ${newValue ? 'enabled' : 'disabled'}`)
      
      // Refresh club data to apply changes
      await refreshData()
    } catch (err) {
      console.error('Error toggling announcements:', err)
      // Revert to previous value on error
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
      // Refresh snapshot status too
      await checkSnapshotStatus()
    } catch (err) {
      console.error('Error refreshing cache:', err)
      showToast(`Failed to refresh cache: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
    } finally {
      setRefreshingCache(false)
    }
  }

  const checkSnapshotStatus = async () => {
    try {
      if (!adminApiKey) return
      
      const resp = await fetch('/api/admin/snapshot-status', {
        method: 'GET',
        headers: {
          'x-admin-key': adminApiKey
        }
      })
      
      if (!resp.ok) {
        console.warn('Failed to check snapshot status')
        setCatalogStatus(null)
        return
      }
      
      const data = await resp.json()
      setCatalogStatus(data)
    } catch (err) {
      console.error('Error checking snapshot status:', err)
      setCatalogStatus(null)
    }
  }

  const publishSnapshotNow = async () => {
    try {
      setPublishingCatalog(true)
      
      const resp = await fetch('/api/admin/snapshot-status', {
        method: 'POST',
        headers: {
          'x-admin-key': adminApiKey,
          'Content-Type': 'application/json'
        }
      })
      
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to publish snapshot')
      }
      
      const data = await resp.json()
      showToast(`✅ Published ${data.snapshot.clubCount} clubs to catalog!`, 'success')
      
      // Refresh snapshot status and clear cache
      await checkSnapshotStatus()
      await refreshCache()
    } catch (err) {
      console.error('Error publishing snapshot:', err)
      showToast(`Failed to publish snapshot: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
    } finally {
      setPublishingCatalog(false)
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

  // ESC key handler for factory reset modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showClearDataModal) {
        setShowClearDataModal(false)
        setClearDataPassword('')
        setClearDataApiKey('')
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [showClearDataModal])

  // Handler to show publish reminder toast after registration actions
  const handleRegistrationActionComplete = () => {
    const newToast: Toast = {
      id: Date.now().toString(),
      type: 'info',
      message: 'Remember to Publish Catalog to make changes visible to the public'
    }
    setToasts(prev => [...prev, newToast])
  }

  // Early return replacement: render login form or authenticated content
  if (!isAuthenticated) {
    return (
      <>
        {/* In-panel page header (keeps login view consistent) */}
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
              Admin Panel
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Manage club information and settings.
            </p>
          </div>
        </div>
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
                    autoComplete="off"
                    name="admin-api-key-prompt"
                    data-lpignore="true"
                    data-form-type="other"
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
        {showPrimaryEmailSetup && (
          <>
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50" />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-3">
                    <Lock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Set Primary Admin Email
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Password reset requests will be sent to this email address. You can forward reset codes to other admins as needed.
                  </p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={primaryEmail}
                    onChange={(e) => setPrimaryEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && savePrimaryEmail()}
                    className="input-field"
                    placeholder="admin@example.com"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={savePrimaryEmail}
                    disabled={savingPrimaryEmail || !primaryEmail.trim()}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-lg transition-colors"
                  >
                    {savingPrimaryEmail ? 'Saving...' : 'Save Email'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
                  This is required for password recovery to work.
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

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setShowPasswordReset(true)
                setResetStep('request')
                setResetUsername(username.trim())
                setResetToken('')
                setNewPassword('')
                setConfirmPassword('')
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Forgot password?
            </button>
          </div>
        </form>

        <div className="mt-4">
          <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Admin API Key
          </label>
          <input
            type="password"
            id="apiKey"
            name="admin-api-key"
            value={loginApiKey}
            onChange={(e) => setLoginApiKey(e.target.value)}
            className="input-field"
            placeholder="Enter admin API key (optional)"
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Required for most admin operations. You can set this now or promptly after login.
          </p>
        </div>

        {isFirstTimeSetup && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>First-time setup:</strong> Default admin account will be created automatically. Use username: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">admin</code> and password: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">admin123</code>
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
              After logging in, you'll be prompted to set your email for password recovery, change the default password, and configure your admin API key.
            </p>
          </div>
        )}

        {/* Password Reset Modal (unauthenticated) */}
        {showPasswordReset && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Reset Admin Password
              </h3>

              {resetStep === 'request' ? (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Enter the username of the admin account to reset. A reset code will be emailed to the primary admin.
                    Keep this page open so you can paste the code.
                  </p>
                  <input
                    type="text"
                    placeholder="Admin username"
                    value={resetUsername}
                    onChange={(e) => setResetUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-4"
                  />
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowPasswordReset(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => requestPasswordReset()}
                      disabled={requestingReset || !resetUsername.trim()}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-md transition-colors"
                    >
                      {requestingReset ? 'Generating...' : 'Generate Reset Token'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Reset code
                      </label>
                    </div>
                    <input
                      type="text"
                      placeholder="Paste reset code"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Paste the reset code the primary admin emails you.
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Enter new password for <strong>{resetUsername}</strong>:
                  </p>
                  <input
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-3"
                  />
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-4"
                  />
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-600 dark:text-red-400 mb-4">
                      Passwords do not match
                    </p>
                  )}
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => {
                        setResetStep('request')
                        setResetToken('')
                        setNewPassword('')
                        setConfirmPassword('')
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => {
                        setShowPasswordReset(false)
                        setResetStep('request')
                        setResetToken('')
                        setNewPassword('')
                        setConfirmPassword('')
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => executePasswordReset()}
                      disabled={
                        resettingPassword ||
                        !newPassword.trim() ||
                        newPassword !== confirmPassword
                      }
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 rounded-md transition-colors"
                    >
                      {resettingPassword ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      </>
    )
  }
  // End of conditional authentication check - all hooks are called above regardless of auth state

  // Calculate registration stats for dashboard (pendingRegistrationsCount calculated in useEffect above)
  const approvedRegistrationsCount = 0
  const rejectedRegistrationsCount = 0
  
  // Handle section navigation
  const handleSectionChange = (section: string) => {
    if (section === 'clear-data') {
      // Open the Clear Data modal without changing section
      // Don't prefill API key - require manual entry for double authentication
      setShowClearDataModal(true)
      return
    }
    
    setActiveSection(section)
    if (section === 'registrations' && !activeCollectionId && collections.length > 0) {
      // Prioritize display collection when navigating to registrations
      const displayCol = collections.find(c => c.display)
      const enabledCol = collections.find(c => c.enabled)
      setActiveCollectionId(displayCol?.id || enabledCol?.id || collections[0].id)
    }
  }

  const getImportableCollections = () => {
    return collections.filter(collection => !collection.id.startsWith('temp-col-'))
  }

  // Helper to select Excel file and prompt for import mode
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return

    const file = e.target.files[0]
    if (!file.name.endsWith('.xlsx')) {
      showToast('Please upload an Excel (.xlsx) file', 'error')
      return
    }

    const importable = getImportableCollections()
    if (importable.length === 0) {
      showToast('No collections available for import', 'error')
      return
    }

    const defaultCollectionId = importable.some(col => col.id === activeCollectionId)
      ? activeCollectionId
      : importable[0].id

    if (!defaultCollectionId) {
      showToast('Select a collection to import into', 'error')
      return
    }

    setExcelImportCollectionId(defaultCollectionId)
    setPendingExcelFile(file)
    setShowExcelImportModal(true)
    e.target.value = ''
  }

  const executeExcelImport = async (mode: 'append' | 'replace') => {
    if (!pendingExcelFile) return

    const importable = getImportableCollections()
    const targetCollectionId = excelImportCollectionId || importable[0]?.id || null
    const targetCollection = importable.find(col => col.id === targetCollectionId)
    if (!targetCollectionId || !targetCollection) {
      showToast('Select a collection to import into', 'error')
      return
    }

    const confirmMessage = mode === 'replace'
      ? `Replace all existing registrations in "${targetCollection.name}" with data from "${pendingExcelFile.name}"? This cannot be undone.`
      : `Append registrations from "${pendingExcelFile.name}" into "${targetCollection.name}"?`

    const ok = await confirm({
      title: 'Confirm Excel Import',
      message: confirmMessage,
      confirmText: mode === 'replace' ? 'Replace' : 'Append',
      cancelText: 'Cancel',
      variant: mode === 'replace' ? 'danger' : 'primary',
    })

    if (!ok) return

    const file = pendingExcelFile
    setShowExcelImportModal(false)
    setPendingExcelFile(null)
    setExcelImportCollectionId(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('collectionId', targetCollectionId)
    formData.append('importMode', mode)

    try {
      setImportingExcel(true)
      logActivity({
        type: 'import',
        action: 'Excel Import Started',
        details: `Importing (${mode === 'replace' ? 'Replace' : 'Append'}) from ${file.name} into ${targetCollection.name}`,
        status: 'info',
        user: currentUser || undefined,
      })
      
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
      logActivity({
        type: 'import',
        action: 'Excel Import Completed',
        details: result.message || 'Import successful',
        status: 'success',
        user: currentUser || undefined,
      })
      
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
      logActivity({
        type: 'import',
        action: 'Excel Import Failed',
        details: String(error),
        status: 'error',
        user: currentUser || undefined,
      })
    } finally {
      setImportingExcel(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar Navigation */}
      <AdminSidebar 
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        pendingRegistrationsCount={pendingRegistrationsCount}
      />
      
      {/* Main Content Area */}
      <div className="flex-1">
        <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 pt-6 sm:pt-8 pb-8 max-w-full">
          {/* Route to different sections based on activeSection */}
          {activeSection === 'dashboard' && (
            <DashboardOverview
              clubs={clubs}
              collections={collections}
              catalogStatus={catalogStatus}
              onNavigate={handleSectionChange}
              pendingRegistrationsCount={pendingRegistrationsCount}
              approvedRegistrationsCount={approvedRegistrationsCount}
              rejectedRegistrationsCount={rejectedRegistrationsCount}
              adminApiKey={adminApiKey}
              setAdminApiKey={setAdminApiKey}
              saveAdminApiKey={saveAdminApiKey}
              refreshCache={refreshCache}
              refreshingCache={refreshingCache}
              publishSnapshotNow={publishSnapshotNow}
              publishingCatalog={publishingCatalog}
            />
          )}
          
          {activeSection === 'announcements' && (() => {
            // Merge announcements but filter out timestamp keys
            const merged: Record<string, string> = { ...announcements }
            Object.keys(localPendingAnnouncements).forEach(key => {
              if (!key.endsWith('_timestamp')) {
                const value = localPendingAnnouncements[key]
                if (typeof value === 'string') {
                  merged[key] = value
                }
              }
            })
            return (
              <AnnouncementsBoard
                clubs={clubs}
                announcements={merged}
                saveAnnouncement={saveAnnouncement}
                clearAnnouncement={clearAnnouncement}
                savingAnnouncements={savingAnnouncements}
                showToast={showToast}
                announcementsEnabled={announcementsEnabled}
                toggleAnnouncements={toggleAnnouncements}
                savingSettings={savingSettings}
              />
            )
          })()}
          
          {activeSection === 'activity' && (
            <ActivityLog />
          )}
          
          {activeSection === 'users' && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Users</h1>
                <button
                  onClick={() => {
                    setResetStep('request')
                    setResetUsername(currentUser || '')
                    setResetToken('')
                    setNewPassword('')
                    setConfirmPassword('')
                    setShowPasswordReset(true)
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                >
                  Change My Password
                </button>
              </div>
              <UserManagement currentUser={currentUser || ''} adminApiKey={adminApiKey} showToast={showToast} />
            </div>
          )}
          
          {activeSection === 'registrations' && (
            <div className="space-y-6">
              {/* Registration Collection Settings - Collapsible */}
              <div className="card p-6">
                <button
                  onClick={() => setIsCollectionsCollapsed(!isCollectionsCollapsed)}
                  className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity"
                >
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    Registration Collection Settings
                    <InfoTooltip text="Manage multiple registration form collections (e.g., different years). Select a collection to view its registrations below." />
                  </h2>
                  <ChevronDown className={`h-5 w-5 text-gray-600 dark:text-gray-400 transition-transform ${isCollectionsCollapsed ? '' : 'rotate-180'}`} />
                </button>

                {!isCollectionsCollapsed && (
                  <div className="mt-4">
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

                {/* Collections List */}
                <div className="space-y-3">
                  {collections.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-8">
                      No collections yet. Create one above to get started.
                    </p>
                  ) : (
                    collections
                      .map((collection) => {
                        const isDisplay = collection.display || (!collection.display && !collection.accepting && collection.enabled)
                        const isAccepting = collection.accepting ?? collection.enabled ?? false
                        const isRenewal = collection.renewalEnabled ?? false
                        
                        return (
                          <div
                            key={collection.id}
                            onClick={() => setActiveCollectionId(collection.id)}
                            className={`p-4 border rounded-lg cursor-pointer transition-all ${
                              activeCollectionId === collection.id
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-200 dark:ring-primary-800'
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
                                  onClick={async () => {
                                    const confirmed = await confirm({
                                      title: 'Delete Collection',
                                      message: `Delete collection "${collection.name}"? This cannot be undone.`,
                                      confirmText: 'Delete',
                                      variant: 'danger'
                                    })
                                    if (confirmed) {
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
                )}
              </div>

              {/* Registrations List */}
              {activeCollectionId ? (
                <div>
                  <div className="mb-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Club Registrations</h1>
                        <p className="text-gray-600 dark:text-gray-400">Review and manage club registration requests for the selected collection</p>
                      </div>
                      {/* Excel Import Button */}
                      <div className="flex-shrink-0">
                        <label className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg cursor-pointer transition-colors disabled:opacity-50" title="Upload an Excel file to import registrations">
                          <FileSpreadsheet className="h-4 w-4" />
                          <span className="text-sm font-medium">{importingExcel ? 'Importing...' : 'Import Excel'}</span>
                          <input
                            type="file"
                            accept=".xlsx"
                            onChange={handleExcelImport}
                            disabled={importingExcel || !activeCollectionId}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                  <RegistrationsList
                    collectionId={activeCollectionId}
                    collections={collections}
                    adminApiKey={adminApiKey}
                    collectionSlug={(() => {
                      return slugifyName(collections.find(c => c.id === activeCollectionId)?.name || '')
                    })()}
                    collectionName={(() => {
                      return collections.find(c => c.id === activeCollectionId)?.name || ''
                    })()}
                    onActionComplete={handleRegistrationActionComplete}
                  />
                </div>
              ) : (
                <div className="card p-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400">Select a collection above to view its registrations</p>
                </div>
              )}
            </div>
          )}
          
          {activeSection === 'updates' && (
            <UpdateRequestsPanel
              clubs={clubs}
              adminApiKey={adminApiKey}
            />
          )}
          
          {activeSection === 'analytics' && (
            <AnalyticsPanel
              clubs={clubs}
              collections={collections}
            />
          )}
        </div>
      </div>

      {/* Modals and Dialogs */}
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
              <UserManagement currentUser={currentUser!} adminApiKey={adminApiKey} showToast={showToast} />
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
                // Merge announcements but filter out timestamp keys
                const merged: Record<string, string> = { ...announcements }
                Object.keys(localPendingAnnouncements).forEach(key => {
                  if (!key.endsWith('_timestamp')) {
                    const value = localPendingAnnouncements[key]
                    if (typeof value === 'string') {
                      merged[key] = value
                    }
                  }
                })
                return (
              <AnnounceEditor
            clubs={clubs}
            announcements={merged}
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
            // Merge announcements but filter out timestamp keys
            const merged: Record<string, string> = { ...announcements }
            Object.keys(localPendingAnnouncements).forEach(key => {
              if (!key.endsWith('_timestamp')) {
                const value = localPendingAnnouncements[key]
                if (typeof value === 'string') {
                  merged[key] = value
                }
              }
            })
            return (
          <BulkDeleteAnnouncements
            clubs={clubs}
            announcements={merged}
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
                  if (id) await clearAnnouncement(id)
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
      {showRegistrations && activeCollectionId && (
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
                    {(() => {
                      const colId = activeCollectionId!
                      const collection = collections.find(c => c.id === colId)
                      const isAccepting = collection?.accepting ?? collection?.enabled ?? false
                      const isRenewalEnabled = collection?.renewalEnabled ?? false
                      const slug = slugifyName(collection?.name || '')
                      const origin = typeof window !== 'undefined' ? window.location.origin : ''
                      
                      return (
                        <>
                          {isAccepting && (
                            <div>
                              <span className="text-gray-500 dark:text-gray-500">Registration:</span> <a href={`${origin}/register-club?collection=${slug}`} target="_blank" className="text-primary-600 dark:text-primary-400 hover:underline">{origin}/register-club?collection={slug}</a>
                            </div>
                          )}
                          {isRenewalEnabled && (
                            <div>
                              <span className="text-gray-500 dark:text-gray-500">Renewal:</span> <a href={`${origin}/renew-club/${colId}`} target="_blank" className="text-primary-600 dark:text-primary-400 hover:underline">{origin}/renew-club/{colId}</a>
                            </div>
                          )}
                          {!isAccepting && !isRenewalEnabled && (
                            <div className="text-gray-500 dark:text-gray-500 italic">
                              No forms currently enabled for this collection
                            </div>
                          )}
                        </>
                      )
                    })()}
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
                {/* Collections Management (moved into Registrations modal) */}
                <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">Club Registration Collections</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Manage registration form collections for this modal. Public Catalog selects which collection appears in the directory. Registration and Renewal control submission availability.
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
                      {activeCollectionId?.startsWith('temp-col-') && (
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2 font-medium">
                          ⏳ Collection is being created... Please wait a moment before importing.
                        </p>
                      )}
                      <input
                        type="file"
                        accept=".xlsx"
                        disabled={importingExcel || activeCollectionId?.startsWith('temp-col-') || false}
                        onChange={handleExcelImport}
                        className="text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  )}

                  {/* Collections List */}
                  <div className="space-y-2 mb-4">
                    {(() => {
                      return collections.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">No collections yet. Create one above.</p>
                      ) : (
                        <>{collections.map((collection) => (
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
                                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Displayed</span>
                                        )}
                                        {isAccepting && (
                                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Accepting</span>
                                        )}
                                      </>
                                    )
                                  })()}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Created {new Date(collection.createdAt).toLocaleDateString()}</p>
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
                                      checked={collection.display || (!collection.display && !collection.accepting && collection.enabled)}
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
                                      checked={collection.accepting ?? collection.enabled ?? false}
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
                                      checked={collection.renewalEnabled ?? false}
                                      onChange={() => toggleCollectionRenewal(collection.id)}
                                      disabled={togglingCollection === collection.id}
                                    />
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditingCollectionId(collection.id); setEditingCollectionName(collection.name) }}
                                  className="mt-2 p-1.5 w-full text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded transition-colors text-xs font-medium"
                                  title="Edit collection name"
                                >
                                  <Edit3 className="h-4 w-4 inline mr-1" />
                                  Edit Collection
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteCollection(collection.id) }}
                                  className="mt-2 p-1.5 w-full text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors text-xs font-medium"
                                  title="Delete collection"
                                >
                                  <Trash2 className="h-4 w-4 inline mr-1" />
                                  Delete Collection
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}</>
                      )
                    })()}
                  </div>
                </div>

                <RegistrationsList 
                adminApiKey={adminApiKey} 
                collectionSlug={(() => {
                  const collection = collections.find(c => c.id === activeCollectionId)
                  return collection ? slugifyName(collection.name) : ''
                })()}
                collectionName={(() => {
                  const collection = collections.find(c => c.id === activeCollectionId)
                  return collection?.name || ''
                })()}
                collectionId={activeCollectionId || ''}
                collections={collections}
                onActionComplete={handleRegistrationActionComplete}
              />
            </div>
          </div>
        </>
      )}

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

            {/* Info note */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-800 dark:text-blue-300">
                <strong>Note:</strong> Both your admin password and API key must be entered for security verification. These will not be saved.
              </p>
            </div>

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
                    checked={clearOptions.adminUsers}
                    onChange={(e) => setClearOptions({ ...clearOptions, adminUsers: e.target.checked })}
                    disabled={clearingData}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-red-600 dark:text-red-400 font-semibold">Admin Users</div>
                    <div className="text-xs text-red-700 dark:text-red-300">⚠️ Delete all admin user accounts (requires re-setup)</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-4">
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

              {/* Factory Reset Option */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-900 dark:text-red-100 text-sm mb-1">
                        Complete Factory Reset
                      </h4>
                      <p className="text-xs text-red-700 dark:text-red-300 mb-2">
                        This will DELETE EVERYTHING including all admin users, clubs, registrations, settings, and data. 
                        You will start from scratch with default credentials (admin/admin123).
                      </p>
                      <p className="text-xs text-red-800 dark:text-red-200 font-semibold">
                        ⚠️ This action CANNOT be undone!
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleFullFactoryReset}
                    disabled={clearingData || !clearDataPassword || !clearDataApiKey}
                    className="w-full px-4 py-2 text-sm font-bold text-white bg-red-700 hover:bg-red-800 rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    FACTORY RESET - DELETE EVERYTHING
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Collection Modal */}
      {editingCollectionId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Edit Collection Name
            </h3>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Collection Name
              </label>
              <input
                type="text"
                value={editingCollectionName}
                onChange={(e) => setEditingCollectionName(e.target.value)}
                placeholder="Enter collection name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editingCollectionId) {
                    renameCollection(editingCollectionId, editingCollectionName)
                  } else if (e.key === 'Escape') {
                    setEditingCollectionId(null)
                    setEditingCollectionName('')
                  }
                }}
                autoFocus
                disabled={savingCollectionEdit}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setEditingCollectionId(null)
                  setEditingCollectionName('')
                }}
                disabled={savingCollectionEdit}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (editingCollectionId) {
                    renameCollection(editingCollectionId, editingCollectionName)
                  }
                }}
                disabled={savingCollectionEdit || !editingCollectionName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {savingCollectionEdit ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Edit3 className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Excel Import Mode Modal */}
      <Modal
        isOpen={showExcelImportModal}
        onClose={() => {
          setShowExcelImportModal(false)
          setPendingExcelFile(null)
          setExcelImportCollectionId(null)
        }}
        title="Import Excel"
        size="md"
      >
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Import into collection
            </label>
            <select
              value={excelImportCollectionId || ''}
              onChange={(e) => setExcelImportCollectionId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              {getImportableCollections().map(collection => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </div>
          <p>
            Choose how to import the Excel file into this collection.
          </p>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900/50">
            <p className="font-medium text-gray-900 dark:text-white">Append</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Keep existing registrations and add new ones from the file.</p>
          </div>
          <div className="rounded-lg border border-red-200 dark:border-red-700 p-3 bg-red-50 dark:bg-red-900/20">
            <p className="font-medium text-red-700 dark:text-red-300">Replace</p>
            <p className="text-xs text-red-600 dark:text-red-400">Delete all existing registrations in this collection before importing.</p>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setShowExcelImportModal(false)
              setPendingExcelFile(null)
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => executeExcelImport('append')}
            isLoading={importingExcel}
            disabled={!excelImportCollectionId}
          >
            Append
          </Button>
          <Button
            variant="danger"
            onClick={() => executeExcelImport('replace')}
            isLoading={importingExcel}
            disabled={!excelImportCollectionId}
          >
            Replace
          </Button>
        </div>
      </Modal>

      {/* Global Confirm Dialog */}
      {isOpen && options && (
        <ConfirmDialog
          {...options}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {/* Password Reset Modal */}
      {showPasswordReset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Reset Admin Password
            </h3>

            {resetStep === 'request' ? (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Enter the username of the admin account to reset. A reset code will be emailed to the primary admin.
                  Keep this page open so you can paste the code.
                </p>
                <input
                  type="text"
                  placeholder="Admin username"
                  value={resetUsername}
                  onChange={(e) => setResetUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-4"
                />
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowPasswordReset(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => requestPasswordReset()}
                    disabled={requestingReset || !resetUsername.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-md transition-colors"
                  >
                    {requestingReset ? 'Generating...' : 'Generate Reset Token'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Reset code
                    </label>
                    {resetToken.trim() && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(resetToken.trim())
                            showToast('Reset code copied')
                          } catch {
                            showToast('Copy failed. Please select and copy manually.', 'error')
                          }
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Copy code
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Paste reset code"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Paste the reset code the primary admin emails you.
                  </p>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Enter new password for <strong>{resetUsername}</strong>:
                </p>
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-3"
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-4"
                />
                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-600 dark:text-red-400 mb-4">
                    Passwords do not match
                  </p>
                )}
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setResetStep('request')
                      setResetToken('')
                      setNewPassword('')
                      setConfirmPassword('')
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      setShowPasswordReset(false)
                      setResetStep('request')
                      setResetToken('')
                      setNewPassword('')
                      setConfirmPassword('')
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => executePasswordReset()}
                    disabled={
                      resettingPassword ||
                      !newPassword.trim() ||
                      newPassword !== confirmPassword
                    }
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 rounded-md transition-colors"
                  >
                    {resettingPassword ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </>
            )}
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
  // All hooks must be called unconditionally at the top, before any returns
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

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
