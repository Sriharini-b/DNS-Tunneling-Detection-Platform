import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../api/client'

interface ThemeState {
  primaryColor: string
  accentColor: string
  backgroundColor: string
  themeMode: 'dark' | 'light' | 'system'
  fontSize: 'sm' | 'md' | 'lg'
  setPrimaryColor: (c: string) => void
  setAccentColor: (c: string) => void
  setBackgroundColor: (c: string) => void
  setThemeMode: (m: 'dark' | 'light' | 'system') => void
  setFontSize: (s: 'sm' | 'md' | 'lg') => void
  applyTheme: () => void
  loadFromServer: () => Promise<void>
  syncToServer: (patch: Partial<ThemeState>) => Promise<void>
}

const FONT_SIZES = { sm: '14px', md: '16px', lg: '18px' }

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      primaryColor: '#10b981',
      accentColor: '#3b82f6',
      backgroundColor: '#0a0a0a',
      themeMode: 'dark',
      fontSize: 'md',

      setPrimaryColor: (c) => { set({ primaryColor: c }); get().applyTheme() },
      setAccentColor: (c) => { set({ accentColor: c }); get().applyTheme() },
      setBackgroundColor: (c) => { set({ backgroundColor: c }); get().applyTheme() },
      setThemeMode: (m) => { set({ themeMode: m }); get().applyTheme() },
      setFontSize: (s) => { set({ fontSize: s }); get().applyTheme() },

      applyTheme: () => {
        const { primaryColor, accentColor, backgroundColor, themeMode, fontSize } = get()
        const root = document.documentElement

        root.style.setProperty('--color-primary', primaryColor)
        root.style.setProperty('--color-accent', accentColor)
        root.style.setProperty('--color-bg', backgroundColor)
        root.style.setProperty('--font-size-scale', FONT_SIZES[fontSize])

        // Derive surface colors from background
        root.classList.remove('theme-light', 'theme-hc')
        if (themeMode === 'light') {
          root.classList.add('theme-light')
        }

        // System preference
        if (themeMode === 'system') {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
          if (!prefersDark) root.classList.add('theme-light')
        }
      },

      loadFromServer: async () => {
        try {
          const data = await api.get('/settings').then(r => r.data)
          set({
            primaryColor: data.primary_color,
            accentColor: data.accent_color,
            backgroundColor: data.background_color,
            themeMode: data.theme_mode,
            fontSize: data.font_size,
          })
          get().applyTheme()
        } catch (e) {
          // Use cached values from persist
          get().applyTheme()
        }
      },

      syncToServer: async (patch) => {
        try {
          const body: Record<string, string> = {}
          if (patch.primaryColor) body.primary_color = patch.primaryColor
          if (patch.accentColor) body.accent_color = patch.accentColor
          if (patch.backgroundColor) body.background_color = patch.backgroundColor
          if (patch.themeMode) body.theme_mode = patch.themeMode
          if (patch.fontSize) body.font_size = patch.fontSize
          await api.patch('/settings', body)
        } catch (e) { /* ignore */ }
      },
    }),
    { name: 'dns-theme' }
  )
)
