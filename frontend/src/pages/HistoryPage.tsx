import { useState, useEffect } from 'react'
import { History, ShieldAlert, CheckCircle, ChevronLeft, ChevronRight, FileDown } from 'lucide-react'
import { getHistory } from '../api/client'

export default function HistoryPage() {
  const [page, setPage] = useState(1)
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  const [data, setData] = useState<{ total: number; page: number; page_size: number; items: any[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getHistory(page, 20, onlyFlagged)
      .then(r => { setData(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [page, onlyFlagged])

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1

  const exportHtmlReport = () => {
    if (!data || !data.items || data.items.length === 0) {
      alert('No history records available to export.')
      return
    }

    const items = data.items
    const flaggedCount = items.filter(i => i.is_tunneling).length
    const cleanCount = items.length - flaggedCount
    const avgRisk = Math.round(items.reduce((acc, i) => acc + (i.risk_score || 0), 0) / items.length)

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DNS Tunneling Detection Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #1e293b; background: #fff; }
    h1 { color: #0f172a; margin-bottom: 4px; display: flex; align-items: center; gap: 10px; }
    .subtitle { color: #64748b; font-size: 14px; margin-bottom: 24px; }
    .metrics { display: flex; gap: 16px; margin-bottom: 30px; }
    .metric-card { flex: 1; padding: 16px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; }
    .metric-val { font-size: 24px; font-weight: 700; color: #0f172a; }
    .metric-lbl { font-size: 12px; color: #64748b; text-transform: uppercase; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
    .badge-flagged { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
    .badge-clean { background: #dcfce7; color: #16a34a; border: 1px solid #bbf7d0; }
    .mono { font-family: monospace; }
    @media print { body { margin: 10mm; } button { display: none; } }
  </style>
</head>
<body>
  <h1>🛡️ DNS Tunneling Security Report</h1>
  <div class="subtitle">Generated on ${new Date().toLocaleString()} · Total Scanned in Batch: ${items.length}</div>
  
  <div class="metrics">
    <div class="metric-card">
      <div class="metric-val">${items.length}</div>
      <div class="metric-lbl">Total Records</div>
    </div>
    <div class="metric-card">
      <div class="metric-val" style="color: #dc2626;">${flaggedCount}</div>
      <div class="metric-lbl">Tunneling Detected</div>
    </div>
    <div class="metric-card">
      <div class="metric-val" style="color: #16a34a;">${cleanCount}</div>
      <div class="metric-lbl">Clean Records</div>
    </div>
    <div class="metric-card">
      <div class="metric-val">${avgRisk}/100</div>
      <div class="metric-lbl">Avg Risk Score</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Status</th>
        <th>Query / Ref</th>
        <th>Source</th>
        <th>Risk Score</th>
        <th>Flags</th>
        <th>Timestamp</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => `
        <tr>
          <td>
            <span class="badge ${item.is_tunneling ? 'badge-flagged' : 'badge-clean'}">
              ${item.is_tunneling ? 'FLAGGED' : 'CLEAN'}
            </span>
          </td>
          <td class="mono">${item.input_ref}</td>
          <td>${(item.source_type || '').replace('_', ' ')}</td>
          <td>${item.risk_score != null ? Math.round(item.risk_score) + '/100' : '—'}</td>
          <td>
            ${item.high_volume_flag ? '<span class="badge badge-flagged" style="font-size:10px;">BURST</span> ' : ''}
            ${item.low_and_slow_flag ? '<span class="badge badge-flagged" style="font-size:10px; background:#fef3c7; color:#d97706; border-color:#fde68a;">BEACON</span>' : ''}
            ${!item.high_volume_flag && !item.low_and_slow_flag ? '—' : ''}
          </td>
          <td>${new Date(item.created_at).toLocaleString()}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dns_tunneling_report_${Date.now()}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: '2rem' }} className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <History size={24} color="var(--color-primary)" /> Scan History
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Log of all DNS queries analyzed by the platform
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-primary" onClick={exportHtmlReport}>
            <FileDown size={14} /> Export Report (HTML)
          </button>
          <button className="btn-secondary" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '0' }}>
        {/* Toolbar */}
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyFlagged} onChange={e => { setOnlyFlagged(e.target.checked); setPage(1) }} />
            Show only flagged (tunneling) records
          </label>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Query / File Ref</th>
                <th>Source Type</th>
                <th>Risk Score</th>
                <th>Flags</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    Loading history...
                  </td>
                </tr>
              ) : (data?.items || []).length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    No scan history found.
                  </td>
                </tr>
              ) : (data?.items || []).map(item => (
                <tr key={item.id}>
                  <td>
                    {item.is_tunneling
                      ? <span className="badge badge-danger"><ShieldAlert size={12} /> Flagged</span>
                      : <span className="badge badge-success"><CheckCircle size={12} /> Clean</span>}
                  </td>
                  <td style={{ fontFamily: 'monospace' }}>{item.input_ref}</td>
                  <td style={{ textTransform: 'capitalize' }}>{item.source_type.replace('_', ' ')}</td>
                  <td>{item.risk_score ? `${item.risk_score.toFixed(0)}/100` : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {item.high_volume_flag && <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>Burst</span>}
                      {item.low_and_slow_flag && <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Beacon</span>}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ padding: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            Showing page {page} of {totalPages} ({data?.total || 0} total records)
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" style={{ padding: '0.375rem 0.75rem' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={14} /> Prev
            </button>
            <button className="btn-secondary" style={{ padding: '0.375rem 0.75rem' }} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
