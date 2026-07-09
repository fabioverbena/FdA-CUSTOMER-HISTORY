import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Users, FileText, Monitor, LogOut, LayoutDashboard, BarChart2, Search, Link2 } from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/dashboard',  label: 'Dashboard',  Icon: LayoutDashboard },
  { to: '/clienti',    label: 'Clienti',    Icon: Users },
  { to: '/documenti',  label: 'Documenti',  Icon: FileText },
  { to: '/espositori', label: 'Espositori', Icon: Monitor },
  { to: '/analitiche', label: 'Analitiche', Icon: BarChart2 },
  { to: '/ricerca',    label: 'Ricerca',    Icon: Search },
  { to: '/grenke',     label: 'GRENKE',     Icon: Link2 },
]

export default function Layout() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-100">
          <span className="font-semibold text-slate-800 text-sm">Fior d'Acqua</span>
          <span className="block text-xs text-slate-400 mt-0.5">Customer History</span>
        </div>

        <nav className="flex-1 py-3 px-2">
          {nav.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-1 transition-colors',
                  isActive
                    ? 'bg-sky-50 text-sky-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-slate-100">
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50 w-full transition-colors"
          >
            <LogOut size={16} />
            Esci
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
