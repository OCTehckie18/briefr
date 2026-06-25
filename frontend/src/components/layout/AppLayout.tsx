import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Video, 
  BarChart3, 
  Settings, 
  ChevronLeft, 
  Menu, 
  Search, 
  Bell, 
  LogOut 
} from 'lucide-react';
import { useUiStore } from '../../hooks/useUiStore';
import './AppLayout.css';

export const AppLayout: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/meetings', label: 'Meetings', icon: Video },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-icon">B</div>
            <span className="logo-text">Briefr</span>
          </div>
          {!sidebarCollapsed && (
            <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} />
                    <span className="nav-text">{item.label}</span>
                    {isActive && !sidebarCollapsed && <div className="nav-link-indicator" />}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <NavLink to="/logout" className="nav-link">
            <LogOut size={20} />
            <span className="nav-text">Sign Out</span>
          </NavLink>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-wrapper">
        <header className="app-header">
          <div className="header-left">
            {sidebarCollapsed && (
              <button className="header-toggle-sidebar" onClick={toggleSidebar}>
                <Menu size={20} />
              </button>
            )}
            <div className="header-search">
              <Search size={18} className="text-muted" />
              <input type="text" placeholder="Search meetings, summaries..." />
            </div>
          </div>

          <div className="header-right">
            <button className="sidebar-toggle-btn">
              <Bell size={18} />
            </button>
            <div className="user-profile">
              <div className="user-avatar">JD</div>
              <div className="user-info">
                <span className="user-name">John Doe</span>
                <span className="user-role">Product Manager</span>
              </div>
            </div>
          </div>
        </header>

        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
