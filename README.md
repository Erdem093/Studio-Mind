# Content Pipeline Machine

Demo app for the Anyway + Animoca hackathon tracks.

## What this MVP now includes

- Supabase auth + RLS-backed tables (`profiles`, `videos`, `runs`, `artifacts`)
- Real pipeline execution via Supabase Edge Function (`run-pipeline`)
- One-agent AI generation (OpenAI) producing 4 artifacts: `story`, `script`, `hook`, `title`
- Run-level observability metadata (`trace_id`, `trace_url`, model, error) shown in Observability
- Stripe test-mode subscription checkout + webhook sync to `profiles`
- Billing page reflects real subscription status and monthly run usage

## Local frontend setup

1. Install dependencies:

```bash
npm install
```

2. Copy env template and fill values:

```bash
cp .env.example .env
```

3. Start app:

```bash
npm run dev
```

## Supabase migration

Apply migrations (including billing + trace columns):

```bash
supabase db push
```

## Edge functions

Functions added:

- `run-pipeline`
- `create-checkout-session`
- `stripe-webhook`

Deploy:

```bash
supabase functions deploy run-pipeline
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

## Required Supabase function secrets

Set these in Supabase project secrets:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, default `gpt-4.1-mini`)
- `ANYWAY_TRACE_BASE_URL` (optional, used to build trace links)
- `ANYWAY_PROJECT_ID` (optional)
- `ANYWAY_API_URL` (optional, best-effort event emit)
- `ANYWAY_API_KEY` (optional)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_STARTER_PRICE_ID` (optional allow-list)
- `STRIPE_PRO_PRICE_ID` (optional allow-list)

## Stripe webhook

`stripe-webhook` has JWT verification disabled in `supabase/config.toml`, so Stripe can call it directly. Configure Stripe endpoint to point at your deployed function URL.
