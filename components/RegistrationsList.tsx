'use client'

import { useState, useEffect } from 'react'
import { ClubRegistration } from '@/types/club'
import { FileSpreadsheet, Download, RefreshCw, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, X, Table as TableIcon, LayoutList } from 'lucide-react'

interface RegistrationsListProps {
  adminApiKey: string
}

export function RegistrationsList({ adminApiKey }: RegistrationsListProps) {
  const [registrations, setRegistrations] = useState<ClubRegistration[]>([])
  const [collections, setCollections] = useState<string[]>([])
  const [selectedCollection, setSelectedCollection] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showDenyModal, setShowDenyModal] = useState(false)
  const [denyReason, setDenyReason] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [currentReg, setCurrentReg] = useState<ClubRegistration | null>(null)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<{[k:string]: string}>({
    status: '',
    clubName: '',
    advisorName: '',
    email: '',
    meetingDay: '',
    meetingFrequency: '',
    studentContactName: '',
    studentContactEmail: '',
    location: ''
  })

  const loadRegistrations = async () => {
    setLoading(true)
    setError('')
    try {
      const url = selectedCollection === 'all' 
        ? '/api/club-registration'
        : `/api/club-registration?collection=${encodeURIComponent(selectedCollection)}`
        
      const response = await fetch(url, {
        headers: {
          'x-admin-key': adminApiKey
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load registrations')
      }

      const data = await response.json()
      setRegistrations(data.registrations || [])
      setCollections(data.collections || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load registrations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (adminApiKey) {
      loadRegistrations()
    }
  }, [adminApiKey, selectedCollection])

  const filtered = registrations.filter(r => {
    const f = filters
    if (f.status && r.status.toLowerCase().indexOf(f.status.toLowerCase()) === -1) return false
    if (f.clubName && r.clubName.toLowerCase().indexOf(f.clubName.toLowerCase()) === -1) return false
    if (f.advisorName && r.advisorName.toLowerCase().indexOf(f.advisorName.toLowerCase()) === -1) return false
    if (f.email && r.email.toLowerCase().indexOf(f.email.toLowerCase()) === -1) return false
    if (f.meetingDay && (r.meetingDay || '').toLowerCase().indexOf(f.meetingDay.toLowerCase()) === -1) return false
    if (f.meetingFrequency && (r.meetingFrequency || '').toLowerCase().indexOf(f.meetingFrequency.toLowerCase()) === -1) return false
    if (f.studentContactName && (r.studentContactName || '').toLowerCase().indexOf(f.studentContactName.toLowerCase()) === -1) return false
    if (f.studentContactEmail && (r.studentContactEmail || '').toLowerCase().indexOf(f.studentContactEmail.toLowerCase()) === -1) return false
    if (f.location && (r.location || '').toLowerCase().indexOf(f.location.toLowerCase()) === -1) return false
    return true
  })

  const handleApprove = async (reg: ClubRegistration) => {
    if (!confirm(`Approve "${reg.clubName}"?`)) {
      return
    }

    setProcessingId(reg.id)
    try {
      const response = await fetch('/api/registration-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify({
          registrationId: reg.id,
          collection: reg.collection
        })
      })

      if (!response.ok) {
        throw new Error('Failed to approve registration')
      }

      await loadRegistrations()
      alert('Registration approved successfully!')
    } catch (err: any) {
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

    try {
      const response = await fetch('/api/registration-deny', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify({
          registrationId: currentReg.id,
          collection: currentReg.collection,
          reason: denyReason
        })
      })

      if (!response.ok) {
        throw new Error('Failed to deny registration')
      }

      await loadRegistrations()
      alert('Registration denied.')
    } catch (err: any) {
      alert(err.message || 'Failed to deny registration')
    } finally {
      setProcessingId(null)
      setCurrentReg(null)
      setDenyReason('')
    }
  }

  const exportToCSV = () => {
    if (filtered.length === 0) return

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

    const rows = filtered.map(reg => [
      reg.id,
      reg.collection || '',
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
    const filename = selectedCollection === 'all' 
      ? `club-registrations-all-${new Date().toISOString().split('T')[0]}.csv`
      : `club-registrations-${selectedCollection.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`
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
            Club Registrations ({filtered.length})
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
          <select
            value={selectedCollection}
            onChange={(e) => setSelectedCollection(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          >
            <option value="all">All Collections</option>
            {collections.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (!confirm(`Approve ${selectedIds.size} selected registrations?`)) return
                  for (const id of Array.from(selectedIds)) {
                    const reg = registrations.find(r => r.id === id)
                    if (!reg) continue
                    await fetch('/api/registration-approve', {
                      method: 'POST',
                      headers: { 'Content-Type':'application/json', 'x-admin-key': adminApiKey },
                      body: JSON.stringify({ registrationId: reg.id, collection: reg.collection })
                    })
                  }
                  setSelectedIds(new Set())
                  await loadRegistrations()
                }}
                className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg"
              >Approve Selected</button>
              <button
                onClick={async () => {
                  const reason = prompt('Optional denial reason (applies to all selected):') || ''
                  if (!confirm(`Deny ${selectedIds.size} selected registrations?`)) return
                  for (const id of Array.from(selectedIds)) {
                    const reg = registrations.find(r => r.id === id)
                    if (!reg) continue
                    await fetch('/api/registration-deny', {
                      method: 'POST',
                      headers: { 'Content-Type':'application/json', 'x-admin-key': adminApiKey },
                      body: JSON.stringify({ registrationId: reg.id, collection: reg.collection, reason })
                    })
                  }
                  setSelectedIds(new Set())
                  await loadRegistrations()
                }}
                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >Deny Selected</button>
              <button
                onClick={async () => {
                  if (!confirm(`Delete ${selectedIds.size} selected registrations? This cannot be undone.`)) return
                  for (const id of Array.from(selectedIds)) {
                    const reg = registrations.find(r => r.id === id)
                    if (!reg) continue
                    await fetch('/api/registration-delete', {
                      method: 'POST',
                      headers: { 'Content-Type':'application/json', 'x-admin-key': adminApiKey },
                      body: JSON.stringify({ registrationId: reg.id, collection: reg.collection })
                    })
                  }
                  setSelectedIds(new Set())
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
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
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
                      if (e.target.checked) setSelectedIds(new Set(filtered.map(r=>r.id)))
                      else setSelectedIds(new Set())
                    }} checked={selectedIds.size>0 && selectedIds.size===filtered.length} /></th>
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
                  <tr>
                    <th></th>
                    <th className="px-4 py-2"><input className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" placeholder="Filter" value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})} /></th>
                    <th></th>
                    <th className="px-4 py-2"><input className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" placeholder="Filter" value={filters.clubName} onChange={e=>setFilters({...filters,clubName:e.target.value})} /></th>
                    <th className="px-4 py-2"><input className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" placeholder="Filter" value={filters.advisorName} onChange={e=>setFilters({...filters,advisorName:e.target.value})} /></th>
                    <th className="px-4 py-2"><input className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" placeholder="Filter" value={filters.email} onChange={e=>setFilters({...filters,email:e.target.value})} /></th>
                    <th className="px-4 py-2"><input className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" placeholder="Filter" value={filters.studentContactName} onChange={e=>setFilters({...filters,studentContactName:e.target.value})} /></th>
                    <th className="px-4 py-2"><input className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" placeholder="Filter" value={filters.studentContactEmail} onChange={e=>setFilters({...filters,studentContactEmail:e.target.value})} /></th>
                    <th className="px-4 py-2"><input className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" placeholder="Filter" value={filters.meetingDay} onChange={e=>setFilters({...filters,meetingDay:e.target.value})} /></th>
                    <th className="px-4 py-2"><input className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" placeholder="Filter" value={filters.meetingFrequency} onChange={e=>setFilters({...filters,meetingFrequency:e.target.value})} /></th>
                    <th className="px-4 py-2"><input className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" placeholder="Filter" value={filters.location} onChange={e=>setFilters({...filters,location:e.target.value})} /></th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {filtered.map(reg => (
                    <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-3 py-2"><input type="checkbox" checked={selectedIds.has(reg.id)} onChange={(e)=>{
                        const copy = new Set(selectedIds)
                        if (e.target.checked) copy.add(reg.id); else copy.delete(reg.id)
                        setSelectedIds(copy)
                      }}/></td>
                      <td className="px-4 py-3"><span className={getStatusBadge(reg.status)}>{getStatusIcon(reg.status)}{reg.status}</span></td>
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
              {filtered.map((reg) => {
                const isExpanded = expandedId === reg.id
                const isProcessing = processingId === reg.id
                
                return (
                  <div key={reg.id} className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
                    <div 
                      className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : reg.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={getStatusBadge(reg.status)}>
                              {getStatusIcon(reg.status)}
                              {reg.status.charAt(0).toUpperCase() + reg.status.slice(1)}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(reg.submittedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">{reg.clubName}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {reg.advisorName} • {reg.email}
                          </p>
                        </div>
                        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
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
