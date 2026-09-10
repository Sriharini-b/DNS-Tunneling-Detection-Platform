import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Save, Palette, Cpu, Sliders } from 'lucide-react'
import { useThemeStore } from '../store/themeStore'
import { getSettings, updateSettings } from '../api/client'

export default function Settings() {
  const { themeMode, primaryColor, accentColor, backgroundColor, fontSize,
          setThemeMode, setPrimaryColor, setAccentColor, setBackgroundColor, setFontSize } = useThemeStore()

  const [aiConfig, setAiConfig] = useState({ model: '', provider: '', hasKey: false })
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [thresholds, setThresholds] = useState({ burst: 50, entropy: 3.5, beaconing: 0.1 })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })

  useEffect(() => {
    getSettings().then(r => {
      const d = r.data
      setAiConfig({ model: d.openrouter_model, provider: d.search_provider, hasKey: d.has_api_key })
      setThresholds({ burst: d.burst_threshold, entropy: d.entropy_threshold, beaconing: d.beaconing_threshold })
    })
  }, [])

  const applyPreset = (bg: string, p: string, a: string) => {
    setBackgroundColor(bg); setPrimaryColor(p); setAccentColor(a)
    setThemeMode('dark') // Presets are dark
  }

  const saveAll = async () => {
    setSaving(true); setMsg({ text: '', type: '' })
    try {
      // 1. Sync theme store (updates UI live via Zustand + server sync)
      useThemeStore.getState().syncToServer({
        themeMode, primaryColor, accentColor, backgroundColor, fontSize
      })

      // 2. Sync AI & Thresholds
      await updateSettings({
        openrouter_api_key: apiKeyInput || undefined,
        openrouter_model: aiConfig.model,
        search_provider: aiConfig.provider,
        burst_threshold: thresholds.burst,
        entropy_threshold: thresholds.entropy,
        beaconing_threshold: thresholds.beaconing
      })

      if (apiKeyInput) setAiConfig(c => ({ ...c, hasKey: true }))
      setApiKeyInput('') // Clear input after save
      setMsg({ text: 'Settings saved successfully', type: 'success' })
    } catch (e: any) {
      setMsg({ text: 'Failed to save settings', type: 'error' })
    } finally {
      setSaving(false)
      setTimeout(() => setMsg({ text: '', type: '' }), 3000)
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px' }} className="animate-fade-in">
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <SettingsIcon size={24} color="var(--color-primary)" /> Platform Settings
          </h1>
        </div>
        <button className="btn-primary" onClick={saveAll} disabled={saving}>
          <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {msg.text && (
        <div style={{ marginBottom: '1.5rem', padding: '0.75rem', borderRadius: '0.5rem',
          background: msg.type === 'error' ? 'var(--color-danger)22' : 'var(--color-success)22',
          color: msg.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)',
          border: `1px solid ${msg.type === 'error' ? 'var(--color-danger)44' : 'var(--color-success)44'}`
        }}>
          {msg.text}
        </div>
      )}

      {/* ── Appearance ── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Palette size={18} color="var(--color-primary)" /> Appearance
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Theme Mode</label>
            <select className="input" value={themeMode} onChange={e => setThemeMode(e.target.value as any)}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System Preference</option>
            </select>

            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '1.25rem', marginBottom: '0.5rem' }}>Font Size</label>
            <select className="input" value={fontSize} onChange={e => setFontSize(e.target.value as any)}>
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Custom Colors</label>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Primary</div>
                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                  style={{ width: '40px', height: '40px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Accent</div>
                <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                  style={{ width: '40px', height: '40px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Background</div>
                <input type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)}
                  style={{ width: '40px', height: '40px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
              </div>
            </div>

            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Presets</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => applyPreset('#0a0a0a', '#10b981', '#3b82f6')}>Cyber Green</button>
              <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => applyPreset('#0f172a', '#38bdf8', '#818cf8')}>Midnight Blue</button>
              <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => applyPreset('#000000', '#00ff88', '#00cfff')}>High Contrast</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Configuration ── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Cpu size={18} color="var(--color-primary)" /> AI Configuration (OpenRouter)
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
              API Key (Encrypted at rest)
              {aiConfig.hasKey && <span style={{ color: 'var(--color-success)', marginLeft: '0.5rem', fontSize: '0.75rem' }}>✓ Key configured</span>}
            </label>
            <input
              type="password"
              className="input"
              placeholder={aiConfig.hasKey ? "•••••••••••••••••••• (Set new key to override)" : "sk-or-v1..."}
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Model</label>
              <input type="text" className="input" value={aiConfig.model} onChange={e => setAiConfig(c => ({ ...c, model: e.target.value }))} />
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>Default: openai/gpt-4o-mini</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Web Search Provider</label>
              <select className="input" value={aiConfig.provider} onChange={e => setAiConfig(c => ({ ...c, provider: e.target.value }))}>
                <option value="duckduckgo">DuckDuckGo (Free/Instant)</option>
                <option value="none" disabled>SerpAPI (Coming Soon)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Detection Thresholds ── */}
      <div className="card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sliders size={18} color="var(--color-primary)" /> Detection Thresholds (Advanced)
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Burst Rate (qpm)</label>
            <input type="number" className="input" value={thresholds.burst} onChange={e => setThresholds(t => ({ ...t, burst: Number(e.target.value) }))} step="1" />
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>Queries per minute to trigger high-volume flag</div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Entropy Threshold</label>
            <input type="number" className="input" value={thresholds.entropy} onChange={e => setThresholds(t => ({ ...t, entropy: Number(e.target.value) }))} step="0.1" />
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>Shannon entropy bits (default 3.5)</div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Beaconing Variance</label>
            <input type="number" className="input" value={thresholds.beaconing} onChange={e => setThresholds(t => ({ ...t, beaconing: Number(e.target.value) }))} step="0.01" />
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>Max std-dev for interval regularity</div>
          </div>
        </div>
      </div>
    </div>
  )
}
