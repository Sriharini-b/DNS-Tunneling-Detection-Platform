import { useState, useRef } from 'react'
import {
  Search, Upload, Radio, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Zap, Clock, FileText
} from 'lucide-react'
import { analyzeSingle, analyzeBatch, analyzePcap, AnalysisResult } from '../api/client'

// ── Components ────────────────────────────────────────────────────────────────

function RiskBar({ score }: { score: number }) {
  const color = score >= 70 ? 'var(--color-danger)' : score >= 40 ? 'var(--color-warning)' : 'var(--color-success)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div className="risk-bar" style={{ flex: 1 }}>
        <div className="risk-bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <span style={{ fontSize: '0.875rem', fontWeight: 700, color, minWidth: '45px' }}>{score.toFixed(0)}/100</span>
    </div>
  )
}

function FeatureContribRow({ f }: { f: { feature: string; value: number; impact: number } }) {
  const isPositive = f.impact > 0
  const pct = Math.min(Math.abs(f.impact) * 100, 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
      <span style={{ color: 'var(--color-text-muted)', width: '160px', flexShrink: 0, fontFamily: 'monospace' }}>
        {f.feature}
      </span>
      <span style={{ color: 'var(--color-text)', width: '70px', flexShrink: 0 }}>
        {typeof f.value === 'number' ? f.value.toFixed(3) : f.value}
      </span>
      <div style={{ flex: 1, height: '4px', background: 'var(--color-border)', borderRadius: '9999px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: '9999px',
          background: isPositive ? 'var(--color-danger)' : 'var(--color-success)'
        }} />
      </div>
      <span style={{ color: isPositive ? 'var(--color-danger)' : 'var(--color-success)', width: '50px', textAlign: 'right' }}>
        {isPositive ? '↑' : '↓'}{Math.abs(f.impact).toFixed(3)}
      </span>
    </div>
  )
}

function ResultCard({ result }: { result: AnalysisResult }) {
  const [expanded, setExpanded] = useState(false)
  const isTunnel = result.is_tunneling
  const borderColor = isTunnel ? 'var(--color-danger)' : 'var(--color-success)'
  return (
    <div className="card animate-slide-up" style={{ border: `1px solid ${borderColor}44`, marginBottom: '0.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {isTunnel
          ? <AlertTriangle size={20} color="var(--color-danger)" />
          : <CheckCircle size={20} color="var(--color-success)" />
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {result.query_name}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
            Confidence: {(result.confidence * 100).toFixed(1)}%
            {result.high_volume_flag && <span className="badge badge-danger" style={{ marginLeft: '0.5rem' }}><Zap size={10} /> High Volume</span>}
            {result.low_and_slow_flag && <span className="badge badge-warning" style={{ marginLeft: '0.5rem' }}><Clock size={10} /> Low & Slow</span>}
          </div>
        </div>
        <div style={{ width: '200px' }}>
          <RiskBar score={result.risk_score} />
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="btn-secondary"
          style={{ padding: '0.375rem 0.75rem' }}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Details
        </button>
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Evidence */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Evidence
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.6, padding: '0.75rem', background: 'var(--color-surface-2)', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }}>
              {result.evidence_text}
            </div>
          </div>

          {/* Feature Contributions */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Feature Contributions (SHAP)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {(result.feature_contributions || []).map(f => (
                <FeatureContribRow key={f.feature} f={f} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Single Query Form ─────────────────────────────────────────────────────────

function SingleQueryTab() {
  const [form, setForm] = useState({
    query_name: '', query_type: 'A', response_code: 'NOERROR',
    response_len: 0, ttl: 300, source_ip: ''
  })
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!form.query_name.trim()) return
    setLoading(true); setError(null); setResult(null)
    try {
      const r = await analyzeSingle(form)
      setResult(r.data)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Analysis failed. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.35rem' }}>Query Name *</label>
            <input className="input" placeholder="e.g. aGVsbG8.evil.com" value={form.query_name}
              onChange={e => setForm(f => ({ ...f, query_name: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.35rem' }}>Query Type</label>
            <select className="input" value={form.query_type}
              onChange={e => setForm(f => ({ ...f, query_type: e.target.value }))}
              style={{ cursor: 'pointer' }}>
              {['A','AAAA','TXT','MX','CNAME','NULL','PTR'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.35rem' }}>Response Code</label>
            <select className="input" value={form.response_code}
              onChange={e => setForm(f => ({ ...f, response_code: e.target.value }))}
              style={{ cursor: 'pointer' }}>
              {['NOERROR','NXDOMAIN','SERVFAIL','REFUSED'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.35rem' }}>Response Len</label>
            <input className="input" type="number" value={form.response_len}
              onChange={e => setForm(f => ({ ...f, response_len: Number(e.target.value) }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.35rem' }}>TTL</label>
            <input className="input" type="number" value={form.ttl}
              onChange={e => setForm(f => ({ ...f, ttl: Number(e.target.value) }))} />
          </div>
        </div>
        <button className="btn-primary" onClick={submit} disabled={loading || !form.query_name.trim()}>
          {loading ? '⟳ Analyzing...' : <><Search size={14} /> Analyze Query</>}
        </button>
      </div>
      {error && <div style={{ color: 'var(--color-danger)', fontSize: '0.875rem', marginBottom: '1rem', padding: '0.75rem', background: 'var(--color-danger)11', borderRadius: '0.5rem', border: '1px solid var(--color-danger)33' }}>{error}</div>}
      {result && <ResultCard result={result} />}
    </div>
  )
}

// ── Batch CSV Tab ─────────────────────────────────────────────────────────────

function BatchCsvTab() {
  const [file, setFile] = useState<File | null>(null)
  const [results, setResults] = useState<{ total: number; flagged: number; items: AnalysisResult[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    if (!file) return
    setLoading(true); setError(null); setResults(null)
    try {
      const r = await analyzeBatch(file)
      setResults({ total: r.data.total_records, flagged: r.data.flagged_count, items: r.data.results })
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Batch analysis failed.')
    } finally { setLoading(false) }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          Expected CSV columns: <code style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>timestamp, source_ip, query_name, query_type, response_code, response_len, ttl</code>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }}
            onChange={e => setFile(e.target.files?.[0] || null)} />
          <button className="btn-secondary" onClick={() => inputRef.current?.click()}>
            <Upload size={14} /> {file ? file.name : 'Choose CSV File'}
          </button>
          <button className="btn-primary" onClick={submit} disabled={!file || loading}>
            {loading ? '⟳ Analyzing...' : <><FileText size={14} /> Analyze Batch</>}
          </button>
        </div>
      </div>
      {error && <div style={{ color: 'var(--color-danger)', fontSize: '0.875rem', marginBottom: '1rem', padding: '0.75rem', background: 'var(--color-danger)11', borderRadius: '0.5rem', border: '1px solid var(--color-danger)33' }}>{error}</div>}
      {results && (
        <div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div className="card-flat" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Total:</span>
              <span style={{ fontWeight: 700 }}>{results.total}</span>
            </div>
            <div className="card-flat" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Flagged:</span>
              <span style={{ fontWeight: 700, color: 'var(--color-danger)' }}>{results.flagged}</span>
            </div>
          </div>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {results.items.slice(0, 100).map((r, i) => <ResultCard key={i} result={r} />)}
            {results.items.length > 100 && (
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>
                Showing first 100 of {results.items.length} results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── PCAP Tab ──────────────────────────────────────────────────────────────────

function PcapTab() {
  const [file, setFile] = useState<File | null>(null)
  const [results, setResults] = useState<{ total: number; flagged: number; items: AnalysisResult[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    if (!file) return
    setLoading(true); setError(null); setResults(null)
    try {
      const r = await analyzePcap(file)
      setResults({ total: r.data.total_records, flagged: r.data.flagged_count, items: r.data.results })
    } catch (e: any) {
      setError(e.response?.data?.detail || 'PCAP analysis failed.')
    } finally { setLoading(false) }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          Upload a <code style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>.pcap</code> or <code style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>.pcapng</code> capture file. DNS queries will be extracted and analyzed.
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input ref={inputRef} type="file" accept=".pcap,.pcapng" style={{ display: 'none' }}
            onChange={e => setFile(e.target.files?.[0] || null)} />
          <button className="btn-secondary" onClick={() => inputRef.current?.click()}>
            <Radio size={14} /> {file ? file.name : 'Choose PCAP File'}
          </button>
          <button className="btn-primary" onClick={submit} disabled={!file || loading}>
            {loading ? '⟳ Analyzing...' : <><Upload size={14} /> Analyze PCAP</>}
          </button>
        </div>
      </div>
      {error && <div style={{ color: 'var(--color-danger)', fontSize: '0.875rem', marginBottom: '1rem', padding: '0.75rem', background: 'var(--color-danger)11', borderRadius: '0.5rem', border: '1px solid var(--color-danger)33' }}>{error}</div>}
      {results && (
        <div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div className="card-flat" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>DNS Queries extracted:</span>
              <span style={{ fontWeight: 700 }}>{results.total}</span>
            </div>
            <div className="card-flat" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Flagged:</span>
              <span style={{ fontWeight: 700, color: 'var(--color-danger)' }}>{results.flagged}</span>
            </div>
          </div>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {results.items.slice(0, 100).map((r, i) => <ResultCard key={i} result={r} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TABS = ['Single Query', 'Batch CSV', 'PCAP Upload']

export default function Analyze() {
  const [tab, setTab] = useState(0)

  return (
    <div style={{ padding: '2rem' }} className="animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Search size={24} color="var(--color-primary)" /> DNS Traffic Analyzer
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Classify DNS records as legitimate or tunneling/C2 using ML + rule-based detection
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '0.75rem 1.25rem', fontSize: '0.875rem', fontWeight: 600,
            color: tab === i ? 'var(--color-primary)' : 'var(--color-text-muted)',
            borderBottom: tab === i ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: '-1px', transition: 'color 0.15s',
          }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && <SingleQueryTab />}
      {tab === 1 && <BatchCsvTab />}
      {tab === 2 && <PcapTab />}
    </div>
  )
}
