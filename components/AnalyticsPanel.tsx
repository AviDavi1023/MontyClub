'use client'

import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Users, Clock, Download, AlertTriangle } from 'lucide-react'
import { Club, RegistrationCollection } from '@/types/club'

interface AnalyticsPanelProps {
  clubs: Club[]
  collections: RegistrationCollection[]
  activeCollectionId?: string | null
}

export function AnalyticsPanel({ clubs, collections, activeCollectionId }: AnalyticsPanelProps) {
  const [stats, setStats] = useState<any>({})
  const [categoryBreakdown, setCategoryBreakdown] = useState<Array<{ name: string; count: number }>>([])
  const [collectionStats, setCollectionStats] = useState<Array<{ name: string; count: number }>>([])
  const [allCollectionsData, setAllCollectionsData] = useState<Array<{ collection: RegistrationCollection; clubs: Club[] }>>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'all'>('month')
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(activeCollectionId || 'all')
  
  // Update selected collection when active collection changes
  useEffect(() => {
    if (activeCollectionId && activeCollectionId !== selectedCollectionId) {
      setSelectedCollectionId(activeCollectionId)
    }
  }, [activeCollectionId])

  useEffect(() => {
    loadAnalytics()
  }, [selectedCollectionId])

  const loadAnalytics = async () => {
    try {
      setLoading(true)

      console.log('[AnalyticsPanel] Starting analytics load, selectedCollectionId:', selectedCollectionId)

      // Fetch all collections' clubs for accurate stats
      const response = await fetch('/api/admin/all-collections-clubs')
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[AnalyticsPanel] API error:', response.status, errorText)
        throw new Error(`Failed to fetch collections clubs: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('[AnalyticsPanel] API response:', data)
      
      const collectionsData = data.data || []
      console.log(`[AnalyticsPanel] Received ${collectionsData.length} collections with data`)
      
      // Log each collection and its clubs count
      collectionsData.forEach((item: any, idx: number) => {
        console.log(`[AnalyticsPanel] Collection ${idx}: ${item.collection?.name || 'Unknown'} (${item.collection?.id || 'no-id'}) has ${(item.clubs || []).length} clubs`)
      })
      
      setAllCollectionsData(collectionsData)

      // Flatten all clubs from all collections
      const allClubs = collectionsData.flatMap((item: any) => item.clubs || [])
      console.log(`[AnalyticsPanel] Total clubs across all collections: ${allClubs.length}`)

      // Filter clubs by selected collection if not 'all'
      let filteredClubs = allClubs
      let displayCollectionName = 'All Collections'
      
      if (selectedCollectionId !== 'all') {
        const selectedData = collectionsData.find((item: any) => item.collection.id === selectedCollectionId)
        if (selectedData) {
          filteredClubs = selectedData.clubs || []
          displayCollectionName = selectedData.collection.name
          console.log(`[AnalyticsPanel] Filtered to ${filteredClubs.length} clubs from collection: ${displayCollectionName}`)
        } else {
          console.warn(`[AnalyticsPanel] Collection ${selectedCollectionId} not found in data`)
        }
      }

      // Calculate statistics from filtered clubs
      const totalClubs = filteredClubs.length
      const activeClubs = filteredClubs.filter((c: Club) => c.active).length
      const avgMeetingsPerWeek = totalClubs > 0 ? filteredClubs.reduce((sum: number, c: Club) => {
        // Estimate based on meeting frequency
        return sum + (c.meetingFrequency === 'Weekly' ? 1 : c.meetingFrequency === 'Bi-weekly' ? 0.5 : 0.25)
      }, 0) / totalClubs : 0

      // Category breakdown
      const categories: Record<string, number> = {}
      filteredClubs.forEach((c: Club) => {
        const cat = c.category || 'Uncategorized'
        categories[cat] = (categories[cat] || 0) + 1
      })
      const categoryData = Object.entries(categories)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)

      // Collection statistics - count clubs per collection
      const collectionData = collectionsData.map((item: any) => ({
        name: item.collection.name,
        count: (item.clubs || []).length
      }))

      // Meeting frequency breakdown
      const meetingFrequency: Record<string, number> = {}
      filteredClubs.forEach((c: Club) => {
        const freq = c.meetingFrequency || 'Unknown'
        meetingFrequency[freq] = (meetingFrequency[freq] || 0) + 1
      })

      console.log('[AnalyticsPanel] Calculated stats:', {
        totalClubs,
        activeClubs,
        avgMeetingsPerWeek: avgMeetingsPerWeek.toFixed(2),
        categoryCount: categoryData.length,
        collectionCount: collectionData.length
      })

      setStats({
        totalClubs,
        activeClubs,
        inactiveClubs: totalClubs - activeClubs,
        avgMeetingsPerWeek: avgMeetingsPerWeek.toFixed(2),
        clubsWithAnnouncements: filteredClubs.filter((c: Club) => c.announcement).length,
        totalCollections: collections.length,
        meetingFrequency,
        displayCollectionName
      })

      setCategoryBreakdown(categoryData)
      setCollectionStats(collectionData)
    } catch (error) {
      console.error('[AnalyticsPanel] Failed to load analytics:', error)
      // Set empty stats to prevent undefined errors
      setStats({
        totalClubs: 0,
        activeClubs: 0,
        inactiveClubs: 0,
        avgMeetingsPerWeek: '0.00',
        clubsWithAnnouncements: 0,
        totalCollections: collections.length,
        meetingFrequency: {},
        displayCollectionName: 'Error Loading Data',
        error: String(error)
      })
    } finally {
      setLoading(false)
    }
  }


  const exportData = () => {
    const displayCollectionName = selectedCollectionId === 'all' ? 'All Collections' : collections.find(c => c.id === selectedCollectionId)?.name || 'Unknown'
    
    const data = {
      exportDate: new Date().toISOString(),
      stats,
      categoryBreakdown,
      collectionStats,
    }

    const csv = [
      ['Club Statistics Export'],
      ['Generated:', new Date().toLocaleString()],
      ['Data Source:', displayCollectionName],
      [''],
      ['Summary Statistics'],
      ['Total Clubs', stats.totalClubs],
      ['Active Clubs', stats.activeClubs],
      ['Inactive Clubs', stats.inactiveClubs],
      ['Clubs with Announcements', stats.clubsWithAnnouncements],
      ['Average Meetings Per Week', stats.avgMeetingsPerWeek],
      [''],
      ['Category Breakdown'],
      ['Category', 'Count'],
      ...categoryBreakdown.map(c => [c.name, c.count]),
      [''],
      ['Meeting Frequency'],
      ['Frequency', 'Count'],
      ...Object.entries(stats.meetingFrequency || {}).map(([freq, count]) => [freq, count]),
    ]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const collectionName = selectedCollectionId === 'all' ? 'all-collections' : collections.find(c => c.id === selectedCollectionId)?.name?.toLowerCase().replace(/\s+/g, '-') || 'unknown'
    a.download = `club-statistics-${collectionName}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Statistics</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">Club insights and distribution analysis</p>
        </div>
        <button
          onClick={exportData}
          className="btn-secondary flex items-center gap-2 whitespace-nowrap"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-500">Loading statistics...</div>
      ) : stats.error ? (
        <div className="card p-8 text-center">
          <div className="text-red-600 dark:text-red-400 mb-4">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">Failed to Load Analytics</h3>
            <p className="text-sm">{stats.error}</p>
          </div>
          <button
            onClick={loadAnalytics}
            className="btn-primary mt-4"
          >
            Try Again
          </button>
          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            <p>Check browser console for detailed error logs</p>
          </div>
        </div>
      ) : (
        <>
          {/* Collection Filter */}
          {collections.length > 1 && (
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Data Source</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {selectedCollectionId === 'all'
                      ? 'Showing all clubs across all collections'
                      : `Showing ${collections.find(c => c.id === selectedCollectionId)?.name || 'Unknown'} collection`}
                  </p>
                </div>
                <select
                  value={selectedCollectionId}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Collections</option>
                  {collections.map(col => (
                    <option key={col.id} value={col.id}>
                      {col.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <div className="card p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats.totalClubs}
                  </div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Clubs</div>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats.activeClubs}
                  </div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Active</div>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Clock className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats.avgMeetingsPerWeek}
                  </div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Meetings/Week</div>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <BarChart3 className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stats.clubsWithAnnouncements}
                  </div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">With Announcements</div>
                </div>
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Top Categories</h2>
            {categoryBreakdown.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No clubs with categories</p>
            ) : (
              <div className="flex flex-col lg:flex-row gap-8 items-center">
                {/* Pie Chart */}
                <div className="relative w-64 h-64 flex-shrink-0">
                  <svg viewBox="0 0 200 200" className="w-full h-full">
                    {(() => {
                      const total = categoryBreakdown.reduce((sum, cat) => sum + cat.count, 0)
                      let currentAngle = -90 // Start at top
                      const colors = [
                        'rgb(59, 130, 246)',   // blue
                        'rgb(16, 185, 129)',   // green
                        'rgb(249, 115, 22)',   // orange
                        'rgb(168, 85, 247)',   // purple
                        'rgb(236, 72, 153)',   // pink
                        'rgb(251, 191, 36)',   // amber
                        'rgb(14, 165, 233)',   // sky
                        'rgb(239, 68, 68)',    // red
                      ]
                      return categoryBreakdown.map((cat, idx) => {
                        const percentage = cat.count / total
                        const angle = percentage * 360
                        const startAngle = currentAngle
                        const endAngle = currentAngle + angle
                        currentAngle = endAngle

                        // Convert angles to radians
                        const startRad = (startAngle * Math.PI) / 180
                        const endRad = (endAngle * Math.PI) / 180

                        // Calculate arc path
                        const x1 = 100 + 90 * Math.cos(startRad)
                        const y1 = 100 + 90 * Math.sin(startRad)
                        const x2 = 100 + 90 * Math.cos(endRad)
                        const y2 = 100 + 90 * Math.sin(endRad)
                        const largeArc = angle > 180 ? 1 : 0

                        return (
                          <path
                            key={cat.name}
                            d={`M 100 100 L ${x1} ${y1} A 90 90 0 ${largeArc} 1 ${x2} ${y2} Z`}
                            fill={colors[idx % colors.length]}
                            className="hover:opacity-80 transition-opacity cursor-pointer"
                          >
                            <title>{cat.name}: {cat.count} ({(percentage * 100).toFixed(1)}%)</title>
                          </path>
                        )
                      })
                    })()}
                  </svg>
                </div>

                {/* Legend */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(() => {
                    const colors = [
                      'rgb(59, 130, 246)',
                      'rgb(16, 185, 129)',
                      'rgb(249, 115, 22)',
                      'rgb(168, 85, 247)',
                      'rgb(236, 72, 153)',
                      'rgb(251, 191, 36)',
                      'rgb(14, 165, 233)',
                      'rgb(239, 68, 68)',
                    ]
                    return categoryBreakdown.map((cat, idx) => (
                      <div key={cat.name} className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: colors[idx % colors.length] }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {cat.name}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {cat.count} ({((cat.count / stats.totalClubs) * 100).toFixed(1)}%)
                          </div>
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Meeting Frequency Distribution */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Meeting Frequency</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(stats.meetingFrequency || {}).length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 col-span-full">No data available</p>
              ) : (
                Object.entries(stats.meetingFrequency || {}).map(([freq, count]: [string, any]) => (
                  <div
                    key={freq}
                    className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400">{freq}</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{count}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {((count / stats.totalClubs) * 100).toFixed(1)}% of clubs
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Collections Performance */}
          {collections.length > 0 && (
            <div className="card p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Collections Overview</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {collectionStats.map(col => (
                  <div
                    key={col.name}
                    className="p-4 bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-lg border border-primary-200 dark:border-primary-800"
                  >
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{col.name}</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{col.count}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                      clubs in this collection
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Insights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Active Clubs</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {stats.activeClubs} / {stats.totalClubs}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${(stats.activeClubs / stats.totalClubs) * 100}%` }}
                  ></div>
                </div>

                <div className="flex justify-between items-center text-sm mt-4">
                  <span className="text-gray-600 dark:text-gray-400">Inactive Clubs</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {stats.inactiveClubs} / {stats.totalClubs}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-red-600 h-2 rounded-full"
                    style={{ width: `${(stats.inactiveClubs / stats.totalClubs) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Collections</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{stats.totalCollections}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Unique Categories</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{categoryBreakdown.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Data Updated</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {new Date().toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
