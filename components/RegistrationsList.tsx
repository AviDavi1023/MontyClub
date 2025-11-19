'use client'

import { useState, useEffect } from 'react'
import { ClubRegistration } from '@/types/club'
import { FileSpreadsheet, Download, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react'

interface RegistrationsListProps {
  adminApiKey: string
}

export function RegistrationsList({ adminApiKey }: RegistrationsListProps) {
  const [registrations, setRegistrations] = useState<ClubRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadRegistrations = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/club-registration', {
        headers: {
          'x-admin-key': adminApiKey
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load registrations')
      }

      const data = await response.json()
      setRegistrations(data.registrations || [])
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
  }, [adminApiKey])

  const exportToCSV = () => {
    if (registrations.length === 0) return

    const headers = [
      'ID',
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
      'Club Agreement Date'
    ]

    const rows = registrations.map(reg => [
      reg.id,
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
      reg.clubAgreementDate
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `club-registrations-${new Date().toISOString().split('T')[0]}.csv`)
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Club Registrations ({registrations.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadRegistrations}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <button
            onClick={exportToCSV}
            disabled={registrations.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {registrations.length === 0 ? (
        <div className="text-center py-12 px-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <FileSpreadsheet className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No registrations yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Submitted
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Club Name
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                  Advisor
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                  Student Contact
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden xl:table-cell">
                  Meeting
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {registrations.map((reg) => (
                <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={getStatusBadge(reg.status)}>
                      {getStatusIcon(reg.status)}
                      {reg.status.charAt(0).toUpperCase() + reg.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {new Date(reg.submittedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    <div className="max-w-xs">
                      <div className="font-semibold">{reg.clubName}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                        {reg.statementOfPurpose}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">
                    <div>{reg.advisorName}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">{reg.email}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                    <div>{reg.studentContactName}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">{reg.studentContactEmail}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 hidden xl:table-cell">
                    <div>{reg.meetingDay}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">{reg.meetingFrequency}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
