import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini";
const AGENT_VERSION = "v1";
const SERVICE_NAME = "studio-mind-run-pipeline";

type AgentName = "HookAgent" | "ScriptAgent" | "TitleAgent" | "StrategyAgent";
type ArtifactType = "hook" | "script" | "title" | "strategy";

type AgentDefinition = {
  name: AgentName;
  artifactType: ArtifactType;
  systemPrompt: string;
};

type RunContext = {
  userId: string;
  runId: string;
  videoId: string;
  title: string;
  description: string | null;
  memorySummary: string;
};

type AgentOutput = {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

type AgentExecutionMetrics = {
  agent_name: AgentName;
  artifact_type: ArtifactType;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  status: "completed" | "failed";
  error_message: string | null;
};

type SpanAttr = { key: string; value: Record<string, unknown> };

type SpanRecord = {
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  statusCode: number;
  statusMessage?: string;
  attributes: SpanAttr[];
};

const MODEL_PRICING_PER_1M: Record<string, { input: number; output: number }> = {
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
};

const AGENTS: AgentDefinition[] = [
  {
    name: "HookAgent",
    artifactType: "hook",
    systemPrompt:
      "You are HookAgent. Generate 3 short, highly clickable opening hook options for a social video. Keep outputs concise and specific.",
  },
  {
    name: "ScriptAgent",
    artifactType: "script",
    systemPrompt:
      "You are ScriptAgent. Generate a practical creator-ready short video script with intro, body beats, and outro CTA.",
  },
  {
    name: "TitleAgent",
    artifactType: "title",
    systemPrompt:
      "You are TitleAgent. Generate title options and one thumbnail text concept optimized for CTR.",
  },
  {
    name: "StrategyAgent",
    artifactType: "strategy",
    systemPrompt:
      "You are StrategyAgent. Generate platform strategy notes: audience angle, retention tactic, and posting guidance.",
  },
];

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function nowNano(): string {
  return (BigInt(Date.now()) * 1_000_000n).toString();
}

function spanAttrString(key: string, value: string): SpanAttr {
  return { key, value: { stringValue: value } };
}

function spanAttrInt(key: string, value: number): SpanAttr {
  return { key, value: { intValue: String(Math.trunc(value)) } };
}

function spanAttrDouble(key: string, value: number): SpanAttr {
  return { key, value: { doubleValue: value } };
}

function normalizeCollectorUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes("/v1/traces")) return trimmed;
  if (trimmed.endsWith("/")) return `${trimmed}v1/traces`;
  return `${trimmed}/v1/traces`;
}

async function exportTrace(traceId: string, spans: SpanRecord[], runId: string) {
  const apiKey = Deno.env.get("ANYWAY_API_KEY");
  const collector = normalizeCollectorUrl(Deno.env.get("ANYWAY_API_URL") ?? "https://collector.anyway.sh");

  if (!apiKey || !collector || spans.length === 0) {
    return;
  }

  const payload = {
    resourceSpans: [
      {
        resource: {
          attributes: [
            spanAttrString("service.name", SERVICE_NAME),
            spanAttrString("deployment.environment", Deno.env.get("DENO_DEPLOYMENT_ID") ? "production" : "development"),
            spanAttrString("studio.run_id", runId),
          ],
        },
        scopeSpans: [
          {
            scope: {
              name: "studio-mind.observability",
              version: "1.0.0",
            },
            spans: spans.map((span) => ({
              traceId,
              spanId: span.spanId,
              parentSpanId: span.parentSpanId,
              name: span.name,
              kind: 1,
              startTimeUnixNano: span.startTimeUnixNano,
              endTimeUnixNano: span.endTimeUnixNano,
              attributes: span.attributes,
              status: {
                code: span.statusCode,
                message: span.statusMessage,
              },
            })),
          },
        ],
      },
    ],
  };

  await fetch(collector, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Observability export is best-effort and must never fail the pipeline.
  });
}

function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING_PER_1M[model] ?? MODEL_PRICING_PER_1M["gpt-4.1-mini"];
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return Number((inputCost + outputCost).toFixed(4));
}

function buildTrace(): { traceId: string; traceUrl: string | null } {
  const traceId = randomHex(16);
  const base = Deno.env.get("ANYWAY_TRACE_BASE_URL") ?? "";

  if (!base) {
    return { traceId, traceUrl: null };
  }

  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return { traceId, traceUrl: `${normalizedBase}/traces/${traceId}` };
}

async function loadMemory(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  videoId: string,
): Promise<string> {
  const [{ data: memoryRows }, { data: feedbackRows }] = await Promise.all([
    adminClient
      .from("agent_memory")
      .select("key, value, source, video_id, updated_at")
      .eq("user_id", userId)
      .or(`video_id.eq.${videoId},video_id.is.null`)
      .order("updated_at", { ascending: false })
      .limit(10),
    adminClient
      .from("run_feedback")
      .select("reason_code, free_text, created_at")
      .eq("user_id", userId)
      .eq("video_id", videoId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const memorySummary = (memoryRows || [])
    .map((row) => {
      const scoped = row.video_id ? "video" : "global";
      return `[${row.source}/${scoped}] ${row.key}: ${JSON.stringify(row.value)}`;
    })
    .join("\n");

  const feedbackSummary = (feedbackRows || [])
    .map((row) => `[feedback] ${row.reason_code}${row.free_text ? ` - ${row.free_text}` : ""}`)
    .join("\n");

  const combined = [memorySummary, feedbackSummary].filter(Boolean).join("\n");
  return combined || "No prior memory available.";
}

async function upsertMemory(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  videoId: string,
  key: string,
  value: Record<string, unknown>,
  source: string,
) {
  const { data: existing } = await adminClient
    .from("agent_memory")
    .select("id")
    .eq("user_id", userId)
    .eq("video_id", videoId)
    .eq("key", key)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await adminClient
      .from("agent_memory")
      .update({ value, source, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    return;
  }

  await adminClient.from("agent_memory").insert({
    user_id: userId,
    video_id: videoId,
    key,
    value,
    source,
  });
}

async function callAgent(
  openAiApiKey: string,
  agent: AgentDefinition,
  context: RunContext,
): Promise<AgentOutput> {
  const userPrompt = [
    `Video Title: ${context.title}`,
    `Video Description: ${context.description ?? "(none)"}`,
    "\nMemory and feedback context:",
    context.memorySummary,
    "\nReturn JSON with this exact shape: {\"content\": \"...\"}.",
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${agent.systemPrompt} You are part of a multi-agent swarm orchestrated for creator workflows.`,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${agent.name} OpenAI error: ${text}`);
  }

  const json = await response.json();
  const rawContent = json?.choices?.[0]?.message?.content;
  if (!rawContent || typeof rawContent !== "string") {
    throw new Error(`${agent.name} missing JSON content`);
  }

  const parsed = JSON.parse(rawContent) as { content?: string };
  const content = parsed.content?.trim();
  if (!content) {
    throw new Error(`${agent.name} returned empty content`);
  }

  return {
    content,
    promptTokens: Number(json?.usage?.prompt_tokens ?? 0),
    completionTokens: Number(json?.usage?.completion_tokens ?? 0),
    totalTokens: Number(json?.usage?.total_tokens ?? 0),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !openAiApiKey) {
    return jsonResponse(500, { error: "Missing required environment variables" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse(401, { error: "Missing authorization header" });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: authData, error: authError } = await userClient.auth.getUser();
  const user = authData?.user;
  if (authError || !user) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const body = await req.json().catch(() => null) as { videoId?: string } | null;
  const videoId = body?.videoId?.trim();

  if (!videoId) {
    return jsonResponse(400, { error: "videoId is required" });
  }

  const { data: video, error: videoError } = await userClient
    .from("videos")
    .select("id, title, description")
    .eq("id", videoId)
    .eq("user_id", user.id)
    .single();

  if (videoError || !video) {
    return jsonResponse(404, { error: "Video not found" });
  }

  let runId: string | null = null;
  const trace = buildTrace();
  const metrics: AgentExecutionMetrics[] = [];
  const spanRecords: SpanRecord[] = [];

  const rootSpanId = randomHex(8);
  const rootStart = nowNano();

  try {
    const { data: run, error: runInsertError } = await adminClient
      .from("runs")
      .insert({
        video_id: video.id,
        user_id: user.id,
        status: "running",
        trace_id: trace.traceId,
        trace_url: trace.traceUrl,
        model: OPENAI_MODEL,
      })
      .select("id")
      .single();

    if (runInsertError || !run) {
      throw new Error(runInsertError?.message ?? "Failed to create run");
    }

    runId = run.id;

    const memorySummary = await loadMemory(adminClient, user.id, video.id);

    const context: RunContext = {
      userId: user.id,
      runId,
      videoId: video.id,
      title: video.title,
      description: video.description,
      memorySummary,
    };

    const artifactRows: Array<{ run_id: string; user_id: string; type: string; content: string; agent_name: string; agent_version: string }> = [];

    for (const agent of AGENTS) {
      const spanId = randomHex(8);
      const spanStart = nowNano();
      const perfStart = Date.now();

      try {
        const result = await callAgent(openAiApiKey, agent, context);
        const costUsd = estimateCostUsd(OPENAI_MODEL, result.promptTokens, result.completionTokens);
        const latencyMs = Date.now() - perfStart;

        artifactRows.push({
          run_id: runId,
          user_id: user.id,
          type: agent.artifactType,
          content: result.content,
          agent_name: agent.name,
          agent_version: AGENT_VERSION,
        });

        const metric: AgentExecutionMetrics = {
          agent_name: agent.name,
          artifact_type: agent.artifactType,
          latency_ms: latencyMs,
          prompt_tokens: result.promptTokens,
          completion_tokens: result.completionTokens,
          total_tokens: result.totalTokens,
          cost_usd: costUsd,
          status: "completed",
          error_message: null,
        };
        metrics.push(metric);

        spanRecords.push({
          spanId,
          parentSpanId: rootSpanId,
          name: `${agent.name}.generate`,
          startTimeUnixNano: spanStart,
          endTimeUnixNano: nowNano(),
          statusCode: 1,
          attributes: [
            spanAttrString("llm.vendor", "openai"),
            spanAttrString("llm.model", OPENAI_MODEL),
            spanAttrString("studio.agent_name", agent.name),
            spanAttrString("studio.artifact_type", agent.artifactType),
            spanAttrInt("llm.tokens.input", result.promptTokens),
            spanAttrInt("llm.tokens.output", result.completionTokens),
            spanAttrInt("llm.tokens.total", result.totalTokens),
            spanAttrDouble("llm.cost", costUsd),
            spanAttrInt("studio.latency_ms", latencyMs),
          ],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown agent error";
        const latencyMs = Date.now() - perfStart;

        const metric: AgentExecutionMetrics = {
          agent_name: agent.name,
          artifact_type: agent.artifactType,
          latency_ms: latencyMs,
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          cost_usd: 0,
          status: "failed",
          error_message: message,
        };
        metrics.push(metric);

        spanRecords.push({
          spanId,
          parentSpanId: rootSpanId,
          name: `${agent.name}.generate`,
          startTimeUnixNano: spanStart,
          endTimeUnixNano: nowNano(),
          statusCode: 2,
          statusMessage: message,
          attributes: [
            spanAttrString("studio.agent_name", agent.name),
            spanAttrString("studio.artifact_type", agent.artifactType),
            spanAttrInt("studio.latency_ms", latencyMs),
            spanAttrString("error.message", message),
          ],
        });

        throw new Error(`${agent.name} failed: ${message}`);
      }
    }

    const { error: artifactError } = await adminClient.from("artifacts").insert(artifactRows);
    if (artifactError) {
      throw new Error(`Artifact insert failed: ${artifactError.message}`);
    }

    const totalTokens = metrics.reduce((sum, item) => sum + item.total_tokens, 0);
    const totalCostUsd = Number(metrics.reduce((sum, item) => sum + item.cost_usd, 0).toFixed(4));

    await upsertMemory(
      adminClient,
      user.id,
      video.id,
      "last_success_summary",
      {
        title: video.title,
        generated_agents: AGENTS.map((agent) => agent.name),
        generated_at: new Date().toISOString(),
        note: "Last run completed successfully.",
      },
      "run_summary",
    );

    const { error: runUpdateError } = await adminClient
      .from("runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        cost_tokens: totalTokens,
        cost_usd: totalCostUsd,
        model: OPENAI_MODEL,
        trace_id: trace.traceId,
        trace_url: trace.traceUrl,
        error_message: null,
        agent_metrics: metrics,
      })
      .eq("id", runId);

    if (runUpdateError) {
      throw new Error(`Run update failed: ${runUpdateError.message}`);
    }

    spanRecords.push({
      spanId: rootSpanId,
      name: "content_generation_pipeline",
      startTimeUnixNano: rootStart,
      endTimeUnixNano: nowNano(),
      statusCode: 1,
      attributes: [
        spanAttrString("studio.run_id", runId),
        spanAttrString("studio.video_id", video.id),
        spanAttrString("studio.user_id", user.id),
        spanAttrString("llm.model", OPENAI_MODEL),
        spanAttrInt("llm.tokens.total", totalTokens),
        spanAttrDouble("llm.cost", totalCostUsd),
        spanAttrInt("studio.agent_count", AGENTS.length),
      ],
    });

    await exportTrace(trace.traceId, spanRecords, runId);

    return jsonResponse(200, {
      runId,
      traceUrl: trace.traceUrl,
      costUsd: totalCostUsd,
      costTokens: totalTokens,
      agentCount: AGENTS.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (runId) {
      await adminClient
        .from("runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: message,
          trace_id: trace.traceId,
          trace_url: trace.traceUrl,
          model: OPENAI_MODEL,
          agent_metrics: metrics,
        })
        .eq("id", runId);

      spanRecords.push({
        spanId: rootSpanId,
        name: "content_generation_pipeline",
        startTimeUnixNano: rootStart,
        endTimeUnixNano: nowNano(),
        statusCode: 2,
        statusMessage: message,
        attributes: [
          spanAttrString("studio.run_id", runId),
          spanAttrString("studio.video_id", video.id),
          spanAttrString("studio.user_id", user.id),
          spanAttrString("llm.model", OPENAI_MODEL),
          spanAttrString("error.message", message),
          spanAttrInt("studio.failed_agent_count", metrics.filter((metric) => metric.status === "failed").length),
        ],
      });

      await exportTrace(trace.traceId, spanRecords, runId);
    }

    return jsonResponse(500, {
      error: message,
      runId,
      traceUrl: trace.traceUrl,
      failedAgent: metrics.find((metric) => metric.status === "failed")?.agent_name ?? null,
    });
  }
});
