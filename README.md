# 🛡️ DNS Shield — DNS Tunneling Detection & Intelligence Platform

An enterprise-grade cybersecurity platform that detects, analyzes, and explains **DNS Tunneling**, **Data Exfiltration**, and **Covert C2 (Command & Control) Beaconing** using hybrid **Machine Learning (XGBoost + SHAP)**, **Deterministic Rule Heuristics**, and an **AI Threat Intelligence Co-Pilot**.

---

## 📑 Table of Contents
1. [What is DNS Tunneling & What is the Use of this Website?](#1-what-is-dns-tunneling--what-is-the-use-of-this-website)
2. [How It Finds DNS Tunneling (Detection Methodology & Science)](#2-how-it-finds-dns-tunneling-detection-methodology--science)
3. [How This Website Works (Architecture & Data Flow)](#3-how-this-website-works-architecture--data-flow)
4. [How to Use the Website (Step-by-Step Guide)](#4-how-to-use-the-website-step-by-step-guide)
5. [Quick Start & Launching](#5-quick-start--launching)
6. [Troubleshooting & FAQ](#6-troubleshooting--faq)

---

## 1. What is DNS Tunneling & What is the Use of this Website?

### What is DNS Tunneling?
**Domain Name System (DNS)** is the address book of the Internet. Because every device needs DNS to browse the web or connect to services, network firewalls and web proxies almost always leave outbound DNS traffic (**Port 53 UDP/TCP**) completely open and unfiltered.

Malicious actors exploit this fundamental trust through **DNS Tunneling**:
* **Data Exfiltration**: Attackers encode sensitive documents, passwords, or credit cards into DNS queries (e.g. `aGVsbG8gd29ybGQ.attacker-domain.com`). The local DNS resolver forwards the query across the Internet until it reaches the attacker's authoritative nameserver, which decodes the payload.
* **Command & Control (C2)**: Malware establishes a covert backchannel with an external attacker server without making direct HTTP/HTTPS connections, bypassing proxy inspection, captive portals, and firewalls.
* **Low-and-Slow Beaconing**: Advanced Persistent Threats (APTs) send minute encoded heartbeats at regular intervals (e.g., once every 5 minutes) to evade volume-based detection.

### What is the Use of this Website?
Traditional firewalls and antivirus tools struggle to identify DNS tunneling because each query looks like a valid DNS request.

**DNS Shield** solves this by providing:
1. **Instant Inspection**: Evaluates single domains, bulk enterprise CSV logs, or raw `.pcap` packet captures.
2. **Transparent Explainability**: Instead of being a "black box", the platform shows exactly **why** a query was flagged (which features triggered the alert using SHAP values).
3. **AI Threat Intelligence Co-Pilot**: An interactive assistant that automatically inspects live DNS records, checks WHOIS domain registration history, and gives clear risk verdicts.
4. **Audit & Compliance**: Generates downloadable executive security reports in standalone HTML format for incident response and SOC documentation.

---

## 2. How It Finds DNS Tunneling (Detection Methodology & Science)

The platform combines two detection mechanisms: **Machine Learning** and **Heuristic Rules**.

```
                           Incoming DNS Query / Log
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
     [Feature Engineering]                         [Temporal Aggregates]
    • Shannon & N-gram Entropy                    • Query Rate (Bursts)
    • Subdomain & FQDN Length                     • Interval Std Dev (Beaconing)
    • Character Ratios (Digit/Hex/B64)            • Unique Subdomain Ratio
    • Query Types (TXT, NULL, etc.)                          │
               │                                             │
               ▼                                             │
      [XGBoost Classifier]                                   │
   (Non-linear decision trees)                               │
               │                                             │
               ▼                                             │
       Confidence Score                                      │
               │                                             │
               └──────────────────────┬──────────────────────┘
                                      ▼
                        [Rule Engine & Risk Scorer]
                           • Boost if Entropy > 3.5
                           • Boost if Base64 Pattern
                           • Boost if TXT/NULL Query
                           • Boost if Burst / Beaconing
                                      │
                                      ▼
                           [Final Risk Score (0-100)]
                           + SHAP Feature Breakdown
                           + Human-Readable Evidence
```

### A. Feature Extraction (13+ Distinct Metrics)

Every DNS query is parsed into mathematical features:

1. **Shannon Entropy**:
   $$\text{Entropy} = -\sum_{i=1}^{n} p_i \log_2(p_i)$$
   * Normal words like `google` or `mail` have low entropy ($1.5 - 2.5$).
   * Encrypted, compressed, or base64-encoded strings like `aGVsbG93b3JsZHRlc3Q` have high entropy ($3.5 - 4.5+$).
2. **Normalized Entropy**: Entropy scaled by label length ($0.0 - 1.0$) to prevent short strings from skewing results.
3. **Bigram & Trigram Entropy**: Evaluates unnatural character pairs and triplets. English domains follow predictable phonetic transitions; tunneling payloads are randomly distributed.
4. **Length Metrics**:
   * **FQDN Length**: Total length of the domain (max RFC limit is 253 characters).
   * **Subdomain Length**: Tunneling pushes as much data as possible into each label (up to 63 characters per label).
5. **Label Count**: Number of dot-separated segments (e.g., `part1.part2.part3.domain.com`).
6. **Character Composition**:
   * **Digit Ratio**: Percentage of numeric digits ($0-9$).
   * **Base64 / Hex Pattern Detection**: Identifies hexadecimal strings (`[0-9a-f]{16,}`) and base64 structures (`[A-Za-z0-9+/]{20,}`).
7. **Query Type Encoding**:
   * Benign traffic is predominantly `A` (IPv4) and `AAAA` (IPv6).
   * Tunneling software (`iodine`, `dnscat2`) prefers `TXT` or `NULL` records because they allow larger bidirectional payload transfers.
8. **Response Code**: `NXDOMAIN` vs `NOERROR`. High rates of `NXDOMAIN` often signal C2 brute-forcing or dynamic subdomain generation algorithms (DGAs).
9. **TTL (Time to Live)**: Very low TTLs ($0 - 10\text{ seconds}$) prevent DNS caching, forcing every query to reach the attacker's server.

### B. Machine Learning (XGBoost + SHAP)
* **Model**: An optimized Gradient Boosted Decision Tree (XGBoost) model trained on thousands of benign domains and synthetic/real tunneling payloads.
* **SHAP (SHapley Additive exPlanations)**: For every classification, the model computes exact Shapley values to identify which features increased or decreased the risk score (e.g., `+32% due to high entropy`, `+18% due to TXT record type`).

### C. Heuristic Session Analysis (CY-04 Standard)
* **High-Volume Bursts**: Detects rapid query bursts exceeding the threshold (default: $>50\text{ queries/min}$).
* **Low-and-Slow Beaconing**: Measures the standard deviation of inter-arrival intervals ($\sigma < 0.1\text{s}$ indicates automated heartbeats).
* **Unique Subdomain Ratio**: Measures whether an unusually high percentage of subdomains are seen only once.

---

## 3. How This Website Works (Architecture & Data Flow)

```
┌─────────────────────────────────────────────────────────────┐
│                       FRONTEND                              │
│       React 18 + Vite + Tailwind CSS + Zustand + Lucide     │
│                                                             │
│   [Dashboard]    [Analyze]    [AI Chat]   [History]  [Settings]
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP REST / Server-Sent Events (SSE)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                        │
│                                                             │
│  • /api/analyze/single   • /api/chat/sessions               │
│  • /api/analyze/batch    • /api/lookup/domain               │
│  • /api/dashboard        • /api/settings                    │
├─────────────────────────────────────────────────────────────┤
│  SERVICES:                                                  │
│  • ML Classifier (XGBoost + SHAP in memory cache)           │
│  • DNS Resolver (dnspython) + WHOIS Client (python-whois)   │
│  • OpenRouter LLM Gateway (SSE streaming)                   │
│  • Encryption Engine (Fernet AES-128-CBC)                   │
├─────────────────────────────────────────────────────────────┤
│  DATABASE: SQLite (scan_history, chat_sessions, settings)   │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. How to Use the Website (Step-by-Step Guide)

### 1. The Dashboard (`/`)
* **Overview Metrics**: Total queries scanned, flagged tunneling attempts, burst attacks, beaconing channels, and average risk score.
* **Risk Score Gauge**: Visual dial displaying the platform-wide risk level.
* **Risk Over Time Chart**: Line chart displaying chronological risk fluctuations.
* **Top Offending Domains**: Identifies repeat culprit root domains.

### 2. The Analyze Page (`/analyze`)
Offers three analysis modes:
* **Single Query**:
  1. Type a domain name (e.g., `aGVsbG93b3JsZHRlc3Q.evilc2.net`).
  2. Select the record type (`A`, `TXT`, `NULL`, `CNAME`, `MX`).
  3. Click **Analyze Query**.
  4. View the **Risk Score (0–100)**, **Verdict (Clean vs Flagged)**, **Human-Readable Evidence**, and **SHAP Feature Impact Breakdown**.
* **Batch CSV Upload**:
  1. Upload a CSV file containing query logs (columns: `query_name`, `query_type`, `response_code`, `response_len`, `ttl`).
  2. Click **Analyze Batch**.
  3. View processed rows, flagged counts, and download the results.
* **PCAP File Upload**:
  1. Upload raw `.pcap` packet capture files from Wireshark or tcpdump.
  2. The server extracts DNS packets, evaluates them, and returns flagged communication flows.

### 3. The AI Threat Intelligence Chat (`/chat`)
* **Ask General Questions**: Ask about DNS tunneling techniques, detection criteria, or mitigation strategies.
* **Domain Investigation**: Type any domain (e.g. `google.com` or `suspicious-site.xyz`). The AI automatically:
  1. Resolves live DNS records (`A`, `AAAA`, `NS`, `MX`, `TXT`).
  2. Pulls WHOIS registration details (registrar, creation date, domain age).
  3. Performs web reputation intelligence.
  4. Renders a structured **Threat Card** with a risk verdict (`Low`, `Medium`, `High`) and CY-04 criteria evaluation.
* **Managing Conversations**:
  * **New Chat**: Click **+ New Chat** to start a fresh thread.
  * **Rename**: Click the pencil icon next to any conversation in the sidebar.
  * **Delete Conversation**: Click the red trash icon next to any conversation in the sidebar, or click the **Delete Chat** button in the header.
  * **Delete Individual Messages**: Hover over any message bubble and click the **Delete** button to remove specific prompts or answers.

### 4. History Page (`/history`)
* Browse the audit log of all analyzed queries.
* Check **"Show only flagged (tunneling) records"** to filter high-risk queries.
* **Export Report (HTML)**: Downloads a standalone, styled executive HTML security report with executive metrics and evidence tables ready for printing or archiving.

### 5. Settings Page (`/settings`)
* **Theme Customization**: Switch between **Cyber Green**, **Midnight Blue**, or **High Contrast** modes.
* **Custom Colors**: Choose any primary brand color or background color.
* **AI Configuration**: Enter your OpenRouter API key (encrypted at rest with Fernet).
* **Detection Thresholds**: Adjust Shannon Entropy threshold (default `3.5`), Burst threshold (default `50 qpm`), and Beaconing variance (default `0.1`).

---

## 5. Quick Start & Launching

### Quickest: One-Click Windows Launcher

Simply double-click:
```cmd
run.bat
```
This automatically:
1. Verifies Python virtual environment and dependencies.
2. Verifies frontend node modules.
3. Initializes the SQLite database.
4. Launches the FastAPI Backend (`http://127.0.0.1:8000`).
5. Launches the Vite React Frontend (`http://localhost:5173`).
6. Automatically opens your browser to **http://localhost:5173**.

To stop all services:
```cmd
stop.bat
```

### Manual Command Line (Two Terminals)

**Terminal 1 (Backend):**
```bash
cd backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

### Docker Compose (Single Command)

```bash
docker-compose up --build
```

---

## 6. Troubleshooting & FAQ

#### Q: The AI Chat returns `Authentication failed (401)`
* **Fix**: Ensure your OpenRouter API key is entered in **Settings &rarr; AI Configuration**. The key must start with `sk-or-v1-`. The platform automatically normalizes keys if the hyphen was accidentally omitted.

#### Q: How do I test a malicious sample?
* Open **Analyze &rarr; Single Query**, enter `aGVsbG93b3JsZHRlc3RkYXRh.evil-tunnel.net` with query type `TXT`, and click **Analyze Query**. The platform will flag it with a 100/100 risk score and explain the detected base64 and entropy patterns.

#### Q: How do I test a clean sample?
* Analyze `www.google.com` with query type `A`. The platform will return a clean verdict with a risk score near 0.
