'use client'

import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Users, Clock, Download } from 'lucide-react'
import { Club, RegistrationCollection } from '@/types/club'

interface AnalyticsPanelProps {
  clubs: Club[]
  collections: RegistrationCollection[]
  adminApiKey: string
}

export function AnalyticsPanel({ clubs, collections, adminApiKey }: AnalyticsPanelProps) {
  const [stats, setStats] = useState<any>({})
  const [categoryBreakdown, setCategoryBreakdown] = useState<Array<{ name: string; count: number }>>([])
  const [collectionStats, setCollectionStats] = useState<Array<{ name: string; count: number }>>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'all'>('month')

  useEffect(() => {
    loadAnalytics()
  }, [clubs, collections])

  const loadAnalytics = async () => {
    try {
      setLoading(true)

      // Calculate statistics from clubs data
      const totalClubs = clubs.length
      const activeClubs = clubs.filter(c => c.active).length
      const avgMeetingsPerWeek = clubs.reduce((sum, c) => {
        // Estimate based on meeting frequency
        return sum + (c.meetingFrequency === 'Weekly' ? 1 : c.meetingFrequency === 'Bi-weekly' ? 0.5 : 0.25)
      }, 0) / Math.max(totalClubs, 1)

      // Category breakdown
      const categories: Record<string, number> = {}
      clubs.forEach(c => {
        const cat = c.category || 'Uncategorized'
        categories[cat] = (categories[cat] || 0) + 1
      })
      const categoryData = Object.entries(categories)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)

      // Collection statistics
      const collectionData = collections.map(col => ({
        name: col.name,
        count: clubs.filter(c => c.id?.includes(col.id)).length || 0
      }))

      // Meeting frequency breakdown
      const meetingFrequency: Record<string, number> = {}
      clubs.forEach(c => {
        const freq = c.meetingFrequency || 'Unknown'
        meetingFrequency[freq] = (meetingFrequency[freq] || 0) + 1
      })

      setStats({
        totalClubs,
        activeClubs,
        inactiveClubs: totalClubs - activeClubs,
        avgMeetingsPerWeek: avgMeetingsPerWeek.toFixed(2),
        clubsWithAnnouncements: clubs.filter(c => c.announcement).length,
        totalCollections: collections.length,
        meetingFrequency
      })

      setCategoryBreakdown(categoryData)
      setCollectionStats(collectionData)
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportData = () => {
    const data = {
      exportDate: new Date().toISOString(),
      stats,
      categoryBreakdown,
      collectionStats,
      clubs: clubs.map(c => ({
        id: c.id,
        name: c.name,
        category: c.category,
        advisor: c.advisor,
        active: c.active,
        meetingFrequency: c.meetingFrequency
      }))
    }

    const csv = [
      ['Club Analytics Export'],
      ['Generated:', new Date().toLocaleString()],
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
    a.download = `club-analytics-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Analytics</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">Club statistics and performance insights</p>
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
        <div className="card p-8 text-center text-gray-500">Loading analytics...</div>
      ) : (
        <>
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
            <div className="space-y-3">
              {categoryBreakdown.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No clubs with categories</p>
              ) : (
                categoryBreakdown.map(cat => (
                  <div key={cat.name} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">{cat.name}</div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-primary-600 dark:bg-primary-500 h-2 rounded-full transition-all"
                          style={{
                            width: `${(cat.count / stats.totalClubs) * 100}%`
                          }}
                        ></div>
                      </div>
                    </div>
                    <div className="ml-3 text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                      {cat.count} ({((cat.count / stats.totalClubs) * 100).toFixed(1)}%)
                    </div>
                  </div>
                ))
              )}
            </div>
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
