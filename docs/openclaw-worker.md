# OpenClaw Worker (Local Laptop)

This worker runs on your laptop and processes queued analysis jobs from Supabase.

## What It Does (Exactly)

Every cycle (default: every 1 hour), it:

1. Calls `enqueue-hourly-analysis` to queue fresh video-performance jobs.
2. Once per UTC day (default hour `0`), calls `enqueue-inspiration-refresh`.
3. Pulls pending jobs from `openclaw-pull-jobs` (max `OPENCLAW_MAX_JOBS_PER_CYCLE`).
4. For each job:
- Reads `job_type` + payload.
- If `YOUTUBE_API_KEY` is present and `youtube_video_id` exists, fetches lightweight YouTube signals:
  - video title/statistics
  - top 5 comments (best effort)
- Produces insights with **rule-based logic** by default.
- Optionally uses OpenAI only if `OPENCLAW_USE_OPENAI=true`.
5. Pushes results to `openclaw-push-insights`.
- Success -> job `completed`
- Failure -> job `failed` and backend retry/backoff applies.

## Safety Defaults

- No OpenAI usage unless explicitly enabled.
- Max jobs per cycle is bounded.
- HTTP timeouts enabled.
- Works in `--dry-run` mode (no writes).

## Setup

1. Copy env file:

```bash
cp .env.openclaw.example .env.openclaw
```

2. Edit `.env.openclaw`:
- set `OPENCLAW_SERVICE_TOKEN`
- keep `OPENCLAW_USE_OPENAI=false` unless you want spend
- set `YOUTUBE_API_KEY` for richer analysis

3. Run once (test):

```bash
set -a; source .env.openclaw; set +a
npm run openclaw:once
```

4. Dry run (no writes):

```bash
set -a; source .env.openclaw; set +a
npm run openclaw:dry
```

5. Continuous worker:

```bash
set -a; source .env.openclaw; set +a
npm run openclaw:worker
```

## Run in Background (macOS/Linux)

Simple `nohup` approach:

```bash
set -a; source .env.openclaw; set +a
nohup npm run openclaw:worker > openclaw-worker.log 2>&1 &
```

Stop:

```bash
pkill -f "openclaw-worker.mjs"
```

## Cost Behavior

- With defaults, worker does **not** spend OpenAI credits.
- OpenAI spend happens only if:
  - `OPENCLAW_USE_OPENAI=true`
  - `OPENAI_API_KEY` is set.
