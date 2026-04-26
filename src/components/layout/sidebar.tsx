'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Package, Store, Play, TrendingUp,
  FileText, Bell, BarChart3, Settings, ChevronRight,
  Bot, Activity, Zap
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/skus', label: 'SKU Management', icon: Package },
  { href: '/competitors', label: 'Competitors', icon: Store },
  { href: '/monitoring', label: 'Monitoring Runs', icon: Play },
  { href: '/recommendations', label: 'Recommendations', icon: TrendingUp },
  { href: '/logs', label: 'Logs & Proof', icon: FileText },
  { href: '/alerts', label: 'Email Alerts', icon: Bell },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-gray-950 flex flex-col z-40">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-800">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
          <Bot size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">PriceWatch AI</p>
          <p className="text-[10px] text-gray-500 leading-tight">Monitoring Agent</p>
        </div>
      </div>

      <div className="px-3 py-2 mt-2">
        <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-1">Main Menu</p>
        <nav className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group',
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
              >
                <Icon size={16} className={cn(active ? 'text-white' : 'text-gray-500 group-hover:text-white')} />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={14} className="text-indigo-300" />}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="mt-auto px-4 py-4 border-t border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-gray-400">Agent Active</span>
          <Zap size={12} className="text-amber-400 ml-auto" />
        </div>
        <div className="bg-gray-900 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-500">Last run</span>
            <Activity size={10} className="text-gray-600" />
          </div>
          <p className="text-xs text-gray-300 font-medium">27 Apr 2026, 06:48</p>
          <p className="text-[10px] text-emerald-500 mt-0.5">✓ 6 SKUs · 4 mismatches</p>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">A</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white font-medium truncate">Admin User</p>
            <p className="text-[10px] text-gray-500">Administrator</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
