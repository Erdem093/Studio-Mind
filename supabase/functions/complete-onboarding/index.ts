import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type InspirationInput = {
  youtubeUrl: string;
  note?: string;
  label?: string;
};

function isValidYoutubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("youtube.com") || parsed.hostname.includes("youtu.be");
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini";

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !openAiApiKey) {
    return jsonResponse(500, { error: "Missing required environment variables" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse(401, { error: "Missing authorization header" });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: authData, error: authError } = await userClient.auth.getUser();
  const user = authData?.user;
  if (authError || !user) return jsonResponse(401, { error: "Unauthorized" });

  const body = await req.json().catch(() => null) as {
    goal?: string;
    tone?: string;
    pacing?: string;
    hookStyle?: string;
    scriptLengthPreference?: string;
    bannedPhrases?: string[];
    inspirations?: InspirationInput[];
    additionalNotes?: string;
  } | null;

  const goal = body?.goal?.trim() || "";
  const tone = body?.tone?.trim() || "clear_confident";
  const pacing = body?.pacing?.trim() || "fast";
  const hookStyle = body?.hookStyle?.trim() || "curiosity_with_value";
  const scriptLengthPreference = body?.scriptLengthPreference?.trim() || "short_form";
  const bannedPhrases = Array.isArray(body?.bannedPhrases)
    ? body!.bannedPhrases.map((item) => item.trim()).filter(Boolean).slice(0, 30)
    : [];
  const additionalNotes = body?.additionalNotes?.trim() || "";
  const inspirations = Array.isArray(body?.inspirations)
    ? body!.inspirations
      .map((item) => ({
        youtubeUrl: item.youtubeUrl?.trim() || "",
        note: item.note?.trim() || "",
        label: item.label?.trim() || "",
      }))
      .filter((item) => item.youtubeUrl)
    : [];

  if (!goal) return jsonResponse(400, { error: "goal is required" });

  for (const inspiration of inspirations) {
    if (!isValidYoutubeUrl(inspiration.youtubeUrl)) {
      return jsonResponse(400, { error: `Invalid YouTube URL: ${inspiration.youtubeUrl}` });
    }
  }

  const prompt = [
    "Create a concise channel master prompt for a multi-agent content pipeline.",
    `Channel goal: ${goal}`,
    `Preferred tone: ${tone}`,
    `Preferred pacing: ${pacing}`,
    `Preferred hook style: ${hookStyle}`,
    `Script length preference: ${scriptLengthPreference}`,
    `Banned phrases: ${bannedPhrases.length ? bannedPhrases.join(", ") : "none"}`,
    `Inspiration references: ${inspirations.length ? inspirations.map((item) => `${item.youtubeUrl}${item.note ? ` (${item.note})` : ""}`).join("; ") : "none"}`,
    `Additional notes: ${additionalNotes || "none"}`,
    "Return JSON: {\"channel_summary_prompt\":\"...\"}. Keep under 220 words.",
  ].join("\n");

  const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a channel strategy assistant that writes precise style prompts for multi-agent generation systems.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!aiResponse.ok) {
    const text = await aiResponse.text();
    return jsonResponse(500, { error: `OpenAI error: ${text}` });
  }

  const aiJson = await aiResponse.json();
  const rawContent = aiJson?.choices?.[0]?.message?.content;
  if (!rawContent || typeof rawContent !== "string") {
    return jsonResponse(500, { error: "Invalid AI response" });
  }

  let channelSummaryPrompt = "";
  try {
    const parsed = JSON.parse(rawContent) as { channel_summary_prompt?: string };
    channelSummaryPrompt = parsed.channel_summary_prompt?.trim() || "";
  } catch {
    return jsonResponse(500, { error: "Failed to parse AI response JSON" });
  }

  if (!channelSummaryPrompt) {
    return jsonResponse(500, { error: "AI returned empty channel_summary_prompt" });
  }

  const now = new Date().toISOString();

  const { data: existingPreference } = await adminClient
    .from("channel_preferences")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingPreference?.id) {
    const { error: prefUpdateError } = await adminClient
      .from("channel_preferences")
      .update({
        tone,
        pacing,
        hook_style: hookStyle,
        script_length_preference: scriptLengthPreference,
        banned_phrases: bannedPhrases,
        notes: additionalNotes || null,
        updated_at: now,
      })
      .eq("id", existingPreference.id);

    if (prefUpdateError) return jsonResponse(500, { error: prefUpdateError.message });
  } else {
    const { error: prefInsertError } = await adminClient
      .from("channel_preferences")
      .insert({
        user_id: user.id,
        tone,
        pacing,
        hook_style: hookStyle,
        script_length_preference: scriptLengthPreference,
        banned_phrases: bannedPhrases,
        notes: additionalNotes || null,
      });

    if (prefInsertError) return jsonResponse(500, { error: prefInsertError.message });
  }

  const { error: profileUpdateError } = await adminClient
    .from("profiles")
    .update({
      channel_style_goal: goal,
      channel_summary_prompt: channelSummaryPrompt,
      onboarding_completed_at: now,
      updated_at: now,
    })
    .eq("user_id", user.id);

  if (profileUpdateError) return jsonResponse(500, { error: profileUpdateError.message });

  const { error: deleteInspirationError } = await adminClient
    .from("channel_inspirations")
    .delete()
    .eq("user_id", user.id);

  if (deleteInspirationError) return jsonResponse(500, { error: deleteInspirationError.message });

  if (inspirations.length > 0) {
    const { error: inspirationInsertError } = await adminClient
      .from("channel_inspirations")
      .insert(
        inspirations.map((item) => ({
          user_id: user.id,
          youtube_url: item.youtubeUrl,
          note: item.note || null,
          label: item.label || null,
        })),
      );

    if (inspirationInsertError) return jsonResponse(500, { error: inspirationInsertError.message });
  }

  const { error: logError } = await adminClient.from("agent_modification_log").insert({
    user_id: user.id,
    source: "onboarding",
    change_summary: "Completed onboarding and initialized channel preferences",
    metadata: {
      tone,
      pacing,
      hook_style: hookStyle,
      script_length_preference: scriptLengthPreference,
      inspirations_count: inspirations.length,
    },
  });

  if (logError) return jsonResponse(500, { error: logError.message });

  return jsonResponse(200, {
    channelSummaryPrompt,
    saved: true,
  });
});
