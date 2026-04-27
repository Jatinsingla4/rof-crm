import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';
import { colors, spacing } from '@rof-crm/design-system';
import { Menu, LogOut } from 'lucide-react';

/**
 * Layout Component - Main application shell
 * Includes sidebar (220px) + top navbar (56px) + main content area
 */
export default function Layout() {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/consumers', label: 'Consumers', icon: '👥' },
    { path: '/units', label: 'Units', icon: '🏢' },
    { path: '/allotments/new', label: 'Allotments', icon: '📋' },
    { path: '/payments', label: 'Payments', icon: '💰' },
    { path: '/documents', label: 'Documents', icon: '📄' },
    { path: '/communications', label: 'Communications', icon: '💬' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', background: colors.neutral[50] }}>
      {/* Sidebar */}
      <aside
        style={{
          width: sidebarOpen ? '220px' : '64px',
          background: '#001529',
          color: '#FFFFFF',
          padding: spacing.md,
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 300ms ease-in-out',
          borderRight: `1px solid ${colors.neutral[300]}`,
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: '48px',
            marginBottom: spacing.lg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: 'bold',
          }}
        >
          {sidebarOpen ? 'ROF CRM' : '🔶'}
        </div>

        {/* Navigation Items */}
        <nav style={{ flex: 1 }}>
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.sm,
                width: '100%',
                border: 'none',
                background: location.pathname === item.path ? '#0050B3' : 'transparent',
                color: '#FFFFFF',
                cursor: 'pointer',
                borderRadius: '4px',
                marginBottom: spacing.xs,
                transition: 'background 150ms',
                fontSize: '14px',
              }}
            >
              <span>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.sm,
            width: '100%',
            border: 'none',
            background: 'transparent',
            color: '#FFFFFF',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          <LogOut size={16} />
          {sidebarOpen && <span>Logout</span>}
        </button>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top Navbar */}
        <header
          style={{
            height: '56px',
            background: '#FFFFFF',
            borderBottom: `1px solid ${colors.neutral[300]}`,
            display: 'flex',
            alignItems: 'center',
            padding: `0 ${spacing.lg}`,
            gap: spacing.lg,
          }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0',
              color: colors.neutral[800],
            }}
          >
            <Menu size={24} />
          </button>

          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>ROF CRM</h1>
          </div>

          {/* User info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            <span style={{ fontSize: '14px', color: colors.neutral[700] }}>{user?.name}</span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: colors.primary[500],
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
              }}
            >
              {user?.name?.charAt(0) || 'U'}
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main
          style={{
            flex: 1,
            overflow: 'auto',
            padding: spacing.lg,
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
