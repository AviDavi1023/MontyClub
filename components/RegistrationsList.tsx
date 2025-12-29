'use client'

import { useState, useEffect } from 'react'
import { ClubRegistration } from '@/types/club'
import { FileSpreadsheet, Download, RefreshCw, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, X, Table as TableIcon, LayoutList } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui'
import { useConfirm } from '@/lib/hooks/useConfirm'

interface RegistrationsListProps {
  adminApiKey: string
  collectionSlug: string
  collectionName: string
  collectionId: string
  collections: Array<{ id: string; name: string }>
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

export function RegistrationsList({ adminApiKey, collectionSlug, collectionName, collectionId, collections }: RegistrationsListProps) {
  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm()
  const [registrations, setRegistrations] = useState<ClubRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showDenyModal, setShowDenyModal] = useState(false)
  const [denyReason, setDenyReason] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [currentReg, setCurrentReg] = useState<ClubRegistration | null>(null)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editReg, setEditReg] = useState<ClubRegistration | null>(null)
  const [editFields, setEditFields] = useState<any>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'submitted' | 'name' | 'status' | 'category'>('submitted')
  const [renewalSettings, setRenewalSettings] = useState<Record<string, { sourceCollections: string[] }>>({})
  const [loadingRenewalSettings, setLoadingRenewalSettings] = useState(true)
  const [savingRenewalSettings, setSavingRenewalSettings] = useState(false)
    const openEditModal = (reg: ClubRegistration) => {
      setEditReg(reg)
      setEditFields({ ...reg })
      setShowEditModal(true)
    }

    const handleEditField = (field: string, value: any) => {
      setEditFields((prev: any) => ({ ...prev, [field]: value }))
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
        // Gracefully handle 404 for just-created collections not yet propagated
        if (response.status === 404) {
          const pend = pendingCollectionsBySlug[collectionSlug]
          if (pend && pend.created) {
            setRegistrations([])
            return
          }
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
    setSavingRenewalSettings(true)
    try {
      const updatedSettings = {
        ...renewalSettings,
        [collectionId]: { sourceCollections }
      }
      const response = await fetch('/api/renewal-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify(updatedSettings)
      })
      if (!response.ok) throw new Error('Failed to save')
      const updated = await response.json()
      setRenewalSettings(updated)
    } catch (err) {
      alert('Failed to save renewal settings')
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
      // Load pending collections and index by slug for created entries
      try {
        const raw = localStorage.getItem(COLLECTIONS_PENDING_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, { created?: boolean; enabled?: boolean; name?: string }>
          const bySlug: Record<string, { created?: boolean; enabled?: boolean; name?: string }> = {}
          Object.values(parsed || {}).forEach((v) => {
            if (!v) return
            const slug = (v.name || '').toLowerCase().replace(/\s+/g, '-')
            if (slug) bySlug[slug] = v
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

  // Filter and sort registrations
  const filtered = registrationsOverlayed.filter(reg => {
    const search = searchTerm.toLowerCase()
    return (
      reg.clubName.toLowerCase().includes(search) ||
      reg.category?.toLowerCase().includes(search) ||
      reg.advisorName?.toLowerCase().includes(search) ||
      reg.studentContactName?.toLowerCase().includes(search) ||
      reg.studentContactEmail?.toLowerCase().includes(search) ||
      reg.statementOfPurpose?.toLowerCase().includes(search)
    )
  })

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.clubName.localeCompare(b.clubName)
      case 'category':
        return (a.category || '').localeCompare(b.category || '')
      case 'status':
        return a.status.localeCompare(b.status)
      case 'submitted':
      default:
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    }
  })

  const visible = sorted

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

      // Success: fetch fresh data to trigger auto-clear
      alert('Registration approved successfully!')
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

      // Success: fetch fresh data to trigger auto-clear
      alert('Registration denied.')
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
    const filename = `club-registrations-${collectionName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"></div>
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

  return (
    <div className="space-y-4">
      {/* Search and Sort Controls */}
      <div className="flex flex-col gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by club name, category, advisor, student..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="submitted">Sort: Newest First</option>
            <option value="name">Sort: Club Name (A-Z)</option>
            <option value="category">Sort: Category (A-Z)</option>
            <option value="status">Sort: Status</option>
          </select>
        </div>
        {searchTerm && (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Showing {visible.length} of {registrations.length} registrations
          </div>
        )}
      </div>

      {/* Renewal Settings Section */}
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

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Club Registrations ({visible.length})
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm ${viewMode==='cards' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-transparent'} text-gray-800 dark:text-gray-200 flex items-center gap-1`}
              onClick={() => setViewMode('cards')}
              title="Cards View"
            >
              <LayoutList className="h-4 w-4"/> Cards
            </button>
            <button
              className={`px-3 py-1.5 text-sm ${viewMode==='table' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-transparent'} text-gray-800 dark:text-gray-200 flex items-center gap-1`}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <TableIcon className="h-4 w-4"/> Table
            </button>
          </div>
          {/* Select All for Cards view */}
          {viewMode === 'cards' && visible.length > 0 && (
            <button
              onClick={() => {
                if (selectedIds.size === visible.length) setSelectedIds(new Set())
                else setSelectedIds(new Set(visible.map(r=>r.id)))
              }}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg"
            >
              {selectedIds.size === visible.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
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
                  // Batch update localPendingRegistrationChanges using functional update
                  setLocalPendingRegistrationChanges(prev => {
                    const newPending = { ...prev }
                    for (const id of idsArray) {
                      newPending[id] = { status: 'approved' }
                    }
                    try {
                      localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(newPending))
                      localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
                    } catch (e) {
                      // Ignore localStorage errors
                    }
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
                  // Fetch fresh data to trigger auto-clear
                  await loadRegistrations()
                }}
                className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg"
              >Approve Selected</button>
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
                  // Batch update localPendingRegistrationChanges using functional update
                  setLocalPendingRegistrationChanges(prev => {
                    const newPending = { ...prev }
                    for (const id of idsArray) {
                      newPending[id] = { status: 'rejected', denialReason: reason }
                    }
                    try {
                      localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(newPending))
                      localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
                    } catch (e) {
                      // Ignore localStorage errors
                    }
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
                  // Fetch fresh data to trigger auto-clear
                  await loadRegistrations()
                }}
                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >Deny Selected</button>
              <button
                onClick={async () => {
                  const confirmed = await confirm({
                    title: 'Delete Registrations',
                    message: `Delete ${selectedIds.size} selected registrations? This cannot be undone.`,
                    confirmText: 'Delete',
                    variant: 'danger'
                  })
                  if (!confirmed) return
                  const idsArray = Array.from(selectedIds)
                  // Batch mark as deleted in localPendingRegistrationChanges using functional update
                  setLocalPendingRegistrationChanges(prev => {
                    const newPending = { ...prev }
                    for (const id of idsArray) {
                      newPending[id] = { deleted: true }
                    }
                    try {
                      localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(newPending))
                      localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
                    } catch (e) {
                      // Ignore localStorage errors
                    }
                    return newPending
                  })

                  for (const id of idsArray) {
                    const reg = registrations.find(r => r.id === id)
                    if (!reg) continue
                    try {
                      await fetch('/api/registration-delete', {
                        method: 'POST',
                        headers: { 'Content-Type':'application/json', 'x-admin-key': adminApiKey },
                        body: JSON.stringify({ registrationId: reg.id, collection: reg.collectionId })
                      })
                    } catch (err) {
                      console.error('Failed to delete', id, err)
                    }
                  }
                  setSelectedIds(new Set())
                  // Fetch fresh data to trigger auto-clear
                  await loadRegistrations()
                }}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg"
              >Delete Selected</button>
            </div>
          )}
          <button
            onClick={loadRegistrations}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <button
            onClick={exportToCSV}
            disabled={visible.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-12 px-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <FileSpreadsheet className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No registrations yet</p>
        </div>
      ) : (
        <>
          {viewMode === 'table' ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2"><input type="checkbox" aria-label="Select all" onChange={(e)=>{
                      if (e.target.checked) setSelectedIds(new Set(visible.map(r=>r.id)))
                      else setSelectedIds(new Set())
                    }} checked={visible.length>0 && selectedIds.size===visible.length} /></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Submitted</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Club Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Advisor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Advisor Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student Contact</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Meeting Day</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Frequency</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Social Media</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Purpose</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {visible.map(reg => (
                    <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-3 py-2"><input type="checkbox" checked={selectedIds.has(reg.id)} onChange={(e)=>{
                        const copy = new Set(selectedIds)
                        if (e.target.checked) copy.add(reg.id); else copy.delete(reg.id)
                        setSelectedIds(copy)
                      }}/></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={getStatusBadge(reg.status)}>{getStatusIcon(reg.status)}{reg.status}</span>
                          {localPendingRegistrationChanges[reg.id] && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 italic">Syncing...</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{new Date(reg.submittedAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{reg.clubName}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{reg.category || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{reg.advisorName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{reg.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{reg.studentContactName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{reg.studentContactEmail}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{reg.meetingDay}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{reg.meetingFrequency}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{reg.location}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{reg.socialMedia || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate" title={reg.statementOfPurpose}>{reg.statementOfPurpose || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate" title={reg.notes}>{reg.notes || '—'}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <div className="flex gap-1">
                          <button onClick={() => openEditModal(reg)} className="text-blue-600 dark:text-blue-400 hover:underline text-xs">Edit</button>
                          <span className="text-gray-300">•</span>
                          <button onClick={() => {setCurrentReg(reg); setShowDenyModal(true);}} className="text-red-600 dark:text-red-400 hover:underline text-xs">Deny</button>
                          {reg.status === 'pending' && (
                            <>
                              <span className="text-gray-300">•</span>
                              <button onClick={() => handleApprove(reg)} className="text-green-600 dark:text-green-400 hover:underline text-xs">Approve</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((reg) => {
                const isExpanded = expandedId === reg.id
                const isProcessing = processingId === reg.id
                return (
                  <div key={reg.id} className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
                    <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <label className="flex items-start gap-3 select-none">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(reg.id)}
                            onChange={(e) => {
                              const copy = new Set(selectedIds)
                              if (e.target.checked) copy.add(reg.id); else copy.delete(reg.id)
                              setSelectedIds(copy)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1"
                          />
                        </label>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : reg.id)}>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={getStatusBadge(reg.status)}>
                              {getStatusIcon(reg.status)}
                              {reg.status.charAt(0).toUpperCase() + reg.status.slice(1)}
                            </span>
                            {localPendingRegistrationChanges[reg.id] && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 italic">Syncing...</span>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(reg.submittedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">{reg.clubName}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {reg.advisorName} • {reg.email}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" onClick={() => setExpandedId(isExpanded ? null : reg.id)}>
                            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </button>
                          <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-xs px-2 py-1 rounded border border-blue-200 dark:border-blue-700" onClick={() => openEditModal(reg)}>
                            Edit
                          </button>
                        </div>
                            {showEditModal && editReg && (
                              <>
                                <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setShowEditModal(false)} />
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
                                  <div className="min-h-full flex items-center justify-center py-8">
                                    <form className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full pointer-events-auto my-auto" onSubmit={e => { e.preventDefault(); saveEdit(); }}>
                                      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10 rounded-t-lg">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Club Registration</h3>
                                        <button type="button" onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="h-5 w-5" /></button>
                                      </div>
                                      <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <label className="block">
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Club Name</span>
                                            <input type="text" className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" value={editFields.clubName || ''} onChange={e => handleEditField('clubName', e.target.value)} />
                                          </label>
                                          <label className="block">
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</span>
                                            <select className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" value={editFields.category || ''} onChange={e => handleEditField('category', e.target.value)}>
                                              <option value="">Select a category</option>
                                              {CATEGORY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                          </label>
                                          <label className="block">
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Advisor Name</span>
                                            <input type="text" className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" value={editFields.advisorName || ''} onChange={e => handleEditField('advisorName', e.target.value)} />
                                          </label>
                                          <label className="block">
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Advisor Email</span>
                                            <input type="email" className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" value={editFields.email || ''} onChange={e => handleEditField('email', e.target.value)} />
                                          </label>
                                          <label className="block">
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Student Contact Name</span>
                                            <input type="text" className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" value={editFields.studentContactName || ''} onChange={e => handleEditField('studentContactName', e.target.value)} />
                                          </label>
                                          <label className="block">
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Student Contact Email</span>
                                            <input type="email" className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" value={editFields.studentContactEmail || ''} onChange={e => handleEditField('studentContactEmail', e.target.value)} />
                                          </label>
                                          <label className="block">
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Location</span>
                                            <input type="text" className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" value={editFields.location || ''} onChange={e => handleEditField('location', e.target.value)} />
                                          </label>
                                          <label className="block">
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Meeting Day</span>
                                            <input type="text" className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" value={editFields.meetingDay || ''} onChange={e => handleEditField('meetingDay', e.target.value)} />
                                          </label>
                                          <label className="block">
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Meeting Frequency</span>
                                            <input type="text" className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" value={editFields.meetingFrequency || ''} onChange={e => handleEditField('meetingFrequency', e.target.value)} />
                                          </label>
                                          <label className="block">
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Social Media</span>
                                            <input type="text" className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" value={editFields.socialMedia || ''} onChange={e => handleEditField('socialMedia', e.target.value)} />
                                          </label>
                                          <label className="block">
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Advisor Agreement Date</span>
                                            <input type="date" className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" value={editFields.advisorAgreementDate || ''} onChange={e => handleEditField('advisorAgreementDate', e.target.value)} />
                                          </label>
                                          <label className="block">
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Club Agreement Date</span>
                                            <input type="date" className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" value={editFields.clubAgreementDate || ''} onChange={e => handleEditField('clubAgreementDate', e.target.value)} />
                                          </label>
                                          <label className="block md:col-span-2">
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Statement of Purpose</span>
                                            <textarea className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" rows={3} value={editFields.statementOfPurpose || ''} onChange={e => handleEditField('statementOfPurpose', e.target.value)} />
                                          </label>
                                          <label className="block md:col-span-2">
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Notes</span>
                                            <textarea className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" rows={2} value={editFields.notes || ''} onChange={e => handleEditField('notes', e.target.value)} />
                                          </label>
                                        </div>
                                      </div>
                                      <div className="flex gap-3 justify-end p-6 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800 rounded-b-lg">
                                        <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">Cancel</button>
                                        <button type="submit" disabled={processingId === editReg.id} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors">
                                          {processingId === editReg.id ? 'Saving...' : 'Save Changes'}
                                        </button>
                                      </div>
                                    </form>
                                  </div>
                                </div>
                              </>
                            )}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Club Name</label>
                            <p className="text-sm text-gray-900 dark:text-white mt-1">{reg.clubName}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Advisor</label>
                            <p className="text-sm text-gray-900 dark:text-white mt-1">{reg.advisorName}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Advisor Email</label>
                            <p className="text-sm text-gray-900 dark:text-white mt-1">{reg.email}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Location</label>
                            <p className="text-sm text-gray-900 dark:text-white mt-1">{reg.location}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Meeting Day</label>
                            <p className="text-sm text-gray-900 dark:text-white mt-1">{reg.meetingDay}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Frequency</label>
                            <p className="text-sm text-gray-900 dark:text-white mt-1">{reg.meetingFrequency}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Student Contact</label>
                            <p className="text-sm text-gray-900 dark:text-white mt-1">{reg.studentContactName}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Student Email</label>
                            <p className="text-sm text-gray-900 dark:text-white mt-1">{reg.studentContactEmail}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Advisor Agreement</label>
                            <p className="text-sm text-gray-900 dark:text-white mt-1">{reg.advisorAgreementDate}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Club Agreement</label>
                            <p className="text-sm text-gray-900 dark:text-white mt-1">{reg.clubAgreementDate}</p>
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Statement of Purpose</label>
                            <p className="text-sm text-gray-900 dark:text-white mt-1">{reg.statementOfPurpose}</p>
                          </div>
                          {reg.denialReason && (
                            <div className="md:col-span-2">
                              <label className="text-xs font-medium text-red-600 dark:text-red-400 uppercase">Denial Reason</label>
                              <p className="text-sm text-gray-900 dark:text-white mt-1">{reg.denialReason}</p>
                            </div>
                          )}
                        </div>
                        {reg.status === 'pending' && (
                          <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <button
                              onClick={() => handleApprove(reg)}
                              disabled={isProcessing}
                              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              {isProcessing ? 'Processing...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleDeny(reg)}
                              disabled={isProcessing}
                              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              <XCircle className="h-4 w-4" />
                              {isProcessing ? 'Processing...' : 'Deny'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
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
    </div>
  )
}
