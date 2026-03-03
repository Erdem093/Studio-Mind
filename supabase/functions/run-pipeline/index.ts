import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini";

const MODEL_PRICING_PER_1M: Record<string, { input: number; output: number }> = {
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
};

type GeneratedArtifacts = {
  story: string;
  script: string;
  hook: string;
  title: string;
};

function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING_PER_1M[model] ?? MODEL_PRICING_PER_1M["gpt-4.1-mini"];
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return Number((inputCost + outputCost).toFixed(4));
}

function buildTrace(projectId?: string): { traceId: string; traceUrl: string | null } {
  const traceId = crypto.randomUUID();
  const base = Deno.env.get("ANYWAY_TRACE_BASE_URL") ?? "";

  if (!base) {
    return { traceId, traceUrl: null };
  }

  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const traceUrl = projectId
    ? `${normalizedBase}/projects/${projectId}/traces/${traceId}`
    : `${normalizedBase}/traces/${traceId}`;

  return { traceId, traceUrl };
}

async function maybeEmitAnywayEvent(payload: Record<string, unknown>) {
  const apiUrl = Deno.env.get("ANYWAY_API_URL");
  const apiKey = Deno.env.get("ANYWAY_API_KEY");

  if (!apiUrl || !apiKey) return;

  await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Keep tracing best-effort for demo stability.
  });
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
  const anywayProjectId = Deno.env.get("ANYWAY_PROJECT_ID") ?? undefined;
  const trace = buildTrace(anywayProjectId);

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

    const prompt = [
      `Video title: ${video.title}`,
      `Video description: ${video.description ?? "(none)"}`,
      "Generate JSON with keys: story, script, hook, title.",
      "Each key should contain plain text, concise and creator-ready.",
    ].join("\n");

    const completionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
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
            content:
              "You are a content strategist agent. Return only JSON with keys story, script, hook, title.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!completionResponse.ok) {
      const apiError = await completionResponse.text();
      throw new Error(`OpenAI error: ${apiError}`);
    }

    const completionJson = await completionResponse.json();
    const rawContent = completionJson?.choices?.[0]?.message?.content;

    if (!rawContent || typeof rawContent !== "string") {
      throw new Error("OpenAI response did not include JSON content");
    }

    const parsed = JSON.parse(rawContent) as Partial<GeneratedArtifacts>;
    const artifacts: GeneratedArtifacts = {
      story: parsed.story?.trim() || "Story generation failed",
      script: parsed.script?.trim() || "Script generation failed",
      hook: parsed.hook?.trim() || "Hook generation failed",
      title: parsed.title?.trim() || "Title generation failed",
    };

    const { error: artifactError } = await adminClient.from("artifacts").insert([
      { run_id: runId, user_id: user.id, type: "story", content: artifacts.story },
      { run_id: runId, user_id: user.id, type: "script", content: artifacts.script },
      { run_id: runId, user_id: user.id, type: "hook", content: artifacts.hook },
      { run_id: runId, user_id: user.id, type: "title", content: artifacts.title },
    ]);

    if (artifactError) {
      throw new Error(`Artifact insert failed: ${artifactError.message}`);
    }

    const promptTokens = Number(completionJson?.usage?.prompt_tokens ?? 0);
    const completionTokens = Number(completionJson?.usage?.completion_tokens ?? 0);
    const totalTokens = Number(completionJson?.usage?.total_tokens ?? promptTokens + completionTokens);
    const costUsd = estimateCostUsd(OPENAI_MODEL, promptTokens, completionTokens);

    const { error: runUpdateError } = await adminClient
      .from("runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        cost_tokens: totalTokens,
        cost_usd: costUsd,
        model: OPENAI_MODEL,
        trace_id: trace.traceId,
        trace_url: trace.traceUrl,
        error_message: null,
      })
      .eq("id", runId);

    if (runUpdateError) {
      throw new Error(`Run update failed: ${runUpdateError.message}`);
    }

    await maybeEmitAnywayEvent({
      trace_id: trace.traceId,
      trace_url: trace.traceUrl,
      run_id: runId,
      user_id: user.id,
      video_id: video.id,
      model: OPENAI_MODEL,
      total_tokens: totalTokens,
      cost_usd: costUsd,
      status: "completed",
      created_at: new Date().toISOString(),
    });

    return jsonResponse(200, {
      runId,
      traceUrl: trace.traceUrl,
      costUsd,
      costTokens: totalTokens,
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
        })
        .eq("id", runId);
    }

    await maybeEmitAnywayEvent({
      trace_id: trace.traceId,
      trace_url: trace.traceUrl,
      run_id: runId,
      user_id: user.id,
      video_id: video.id,
      model: OPENAI_MODEL,
      status: "failed",
      error_message: message,
      created_at: new Date().toISOString(),
    });

    return jsonResponse(500, {
      error: message,
      runId,
      traceUrl: trace.traceUrl,
    });
  }
});
