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
    <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-[calc(100vh-4rem)] sticky top-16">
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
                  ${isActive 
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }
                `}
                title={item.description}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
                <span className="flex-1 truncate text-sm">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>
      
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <p className="font-medium mb-1">Quick Tips</p>
          <p>Use sidebar to navigate between sections. Changes sync automatically.</p>
        </div>
      </div>
    </aside>
  )
}
