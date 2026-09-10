import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { ShieldAlert, Shield, Zap, Clock, TrendingUp, Activity } from 'lucide-react'
import { getDashboard } from '../api/client'

const COLORS = ['var(--color-primary)', 'var(--color-accent)', 'var(--color-warning)', 'var(--color-danger)']

function StatCard({
  icon: Icon, title, value, sub, color = 'var(--color-primary)'
}: { icon: any; title: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <div style={{
        width: '48px', height: '48px', borderRadius: '12px',
        background: `${color}22`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.2, color: 'var(--color-text)' }}>{value}</div>
        {sub && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{sub}</div>}
      </div>
    </div>
  )
}

function RiskBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'var(--color-danger)' : score >= 40 ? 'var(--color-warning)' : 'var(--color-success)'
  return (
    <span style={{
      padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700,
      background: `${color}22`, color, border: `1px solid ${color}44`,
    }}>
      {score?.toFixed(0) ?? '—'}/100
    </span>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDashboard().then(r => {
      setData(r.data)
      setLoading(false)
    }).catch(() => {
      setError('Could not load dashboard data. Is the backend running?')
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: '100px' }} />)}
      </div>
    </div>
  )

  if (error) return (
    <div style={{ padding: '2rem' }}>
      <div className="card" style={{ color: 'var(--color-danger)', textAlign: 'center', padding: '2rem' }}>
        <ShieldAlert size={40} style={{ margin: '0 auto 1rem' }} />
        <div>{error}</div>
      </div>
    </div>
  )

  const pieData = [
    { name: 'Benign', value: (data?.total_scans || 0) - (data?.flagged_count || 0) },
    { name: 'Tunneling', value: data?.flagged_count || 0 },
  ]

  return (
    <div style={{ padding: '2rem' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Activity size={24} color="var(--color-primary)" />
          Threat Intelligence Dashboard
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Real-time overview of DNS traffic analysis
        </p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard icon={Activity} title="Total Scans" value={data?.total_scans ?? 0} sub="All time" />
        <StatCard icon={ShieldAlert} title="Flagged as Tunneling" value={data?.flagged_count ?? 0}
          sub={`${data?.total_scans ? ((data.flagged_count/data.total_scans)*100).toFixed(1) : 0}% of all scans`}
          color="var(--color-danger)" />
        <StatCard icon={Zap} title="High Volume" value={data?.high_volume_count ?? 0}
          sub="Burst/flood attacks" color="var(--color-warning)" />
        <StatCard icon={Clock} title="Low & Slow" value={data?.low_and_slow_count ?? 0}
          sub="Beaconing attacks" color="var(--color-accent)" />
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* Risk over time */}
        <div className="card">
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={16} color="var(--color-primary)" /> Risk Score Over Time (14 days)
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data?.risk_over_time || []}>
              <defs>
                <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)' }}
              />
              <Area type="monotone" dataKey="avg_risk" stroke="var(--color-primary)" fill="url(#riskGrad)" strokeWidth={2} name="Avg Risk" />
              <Area type="monotone" dataKey="flagged" stroke="var(--color-danger)" fill="none" strokeWidth={1.5} strokeDasharray="4 2" name="Flagged" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '1rem', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={16} color="var(--color-primary)" /> Traffic Classification
          </h2>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value">
                <Cell fill="var(--color-success)" />
                <Cell fill="var(--color-danger)" />
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)' }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
            <span><span style={{ color: 'var(--color-success)' }}>●</span> Benign</span>
            <span><span style={{ color: 'var(--color-danger)' }}>●</span> Tunneling</span>
          </div>
        </div>
      </div>

      {/* Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Top offending domains */}
        <div className="card">
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={16} color="var(--color-danger)" /> Top Offending Domains
          </h2>
          {(data?.top_offending_domains || []).length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>
              No flagged domains yet. Run an analysis to populate this.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data?.top_offending_domains || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                <YAxis type="category" dataKey="domain" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} width={120} />
                <Tooltip contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)' }} />
                <Bar dataKey="count" fill="var(--color-danger)" radius={[0, 4, 4, 0]} name="Flagged Count" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent flagged sessions */}
        <div className="card">
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={16} color="var(--color-accent)" /> Recent Flagged Sessions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
            {(data?.recent_flagged || []).length === 0 ? (
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>
                No flagged sessions yet.
              </div>
            ) : (data?.recent_flagged || []).map((item: any) => (
              <div key={item.id} className="card-flat" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem' }}>
                <ShieldAlert size={14} color="var(--color-danger)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.input_ref}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                    {item.source_type} · {new Date(item.created_at).toLocaleString()}
                  </div>
                </div>
                <RiskBadge score={item.risk_score} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
