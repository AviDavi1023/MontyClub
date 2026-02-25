'use client'

import { useState, useEffect } from 'react'
import { ClubRegistration } from '@/types/club'
import { FileSpreadsheet, Download, RefreshCw, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, X, Table as TableIcon, LayoutList, Filter, Search, AlertCircle } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui'
import { useConfirm } from '@/lib/hooks/useConfirm'

interface RegistrationsListProps {
  adminApiKey: string
  collectionSlug: string
  collectionName: string
  collectionId: string
  collections: Array<{ id: string; name: string; createdAt: string; accepting?: boolean; renewalEnabled?: boolean }>
  onActionComplete?: () => void
}

const CATEGORY_OPTIONS = [
  'Awareness',
  'Business',
  'Debate/Political',
  'Education',
  'Culture',
  'Performing Arts',
  'Cultural/Religious',
  'Service',
  'Social',
  'STEM',
  'Other',
]

export function RegistrationsList({ adminApiKey, collectionSlug, collectionName, collectionId, collections, onActionComplete }: RegistrationsListProps) {
  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm()
  const [registrations, setRegistrations] = useState<ClubRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showDenyModal, setShowDenyModal] = useState(false)
  const [denyReason, setDenyReason] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [currentReg, setCurrentReg] = useState<ClubRegistration | null>(null)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('montyclub:regViewMode') as 'cards' | 'table') || 'table'
    }
    return 'table'
  })
  const [showEditModal, setShowEditModal] = useState(false)
  const [editReg, setEditReg] = useState<ClubRegistration | null>(null)
  const [editFields, setEditFields] = useState<any>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'submitted' | 'name' | 'status' | 'category'>('submitted')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [advisorFilter, setAdvisorFilter] = useState<string>('')
  const [meetingDayFilter, setMeetingDayFilter] = useState<string>('')
  const [renewalSettings, setRenewalSettings] = useState<Record<string, { sourceCollections: string[] }>>({})
  const [loadingRenewalSettings, setLoadingRenewalSettings] = useState(true)
  const [savingRenewalSettings, setSavingRenewalSettings] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [undoAction, setUndoAction] = useState<{ type: string; data: any; timestamp: number } | null>(null)
  const [quickEditId, setQuickEditId] = useState<string | null>(null)
  const [quickEditFields, setQuickEditFields] = useState<{ clubName?: string; category?: string }>({})
  const [renewalChanges, setRenewalChanges] = useState<Record<string, any>>({}) // Store changed fields for renewals
  const [loadingRenewalChanges, setLoadingRenewalChanges] = useState<Record<string, boolean>>({})
    const openEditModal = (reg: ClubRegistration) => {
      setEditReg(reg)
      setEditFields({ ...reg })
      setShowEditModal(true)
    }

    const handleEditField = (field: string, value: any) => {
      setEditFields((prev: any) => ({ ...prev, [field]: value }))
    }

    const saveQuickEdit = async (reg: ClubRegistration) => {
      if (!quickEditId) return
      setProcessingId(reg.id)
      try {
        const response = await fetch('/api/registration-update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': adminApiKey
          },
          body: JSON.stringify({ 
            registrationId: reg.id, 
            collection: reg.collectionId, 
            updates: quickEditFields 
          })
        })
        if (!response.ok) throw new Error('Failed to update')
        setQuickEditId(null)
        setQuickEditFields({})
        await loadRegistrations()
        // Broadcast reload
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          try {
            const bc = new window.BroadcastChannel('clubDataSource')
            bc.postMessage('reload')
            bc.close()
          } catch {}
        }
      } catch (err) {
        alert('Failed to save changes')
      } finally {
        setProcessingId(null)
      }
    }

    const saveEdit = async () => {
      if (!editReg) return
      setProcessingId(editReg.id)
      try {
        const response = await fetch('/api/registration-update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': adminApiKey
          },
          body: JSON.stringify({ registrationId: editReg.id, collection: editReg.collectionId, updates: editFields })
        })
        if (!response.ok) throw new Error('Failed to update registration')
        setShowEditModal(false)
        setEditReg(null)
        setEditFields({})
        await loadRegistrations()
        // Broadcast to ClubsList to reload clubs
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          try {
            const bc = new window.BroadcastChannel('clubDataSource')
            bc.postMessage('reload')
            bc.close()
          } catch {}
        }
      } catch (err) {
        alert('Failed to update registration')
      } finally {
        setProcessingId(null)
      }
    }
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [localPendingRegistrationChanges, setLocalPendingRegistrationChanges] = useState<Record<string, { status?: string; denialReason?: string; deleted?: boolean }>>({})
  const [registrationStorageLoaded, setRegistrationStorageLoaded] = useState(false)
  const REGISTRATIONS_PENDING_KEY = 'montyclub:pendingRegistrationChanges'
  const REGISTRATIONS_BACKUP_KEY = 'montyclub:pendingRegistrationChanges:backup'
  const COLLECTIONS_PENDING_KEY = 'montyclub:pendingCollectionChanges'
  const [pendingCollectionsBySlug, setPendingCollectionsBySlug] = useState<Record<string, { created?: boolean; enabled?: boolean; name?: string }>>({})

  // Fetch and compare fields for renewal registrations
  const fetchRenewalChanges = async (renewalReg: ClubRegistration) => {
    if (!renewalReg.renewedFromId || loadingRenewalChanges[renewalReg.id]) return
    
    setLoadingRenewalChanges(prev => ({ ...prev, [renewalReg.id]: true }))
    
    try {
      // Fetch all clubs to find the original one
      const response = await fetch('/api/clubs')
      if (!response.ok) throw new Error('Failed to fetch clubs')
      const clubs = await response.json()
      
      // Find the original club by ID
      const originalClub = clubs.find((c: any) => c.id === renewalReg.renewedFromId)
      if (!originalClub) {
        setRenewalChanges(prev => ({ ...prev, [renewalReg.id]: null }))
        return
      }
      
      // Compare fields
      const changes: any = {}
      const fieldsToCompare = [
        { key: 'clubName', label: 'Club Name' },
        { key: 'category', label: 'Category' },
        { key: 'advisorName', label: 'Advisor' },
        { key: 'studentContactName', label: 'Student Contact Name' },
        { key: 'studentContactEmail', label: 'Student Contact Email' },
        { key: 'location', label: 'Location' },
        { key: 'meetingDay', label: 'Meeting Day' },
        { key: 'meetingFrequency', label: 'Meeting Frequency' },
        { key: 'socialMedia', label: 'Social Media' },
        { key: 'statementOfPurpose', label: 'Statement of Purpose' }
      ]
      
      fieldsToCompare.forEach(({ key, label }) => {
        const oldValue = originalClub[key] || ''
        const newValue = renewalReg[key as keyof ClubRegistration] || ''
        if (oldValue !== newValue) {
          changes[key] = { label, old: oldValue, new: newValue }
        }
      })
      
      setRenewalChanges(prev => ({ ...prev, [renewalReg.id]: changes }))
    } catch (err) {
      console.error('Error fetching renewal changes:', err)
      setRenewalChanges(prev => ({ ...prev, [renewalReg.id]: null }))
    } finally {
      setLoadingRenewalChanges(prev => ({ ...prev, [renewalReg.id]: false }))
    }
  }

  const loadRegistrations = async () => {
    if (!collectionSlug) return
    setLoading(true)
    setError('')
    try {
      const url = `/api/club-registration?collection=${encodeURIComponent(collectionSlug)}`
        
      const response = await fetch(url, {
        headers: {
          'x-admin-key': adminApiKey
        }
      })

      if (!response.ok) {
        // For 404, might be a newly created collection - still treat as empty registrations
        // but let the retry logic in the API handle eventual consistency
        if (response.status === 404) {
          setRegistrations([])
          return
        }
        throw new Error('Failed to load registrations')
      }

      const data = await response.json()
      // Keep registrations as pure server snapshot
      // localPendingRegistrationChanges will overlay at render time
      setRegistrations(data.registrations || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load registrations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (adminApiKey && collectionSlug) {
      loadRegistrations()
    }
  }, [adminApiKey, collectionSlug, pendingCollectionsBySlug])

  // Load renewal settings
  useEffect(() => {
    const loadRenewalSettings = async () => {
      setLoadingRenewalSettings(true)
      try {
        const response = await fetch('/api/renewal-settings')
        if (response.ok) {
          const data = await response.json()
          setRenewalSettings(data)
          
          // Auto-select most recent other collection if no sources configured for this collection
          const currentSettings = data[collectionId]
          if (!currentSettings || !currentSettings.sourceCollections || currentSettings.sourceCollections.length === 0) {
            // Find the most recent other collection (excluding current)
            const otherCollections = collections
              .filter(c => c.id !== collectionId)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            
            if (otherCollections.length > 0) {
              // Auto-select the most recent collection
              const mostRecentId = otherCollections[0].id
              const updatedSettings = {
                ...data,
                [collectionId]: { sourceCollections: [mostRecentId] }
              }
              
              // Save the auto-selected collection
              try {
                const saveResponse = await fetch('/api/renewal-settings', {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': adminApiKey
                  },
                  body: JSON.stringify(updatedSettings)
                })
                if (saveResponse.ok) {
                  const updated = await saveResponse.json()
                  setRenewalSettings(updated)
                }
              } catch (err) {
                console.error('Failed to auto-select collection:', err)
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load renewal settings:', err)
      } finally {
        setLoadingRenewalSettings(false)
      }
    }
    loadRenewalSettings()
  }, [collectionId, collections, adminApiKey])

  const saveRenewalSettings = async (collectionId: string, sourceCollections: string[]) => {
    // OPTIMISTIC: Update UI immediately, sync in background
    const updatedSettings = {
      ...renewalSettings,
      [collectionId]: { sourceCollections }
    }
    setRenewalSettings(updatedSettings)
    setSavingRenewalSettings(true)
    
    try {
      const response = await fetch('/api/renewal-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify(updatedSettings)
      })
      if (!response.ok) {
        throw new Error('Failed to save')
      }
      // Verify server response matches what we sent
      const serverData = await response.json()
      // Update with server response to ensure consistency
      setRenewalSettings(serverData)
    } catch (err) {
      // Revert to previous state on error
      // The updatedSettings is already shown, so user can retry
      alert('Failed to save renewal settings: ' + String(err))
      // Refresh from server to get correct state
      try {
        const resp = await fetch('/api/renewal-settings')
        if (resp.ok) {
          const data = await resp.json()
          setRenewalSettings(data)
        }
      } catch {}
    } finally {
      setSavingRenewalSettings(false)
    }
  }

  const toggleRenewalSourceCollection = (sourceCollectionId: string) => {
    const currentSettings = renewalSettings[collectionId] || { sourceCollections: [] }
    const currentSources = currentSettings.sourceCollections || []
    const newSources = currentSources.includes(sourceCollectionId)
      ? currentSources.filter(id => id !== sourceCollectionId)
      : [...currentSources, sourceCollectionId]
    saveRenewalSettings(collectionId, newSources)
  }

  // Load pending registration changes from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      // Load pending collections and index by ID to slug mapping
      // This is just for tracking if a collection was recently created
      try {
        const raw = localStorage.getItem(COLLECTIONS_PENDING_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, any>
          const bySlug: Record<string, { created?: boolean; enabled?: boolean; name?: string }> = {}
          // Index by collection ID to extract pending metadata
          Object.entries(parsed || {}).forEach(([id, v]) => {
            if (!v || typeof v !== 'object') return
            // For created collections, use the temp ID as the key for now
            // Will be cleared when the real server collection arrives
            bySlug[id] = v
          })
          setPendingCollectionsBySlug(bySlug)
        }
      } catch {}
      const primary = localStorage.getItem(REGISTRATIONS_PENDING_KEY)
      if (primary) {
        const parsed = JSON.parse(primary)
        if (parsed && typeof parsed === 'object') setLocalPendingRegistrationChanges(parsed)
      } else {
        const backup = localStorage.getItem(REGISTRATIONS_BACKUP_KEY)
        if (backup) {
          try {
            const bp = JSON.parse(backup)
            if (bp && bp.data) setLocalPendingRegistrationChanges(bp.data)
          } catch {}
        }
      }
    } catch {}
    finally {
      setRegistrationStorageLoaded(true)
    }
  }, [])

  // Redundant persistence for registrations
  useEffect(() => {
    if (!registrationStorageLoaded) return
    try {
      if (Object.keys(localPendingRegistrationChanges).length === 0) {
        localStorage.removeItem(REGISTRATIONS_PENDING_KEY)
        localStorage.removeItem(REGISTRATIONS_BACKUP_KEY)
      } else {
        const serialized = JSON.stringify(localPendingRegistrationChanges)
        localStorage.setItem(REGISTRATIONS_PENDING_KEY, serialized)
        localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: localPendingRegistrationChanges }))
      }
    } catch (e) {}
  }, [localPendingRegistrationChanges, registrationStorageLoaded])

  // Auto-clear pending registration changes that now match database state
  useEffect(() => {
    const autoClearId = `reg-autoclear-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    
    if (!registrationStorageLoaded) {
      console.log(JSON.stringify({ tag: 'reg-autoclear', step: 'skip-not-loaded', autoClearId }))
      return
    }
    if (Object.keys(localPendingRegistrationChanges).length === 0) {
      console.log(JSON.stringify({ tag: 'reg-autoclear', step: 'skip-no-pending', autoClearId }))
      return
    }

    console.log(JSON.stringify({ 
      tag: 'reg-autoclear', 
      step: 'start', 
      autoClearId,
      pendingIds: Object.keys(localPendingRegistrationChanges),
      pendingDetails: Object.entries(localPendingRegistrationChanges).map(([id, p]) => ({ id, ...p })),
      registrationsCount: registrations.length,
      registrationsDetails: registrations.map((r: any) => ({ id: r.id, status: r.status }))
    }))

    const stillPending = { ...localPendingRegistrationChanges }
    let hasCleared = false
    const clearedIds: string[] = []
    const stillPendingIds: string[] = []

    Object.keys(stillPending).forEach(id => {
      const pending = stillPending[id]
      const dbItem = registrations.find(r => r.id === id)

      console.log(JSON.stringify({ 
        tag: 'reg-autoclear', 
        step: 'checking', 
        autoClearId,
        id,
        pending: { status: pending.status, deleted: pending.deleted },
        dbItem: dbItem ? { id: dbItem.id, status: dbItem.status } : null
      }))

      // If marked deleted locally but no longer exists in DB, clear it
      if (pending.deleted && !dbItem) {
        console.log(JSON.stringify({ tag: 'reg-autoclear', step: 'clear-deleted', autoClearId, id }))
        delete stillPending[id]
        hasCleared = true
        clearedIds.push(id)
      }
      // If status matches DB, clear it
      else if (dbItem && pending.status !== undefined && dbItem.status === pending.status) {
        console.log(JSON.stringify({ 
          tag: 'reg-autoclear', 
          step: 'clear-match', 
          autoClearId, 
          id,
          status: pending.status
        }))
        delete stillPending[id]
        hasCleared = true
        clearedIds.push(id)
      } else {
        console.log(JSON.stringify({ 
          tag: 'reg-autoclear', 
          step: 'still-pending', 
          autoClearId, 
          id,
          pendingStatus: pending.status,
          dbStatus: dbItem?.status,
          match: dbItem && pending.status !== undefined ? pending.status === dbItem.status : false
        }))
        stillPendingIds.push(id)
      }
    })

    if (hasCleared) {
      console.log(JSON.stringify({ 
        tag: 'reg-autoclear', 
        step: 'updating-state', 
        autoClearId,
        clearedIds,
        stillPendingIds,
        remainingCount: Object.keys(stillPending).length
      }))
      
      setLocalPendingRegistrationChanges(stillPending)
      try {
        if (Object.keys(stillPending).length === 0) {
          localStorage.removeItem(REGISTRATIONS_PENDING_KEY)
          localStorage.removeItem(REGISTRATIONS_BACKUP_KEY)
          console.log(JSON.stringify({ tag: 'reg-autoclear', step: 'localStorage-cleared', autoClearId }))
        } else {
          localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(stillPending))
          localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: stillPending }))
          console.log(JSON.stringify({ 
            tag: 'reg-autoclear', 
            step: 'localStorage-updated', 
            autoClearId,
            remainingIds: Object.keys(stillPending)
          }))
        }
      } catch (e) {
        console.error(JSON.stringify({ tag: 'reg-autoclear', step: 'localStorage-error', autoClearId, error: String(e) }))
      }
    } else {
      console.log(JSON.stringify({ 
        tag: 'reg-autoclear', 
        step: 'no-changes', 
        autoClearId,
        stillPendingIds
      }))
    }
  }, [registrations, localPendingRegistrationChanges, registrationStorageLoaded])

  // Save view mode preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('montyclub:regViewMode', viewMode)
    }
  }, [viewMode])

  // Scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Merge server registrations with local pending changes
  const registrationsOverlayed = registrations.map(reg => {
    const pending = localPendingRegistrationChanges[reg.id]
    if (!pending) return reg
    const overlayed: ClubRegistration = {
      ...reg,
      status: (pending.status !== undefined ? pending.status : reg.status) as 'pending' | 'approved' | 'rejected',
      denialReason: pending.denialReason !== undefined ? pending.denialReason : reg.denialReason
    }
    return overlayed
  }).filter(reg => !localPendingRegistrationChanges[reg.id]?.deleted)

  // Get unique values for filters
  const uniqueCategories = Array.from(new Set(registrationsOverlayed.map(r => r.category).filter(Boolean))).sort()
  const uniqueAdvisors = Array.from(new Set(registrationsOverlayed.map(r => r.advisorName).filter(Boolean))).sort()
  const uniqueMeetingDays = Array.from(new Set(registrationsOverlayed.map(r => r.meetingDay).filter(Boolean))).sort()

  // Duplicate detection: Find registrations with similar club names IN THE SAME COLLECTION
  const detectDuplicates = (clubName: string, currentId: string, currentCollectionId: string) => {
    const normalized = clubName.toLowerCase().trim()
    const duplicates = registrationsOverlayed.filter(r => 
      r.id !== currentId && 
      r.collectionId === currentCollectionId && // Only check within same collection
      (r.clubName.toLowerCase().trim().includes(normalized) || 
      normalized.includes(r.clubName.toLowerCase().trim()))
    )
    return duplicates.length > 0 ? duplicates : null
  }

  // Filter and sort registrations with enhanced search (matching main page algorithm)
  const filtered = registrationsOverlayed.filter(reg => {
    // Enhanced search filter (matches main page algorithm)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase().trim()
      const fields = [
        reg.clubName,
        reg.category,
        reg.advisorName,
        reg.studentContactName,
        reg.studentContactEmail,
        reg.email,
        reg.statementOfPurpose,
        reg.location,
        reg.meetingDay,
        reg.meetingFrequency,
      ]
      const haystack = fields.map(f => (f || '').toLowerCase()).join(' ').replace(/\s+/g, ' ').trim()
      if (!haystack.includes(searchLower)) return false
    }

    // Category filter
    if (categoryFilter && reg.category !== categoryFilter) return false

    // Advisor filter
    if (advisorFilter && reg.advisorName !== advisorFilter) return false

    // Meeting day filter
    if (meetingDayFilter && reg.meetingDay !== meetingDayFilter) return false

    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    let comparison = 0
    switch (sortBy) {
      case 'name':
        comparison = a.clubName.localeCompare(b.clubName)
        break
      case 'category':
        comparison = (a.category || '').localeCompare(b.category || '')
        break
      case 'status':
        comparison = a.status.localeCompare(b.status)
        break
      case 'submitted':
      default:
        comparison = new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    }
    return sortDirection === 'asc' ? comparison : -comparison
  })

  // Apply status filter
  const visible = sorted.filter(reg => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'pending') return reg.status === 'pending'
    if (statusFilter === 'approved') return reg.status === 'approved'
    if (statusFilter === 'rejected') return reg.status === 'rejected'
    return true
  })

  const handleApprove = async (reg: ClubRegistration) => {
    const confirmed = await confirm({
      title: 'Approve Registration',
      message: `Approve "${reg.clubName}"?`,
      confirmText: 'Approve',
      variant: 'primary'
    })
    if (!confirmed) return

    const operationId = `approve-${reg.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    console.log(JSON.stringify({ 
      tag: 'registration-approve', 
      step: 'start', 
      operationId, 
      registrationId: reg.id,
      currentPendingIds: Object.keys(localPendingRegistrationChanges)
    }))

    setProcessingId(reg.id)

    // Use functional update to avoid stale closures
    setLocalPendingRegistrationChanges(prev => {
      const newPending = { ...prev, [reg.id]: { status: 'approved' } }
      console.log(JSON.stringify({ 
        tag: 'registration-approve', 
        step: 'pending-set', 
        operationId, 
        registrationId: reg.id,
        allPendingIds: Object.keys(newPending)
      }))
      try {
        localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(newPending))
        localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
      } catch (e) {
        console.error(JSON.stringify({ 
          tag: 'registration-approve', 
          step: 'localStorage-error', 
          operationId, 
          error: String(e) 
        }))
      }
      return newPending
    })

    try {
      console.log(JSON.stringify({ 
        tag: 'registration-approve', 
        step: 'api-call-start', 
        operationId, 
        registrationId: reg.id 
      }))
      const apiStartTime = Date.now()
      const response = await fetch('/api/registration-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify({
          registrationId: reg.id,
          collection: reg.collectionId
        })
      })
      const apiDuration = Date.now() - apiStartTime
      console.log(JSON.stringify({ 
        tag: 'registration-approve', 
        step: 'api-call-complete', 
        operationId, 
        registrationId: reg.id,
        status: response.status,
        duration: apiDuration
      }))

      if (!response.ok) {
        throw new Error('Failed to approve registration')
      }

      console.log(JSON.stringify({ 
        tag: 'registration-approve', 
        step: 'api-success', 
        operationId, 
        registrationId: reg.id 
      }))

      // Success: show undo toast
      setUndoAction({ type: 'approve', data: reg, timestamp: Date.now() })
      setTimeout(() => setUndoAction(null), 5000)
      
      // Trigger parent callback for publish reminder
      onActionComplete?.()
      
      console.log(JSON.stringify({ 
        tag: 'registration-approve', 
        step: 'load-registrations-start', 
        operationId 
      }))
      await loadRegistrations()
      console.log(JSON.stringify({ 
        tag: 'registration-approve', 
        step: 'load-registrations-complete', 
        operationId 
      }))
      // Broadcast to ClubsList to reload clubs
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const bc = new window.BroadcastChannel('clubDataSource')
          bc.postMessage('reload')
          bc.close()
        } catch {}
      }
    } catch (err: any) {
      console.error(JSON.stringify({ 
        tag: 'registration-approve', 
        step: 'api-error', 
        operationId, 
        registrationId: reg.id,
        error: String(err) 
      }))
      // Revert on error using functional update
      setLocalPendingRegistrationChanges(prev => {
        const revertPending = { ...prev }
        delete revertPending[reg.id]
        console.log(JSON.stringify({ 
          tag: 'registration-approve', 
          step: 'revert-pending', 
          operationId, 
          registrationId: reg.id 
        }))
        try {
          if (Object.keys(revertPending).length === 0) {
            localStorage.removeItem(REGISTRATIONS_PENDING_KEY)
            localStorage.removeItem(REGISTRATIONS_BACKUP_KEY)
          } else {
            localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(revertPending))
            localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: revertPending }))
          }
        } catch (e) {
          console.error(JSON.stringify({ 
            tag: 'registration-approve', 
            step: 'revert-localStorage-error', 
            operationId, 
            error: String(e) 
          }))
        }
        return revertPending
      })
      alert(err.message || 'Failed to approve registration')
    } finally {
      setProcessingId(null)
      console.log(JSON.stringify({ 
        tag: 'registration-approve', 
        step: 'complete', 
        operationId, 
        registrationId: reg.id 
      }))
    }
  }

  const handleDeny = (reg: ClubRegistration) => {
    setCurrentReg(reg)
    setDenyReason('')
    setShowDenyModal(true)
  }

  const handleDelete = async (reg: ClubRegistration) => {
    const confirmed = await confirm({
      title: 'Delete Registration',
      message: `Delete "${reg.clubName}"? This cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger'
    })
    if (!confirmed) return

    setProcessingId(reg.id)

    setLocalPendingRegistrationChanges(prev => {
      const newPending = { ...prev, [reg.id]: { deleted: true } }
      try {
        localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(newPending))
        localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
      } catch (e) {}
      return newPending
    })

    try {
      const response = await fetch('/api/registration-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify({
          registrationId: reg.id,
          collection: reg.collectionId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to delete registration')
      }

      setUndoAction({ type: 'delete', data: reg, timestamp: Date.now() })
      setTimeout(() => setUndoAction(null), 5000)
      await loadRegistrations()
    } catch (err: any) {
      setLocalPendingRegistrationChanges(prev => {
        const revertPending = { ...prev }
        delete revertPending[reg.id]
        try {
          if (Object.keys(revertPending).length === 0) {
            localStorage.removeItem(REGISTRATIONS_PENDING_KEY)
            localStorage.removeItem(REGISTRATIONS_BACKUP_KEY)
          } else {
            localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(revertPending))
            localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: revertPending }))
          }
        } catch (e) {}
        return revertPending
      })
      alert(err.message || 'Failed to delete registration')
    } finally {
      setProcessingId(null)
    }
  }

  const confirmDeny = async () => {
    if (!currentReg) return

    setProcessingId(currentReg.id)
    setShowDenyModal(false)

    // Use functional update to avoid stale closures
    setLocalPendingRegistrationChanges(prev => {
      const newPending = { ...prev, [currentReg.id]: { status: 'rejected', denialReason: denyReason } }
      try {
        localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(newPending))
        localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
      } catch (e) {
        // Ignore localStorage errors
      }
      return newPending
    })

    try {
      const response = await fetch('/api/registration-deny', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify({
          registrationId: currentReg.id,
          collection: currentReg.collectionId,
          reason: denyReason
        })
      })

      if (!response.ok) {
        throw new Error('Failed to deny registration')
      }

      // Success: show undo toast
      setUndoAction({ type: 'deny', data: currentReg, timestamp: Date.now() })
      setTimeout(() => setUndoAction(null), 5000)
      
      // Trigger parent callback for publish reminder
      onActionComplete?.()
      
      await loadRegistrations()
    } catch (err: any) {
      // Revert on error using functional update
      setLocalPendingRegistrationChanges(prev => {
        const revertPending = { ...prev }
        delete revertPending[currentReg.id]
        try {
          if (Object.keys(revertPending).length === 0) {
            localStorage.removeItem(REGISTRATIONS_PENDING_KEY)
            localStorage.removeItem(REGISTRATIONS_BACKUP_KEY)
          } else {
            localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(revertPending))
            localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: revertPending }))
          }
        } catch (e) {
          // Ignore localStorage errors
        }
        return revertPending
      })
      alert(err.message || 'Failed to deny registration')
    } finally {
      setProcessingId(null)
      setCurrentReg(null)
      setDenyReason('')
    }
  }

  const exportToCSV = () => {
    if (visible.length === 0) return

    const headers = [
      'ID',
      'Collection',
      'Submitted At',
      'Status',
      'Email',
      'Club Name',
      'Advisor Name',
      'Statement of Purpose',
      'Location',
      'Meeting Day',
      'Meeting Frequency',
      'Student Contact Name',
      'Student Contact Email',
      'Advisor Agreement Date',
      'Club Agreement Date',
      'Denial Reason'
    ]

    const rows = visible.map(reg => [
      reg.id,
      reg.collectionId || '',
      new Date(reg.submittedAt).toLocaleString(),
      reg.status,
      reg.email,
      reg.clubName,
      reg.advisorName,
      reg.statementOfPurpose.replace(/"/g, '""'), // Escape quotes
      reg.location,
      reg.meetingDay,
      reg.meetingFrequency,
      reg.studentContactName,
      reg.studentContactEmail,
      reg.advisorAgreementDate,
      reg.clubAgreementDate,
      reg.denialReason || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    const filterSuffix = statusFilter !== 'all' ? `-${statusFilter}` : ''
    const filename = `club-registrations-${collectionName.toLowerCase().replace(/\s+/g, '-')}${filterSuffix}-${new Date().toISOString().split('T')[0]}.csv`
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleColumnSort = (column: 'submitted' | 'name' | 'status' | 'category') => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDirection('desc')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
      default:
        return <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium'
    switch (status) {
      case 'approved':
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400`
      case 'rejected':
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400`
      default:
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400`
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Skeleton for stats dashboard */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
            </div>
          ))}
        </div>
        
        {/* Skeleton for search bar */}
        <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
        
        {/* Skeleton for filter buttons */}
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-10 w-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
          ))}
        </div>
        
        {/* Skeleton for table/cards */}
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-24 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  // Get accepting/renewal status from collections
  const currentCollection = collections.find(c => c.id === collectionId)
  const accepting = currentCollection?.accepting ?? false
  const renewalEnabled = currentCollection?.renewalEnabled ?? false

  return (
    <div className="space-y-4">
      {/* Renewal Settings Section - Only show if renewal is enabled */}
      {renewalEnabled && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Club Charter Renewal Settings</h4>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
          Configure which collection(s) clubs can renew from. Users with the renewal link for this collection can select clubs from the checked collections below.
        </p>
        {loadingRenewalSettings ? (
          <div className="text-xs text-gray-500 dark:text-gray-400">Loading settings...</div>
        ) : (
          <div className="space-y-2">
            {collections.filter(c => c.id !== collectionId).map(collection => {
              const currentSettings = renewalSettings[collectionId] || { sourceCollections: [] }
              const isSource = currentSettings.sourceCollections.includes(collection.id)
              return (
                <label key={collection.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isSource}
                    onChange={() => toggleRenewalSourceCollection(collection.id)}
                    disabled={savingRenewalSettings}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">{collection.name}</span>
                </label>
              )
            })}
            {collections.filter(c => c.id !== collectionId).length === 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 italic">No other collections available as renewal sources.</div>
            )}
            {savingRenewalSettings && (
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">Saving...</div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Search and Controls */}
      <div className="space-y-4">
        {/* Header with Refresh Button */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Registrations</h3>
          <button
            onClick={() => loadRegistrations()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
            title="Refresh registrations"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-600 dark:text-gray-400 font-medium uppercase tracking-wide">Total</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {registrations.filter(r => !localPendingRegistrationChanges[r.id]?.deleted).length}
            </div>
          </div>
          <div className="p-3 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
            <div className="text-xs text-yellow-700 dark:text-yellow-400 font-medium uppercase tracking-wide">Pending</div>
            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300 mt-1">
              {registrations.filter(r => !localPendingRegistrationChanges[r.id]?.deleted && r.status === 'pending').length}
            </div>
          </div>
          <div className="p-3 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg border border-green-200 dark:border-green-700">
            <div className="text-xs text-green-700 dark:text-green-400 font-medium uppercase tracking-wide">Approved</div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
              {registrations.filter(r => !localPendingRegistrationChanges[r.id]?.deleted && r.status === 'approved').length}
            </div>
          </div>
          <div className="p-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg border border-red-200 dark:border-red-700">
            <div className="text-xs text-red-700 dark:text-red-400 font-medium uppercase tracking-wide">Denied</div>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">
              {registrations.filter(r => !localPendingRegistrationChanges[r.id]?.deleted && r.status === 'rejected').length}
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search by club name, category, advisor, student..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            All ({registrations.filter(r => !localPendingRegistrationChanges[r.id]?.deleted).length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              statusFilter === 'pending'
                ? 'bg-yellow-600 dark:bg-yellow-500 text-white shadow-sm'
                : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700'
            }`}
          >
            <Clock className="h-4 w-4" />
            Pending ({registrations.filter(r => !localPendingRegistrationChanges[r.id]?.deleted && r.status === 'pending').length})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              statusFilter === 'approved'
                ? 'bg-green-600 dark:bg-green-500 text-white shadow-sm'
                : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-700'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            Approved ({registrations.filter(r => !localPendingRegistrationChanges[r.id]?.deleted && r.status === 'approved').length})
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              statusFilter === 'rejected'
                ? 'bg-red-600 dark:bg-red-500 text-white shadow-sm'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-700'
            }`}
          >
            <XCircle className="h-4 w-4" />
            Denied ({registrations.filter(r => !localPendingRegistrationChanges[r.id]?.deleted && r.status === 'rejected').length})
          </button>
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <option value="">All Categories</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={advisorFilter}
            onChange={(e) => setAdvisorFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <option value="">All Advisors</option>
            {uniqueAdvisors.map(adv => (
              <option key={adv} value={adv}>{adv}</option>
            ))}
          </select>
          <select
            value={meetingDayFilter}
            onChange={(e) => setMeetingDayFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <option value="">All Meeting Days</option>
            {uniqueMeetingDays.map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
          {(categoryFilter || advisorFilter || meetingDayFilter) && (
            <button
              onClick={() => {
                setCategoryFilter('')
                setAdvisorFilter('')
                setMeetingDayFilter('')
              }}
              className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-1"
              title="Clear all filters"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span>Showing <span className="font-semibold text-gray-900 dark:text-white">{visible.length}</span> of <span className="font-semibold text-gray-900 dark:text-white">{registrations.filter(r => !localPendingRegistrationChanges[r.id]?.deleted).length}</span></span>
          </div>
          {visible.length > 0 && (
            <button
              onClick={() => {
                if (selectedIds.size === visible.length) {
                  setSelectedIds(new Set())
                } else {
                  setSelectedIds(new Set(visible.map(r => r.id)))
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedIds.size === visible.length && visible.length > 0}
                onChange={() => {}}
                className="rounded border-gray-300 dark:border-gray-600 pointer-events-none"
              />
              {selectedIds.size === visible.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <option value="submitted">Newest First</option>
            <option value="name">Club Name (A-Z)</option>
            <option value="category">Category (A-Z)</option>
            <option value="status">Status</option>
          </select>
          
          {/* View Toggle */}
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden bg-white dark:bg-gray-700">
            <button
              className={`px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1 ${
                viewMode === 'cards'
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
              onClick={() => setViewMode('cards')}
              title="Cards View"
            >
              <LayoutList className="h-4 w-4" /> Cards
            </button>
            <div className="w-px bg-gray-300 dark:bg-gray-600"></div>
            <button
              className={`px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1 ${
                viewMode === 'table'
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <TableIcon className="h-4 w-4" /> Table
            </button>
          </div>

          {/* Refresh button */}
          <button
            onClick={loadRegistrations}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>

          {/* Export CSV button */}
          <button
            onClick={exportToCSV}
            disabled={visible.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Bulk Actions Row removed; using sticky bottom bar to avoid layout shift */}

      {visible.length === 0 ? (
        <div className="text-center py-16 px-4 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 mb-4">
            <FileSpreadsheet className="h-8 w-8 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">No registrations found</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            {statusFilter === 'all' && searchTerm ? 'Try adjusting your search' : 'Change your filter or check back later'}
          </p>
        </div>
      ) : (
        <>
          {viewMode === 'table' ? (
            <div className="w-full overflow-x-auto overflow-y-hidden rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <table className="table-fixed divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900 w-full" style={{ minWidth: '1100px' }}>
                <colgroup>
                  <col style={{ width: '40px' }} />
                  <col style={{ width: '70px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '95px' }} />
                  <col style={{ width: '150px' }} />
                  <col style={{ width: '140px' }} />
                  <col style={{ width: '85px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '95px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '80px' }} />
                  <col style={{ width: '80px' }} />
                </colgroup>
                <thead className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-1.5 py-2 text-left">
                      <input 
                        type="checkbox" 
                        aria-label="Select all" 
                        onChange={(e)=>{
                          if (e.target.checked) setSelectedIds(new Set(visible.map(r=>r.id)))
                          else setSelectedIds(new Set())
                        }} 
                        checked={visible.length>0 && selectedIds.size===visible.length}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                    </th>
                    <th 
                      className="pl-1 pr-0.5 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => handleColumnSort('status')}
                    >
                      <div className="flex items-center gap-1">
                        Status
                        {sortBy === 'status' && (
                          <span className="text-primary-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-1.5 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    <th 
                      className="px-1.5 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => handleColumnSort('submitted')}
                    >
                      <div className="flex items-center gap-1">
                        Submitted
                        {sortBy === 'submitted' && (
                          <span className="text-primary-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-1.5 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => handleColumnSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        Club
                        {sortBy === 'name' && (
                          <span className="text-primary-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-1.5 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Description</th>
                    <th 
                      className="px-1.5 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => handleColumnSort('category')}
                    >
                      <div className="flex items-center gap-1">
                        Category
                        {sortBy === 'category' && (
                          <span className="text-primary-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-1.5 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Advisor</th>
                    <th className="px-1.5 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Contact</th>
                    <th className="px-1.5 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Location</th>
                    <th className="px-1.5 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Meeting</th>
                    <th className="px-1.5 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Social</th>
                    <th className="px-1.5 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {visible.map(reg => {
                    const isExpanded = expandedId === reg.id
                    return (
                    <>
                    <tr key={reg.id} onClick={() => setExpandedId(isExpanded ? null : reg.id)} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                      <td className="px-1.5 py-2" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(reg.id)} 
                          onChange={(e)=>{
                            const copy = new Set(selectedIds)
                            if (e.target.checked) copy.add(reg.id); else copy.delete(reg.id)
                            setSelectedIds(copy)
                          }}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                      </td>
                      <td className="pl-1 pr-0.5 py-2">
                        <div className="flex items-center gap-1">
                          <span className={getStatusBadge(reg.status)} title={reg.status}>
                            {getStatusIcon(reg.status)}
                          </span>
                          {localPendingRegistrationChanges[reg.id] && (
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">⟳</span>
                          )}
                        </div>
                      </td>
                      <td className="px-1.5 py-1" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1 items-center flex-wrap">
                          {reg.status === 'pending' && (
                            <button 
                              onClick={() => handleApprove(reg)} 
                              disabled={processingId === reg.id}
                              className="px-1 py-0.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xs font-semibold rounded transition-colors flex items-center gap-0.5 whitespace-nowrap"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              <span className="hidden xl:inline">Approve</span>
                            </button>
                          )}
                          <button 
                            onClick={() => openEditModal(reg)} 
                            disabled={processingId === reg.id}
                            className="px-1 py-0.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-xs font-semibold rounded transition-colors whitespace-nowrap"
                          >
                            Edit
                          </button>
                          {reg.status === 'rejected' ? (
                            <button
                              onClick={() => handleApprove(reg)}
                              disabled={processingId === reg.id}
                              className="px-1 py-0.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xs font-semibold rounded transition-colors flex items-center gap-0.5 whitespace-nowrap"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              <span className="hidden xl:inline">Approve</span>
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleDeny(reg)} 
                              disabled={processingId === reg.id}
                              className="px-1 py-0.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-xs font-semibold rounded transition-colors whitespace-nowrap"
                            >
                              Deny
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(reg)}
                            disabled={processingId === reg.id}
                            className="px-1 py-0.5 bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400 text-white text-xs font-semibold rounded transition-colors whitespace-nowrap"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                      <td className="px-1.5 py-2 text-xs text-gray-600 dark:text-gray-400">
                        <div className="whitespace-nowrap">{new Date(reg.submittedAt).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-500">{new Date(reg.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-1.5 py-2" onClick={(e) => e.stopPropagation()}>
                        {quickEditId === reg.id ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={quickEditFields.clubName ?? reg.clubName}
                              onChange={(e) => setQuickEditFields(prev => ({ ...prev, clubName: e.target.value }))}
                              className="w-full px-1.5 py-0.5 text-xs border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-blue-400"
                              placeholder="Club name"
                              autoFocus
                            />
                            <div className="flex gap-0.5">
                              <button
                                onClick={() => saveQuickEdit(reg)}
                                disabled={processingId === reg.id}
                                className="px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setQuickEditId(null)
                                  setQuickEditFields({})
                                }}
                                className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onDoubleClick={(e) => {
                              e.stopPropagation()
                              setQuickEditId(reg.id)
                              setQuickEditFields({ clubName: reg.clubName, category: reg.category })
                            }}
                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded px-1 -mx-1"
                            title="Double-click to edit"
                          >
                            <div className="font-medium text-gray-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                              {reg.clubName}
                              {reg.renewedFromId && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 rounded whitespace-nowrap">
                                  RENEWAL
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{reg.email}</div>
                          </div>
                        )}
                        {reg.status === 'pending' && detectDuplicates(reg.clubName, reg.id, reg.collectionId) && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-orange-600 dark:text-orange-400">
                            <AlertCircle className="h-3 w-3" />
                            <span>Duplicate?</span>
                          </div>
                        )}
                      </td>
                      <td className="px-1.5 py-2 text-xs text-gray-600 dark:text-gray-400 relative" onClick={(e) => e.stopPropagation()}>
                        <div className="truncate group cursor-help">
                          {reg.statementOfPurpose || '—'}
                          {reg.statementOfPurpose && reg.statementOfPurpose.length > 30 && (
                            <div className="invisible group-hover:visible absolute left-full top-0 ml-2 z-[100] p-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl w-96 text-sm leading-relaxed text-gray-800 dark:text-gray-200 whitespace-normal animate-in fade-in zoom-in-95 duration-150">
                              {reg.statementOfPurpose}
                              <div className="absolute top-3 -left-2 w-3 h-3 bg-white dark:bg-gray-900 border-l border-b border-gray-300 dark:border-gray-700 transform rotate-45"></div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-1.5 py-2 text-xs text-gray-900 dark:text-white" onClick={(e) => e.stopPropagation()}>
                        {quickEditId === reg.id ? (
                          <select
                            value={quickEditFields.category ?? reg.category}
                            onChange={(e) => setQuickEditFields(prev => ({ ...prev, category: e.target.value }))}
                            className="w-full px-1.5 py-0.5 text-xs border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-blue-400"
                          >
                            <option value="">Select category</option>
                            {CATEGORY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <span 
                            onDoubleClick={(e) => {
                              e.stopPropagation()
                              setQuickEditId(reg.id)
                              setQuickEditFields({ clubName: reg.clubName, category: reg.category })
                            }}
                            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded px-1 -mx-1 inline-block text-xs"
                            title="Double-click to edit"
                          >
                            {reg.category || '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-1.5 py-2 text-xs text-gray-900 dark:text-white truncate">{reg.advisorName}</td>
                      <td className="px-1.5 py-2 text-xs text-gray-600 dark:text-gray-400">
                        <div className="truncate">{reg.studentContactName}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-500 truncate">{reg.studentContactEmail}</div>
                      </td>
                      <td className="px-1.5 py-2 text-xs text-gray-600 dark:text-gray-400 truncate">{reg.location || '—'}</td>
                      <td className="px-1.5 py-2 text-xs text-gray-600 dark:text-gray-400">
                        <div className="truncate">{reg.meetingDay}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-500 truncate">{reg.meetingFrequency}</div>
                      </td>
                      <td className="px-1.5 py-2 text-xs text-gray-600 dark:text-gray-400">
                        {reg.socialMedia ? (
                          <a href={reg.socialMedia.startsWith('http') ? reg.socialMedia : `https://${reg.socialMedia}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline truncate block">
                            {reg.socialMedia.length > 12 ? reg.socialMedia.substring(0, 12) + '...' : reg.socialMedia}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="px-1.5 py-2 text-xs text-gray-600 dark:text-gray-400">
                        <div className="truncate" title={reg.notes}>
                          {reg.notes || '—'}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${reg.id}-expanded`} className="bg-gray-50 dark:bg-gray-800">
                        <td colSpan={13} className="px-4 py-4">
                          {/* Changed Fields for Renewals */}
                          {reg.renewedFromId && reg.status === 'pending' && (() => {
                            // Fetch changes when expanded
                            if (!renewalChanges[reg.id] && !loadingRenewalChanges[reg.id]) {
                              fetchRenewalChanges(reg)
                            }
                            const changes = renewalChanges[reg.id]
                            const isLoadingChanges = loadingRenewalChanges[reg.id] || changes === undefined
                            return (
                              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">📝 Changed Fields from Previous Year</h4>
                                {isLoadingChanges ? (
                                  <p className="text-xs text-blue-700 dark:text-blue-400">Loading changes...</p>
                                ) : changes === null ? (
                                  <p className="text-xs text-blue-700 dark:text-blue-400 italic">Could not find original club data.</p>
                                ) : Object.keys(changes).length === 0 ? (
                                  <p className="text-xs text-blue-700 dark:text-blue-400 italic">No changes detected.</p>
                                ) : (
                                  <div className="space-y-1 text-xs">
                                    {Object.entries(changes).map(([key, change]: [string, any]) => (
                                      <div key={key} className="flex flex-col gap-0.5">
                                        <span className="font-semibold text-blue-900 dark:text-blue-300">{change.label}:</span>
                                        <div className="flex items-center gap-2">
                                          <span className="text-gray-600 dark:text-gray-400 line-through">{change.old || '(empty)'}</span>
                                          <span className="text-blue-700 dark:text-blue-400">→</span>
                                          <span className="text-blue-900 dark:text-blue-200 font-medium">{change.new || '(empty)'}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-semibold text-gray-700 dark:text-gray-300">Full Description:</span>
                              <p className="mt-1 text-gray-600 dark:text-gray-400">{reg.statementOfPurpose}</p>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-700 dark:text-gray-300">Additional Details:</span>
                              <div className="mt-1 space-y-1 text-gray-600 dark:text-gray-400">
                                <p><strong>Advisor:</strong> {reg.advisorName}</p>
                                <p><strong>Student Contact:</strong> {reg.studentContactName} ({reg.studentContactEmail})</p>
                                <p><strong>Location:</strong> {reg.location}</p>
                                <p><strong>Meeting:</strong> {reg.meetingDay} - {reg.meetingFrequency}</p>
                                {reg.socialMedia && <p><strong>Social:</strong> <a href={reg.socialMedia.startsWith('http') ? reg.socialMedia : `https://${reg.socialMedia}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{reg.socialMedia}</a></p>}
                                {reg.notes && <p><strong>Notes:</strong> {reg.notes}</p>}
                                <p><strong>Submitted:</strong> {new Date(reg.submittedAt).toLocaleString()}</p>
                                {reg.advisorAgreementDate && <p><strong>Advisor Agreement:</strong> {new Date(reg.advisorAgreementDate).toLocaleDateString()}</p>}
                                {reg.clubAgreementDate && <p><strong>Club Agreement:</strong> {new Date(reg.clubAgreementDate).toLocaleDateString()}</p>}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </>
                  )})}

                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {visible.map((reg) => {
                const isExpanded = expandedId === reg.id
                return (
                  <div 
                    key={reg.id} 
                    className={`border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-all ${
                      selectedIds.has(reg.id) ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900' : ''
                    }`}
                  >
                    {/* Header with status and checkbox */}
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(reg.id)}
                        onChange={(e) => {
                          const copy = new Set(selectedIds)
                          if (e.target.checked) copy.add(reg.id); else copy.delete(reg.id)
                          setSelectedIds(copy)
                        }}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      <div className="flex-1">
                        <span className={getStatusBadge(reg.status)}>
                          {getStatusIcon(reg.status)}
                          <span className="capitalize font-semibold">{reg.status}</span>
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(reg.submittedAt).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Main content */}
                    <div 
                      className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : reg.id)}
                    >
                      <h4 className="font-bold text-lg text-gray-900 dark:text-white mb-2 line-clamp-2 flex items-center gap-2">
                        {reg.clubName}
                        {reg.renewedFromId && (
                          <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 rounded">
                            RENEWAL
                          </span>
                        )}
                      </h4>
                      {reg.status === 'pending' && detectDuplicates(reg.clubName, reg.id, reg.collectionId) && (
                        <div className="flex items-center gap-1 mb-2 px-2 py-1 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded text-xs text-orange-700 dark:text-orange-400">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span className="font-medium">Possible duplicate club name detected</span>
                        </div>
                      )}

                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <span className="text-gray-600 dark:text-gray-400 min-w-fit font-medium">Category:</span>
                          <span className="text-gray-900 dark:text-white font-medium">{reg.category || '—'}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-gray-600 dark:text-gray-400 min-w-fit font-medium">Advisor:</span>
                          <span className="text-gray-900 dark:text-white">{reg.advisorName}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-gray-600 dark:text-gray-400 min-w-fit font-medium">Leader:</span>
                          <span className="text-gray-900 dark:text-white">{reg.studentContactName}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-gray-600 dark:text-gray-400 min-w-fit font-medium">Meeting:</span>
                          <span className="text-gray-900 dark:text-white">{reg.meetingDay} ({reg.meetingFrequency})</span>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                            {/* Changed Fields for Renewals */}
                            {reg.renewedFromId && reg.status === 'pending' && (() => {
                              // Fetch changes when expanded
                              if (!renewalChanges[reg.id] && !loadingRenewalChanges[reg.id]) {
                                fetchRenewalChanges(reg)
                              }
                              const changes = renewalChanges[reg.id]
                              const isLoadingChanges = loadingRenewalChanges[reg.id] || changes === undefined
                              return (
                                <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">📝 Changed Fields from Previous Year</h4>
                                  {isLoadingChanges ? (
                                    <p className="text-xs text-blue-700 dark:text-blue-400">Loading changes...</p>
                                  ) : changes === null ? (
                                    <p className="text-xs text-blue-700 dark:text-blue-400 italic">Could not find original club data.</p>
                                  ) : Object.keys(changes).length === 0 ? (
                                    <p className="text-xs text-blue-700 dark:text-blue-400 italic">No changes detected.</p>
                                  ) : (
                                    <div className="space-y-1.5 text-xs">
                                      {Object.entries(changes).map(([key, change]: [string, any]) => (
                                        <div key={key} className="flex flex-col gap-0.5">
                                          <span className="font-semibold text-blue-900 dark:text-blue-300">{change.label}:</span>
                                          <div className="flex items-center gap-2">
                                            <span className="text-gray-600 dark:text-gray-400 line-through">{change.old || '(empty)'}</span>
                                            <span className="text-blue-700 dark:text-blue-400">→</span>
                                            <span className="text-blue-900 dark:text-blue-200 font-medium">{change.new || '(empty)'}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                            
                            <div className="flex items-start gap-2">
                              <span className="text-gray-600 dark:text-gray-400 min-w-fit font-medium">Email:</span>
                              <span className="text-gray-900 dark:text-white break-all text-xs">{reg.email}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-gray-600 dark:text-gray-400 min-w-fit font-medium">Contact:</span>
                              <span className="text-gray-900 dark:text-white break-all text-xs">{reg.studentContactEmail}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-gray-600 dark:text-gray-400 min-w-fit font-medium">Location:</span>
                              <span className="text-gray-900 dark:text-white">{reg.location}</span>
                            </div>
                            {reg.socialMedia && (
                              <div className="flex items-start gap-2">
                                <span className="text-gray-600 dark:text-gray-400 min-w-fit font-medium">Social:</span>
                                <span className="text-gray-900 dark:text-white break-all">{reg.socialMedia}</span>
                              </div>
                            )}
                            {reg.statementOfPurpose && (
                              <div className="flex items-start gap-2 mt-3">
                                <span className="text-gray-600 dark:text-gray-400 font-medium">Purpose:</span>
                                <p className="text-gray-700 dark:text-gray-300 text-xs">{reg.statementOfPurpose}</p>
                              </div>
                            )}
                            {reg.notes && (
                              <div className="flex items-start gap-2 mt-3">
                                <span className="text-gray-600 dark:text-gray-400 font-medium">Notes:</span>
                                <p className="text-gray-700 dark:text-gray-300 text-xs">{reg.notes}</p>
                              </div>
                            )}
                            {reg.denialReason && (
                              <div className="flex items-start gap-2 mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-700">
                                <span className="text-red-700 dark:text-red-400 font-medium min-w-fit">Denial Reason:</span>
                                <p className="text-red-700 dark:text-red-400 text-xs">{reg.denialReason}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer with actions */}
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2 flex-wrap">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : reg.id)}
                        className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium"
                      >
                        {isExpanded ? '▼ Less' : '▶ More'}
                      </button>
                      <div className="flex gap-2 flex-wrap justify-end">
                        {reg.status === 'pending' && (
                          <button
                            onClick={() => handleApprove(reg)}
                            disabled={processingId === reg.id}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xs font-semibold rounded transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(reg)}
                          disabled={processingId === reg.id}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-xs font-semibold rounded transition-colors"
                        >
                          Edit
                        </button>
                        {reg.status === 'rejected' ? (
                          <button
                            onClick={() => handleApprove(reg)}
                            disabled={processingId === reg.id}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xs font-semibold rounded transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDeny(reg)}
                            disabled={processingId === reg.id}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-xs font-semibold rounded transition-colors"
                          >
                            Deny
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(reg)}
                          disabled={processingId === reg.id}
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400 text-white text-xs font-semibold rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Edit Registration Modal */}
      {showEditModal && editReg && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setShowEditModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
            <div 
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 pointer-events-auto my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Edit Registration: {editReg.clubName}
                </h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Edit Fields */}
              <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Club Name</label>
                  <input
                    type="text"
                    value={editFields.clubName || ''}
                    onChange={(e) => handleEditField('clubName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Statement of Purpose / Description</label>
                  <textarea
                    value={editFields.statementOfPurpose || ''}
                    onChange={(e) => handleEditField('statementOfPurpose', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  {!editFields.category || CATEGORY_OPTIONS.includes(editFields.category) ? (
                    <select
                      value={editFields.category || ''}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === '__custom__') {
                          // User wants to enter custom, show the field differently
                          handleEditField('category', '')
                        } else {
                          handleEditField('category', val)
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value="">Select a category</option>
                      {CATEGORY_OPTIONS.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      {editFields.category && !CATEGORY_OPTIONS.includes(editFields.category) && (
                        <option key="current" value={editFields.category}>{editFields.category} (custom)</option>
                      )}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={editFields.category || ''}
                      onChange={(e) => handleEditField('category', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      placeholder="Custom category"
                    />
                  )}
                  {editFields.category && !CATEGORY_OPTIONS.includes(editFields.category) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Custom category. Click the select to choose a predefined one or keep this custom value.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Advisor Name</label>
                  <input
                    type="text"
                    value={editFields.advisorName || ''}
                    onChange={(e) => handleEditField('advisorName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student Contact Name</label>
                  <input
                    type="text"
                    value={editFields.studentContactName || ''}
                    onChange={(e) => handleEditField('studentContactName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student Contact Email</label>
                  <input
                    type="email"
                    value={editFields.studentContactEmail || ''}
                    onChange={(e) => handleEditField('studentContactEmail', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meeting Day</label>
                  <select
                    value={editFields.meetingDay || ''}
                    onChange={(e) => handleEditField('meetingDay', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="">Select a day</option>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meeting Frequency</label>
                  <select
                    value={editFields.meetingFrequency || ''}
                    onChange={(e) => handleEditField('meetingFrequency', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="">Select frequency</option>
                    <option value="Weekly">Weekly</option>
                    <option value="1st and 3rd weeks of the month">1st and 3rd weeks of the month</option>
                    <option value="2nd and 4th weeks of the month">2nd and 4th weeks of the month</option>
                    <option value="1st week only">1st week only</option>
                    <option value="2nd week only">2nd week only</option>
                    <option value="3rd week only">3rd week only</option>
                    <option value="4th week only">4th week only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                  <input
                    type="text"
                    value={editFields.location || ''}
                    onChange={(e) => handleEditField('location', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Social Media (optional)</label>
                  <input
                    type="text"
                    value={editFields.socialMedia || ''}
                    onChange={(e) => handleEditField('socialMedia', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    placeholder="@handle or URL"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
                  <textarea
                    value={editFields.notes || ''}
                    onChange={(e) => handleEditField('notes', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    placeholder="Additional information for the public"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowEditModal(false)}
                  disabled={processingId === editReg.id}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={processingId === editReg.id}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {processingId === editReg.id ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showDenyModal && currentReg && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setShowDenyModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div 
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Deny Registration
                </h3>
                <button
                  onClick={() => setShowDenyModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                Deny "{currentReg.clubName}" by {currentReg.advisorName}?
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason (optional)
                </label>
                <textarea
                  value={denyReason}
                  onChange={(e) => setDenyReason(e.target.value)}
                  placeholder="Explain why this request was denied..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDenyModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeny}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Confirm Denial
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {isOpen && options && (
        <ConfirmDialog
          {...options}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {/* Quick Jump to Top Button */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg transition-all hover:scale-110 z-40"
          title="Scroll to top"
        >
          <ChevronUp className="h-6 w-6" />
        </button>
      )}

      {/* Undo Toast */}
      {undoAction && Date.now() - undoAction.timestamp < 5000 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-6 py-3 rounded-lg shadow-2xl z-50 flex items-center gap-4">
          <span className="font-medium">
            {undoAction.type === 'approve' && `Approved "${undoAction.data.clubName}"`}
            {undoAction.type === 'deny' && `Denied "${undoAction.data.clubName}"`}
            {undoAction.type === 'delete' && `Deleted "${undoAction.data.clubName}"`}
          </span>
          <button
            onClick={() => {
              // Undo the action by removing from pending changes
              setLocalPendingRegistrationChanges(prev => {
                const newPending = { ...prev }
                delete newPending[undoAction.data.id]
                try {
                  if (Object.keys(newPending).length === 0) {
                    localStorage.removeItem(REGISTRATIONS_PENDING_KEY)
                    localStorage.removeItem(REGISTRATIONS_BACKUP_KEY)
                  } else {
                    localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(newPending))
                    localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
                  }
                } catch (e) {}
                return newPending
              })
              setUndoAction(null)
              loadRegistrations()
            }}
            className="px-3 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Undo
          </button>
          <button
            onClick={() => setUndoAction(null)}
            className="text-gray-400 hover:text-white dark:hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Sticky Action Bar (Desktop & Mobile) - Shows whenever items are selected */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-blue-600 dark:bg-blue-700 text-white shadow-2xl z-50 border-t-4 border-blue-500">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="font-semibold text-lg">{selectedIds.size} selected</div>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-sm text-blue-100 hover:text-white underline"
                >
                  Deselect all
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={async () => {
                    const confirmed = await confirm({
                      title: 'Approve Registrations',
                      message: `Approve ${selectedIds.size} selected registrations?`,
                      confirmText: 'Approve All',
                      variant: 'primary'
                    })
                    if (!confirmed) return
                    const idsArray = Array.from(selectedIds)
                    setLocalPendingRegistrationChanges(prev => {
                      const newPending = { ...prev }
                      for (const id of idsArray) {
                        newPending[id] = { status: 'approved' }
                      }
                      try {
                        localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(newPending))
                        localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
                      } catch (e) {}
                      return newPending
                    })
                    
                    for (const id of idsArray) {
                      const reg = registrations.find(r => r.id === id)
                      if (!reg) continue
                      try {
                        await fetch('/api/registration-approve', {
                          method: 'POST',
                          headers: { 'Content-Type':'application/json', 'x-admin-key': adminApiKey },
                          body: JSON.stringify({ registrationId: reg.id, collection: reg.collectionId })
                        })
                      } catch (err) {
                        console.error('Failed to approve', id, err)
                      }
                    }
                    setSelectedIds(new Set())
                    await loadRegistrations()
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Approve Selected
                </button>
                <button
                  onClick={async () => {
                    const reason = prompt('Optional denial reason (applies to all selected):') || ''
                    const confirmed = await confirm({
                      title: 'Deny Registrations',
                      message: `Deny ${selectedIds.size} selected registrations?`,
                      confirmText: 'Deny All',
                      variant: 'danger'
                    })
                    if (!confirmed) return
                    const idsArray = Array.from(selectedIds)
                    setLocalPendingRegistrationChanges(prev => {
                      const newPending = { ...prev }
                      for (const id of idsArray) {
                        newPending[id] = { status: 'rejected', denialReason: reason }
                      }
                      try {
                        localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(newPending))
                        localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
                      } catch (e) {}
                      return newPending
                    })

                    for (const id of idsArray) {
                      const reg = registrations.find(r => r.id === id)
                      if (!reg) continue
                      try {
                        await fetch('/api/registration-deny', {
                          method: 'POST',
                          headers: { 'Content-Type':'application/json', 'x-admin-key': adminApiKey },
                          body: JSON.stringify({ registrationId: reg.id, collection: reg.collectionId, reason })
                        })
                      } catch (err) {
                        console.error('Failed to deny', id, err)
                      }
                    }
                    setSelectedIds(new Set())
                    await loadRegistrations()
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                >
                  <XCircle className="h-5 w-5" />
                  Deny Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
