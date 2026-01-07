'use client'

import { 
  LayoutDashboard, 
  Settings, 
  Users, 
  FileText, 
  Megaphone, 
  BarChart3,
  ClipboardList,
  Activity
} from 'lucide-react'

interface AdminSidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
  pendingRegistrationsCount?: number
}

export function AdminSidebar({ 
  activeSection, 
  onSectionChange,
  pendingRegistrationsCount = 0 
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
      label: 'Analytics', 
      icon: BarChart3,
      description: 'Usage statistics'
    },
    { 
      id: 'users', 
      label: 'Admin Users', 
      icon: Users,
      description: 'User management'
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: Settings,
      description: 'System configuration'
    },
    { 
      id: 'activity', 
      label: 'Activity Log', 
      icon: Activity,
      description: 'Recent operations'
    },
  ]

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-[calc(100vh-4rem)] sticky top-16">
      <nav className="flex-1 overflow-y-auto py-6 px-4">
        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={`
                  w-full flex items-center gap-4 px-4 py-3 rounded-lg text-left transition-colors
                  ${isActive 
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold border-l-4 border-primary-600 dark:border-primary-400' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }
                `}
                title={item.description}
              >
                <Icon className={`h-6 w-6 flex-shrink-0 ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{item.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</div>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="flex-shrink-0 px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>
      
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">💡 Pro Tip</p>
          <p>All changes sync automatically across tabs and devices.</p>
        </div>
      </div>
    </aside>
  )
}
