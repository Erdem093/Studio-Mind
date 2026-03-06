# 🎬 ContentPilot — Multi-Agent Content Autopilot for Creators

> **UK AI Agent Hackathon EP4** · Animoca Minds Track · Anyway Track · OpenClaw Special Edition

ContentPilot is a production-grade multi-agent system that transforms a single video idea into a coordinated set of reviewed, approved, and reusable content packages — then learns from every creator decision to get better with each run.

---

## 🧩 The Problem

Creators juggle 5+ disconnected tools to produce a single video: one for ideation, another for scripting, another for titles, another for strategy, and nothing to carry learning between them. There is no feedback loop. No memory. No observability. Every video starts from scratch.

---

## 💡 The Solution

ContentPilot deploys a **4+1 multi-agent orchestration pipeline** — four specialist AI agents (Hook, Script, Title, Strategy) coordinated by an Orchestrator — that converts one idea into a complete, reviewed content package. Creators approve or reject each artifact with structured feedback. That feedback is weighted, stored, and injected into every future run. The system learns continuously from rejections, approvals, and external YouTube performance data.

**Key outcomes:**
- One run → 4 coordinated artifacts ready for review
- Rejection reasoning deterministically modifies future prompts
- Approval triggers automatic "what worked" analysis written back to long-term memory
- External YouTube + OpenClaw data keeps agent context grounded in real-world performance
- Every run is fully observable via Anyway traces (cost, latency, tokens, errors, per-agent)

---

## 🏗️ Architecture Overview

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript |
| Backend / Auth | Supabase (Auth, RLS, Edge Functions, Storage, Webhooks) |
| AI Pipeline | OpenAI (GPT-4o for agents, DALL·E for thumbnails) |
| Billing | Stripe Subscriptions + Stripe Connect |
| Observability | Anyway (OTLP span export + OpenClaw plugin traces) |
| External Intelligence | YouTube Data API v3 + OpenClaw Worker Loop |
| Memory Store | Supabase PostgreSQL (scoped per-agent + global channel) |

### Agent Architecture: 4+1 Orchestrator Pattern

```
User Input (idea + project)
        │
        ▼
  ┌─────────────┐
  │ Orchestrator │  ← creates run row, compiles memory, routes agents, handles failures
  └──────┬──────┘
         │
    ┌────┴────┬──────────┬──────────┐
    ▼         ▼          ▼          ▼
HookAgent  ScriptAgent TitleAgent StrategyAgent
    │         │          │          │
    └────┬────┴──────────┴──────────┘
         ▼
   Artifacts stored (agent_name + version + status)
         │
         ▼
  Creator Review (approve / reject with feedback)
         │
    ┌────┴────────────────────────┐
    │                             │
Approval Path                Rejection Path
    │                             │
Auto-analysis               Feedback modal
"what worked" →             (agent-targeted or global)
long-term memory            Weighted memory write
                            → injected into next run
```

### Memory System

```
Memory Sources:
  ├── Scoped agent memory (per-agent feedback history)
  ├── Global channel memory (cross-agent learnings)
  ├── Approved artifact baseline (best run injected as anchor)
  ├── External insights (YouTube channel data, comments)
  └── OpenClaw inspiration refresh (daily automated sync)

Memory Compiler (per run, per agent):
  → Deterministic weighted compilation
  → Scoped to agent OR global (user-controlled)
  → Optional video-scope isolation
  → Injected into agent system prompt at run time
```

### OpenClaw Worker Loop

```
OpenClaw Scheduler (hourly)
  │
  ├── openclaw-pull-jobs   → fetches queued analysis jobs
  │       ↓
  │   Process: YouTube ingestion, inspiration channel sync
  │       ↓
  └── openclaw-push-insights → writes results to external_insights table
                                → triggers memory ingest path
                                → available in next agent run
```

---

## 🔌 Anyway Integration

ContentPilot integrates with Anyway via two independent trace-producing paths:

### Path 1: Run Pipeline OTLP Span Export

Every agent run emits structured spans to the Anyway collector:

```
Run Start
  ├── Span: OrchestratorAgent  { run_id, model, tokens, cost, latency, status }
  ├── Span: HookAgent          { agent_name, version, tokens, cost, latency, memory_applied, prompt_preview }
  ├── Span: ScriptAgent        { agent_name, version, tokens, cost, latency, memory_applied, prompt_preview }
  ├── Span: TitleAgent         { agent_name, version, tokens, cost, latency, memory_applied, prompt_preview }
  ├── Span: StrategyAgent      { agent_name, version, tokens, cost, latency, memory_applied, prompt_preview }
  └── Span: ThumbnailAgent     { agent_name, version, status, error? }

Each span includes:
  - trace_url        → deep link to Anyway trace viewer
  - model            → OpenAI model used
  - input_tokens     → prompt token count
  - output_tokens    → completion token count
  - cost_usd         → per-agent USD cost
  - latency_ms       → agent wall-clock time
  - memory_applied   → memory sources used (scoped / global / external)
  - external_insight_refs → OpenClaw/YouTube insight IDs injected
  - error            → failure metadata if agent failed
```

Spans are exported via OTLP POST to the Anyway collector endpoint (`run-pipeline/index.ts`).

### Path 2: OpenClaw Plugin Traces

The OpenClaw worker loop is instrumented with the Anyway agent plugin, producing independent traces for every background analysis job:

```
openclaw-pull-jobs  → Anyway trace (job type, source, queue depth)
openclaw-push-insights → Anyway trace (insight type, insight_id, memory_written)
```

### Observability UI

The Observability page in the app surfaces Anyway data directly to users:
- Per-run trace URL (deep link to Anyway)
- Per-agent: latency, tokens, cost, status, prompt preview
- Memory provenance (which memory sources were applied, which external insights were referenced)
- Analysis job board with retry controls

---

## 💳 Stripe Integration

### Subscription Billing (Live in Sandbox)
- Stripe Checkout subscription session creation
- Webhook sync for full subscription lifecycle (created → active → cancelled)
- Plan state reflected immediately in UI
- Run limits enforced by plan tier
- Pro plan gates thumbnail generation (real DALL·E image generation)

### Stripe Connect Backend
- `create-connect-account` edge function — creates Connect account
- `create-connect-checkout-session` edge function — initiates Connect checkout with application fee + transfer destination
- Backend infrastructure ready for marketplace/platform-fee monetisation flows

---

## 📺 YouTube Intelligence

- OAuth 2.0 connect flow with encrypted token storage
- Channel metadata, video stats, and comment ingestion into `external_insights`
- Inspiration channel sync — add competitor/inspiration channels for automatic monitoring
- Token refresh handling for long-lived connections

---

## 🔐 Auth & Security

- Supabase email/password auth with profile auto-provisioning
- Row-Level Security (RLS) enforced on all user-owned data
- Service-role-only writes for pipeline/webhook/worker operations
- OAuth token encryption for YouTube credentials
- Protected routes with mandatory onboarding gate

---

## ⚙️ Setup & Installation

### Prerequisites

- Node.js 18+
- Supabase CLI
- Stripe CLI (for webhook testing)
- OpenAI API key
- YouTube Data API v3 credentials
- Anyway collector endpoint + API key

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/contentpilot.git
cd contentpilot
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
STRIPE_CONNECT_CLIENT_ID=your_connect_client_id
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# YouTube
YOUTUBE_CLIENT_ID=your_youtube_oauth_client_id
YOUTUBE_CLIENT_SECRET=your_youtube_oauth_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/youtube/callback

# Anyway (Supabase Edge Functions runtime env)
ANYWAY_API_KEY=your_anyway_sdk_api_key
ANYWAY_API_URL=https://trace-dev-collector.anyway.sh
ANYWAY_TRACE_BASE_URL=https://webapp.anyway.sh

# OpenClaw
OPENCLAW_API_KEY=your_openclaw_api_key
OPENCLAW_WORKER_SECRET=your_openclaw_worker_secret
```

### 3. Database Setup

```bash
# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push

# Or apply migrations manually
supabase migration up
```

### 4. Deploy Edge Functions

```bash
supabase functions deploy run-pipeline
supabase functions deploy create-connect-account
supabase functions deploy create-connect-checkout-session
supabase functions deploy youtube-oauth-callback
supabase functions deploy stripe-webhook
supabase functions deploy openclaw-pull-jobs
supabase functions deploy openclaw-push-insights
```

### 5. Start Development Server

```bash
npm run dev
```

### 6. Start OpenClaw Worker (Local)

```bash
# Run the local worker script
node scripts/openclaw-worker.js

# Or with OpenAI enhancement mode
OPENCLAW_ENHANCE=true node scripts/openclaw-worker.js
```

### 7. Stripe Webhook (Local Testing)

```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

---

## 📁 Key File Structure

```
/
├── src/
│   ├── App.tsx                    # Root routing
│   ├── ProtectedRoute.tsx         # Auth + onboarding guard
│   └── pages/
│       ├── Landing.tsx            # Public landing page
│       ├── Auth.tsx               # Sign up / login
│       ├── Onboarding.tsx         # Channel identity setup
│       ├── Dashboard.tsx          # Project management
│       ├── RunDetail.tsx          # Artifact review + approval
│       ├── Preferences.tsx        # Channel control + memory history
│       ├── Billing.tsx            # Plan + usage
│       └── Observability.tsx      # Trace + agent metrics
├── supabase/
│   ├── functions/
│   │   ├── run-pipeline/          # Core 4+1 agent orchestrator
│   │   │   └── index.ts
│   │   ├── create-connect-account/
│   │   ├── create-connect-checkout-session/
│   │   ├── stripe-webhook/
│   │   ├── youtube-oauth-callback/
│   │   ├── openclaw-pull-jobs/
│   │   └── openclaw-push-insights/
│   └── migrations/                # All DB schema migrations
├── scripts/
│   └── openclaw-worker.js         # Local OpenClaw worker
├── docs/
│   ├── README.md
│   └── architecture.md
└── .env.local.example
```

---

## 🏆 Hackathon Track Alignment

### Animoca Minds — Best Multi-Agent System

| Criteria | Implementation |
|---|---|
| **Identity** | 4 specialist agents with distinct system prompts + channel persona via onboarding |
| **Memory** | Weighted feedback store, approved baseline injection, external YouTube/OpenClaw insight ingestion |
| **Cognition** | Rejection → structured feedback → deterministic prompt constraint in next run |
| **Multi-Agent** | 4+1 orchestrator architecture with per-agent observability and targeted feedback loops |

### Anyway — Agent Tracing + Commercialisation

| Requirement | Implementation |
|---|---|
| **SDK / Trace Collection** | OTLP spans emitted per agent run + OpenClaw plugin traces |
| **Stripe Connect** | `create-connect-account` + `create-connect-checkout-session` edge functions |
| **Sandbox Revenue** | Stripe subscription checkout + webhook sync working in sandbox |

### OpenClaw — Special Edition Partner

| Requirement | Implementation |
|---|---|
| **Worker Protocol** | `openclaw-pull-jobs` + `openclaw-push-insights` bidirectional protocol |
| **Production Reliability** | Retry/backoff/dead-letter handling in worker loop |
| **Agent Ecosystem** | OpenClaw drives daily inspiration refresh + hourly insight analysis into agent memory |

---

## 👥 Team

Built for UK AI Agent Hackathon EP4 · March 2025

---

## 📄 Licence

MIT
