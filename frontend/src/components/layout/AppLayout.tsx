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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name: string) =>
    name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050510] text-slate-100">
      <aside className="hidden w-72 flex-col border-r border-white/10 bg-slate-950/70 backdrop-blur-xl md:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-indigo-500 to-cyan-400 text-sm font-bold text-white shadow-lg shadow-cyan-500/20">
            B
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight">Briefr</div>
            <div className="text-xs text-slate-500">Meeting intelligence</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${isActive ? 'bg-cyan-500/15 text-cyan-400' : 'bg-white/5 text-slate-500'}`}>
                      <Icon size={16} />
                    </span>
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-[14px] border border-white/10 px-3 py-2.5 text-sm text-slate-400 transition-all hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-20 items-center justify-between border-b border-white/10 bg-slate-950/70 px-5 backdrop-blur-xl sm:px-8 lg:px-12">
          <div className="flex w-full max-w-xl items-center gap-3 rounded-[14px] border border-white/10 bg-white/5 px-4 py-2.5">
            <Search size={16} className="text-slate-500" />
            <input
              type="text"
              placeholder="Search transcripts, tasks..."
              className="w-full border-none bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="ml-4 flex items-center gap-3">
            <button aria-label="Notifications" className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-slate-200">
              <Bell size={16} />
            </button>

            <div className="hidden items-center gap-3 rounded-[14px] border border-white/10 bg-white/5 px-3 py-2 sm:flex">
              <div className="text-right">
                <div className="text-sm font-medium text-slate-200">{user?.name || 'User'}</div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {user?.role === 'admin' ? 'Admin' : 'Member'}
                </div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-xs font-semibold text-slate-200">
                {user ? getInitials(user.name) : '??'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-5 py-8 sm:px-8 lg:px-12 lg:py-10 xl:px-14">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
