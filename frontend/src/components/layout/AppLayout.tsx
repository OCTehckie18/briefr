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
  Video,
} from 'lucide-react';
import { useAuth } from '../../store/AuthContext';

export const AppLayout: React.FC = () => {
  const { user, logout, isAdmin, track } = useAuth();
  const navigate = useNavigate();
  const isAcademic = track === 'academic_gd';

  const navItems = isAcademic
    ? [
        { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
        ...(isAdmin ? [{ to: '/ingest', label: 'Analyze Recorded GD', icon: FileText, end: false }] : []),
        ...(isAdmin ? [{ to: '/academic/sessions/new', label: 'Schedule GD', icon: Video, end: false }] : []),
        { to: '/calendar', label: 'GD Calendar', icon: CalendarDays, end: false },
        { to: '/academic/reports', label: 'Evaluation Sheets', icon: History, end: false },
      ]
    : [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
        ...(isAdmin ? [{ to: '/ingest', label: 'Ingest', icon: FileText, end: false }] : []),
        ...(isAdmin ? [{ to: '/meetings/schedule', label: 'Schedule Meeting', icon: Video, end: false }] : []),
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
    <div className={`flex h-screen w-screen overflow-hidden ${isAcademic ? 'academic-app-shell' : 'bg-black text-white'}`}>
      <aside className={`hidden w-72 flex-col md:flex ${isAcademic ? 'academic-sidebar' : 'border-r border-[#202020] bg-black'}`}>
        <div className="flex h-20 items-center gap-3 border-b border-[#202020] px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white bg-white text-sm font-bold text-black">
            B
          </div>
          <div>
          <div className={`text-lg font-normal uppercase tracking-[0.12em] ${isAcademic ? 'text-slate-800' : 'text-white'}`}>Briefr</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#7d7d7d]">{isAcademic ? 'Academic GD' : 'Industry Meetings'}</div>
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
                      ? isAcademic ? 'academic-nav-link--active' : 'border-l-2 border-white bg-[#0a0a0a] text-white'
                      : isAcademic ? 'academic-nav-link' : 'text-[#7d7d7d] hover:bg-[#181818] hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`flex h-8 w-8 items-center justify-center ${isAcademic ? (isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400') : (isActive ? 'bg-white text-black' : 'bg-[#0a0a0a] text-[#5a5a5f]')}`}>
                      <Icon size={16} />
                    </span>
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className={`p-4 ${isAcademic ? 'border-t border-slate-200' : 'border-t border-slate-800'}`}>
          <button
            onClick={handleLogout}
            className={`flex w-full items-center gap-3 rounded-[14px] border px-3 py-2.5 text-sm transition-all ${isAcademic ? 'border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-500' : 'border-white/10 text-slate-400 hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-400'}`}
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className={`flex h-20 items-center justify-between px-5 sm:px-8 lg:px-12 ${isAcademic ? 'academic-header' : 'border-b border-[#202020] bg-black'}`}>
          <div className={`flex w-full max-w-xl items-center gap-3 border px-4 py-2.5 ${isAcademic ? 'border-slate-200 bg-slate-50' : 'border-[#494949] bg-[#181818]'}`}>
            <Search size={16} className={isAcademic ? 'text-indigo-400' : 'text-slate-500'} />
            <input
              type="text"
              placeholder={isAcademic ? 'Search students, sessions, reports...' : 'Search transcripts, tasks...'}
              className={`w-full border-none bg-transparent text-sm outline-none placeholder:text-slate-500 ${isAcademic ? 'text-slate-700' : 'text-slate-200'}`}
            />
          </div>

          <div className="ml-4 flex items-center gap-3">
            <button aria-label="Notifications" className={`flex h-10 w-10 items-center justify-center border transition ${isAcademic ? 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50' : 'border-[#494949] bg-[#181818] text-[#7d7d7d] hover:bg-[#202020] hover:text-white'}`}>
              <Bell size={16} />
            </button>

            <div className={`hidden items-center gap-3 border px-3 py-2 sm:flex ${isAcademic ? 'border-slate-200 bg-white' : 'border-[#202020] bg-[#181818]'}`}>
              <div className="text-right">
                <div className={`text-sm font-medium ${isAcademic ? 'text-slate-700' : 'text-slate-200'}`}>{user?.name || 'User'}</div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  {user?.role === 'admin' ? 'Admin' : 'Member'}
                </div>
              </div>
              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${isAcademic ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-black'}`}>
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
