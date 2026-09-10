# MASTER BUILD PROMPT — DNS Tunneling Detection & Intelligence Platform
> Paste this entire document into Google Antigravity as your project brief.

---

## 0. ONE-LINE PROJECT SUMMARY

Build a full-stack **DNS Tunneling Detection Platform** that classifies DNS traffic as legitimate or tunneling/C2/exfiltration using machine learning with explainable evidence, supports batch and real-time analysis, includes an **AI research chatbot (powered by OpenRouter)** that can look up any domain/website, summarize what it is, and compare it against our detection criteria, stores all chat history locally, and lets the user fully customize the UI theme and colors from a Settings page.

---

## 1. BACKGROUND / PROBLEM STATEMENT (do not deviate from this)

**Problem ID: CY-04 — DNS Tunneling Detection (Cybersecurity)**

> Analyze DNS traffic to distinguish legitimate DNS activity from covert data-exfiltration or C2 tunneling. Use traffic characteristics such as entropy, query rate, query types, and subdomain behavior. Detect both high-volume and low-and-slow tunneling techniques. Provide evidence explaining why a domain or session was classified as suspicious.

A reference/prior implementation existed as a bare-bones Streamlit + PyCaret demo that only supported single-record manual entry, computed just entropy, and printed a raw prediction dataframe with zero explanation. This new project must **fully replace it** and close every one of these gaps:

| Requirement from problem statement | Must be implemented as |
|---|---|
| Entropy | Shannon entropy PLUS normalized entropy PLUS n-gram entropy |
| Query rate | Rolling time-window aggregation per source/domain |
| Query types | Real distribution analysis (A, AAAA, TXT, MX, CNAME, NULL, PTR) not just a dropdown |
| Subdomain behavior | Label length, label count/depth, digit ratio, character entropy, randomness score, repetition |
| High-volume tunneling | Burst detection via queries-per-minute thresholds + anomaly scoring |
| Low-and-slow tunneling | Time-windowed rolling stats over hours/days, beaconing interval regularity detection |
| Evidence/explanation | Human-readable, per-record reason string + feature contribution (SHAP or rule engine) — NEVER a raw dataframe dump |

---

## 2. HIGH-LEVEL FEATURE LIST (build all of these)

1. **Detection Engine** — ML classifier + feature engineering pipeline (batch + single-record + streaming-style)
2. **Explainability Layer** — every verdict comes with a plain-English "why" plus a feature-importance breakdown
3. **Dashboard** — visual overview: flagged sessions, risk trend over time, top offending domains, query-type breakdown
4. **AI Research Chatbot** (NEW — core differentiator) — powered by OpenRouter API:
   - User types a domain/website name (or a general question)
   - App performs live lookup (WHOIS + DNS records + web search) on that domain
   - The LLM (via OpenRouter) summarizes what the site/domain is and does
   - The LLM then explicitly compares the domain's DNS characteristics against the CY-04 detection criteria (entropy, query pattern, subdomain structure, etc.) and states whether it resembles tunneling/exfiltration behavior, with reasoning
   - Results rendered in a structured card (Summary / Technical DNS Findings / Risk Comparison / Verdict) — not just a wall of chat text
5. **Persistent Local Chat History** — every chat session and message stored in a local database, browsable/searchable, resumable
6. **Fully Customizable UI (Settings page)** — theme (light/dark/system), full color palette customization (primary/accent/background), font size, layout density — saved per user/device
7. **Reports** — export a session's findings as PDF/HTML

---

## 3. TECH STACK (use exactly this unless Antigravity strongly recommends an equivalent)

**Frontend**
- React 18 + TypeScript + Vite
- TailwindCSS with CSS variables for full theremeability (see Section 7)
- shadcn/ui component library
- Recharts for dashboard charts
- Zustand or React Context for global state (theme, active chat session)

**Backend**
- Python 3.11 + FastAPI
- Uvicorn ASGI server
- SQLAlchemy ORM

**Database**
- SQLite for local persistence (chats, settings, scan history, users) — file-based, zero external setup
- Alembic for migrations

**ML / Detection**
- scikit-learn + XGBoost for the classifier (train a fresh model — do not just reuse the old `best_pipeline.pkl`)
- pandas / numpy for feature engineering
- SHAP for explainability
- dnspython for live DNS resolution/record lookups
- python-whois for WHOIS lookups
- scapy or pyshark (optional) for PCAP ingestion

**AI Chatbot**
- OpenRouter API (OpenAI-compatible `/chat/completions` endpoint) — model configurable in Settings (default: a fast, cheap model; let user override)
- A pluggable web-search tool call (SerpAPI, Bing Search API, or DuckDuckGo instant-answer as a free fallback) that the LLM can invoke when the user gives a domain/site name, so the summary is grounded in real, current information rather than the model's own guesses

**Auth (lightweight)**
- Single-user local mode by default (no login wall) — but structure the DB with a `user_id` column so multi-user support can be added later without a rewrite

---

## 4. DETECTION ENGINE — DETAILED SPEC

### 4.1 Input modes
1. **Single query check** — manual form (kept for parity with old app, but enhanced)
2. **Batch CSV upload** — columns: `timestamp, source_ip, query_name, query_type, response_code, response_len, ttl`
3. **PCAP upload** — parse DNS packets out of a `.pcap`/`.pcapng` file into the same schema as #2

### 4.2 Feature engineering (compute ALL of these per record, plus per-session aggregates)

**Per-query features**
- `entropy` — Shannon entropy of the full query string
- `subdomain_entropy` — entropy of just the leftmost label
- `label_count` — number of dot-separated labels
- `max_label_length`, `avg_label_length`
- `digit_ratio` — proportion of digits in the query
- `vowel_consonant_ratio`
- `query_length`
- `response_len`
- `query_type` (one-hot: A, AAAA, TXT, MX, CNAME, NULL, PTR, other)
- `ttl`
- `is_nxdomain` (from response_code)
- `contains_base64_pattern` (regex heuristic for base32/base64-looking payloads)

**Per-session / per-source aggregates (rolling windows: 1 min, 5 min, 1 hr, 24 hr)**
- `query_rate` — queries per minute from this source/domain
- `unique_subdomain_count` — distinct subdomains queried under the same parent domain in the window
- `unique_subdomain_ratio` — unique subdomains / total queries (near 1.0 = suspicious for tunneling)
- `avg_interval_seconds` and `interval_stddev` — regularity of query timing (low stddev + regular interval = beaconing → low-and-slow indicator)
- `burst_score` — z-score of query_rate vs that source's historical baseline (high-volume indicator)
- `nxdomain_ratio` — fraction of queries in window resulting in NXDOMAIN
- `query_type_diversity` — Shannon entropy over the query_type distribution in the window

### 4.3 Classification
- Train a binary classifier (XGBoost primary, Logistic Regression as an interpretable baseline for comparison) on the engineered features
- Output: `is_tunneling` (bool), `confidence` (0–1), `risk_score` (0–100, scaled + weighted combination of model confidence and rule-based aggregate signals)
- **Two detection modes must both fire independently and be shown separately:**
  - `high_volume_flag`: triggered by `burst_score` and `query_rate` exceeding thresholds
  - `low_and_slow_flag`: triggered by `interval_stddev` being very low (regular beaconing) sustained over long windows combined with elevated entropy/unique-subdomain-ratio, even when query_rate is low

### 4.4 Explainability (mandatory — this fixes the old project's biggest flaw)
For every flagged record/session, generate:
1. **SHAP-based feature contribution** — top 3–5 features pushing the verdict toward "tunneling", with their values
2. **Rule-based plain-English evidence string**, e.g.:
   > "Flagged as tunneling (risk 87/100): subdomain entropy is 4.8 (normal traffic averages 2.1), 340 unique subdomains queried under the same parent domain in 5 minutes, and query type is predominantly TXT (78%), consistent with data encoding rather than name resolution."
3. Never show a raw dataframe/JSON dump as the primary output — the evidence string and chart are the primary UI; raw data is available behind an optional "view raw" toggle.

---

## 5. AI RESEARCH CHATBOT — DETAILED SPEC

### 5.1 Conversation flow
1. User opens the "Chat" tab and either:
   - types a domain/website name directly (e.g., `example-cdn123.com`), or
   - asks a general question (e.g., "what makes a subdomain look like tunneling?")
2. **If the input is/contains a domain or URL:**
   - Backend performs, in parallel:
     a. DNS lookup (A/AAAA/TXT/MX/NS records) via dnspython
     b. WHOIS lookup (registrar, creation date, registrant org if public)
     c. A live web search (via the configured search tool) for "what is <domain> used for / reviews / reputation"
   - All of this raw context is packaged and sent to the OpenRouter LLM with a system prompt instructing it to:
     - Summarize what the site/domain appears to be (business, CDN, malware C2, parked domain, etc.)
     - Explicitly map the domain's DNS characteristics (subdomain structure, entropy of any observed subdomains, WHOIS age, record types present) against the CY-04 detection criteria
     - Give a verdict: "Low / Medium / High resemblance to tunneling behavior" with reasoning, clearly caveated as heuristic, not a live traffic capture
3. **If the input is a general question:** skip the lookup step and answer directly using the LLM, grounded in the platform's own detection logic/documentation (pass the feature-engineering spec as context so answers stay consistent with Section 4).

### 5.2 Response rendering (structured, not just chat bubbles)
Render each domain-lookup response as a card with four labeled sections:
- **Summary** — what the domain/site is
- **Technical DNS Findings** — records found, WHOIS age, notable subdomain patterns if discoverable
- **Comparison to Detection Criteria** — bullet list mapping findings to entropy/query-rate/subdomain-behavior/query-type criteria
- **Verdict** — Low/Medium/High resemblance + one-sentence justification

### 5.3 OpenRouter integration requirements
- API key entered once in **Settings → AI Configuration** and stored locally (encrypted at rest in the SQLite DB, never sent anywhere except OpenRouter)
- Model name is a dropdown/free-text field in Settings (so the user can pick any OpenRouter-supported model)
- Backend endpoint: `POST /api/chat` — proxies to `https://openrouter.ai/api/v1/chat/completions`
- Handle streaming responses (SSE) so the chat feels responsive
- Gracefully handle: missing API key (prompt user to add one in Settings), rate limits, and lookup failures (e.g., WHOIS privacy-protected domains) — never crash the chat, just note the limitation in the response

### 5.4 Local chat history persistence
- Every chat session gets a `session_id`, a title (auto-generated from the first message), and a timestamp
- Every message (`role`: user/assistant, `content`, `timestamp`, `session_id`) stored in SQLite
- Sidebar lists past sessions (like a typical chat app), newest first, searchable by keyword
- User can rename, delete, or continue any past session
- All of this works fully offline/locally except the actual OpenRouter API call and web search call

**Suggested schema:**
```sql
CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT REFERENCES chat_sessions(id),
  role TEXT CHECK(role IN ('user','assistant')),
  content TEXT,
  metadata_json TEXT, -- stores structured card data (summary/findings/verdict) when applicable
  created_at TIMESTAMP
);

CREATE TABLE scan_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT, -- 'single' | 'batch_csv' | 'pcap'
  input_ref TEXT,
  risk_score REAL,
  is_tunneling BOOLEAN,
  high_volume_flag BOOLEAN,
  low_and_slow_flag BOOLEAN,
  evidence_text TEXT,
  raw_features_json TEXT,
  created_at TIMESTAMP
);

CREATE TABLE user_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  theme_mode TEXT DEFAULT 'dark',       -- 'light' | 'dark' | 'system'
  primary_color TEXT DEFAULT '#10b981',
  accent_color TEXT DEFAULT '#3b82f6',
  background_color TEXT DEFAULT '#0a0a0a',
  font_size TEXT DEFAULT 'md',
  openrouter_api_key_encrypted TEXT,
  openrouter_model TEXT DEFAULT 'openai/gpt-4o-mini',
  search_provider TEXT DEFAULT 'duckduckgo'
);
```

---

## 6. PAGES / UI STRUCTURE

1. **Dashboard** (`/`) — summary cards (total scans, flagged count, high-volume vs low-and-slow split), time-series risk chart, recent flagged sessions table
2. **Analyze** (`/analyze`) — tabs for Single Query / Batch CSV / PCAP Upload → results table with expandable evidence per row
3. **Chat** (`/chat`) — sidebar of past sessions + main chat window with the structured result cards described in Section 5.2
4. **History** (`/history`) — searchable/filterable log of all past scans
5. **Settings** (`/settings`) — sections:
   - **Appearance**: theme mode toggle, color pickers for primary/accent/background, font size slider, live preview panel
   - **AI Configuration**: OpenRouter API key input (masked), model selector, search provider selector
   - **Detection Thresholds**: sliders for burst threshold, entropy threshold, beaconing regularity threshold (advanced/optional section)

---

## 7. THEMING / CUSTOMIZATION REQUIREMENTS (Section 6's Appearance tab)

- Implement using CSS custom properties (`--color-primary`, `--color-accent`, `--color-bg`, `--color-surface`, `--color-text`) set at the `:root` level and updated live via JS when the user changes a color picker — no page reload needed
- Persist chosen theme to `user_settings` table via `PATCH /api/settings`, and re-apply on app load
- Provide at least 3 preset themes (e.g., "Cyber Green", "Midnight Blue", "High Contrast") as one-click starting points, in addition to full manual color picking
- Respect `prefers-color-scheme` when theme mode is set to "system"
- Font size setting should scale a root `rem` variable (small/medium/large) affecting the whole app consistently

---

## 8. API ENDPOINTS (backend contract)

```
POST   /api/analyze/single        -> single DNS record classification
POST   /api/analyze/batch         -> CSV upload, returns job id + results
POST   /api/analyze/pcap          -> PCAP upload, parses + classifies
GET    /api/analyze/history       -> paginated scan history
GET    /api/dashboard/summary     -> aggregate stats for dashboard

POST   /api/chat/sessions         -> create new chat session
GET    /api/chat/sessions         -> list sessions
GET    /api/chat/sessions/{id}    -> get messages for a session
POST   /api/chat/sessions/{id}/messages -> send message, streams back assistant reply
DELETE /api/chat/sessions/{id}    -> delete a session

GET    /api/settings              -> get current settings
PATCH  /api/settings              -> update settings (theme, colors, API key, model, thresholds)

POST   /api/lookup/domain         -> DNS + WHOIS + web-search lookup for a given domain (used internally by chat, but exposed standalone too)
```

---

## 9. NON-FUNCTIONAL REQUIREMENTS

- **Security**: OpenRouter API key must be encrypted at rest (e.g., Fernet symmetric encryption with a locally-generated key file, not stored in plaintext); never log the key; never send it anywhere but OpenRouter
- **Performance**: batch CSV analysis should handle at least 100k rows without blocking the UI (use background task / job polling pattern)
- **Error handling**: every external call (WHOIS, DNS, web search, OpenRouter) must fail gracefully with a user-visible, non-technical message — never a raw stack trace in the UI
- **Portability**: entire app must run locally with a single `docker-compose up` or two terminal commands (`uvicorn` + `npm run dev`) — no cloud dependency except the optional OpenRouter/search API calls
- **Code quality**: type-annotated Python (Pydantic models for all API schemas), TypeScript strict mode on frontend, no `any` types
- **Testing**: unit tests for the feature-engineering functions (especially entropy, query-rate, and beaconing-interval calculations) since these are the core correctness-critical logic

---

## 10. BUILD ORDER (recommended sequence for the agent)

1. Scaffold backend (FastAPI) + SQLite schema + Alembic migrations
2. Implement feature-engineering module + unit tests
3. Train and serialize the ML classifier (generate/simulate a labeled dataset if a real one isn't provided — include a data-generation script that synthesizes realistic benign DNS traffic and several tunneling patterns, both high-volume and low-and-slow)
4. Build `/api/analyze/*` endpoints + explainability layer
5. Scaffold frontend (Vite + React + Tailwind + shadcn/ui) with the theming system wired up first (Section 7) since every other page depends on it
6. Build Dashboard and Analyze pages
7. Build OpenRouter integration + domain lookup service (DNS/WHOIS/search) + Chat page with structured card rendering
8. Build chat history persistence + sidebar
9. Build Settings page (Appearance, AI Configuration, Detection Thresholds)
10. Build History page + PDF/HTML export
11. Polish: loading states, empty states, responsive layout, dark/light parity testing across all custom color combinations

---

## 11. WHAT TO EXPLICITLY AVOID

- Do NOT reuse the old project's `best_pipeline.pkl` as-is — retrain with the full feature set above
- Do NOT display raw prediction dataframes or JSON as the primary result — always surface the human-readable evidence string first
- Do NOT hardcode the OpenRouter API key or any model name — both must be user-configurable from Settings
- Do NOT store the API key in plaintext or in frontend localStorage — backend-encrypted storage only
- Do NOT build the chatbot as a single-turn Q&A with no memory — full session history is required
