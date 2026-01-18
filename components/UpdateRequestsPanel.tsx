'use client'

import { useState, useEffect } from 'react'
import { Search, CheckCircle2, XCircle, Clock, AlertCircle, ChevronDown, ChevronUp, RefreshCw, Trash2 } from 'lucide-react'
import { Club } from '@/types/club'

interface UpdateRequest {
  id: string
  clubId?: string
  clubName: string
  updateType: string
  suggestedChange: string
  contactEmail: string
  additionalNotes?: string
  requestedBy: string
  requestedAt: string
  status: 'pending' | 'approved' | 'rejected'
  _timestamp?: number
}

interface PendingUpdateChange {
  status?: 'pending' | 'approved' | 'rejected'
  deleted?: boolean
  _timestamp?: number
}

interface UpdateRequestsPanelProps {
  clubs: Club[]
  adminApiKey: string
}

export function UpdateRequestsPanel({ clubs, adminApiKey }: UpdateRequestsPanelProps) {
  const [updateRequests, setUpdateRequests] = useState<UpdateRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingUpdateChange>>({})

  useEffect(() => {
    // Load pending changes from localStorage
    try {
      const stored = localStorage.getItem('localPendingUpdateChanges')
      if (stored) {
        setPendingChanges(JSON.parse(stored))
      }
    } catch (e) {
      console.warn('Failed to load pending update changes:', e)
    }
    loadUpdateRequests()
  }, [])

  const loadUpdateRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/updates', {
        headers: { 'x-admin-key': adminApiKey }
      })
      if (!response.ok) throw new Error('Failed to load update requests')
      const data = await response.json()
      // API returns array directly, not wrapped in { updates: [...] }
      // Map the actual data structure to our interface
      const mappedData = Array.isArray(data) ? data.map((item: any) => ({
        ...item,
        // Map 'reviewed' field to 'status' for backwards compatibility
        status: item.status || (item.reviewed === true ? 'approved' : item.reviewed === false ? 'pending' : 'pending'),
        clubName: item.clubName || item.name || 'Unknown Club',
        requestedBy: item.requestedBy || item.createdBy || item.contactEmail || 'Unknown',
        requestedAt: item.requestedAt || item.createdAt || new Date().toISOString(),
      })) : []
      setUpdateRequests(mappedData)
      setError('')
    } catch (err) {
      setError(String(err))
      setUpdateRequests([])
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId)
    
    // Optimistic update
    const newPending = { ...pendingChanges }
    newPending[requestId] = { status: 'approved', _timestamp: Date.now() }
    setPendingChanges(newPending)
    localStorage.setItem('localPendingUpdateChanges', JSON.stringify(newPending))
    
    setUpdateRequests(prev =>
      prev.map(r => r.id === requestId ? { ...r, status: 'approved' } : r)
    )
    
    try {
      const response = await fetch(`/api/updates/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey
        },
        body: JSON.stringify({ reviewed: true })
      })
      if (!response.ok) throw new Error('Failed to approve')
      
      // Clear pending change on success
      const updatedPending = { ...newPending }
      delete updatedPending[requestId]
      setPendingChanges(updatedPending)
      localStorage.setItem('localPendingUpdateChanges', JSON.stringify(updatedPending))
    } catch (err) {
      setError(String(err))
      // Revert optimistic update on error
      const revertPending = { ...newPending }
      delete revertPending[requestId]
      setPendingChanges(revertPending)
      localStorage.setItem('localPendingUpdateChanges', JSON.stringify(revertPending))
      loadUpdateRequests()
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId)
    
    // Optimistic update
    const newPending = { ...pendingChanges }
    newPending[requestId] = { status: 'rejected', _timestamp: Date.now() }
    setPendingChanges(newPending)
    localStorage.setItem('localPendingUpdateChanges', JSON.stringify(newPending))
    
    setUpdateRequests(prev => prev.filter(r => r.id !== requestId))
    
    try {
      const response = await fetch(`/api/updates/${requestId}`, {
        method: 'DELETE',
        headers: {
          'x-admin-key': adminApiKey
        }
      })
      if (!response.ok) throw new Error('Failed to reject')
      
      // Clear pending change on success
      const updatedPending = { ...newPending }
      delete updatedPending[requestId]
      setPendingChanges(updatedPending)
      localStorage.setItem('localPendingUpdateChanges', JSON.stringify(updatedPending))
    } catch (err) {
      setError(String(err))
      // Revert optimistic update on error
      const revertPending = { ...newPending }
      delete revertPending[requestId]
      setPendingChanges(revertPending)
      localStorage.setItem('localPendingUpdateChanges', JSON.stringify(revertPending))
      loadUpdateRequests()
    } finally {
      setProcessingId(null)
    }
  }

  const filteredRequests = updateRequests.filter(req => {
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter
    const matchesSearch = req.clubName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.requestedBy.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const stats = {
    total: updateRequests.length,
    pending: updateRequests.filter(r => r.status === 'pending').length,
    approved: updateRequests.filter(r => r.status === 'approved').length,
    rejected: updateRequests.filter(r => r.status === 'rejected').length,
  }

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Update Requests</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">Review and manage club information update requests</p>
        </div>
        <button
          onClick={() => loadUpdateRequests()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 font-medium whitespace-nowrap"
          title="Refresh update requests"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <AlertCircle className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.total}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Requests</div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Clock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.pending}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending</div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.approved}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Approved</div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.rejected}
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Rejected</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card p-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by club name or requester..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              statusFilter === 'pending'
                ? 'bg-yellow-600 dark:bg-yellow-500 text-white'
                : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100'
            }`}
          >
            <Clock className="h-4 w-4" />
            Pending ({stats.pending})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              statusFilter === 'approved'
                ? 'bg-green-600 dark:bg-green-500 text-white'
                : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            Approved ({stats.approved})
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              statusFilter === 'rejected'
                ? 'bg-red-600 dark:bg-red-500 text-white'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100'
            }`}
          >
            <XCircle className="h-4 w-4" />
            Rejected ({stats.rejected})
          </button>
        </div>
      </div>

      {/* Update Requests List */}
      {loading ? (
        <div className="card p-8 text-center text-gray-500">Loading update requests...</div>
      ) : error ? (
        <div className="card p-8 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
          Error: {error}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
          No update requests found
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => (
            <div
              key={req.id}
              className="card p-4 hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{req.clubName}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        req.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        req.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {req.status && typeof req.status === 'string' 
                          ? req.status.charAt(0).toUpperCase() + req.status.slice(1)
                          : 'Unknown'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Requested by {req.requestedBy} on {new Date(req.requestedAt).toLocaleDateString()}
                    </p>
                  </div>
                  {expandedId === req.id ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </button>

              {expandedId === req.id && (
                <div className="mt-4 space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                  {/* Update Type */}
                  <div className="bg-gray-50 dark:bg-gray-900/30 p-3 rounded">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Update Type</div>
                    <div className="text-sm text-gray-900 dark:text-white">{req.updateType || 'Not specified'}</div>
                  </div>

                  {/* Suggested Change */}
                  <div className="bg-gray-50 dark:bg-gray-900/30 p-3 rounded">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Suggested Change</div>
                    <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{req.suggestedChange || 'Not specified'}</div>
                  </div>

                  {/* Contact Email */}
                  <div className="bg-gray-50 dark:bg-gray-900/30 p-3 rounded">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Contact Email</div>
                    <a href={`mailto:${req.contactEmail}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{req.contactEmail}</a>
                  </div>

                  {/* Additional Notes */}
                  {req.additionalNotes && (
                    <div className="bg-gray-50 dark:bg-gray-900/30 p-3 rounded">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Additional Notes</div>
                      <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{req.additionalNotes}</div>
                    </div>
                  )}

                  {/* Action Buttons - Available for all statuses */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={processingId === req.id}
                      className={`text-sm flex items-center gap-2 px-3 py-2 rounded transition-colors ${
                        req.status === 'approved'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'btn-primary'
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={processingId === req.id}
                      className={`text-sm flex items-center gap-2 px-3 py-2 rounded transition-colors ${
                        req.status === 'rejected'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'btn-secondary'
                      }`}
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this update request? This cannot be undone.')) {
                          handleReject(req.id)
                        }
                      }}
                      disabled={processingId === req.id}
                      className="text-sm flex items-center gap-2 px-3 py-2 rounded bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
