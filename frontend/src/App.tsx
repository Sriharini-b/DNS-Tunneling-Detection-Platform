import { useEffect } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Search, MessageSquare, History,
  Settings, Shield, Activity
} from 'lucide-react'
import clsx from 'clsx'

import Dashboard from './pages/Dashboard'
import Analyze from './pages/Analyze'
import Chat from './pages/Chat'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/Settings'

import { useThemeStore } from './store/themeStore'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/analyze', icon: Search, label: 'Analyze' },
  { to: '/chat', icon: MessageSquare, label: 'AI Chat' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function App() {
  const { loadFromServer, applyTheme } = useThemeStore()
  const location = useLocation()

  useEffect(() => {
    loadFromServer()
  }, [])

  useEffect(() => {
    applyTheme()
  }, [])

  useEffect(() => {
    const route = NAV_ITEMS.find(n => n.to === location.pathname)
    const title = route ? `${route.label} — DNS Shield` : 'DNS Shield — Tunneling Detector'
    document.title = title
  }, [location.pathname])

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '240px',
          minHeight: '100vh',
          background: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem 0.75rem',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 50,
        }}
      >
        {/* Logo */}
        <div style={{ padding: '0 0.5rem 2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px var(--color-primary)44',
          }}>
            <Shield size={20} color="#000" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>DNS Shield</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>TUNNELING DETECTOR</div>
          </div>
        </div>

        {/* Status indicator */}
        <div style={{
          margin: '0 0.25rem 1.5rem',
          padding: '0.5rem 0.75rem',
          background: 'var(--color-surface-2)',
          borderRadius: '0.5rem',
          border: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <Activity size={12} color="var(--color-primary)" />
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>ML Engine Active</span>
          <div style={{
            marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%',
            background: 'var(--color-primary)',
            boxShadow: '0 0 6px var(--color-primary)',
            animation: 'pulse 2s infinite',
          }} />
        </div>

        {/* Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => clsx('sidebar-item', isActive && 'active')}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '0.5rem', borderTop: '1px solid var(--color-border)', marginTop: '1rem' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
            DNS Tunneling Platform v1.0
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ marginLeft: '240px', flex: 1, minHeight: '100vh', overflow: 'auto' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/analyze" element={<Analyze />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}
