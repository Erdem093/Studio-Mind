# Content Pipeline Machine

Built for the UK AI Agent Hackathon EP4 with sponsor-track focus on **Anyway** (observability/commercialization) and **Animoca Minds** (multi-agent + memory cognition).

## What Is Implemented

- Supabase auth + RLS-backed data model
- Multi-agent server pipeline (`run-pipeline`) with 4 specialists:
  - HookAgent
  - ScriptAgent
  - TitleAgent
  - StrategyAgent
- Per-run artifacts with agent metadata
- Persistent memory + recursive feedback loop:
  - `agent_memory`
  - `run_feedback`
  - `submit-run-feedback` function
- Deterministic memory compiler per agent:
  - hard constraints
  - style preferences
  - weighted recent failures
- Anyway-style trace + per-agent span event emission
- Observability UI with per-agent metrics drilldown
- Subscription billing:
  - `create-checkout-session`
  - `stripe-webhook`
- Stripe Connect MVP:
  - `create-connect-account`
  - `create-connect-checkout-session`
- OpenClaw bridge mode (external worker):
  - `queue-youtube-analysis`
  - `openclaw-pull-jobs`
  - `openclaw-push-insights`
- Pro thumbnail image generation (stored artifact + preview/download)
- Approved output packaging:
  - `finalize-approved-output` (JSON + PDF)
  - `approved_outputs` table + storage package versions
- YouTube intelligence:
  - `youtube-connect-start`
  - `youtube-connect-callback`
  - `youtube-sync-channel`
  - `sync-inspiration-channels`
  - `enqueue-hourly-analysis`
  - `enqueue-inspiration-refresh`
- Channel onboarding + preferences baseline:
  - required onboarding gate
  - `complete-onboarding`
  - `suggest-video-copy` (Suggest + Apply for title/description)
- Public landing page and SPA rewrites for Vercel

## Why 4 Specialists + 1 Orchestrator

We intentionally use a `4+1` structure (Hook/Script/Title/Strategy + orchestrator) instead of a 6+ swarm for this sprint:

- lower latency and lower token cost per run
- cleaner accountability (one owner per artifact type)
- easier tracing/debugging in Anyway and in-app observability
- more predictable stability under hackathon time constraints

## Architecture Docs

- [Architecture](docs/architecture.md)
- [Demo Script](docs/demo-script.md)

## Core Data Model

Main tables:

- `videos`
- `runs`
- `artifacts`
- `profiles`
- `channel_preferences`
- `channel_inspirations`
- `agent_modification_log`
- `agent_memory`
- `run_feedback`
- `analysis_jobs`
- `external_insights`
- `approved_outputs`

Notable run fields:

- `trace_id`
- `trace_url`
- `cost_tokens`
- `cost_usd`
- `agent_metrics` (jsonb)
- `memory_applied` (jsonb)
- `quality_delta` (jsonb)
- `collector_export_status`
- `collector_export_error`

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Required Frontend Env Vars (`.env`)

- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_STRIPE_STARTER_PRICE_ID`
- `VITE_STRIPE_PRO_PRICE_ID`

## Supabase Migrations

```bash
supabase db push
```

## Edge Functions

Deployed/used functions:

- `run-pipeline`
- `submit-run-feedback`
- `create-checkout-session`
- `stripe-webhook`
- `create-connect-account`
- `create-connect-checkout-session`
- `delete-project`
- `complete-onboarding`
- `suggest-video-copy`
- `analyze-approved-artifact`
- `queue-youtube-analysis`
- `openclaw-pull-jobs`
- `openclaw-push-insights`
- `finalize-approved-output`
- `youtube-connect-start`
- `youtube-connect-callback`
- `youtube-sync-channel`
- `sync-inspiration-channels`
- `enqueue-hourly-analysis`
- `enqueue-inspiration-refresh`

Deploy manually:

```bash
supabase functions deploy run-pipeline
supabase functions deploy submit-run-feedback
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
supabase functions deploy create-connect-account
supabase functions deploy create-connect-checkout-session
supabase functions deploy delete-project
supabase functions deploy complete-onboarding
supabase functions deploy suggest-video-copy
supabase functions deploy analyze-approved-artifact
supabase functions deploy queue-youtube-analysis
supabase functions deploy openclaw-pull-jobs
supabase functions deploy openclaw-push-insights
supabase functions deploy finalize-approved-output
supabase functions deploy youtube-connect-start
supabase functions deploy youtube-connect-callback
supabase functions deploy youtube-sync-channel
supabase functions deploy sync-inspiration-channels
supabase functions deploy enqueue-hourly-analysis
supabase functions deploy enqueue-inspiration-refresh
```

## Required Supabase Function Secrets

### AI

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, default `gpt-4.1-mini`)
- `OPENAI_IMAGE_MODEL` (optional, default `gpt-image-1`)

### Anyway

- `ANYWAY_TRACE_BASE_URL` (for UI trace links)
- `ANYWAY_API_URL` (optional event endpoint)
- `ANYWAY_API_KEY` (optional)

### Stripe Subscription

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_STARTER_PRICE_ID`
- `STRIPE_PRO_PRICE_ID`

### OpenClaw Bridge

- `OPENCLAW_SERVICE_TOKEN`

### YouTube OAuth + Ingestion

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REDIRECT_URI` (must target `.../functions/v1/youtube-connect-callback`)
- `YOUTUBE_API_KEY` (for inspiration-channel refresh)
- `YOUTUBE_OAUTH_STATE_SECRET` (optional; falls back to service key)
- `APP_ENCRYPTION_KEY` (optional; falls back to service key)
- `APP_FRONTEND_URL` (optional redirect after OAuth callback)

## Stripe Connect MVP (Plain Language)

This app has two Stripe paths:

- `Subscriptions`: user plan billing (`Starter`, `Pro`).
- `Connect MVP`: demo marketplace-style payment split where part of a one-time payment is kept as platform fee and the remainder is transferred to a connected destination account.

## Stripe Webhook

Endpoint:

- `https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`

Recommended events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Sponsor Demo Checklist

- Trigger multi-agent run and show 4 agent outputs
- Submit negative feedback and rerun with memory influence
- Show observability trace link + per-agent metrics
- Show subscription checkout path
- Show Connect onboarding + platform-fee checkout path

## Local OpenClaw Worker

Run analysis worker on your laptop:

```bash
cp .env.openclaw.example .env.openclaw
set -a; source .env.openclaw; set +a
npm run openclaw:once
```

Continuous mode:

```bash
set -a; source .env.openclaw; set +a
npm run openclaw:worker
```

Detailed behavior + safety controls:
- [OpenClaw Worker Guide](docs/openclaw-worker.md)
