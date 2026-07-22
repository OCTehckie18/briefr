import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Columns3,
  CalendarDays,
  History,
  Search,
  Bell,
  LogOut,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../store/AuthContext';

export const AppLayout: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    ...(isAdmin ? [{ to: '/ingest', label: 'Ingest', icon: FileText, end: false }] : []),
    { to: '/kanban', label: 'Kanban', icon: Columns3, end: false },
    { to: '/calendar', label: 'Calendar', icon: CalendarDays, end: false },
    { to: '/history', label: 'History', icon: History, end: false },
  ];

  const handleLogout = () => { logout(); navigate('/login'); };

  const getInitials = (name: string) =>
    name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050510]">
      {/* ═══ Sidebar ═══ */}
      <aside className="w-[240px] h-full flex flex-col shrink-0 border-r border-white/[0.06] bg-[#050510]">
        {/* Brand */}
        <div className="h-[60px] flex items-center px-5 gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/20">
            B
          </div>
          <span className="text-lg font-bold text-white tracking-tight">Briefr</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Main</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-white/[0.06] text-white border border-white/[0.06]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] border border-transparent'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? 'text-cyan-400' : ''} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/[0.06] space-y-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent"
          >
            <LogOut size={18} strokeWidth={1.8} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ═══ Main Area ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-[60px] flex items-center justify-between px-6 shrink-0 border-b border-white/[0.06] bg-[#050510]/90 backdrop-blur-md z-10">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg w-[320px] focus-within:border-cyan-500/50 focus-within:bg-white/[0.05] transition-all">
            <Search size={15} className="text-slate-500" />
            <input
              type="text"
              placeholder="Search transcripts, tasks..."
              className="bg-transparent border-none outline-none text-sm text-slate-200 w-full placeholder:text-slate-600"
            />
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors">
              <Bell size={18} />
            </button>
            <div className="h-5 w-px bg-white/[0.06]" />
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold text-slate-200 leading-tight">{user?.name || 'User'}</span>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{user?.role === 'admin' ? 'Admin' : 'Member'}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 border border-white/[0.06] flex items-center justify-center text-xs font-bold text-slate-300">
                {user ? getInitials(user.name) : '??'}
              </div>
            </div>
          </div>
        </header>

        {/* Canvas */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#050510]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
