'use client'

import { useState, useEffect } from 'react'
import { ClubRegistration } from '@/types/club'
import { FileSpreadsheet, Download, RefreshCw, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, X, Table as TableIcon, LayoutList } from 'lucide-react'

interface RegistrationsListProps {
  adminApiKey: string
  collectionId: string
  collectionName: string
}

export function RegistrationsList({ adminApiKey, collectionId, collectionName }: RegistrationsListProps) {
  const [registrations, setRegistrations] = useState<ClubRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showDenyModal, setShowDenyModal] = useState(false)
  const [denyReason, setDenyReason] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [currentReg, setCurrentReg] = useState<ClubRegistration | null>(null)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [localPendingRegistrationChanges, setLocalPendingRegistrationChanges] = useState<Record<string, { status?: string; denialReason?: string; deleted?: boolean }>>({})
  const [registrationStorageLoaded, setRegistrationStorageLoaded] = useState(false)
  const REGISTRATIONS_PENDING_KEY = 'montyclub:pendingRegistrationChanges'
  const REGISTRATIONS_BACKUP_KEY = 'montyclub:pendingRegistrationChanges:backup'

  const loadRegistrations = async () => {
    if (!collectionId) return
    setLoading(true)
    setError('')
    try {
      const url = `/api/club-registration?collectionId=${encodeURIComponent(collectionId)}`
        
      const response = await fetch(url, {
        headers: {
          'x-admin-key': adminApiKey
        }
      })

      if (!response.ok) {
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
    if (adminApiKey && collectionId) {
      loadRegistrations()
    }
  }, [adminApiKey, collectionId])

  // Load pending registration changes from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
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
    if (!registrationStorageLoaded) return
    if (Object.keys(localPendingRegistrationChanges).length === 0) return

    const stillPending = { ...localPendingRegistrationChanges }
    let hasCleared = false

    Object.keys(stillPending).forEach(id => {
      const pending = stillPending[id]
      const dbItem = registrations.find(r => r.id === id)

      // If marked deleted locally but no longer exists in DB, clear it
      if (pending.deleted && !dbItem) {
        delete stillPending[id]
        hasCleared = true
      }
      // If status matches DB, clear it
      else if (dbItem && pending.status !== undefined && dbItem.status === pending.status) {
        delete stillPending[id]
        hasCleared = true
      }
    })

    if (hasCleared) {
      setLocalPendingRegistrationChanges(stillPending)
      try {
        if (Object.keys(stillPending).length === 0) {
          localStorage.removeItem(REGISTRATIONS_PENDING_KEY)
          localStorage.removeItem(REGISTRATIONS_BACKUP_KEY)
        } else {
          localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(stillPending))
          localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: stillPending }))
        }
      } catch (e) {}
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

  const visible = registrationsOverlayed

  const handleApprove = async (reg: ClubRegistration) => {
    if (!confirm(`Approve "${reg.clubName}"?`)) {
      return
    }

    setProcessingId(reg.id)

    // Do NOT mutate registrations optimistically; only update localPendingRegistrationChanges
    const newPending = { ...localPendingRegistrationChanges, [reg.id]: { status: 'approved' } }
    setLocalPendingRegistrationChanges(newPending)
    try {
      localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(newPending))
      localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
    } catch (e) {}

    try {
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

      if (!response.ok) {
        throw new Error('Failed to approve registration')
      }

      // Success: keep pending until future GET shows same state
      alert('Registration approved successfully!')
    } catch (err: any) {
      // Clear from pending on error (revert)
      const revertPending = { ...localPendingRegistrationChanges }
      delete revertPending[reg.id]
      setLocalPendingRegistrationChanges(revertPending)
      try {
        if (Object.keys(revertPending).length === 0) {
          localStorage.removeItem(REGISTRATIONS_PENDING_KEY)
          localStorage.removeItem(REGISTRATIONS_BACKUP_KEY)
        } else {
          localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(revertPending))
          localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: revertPending }))
        }
      } catch (e) {}
      alert(err.message || 'Failed to approve registration')
    } finally {
      setProcessingId(null)
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

    // Do NOT mutate registrations optimistically; only update localPendingRegistrationChanges
    const newPending = { ...localPendingRegistrationChanges, [currentReg.id]: { status: 'rejected', denialReason: denyReason } }
    setLocalPendingRegistrationChanges(newPending)
    try {
      localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(newPending))
      localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
    } catch (e) {}

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

      // Success: keep pending until future GET shows same state
      alert('Registration denied.')
    } catch (err: any) {
      // Clear from pending on error (revert)
      const revertPending = { ...localPendingRegistrationChanges }
      delete revertPending[currentReg.id]
      setLocalPendingRegistrationChanges(revertPending)
      try {
        if (Object.keys(revertPending).length === 0) {
          localStorage.removeItem(REGISTRATIONS_PENDING_KEY)
          localStorage.removeItem(REGISTRATIONS_BACKUP_KEY)
        } else {
          localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(revertPending))
          localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: revertPending }))
        }
      } catch (e) {}
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
                  if (!confirm(`Approve ${selectedIds.size} selected registrations?`)) return
                  // Batch update localPendingRegistrationChanges
                  const newPending = { ...localPendingRegistrationChanges }
                  for (const id of Array.from(selectedIds)) {
                    newPending[id] = { status: 'approved' }
                  }
                  setLocalPendingRegistrationChanges(newPending)
                  try {
                    localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(newPending))
                    localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
                  } catch (e) {}
                  
                  for (const id of Array.from(selectedIds)) {
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
                }}
                className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg"
              >Approve Selected</button>
              <button
                onClick={async () => {
                  const reason = prompt('Optional denial reason (applies to all selected):') || ''
                  if (!confirm(`Deny ${selectedIds.size} selected registrations?`)) return
                  // Batch update localPendingRegistrationChanges
                  const newPending = { ...localPendingRegistrationChanges }
                  for (const id of Array.from(selectedIds)) {
                    newPending[id] = { status: 'rejected', denialReason: reason }
                  }
                  setLocalPendingRegistrationChanges(newPending)
                  try {
                    localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(newPending))
                    localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
                  } catch (e) {}

                  for (const id of Array.from(selectedIds)) {
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
                }}
                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >Deny Selected</button>
              <button
                onClick={async () => {
                  if (!confirm(`Delete ${selectedIds.size} selected registrations? This cannot be undone.`)) return
                  // Batch mark as deleted in localPendingRegistrationChanges
                  const newPending = { ...localPendingRegistrationChanges }
                  for (const id of Array.from(selectedIds)) {
                    newPending[id] = { deleted: true }
                  }
                  setLocalPendingRegistrationChanges(newPending)
                  try {
                    localStorage.setItem(REGISTRATIONS_PENDING_KEY, JSON.stringify(newPending))
                    localStorage.setItem(REGISTRATIONS_BACKUP_KEY, JSON.stringify({ t: Date.now(), data: newPending }))
                  } catch (e) {}

                  for (const id of Array.from(selectedIds)) {
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Advisor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Advisor Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student Contact</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Meeting Day</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Frequency</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Location</th>
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
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{reg.advisorName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{reg.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{reg.studentContactName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{reg.studentContactEmail}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{reg.meetingDay}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{reg.meetingFrequency}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{reg.location}</td>
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
                        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" onClick={() => setExpandedId(isExpanded ? null : reg.id)}>
                          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
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
    </div>
  )
}
