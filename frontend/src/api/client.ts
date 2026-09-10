import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

export default api

// ── Analyze ──────────────────────────────────────────────────────────

export interface AnalysisResult {
  query_name: string
  is_tunneling: boolean
  confidence: number
  risk_score: number
  high_volume_flag: boolean
  low_and_slow_flag: boolean
  evidence_text: string
  feature_contributions: { feature: string; value: number; impact: number }[]
  raw_features: Record<string, number>
}

export const analyzeSingle = (payload: {
  query_name: string
  query_type: string
  response_code: string
  response_len: number
  ttl: number
  source_ip?: string
}) => api.post<AnalysisResult>('/analyze/single', payload)

export const analyzeBatch = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post<{ job_id: string; total_records: number; flagged_count: number; results: AnalysisResult[] }>(
    '/analyze/batch',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }
  )
}

export const analyzePcap = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post<{ job_id: string; total_records: number; flagged_count: number; results: AnalysisResult[] }>(
    '/analyze/pcap',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }
  )
}

export const getHistory = (page = 1, page_size = 20, only_flagged = false) =>
  api.get('/analyze/history', { params: { page, page_size, only_flagged } })

// ── Dashboard ─────────────────────────────────────────────────────────

export const getDashboard = () => api.get('/dashboard/summary')

// ── Chat ──────────────────────────────────────────────────────────────

export interface ChatSession {
  id: string
  title: string | null
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: number
  session_id: string
  role: 'user' | 'assistant'
  content: string
  metadata_json: string | null
  created_at: string
}

export const createChatSession = (title?: string) =>
  api.post<ChatSession>('/chat/sessions', { title })

export const listChatSessions = (search?: string) =>
  api.get<ChatSession[]>('/chat/sessions', { params: search ? { search } : {} })

export const getChatMessages = (session_id: string) =>
  api.get<ChatMessage[]>(`/chat/sessions/${session_id}`)

export const deleteChatSession = (session_id: string) =>
  api.delete(`/chat/sessions/${session_id}`)

export const deleteChatMessage = (message_id: number) =>
  api.delete(`/chat/messages/${message_id}`)

export const renameChatSession = (session_id: string, title: string) =>
  api.patch(`/chat/sessions/${session_id}/title`, { title })

// ── Settings ─────────────────────────────────────────────────────────

export interface Settings {
  theme_mode: string
  primary_color: string
  accent_color: string
  background_color: string
  font_size: string
  openrouter_model: string
  search_provider: string
  burst_threshold: number
  entropy_threshold: number
  beaconing_threshold: number
  has_api_key: boolean
}

export const getSettings = () => api.get<Settings>('/settings')
export const updateSettings = (patch: Partial<Settings> & { openrouter_api_key?: string }) =>
  api.patch<Settings>('/settings', patch)

// ── Lookup ────────────────────────────────────────────────────────────

export const lookupDomain = (domain: string) =>
  api.post('/lookup/domain', { domain })
