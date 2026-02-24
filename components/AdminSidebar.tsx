'use client'

import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Megaphone, 
  BarChart3,
  ClipboardList,
  Activity,
  Trash2,
  RefreshCw,
  Upload
} from 'lucide-react'

interface AdminSidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
  pendingRegistrationsCount?: number
  refreshCache?: () => void
  refreshingCache?: boolean
  publishSnapshotNow?: () => void
  publishingCatalog?: boolean
  catalogStatus?: { exists: boolean; generatedAt?: string; clubCount?: number } | null
}

export function AdminSidebar({ 
  activeSection, 
  onSectionChange,
  pendingRegistrationsCount = 0,
  refreshCache,
  refreshingCache = false,
  publishSnapshotNow,
  publishingCatalog = false,
  catalogStatus
}: AdminSidebarProps) {
  const menuItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: LayoutDashboard,
      description: 'Overview & quick stats'
    },
    { 
      id: 'registrations', 
      label: 'Registrations', 
      icon: ClipboardList,
      badge: pendingRegistrationsCount,
      description: 'Manage club registrations'
    },
    { 
      id: 'announcements', 
      label: 'Announcements', 
      icon: Megaphone,
      description: 'Club announcements'
    },
    { 
      id: 'updates', 
      label: 'Update Requests', 
      icon: FileText,
      description: 'Club info updates'
    },
    { 
      id: 'analytics', 
      label: 'Statistics', 
      icon: BarChart3,
      description: 'Club insights & analysis'
    },
    { 
      id: 'users', 
      label: 'Admin Users', 
      icon: Users,
      description: 'User management'
    },
    { 
      id: 'activity', 
      label: 'Activity Log', 
      icon: Activity,
      description: 'Recent operations'
    },
    { 
      id: 'clear-data', 
      label: 'Data Reset', 
      icon: Trash2,
      description: 'Clear all data (advanced)',
      variant: 'danger',
      separator: true
    },
  ]

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 sticky top-16 left-0 z-10 h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] overflow-hidden box-border">
      <nav className="flex-1 min-h-0 overflow-y-auto py-4 px-3">
        <div className="space-y-1">
          {menuItems.map((item, index) => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            const showSeparator = (item as any).separator
            
            return (
              <div key={item.id}>
                {showSeparator && index > 0 && (
                  <div className="h-px bg-gray-200 dark:bg-gray-700 my-2 mx-2" />
                )}
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  className={`
                    w-full flex items-start gap-3 px-3 py-2 rounded-lg text-left transition-colors group
                    ${isActive && item.variant !== 'danger'
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold border-l-4 border-primary-600 dark:border-primary-400' 
                    : isActive && item.variant === 'danger'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-semibold border-l-4 border-red-600 dark:border-red-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }
                `}
                  title={item.description}
                >
                  <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${isActive && item.variant !== 'danger' ? 'text-primary-600 dark:text-primary-400' : isActive && item.variant === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm leading-tight">{item.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{item.description}</div>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="flex-shrink-0 px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 whitespace-nowrap">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </nav>
      
      {/* Quick Actions Section */}
      {(refreshCache || publishSnapshotNow) && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-2">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Quick Actions</p>
          
          {/* Publish Catalog Button */}
          {publishSnapshotNow && (
            <div>
              <button
                onClick={publishSnapshotNow}
                disabled={publishingCatalog}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 rounded-lg transition-colors shadow-sm"
                title="Publish changes to public catalog (also refreshes cache)"
              >
                <Upload className={`h-4 w-4 ${publishingCatalog ? 'animate-pulse' : ''}`} />
                {publishingCatalog ? 'Publishing...' : 'Publish Catalog'}
              </button>
              {catalogStatus?.exists && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-1">
                  ✓ {catalogStatus.clubCount} clubs published
                </p>
              )}
              {!catalogStatus?.exists && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 px-1">
                  ⚠ Not yet published
                </p>
              )}
            </div>
          )}
          
          {/* Refresh Cache Button - Secondary/Less Prominent */}
          {refreshCache && (
            <div className="pt-1">
              <button
                onClick={refreshCache}
                disabled={refreshingCache}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-50 rounded transition-colors"
                title="Clear cache to see latest data in admin panel. Note: Publish Catalog automatically refreshes cache, so this is rarely needed separately."
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshingCache ? 'animate-spin' : ''}`} />
                {refreshingCache ? 'Refreshing...' : 'Refresh Cache Only'}
              </button>
              <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-0.5 px-1 leading-tight">
                Advanced: Use only if you need to refresh admin view without publishing
              </p>
            </div>
          )}
        </div>
      )}
      
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Navigation</p>
          <p className="line-clamp-2">Quick access to admin tools.</p>
        </div>
      </div>
    </aside>
  )
}
