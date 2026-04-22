import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (payload: Record<string, unknown>, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), {
    status: init?.status ?? 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ ok: false, code: "BAD_REQUEST", error: "Invalid request body." });
    }

    const { messages, character, anime } = (body ?? {}) as {
      messages?: Array<{ role?: unknown; content?: unknown }>;
      character?: unknown;
      anime?: unknown;
    };

    const validMessages = Array.isArray(messages)
      && messages.every((message) =>
        message
        && (message.role === "user" || message.role === "assistant" || message.role === "system")
        && typeof message.content === "string"
        && message.content.trim().length > 0,
      );

    if (!validMessages || typeof character !== "string" || !character.trim() || typeof anime !== "string" || !anime.trim()) {
      return jsonResponse({
        ok: false,
        code: "BAD_REQUEST",
        error: "Valid messages, character, and anime are required.",
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ ok: false, code: "SERVER_ERROR", error: "AI is not configured." });
    }

    const systemPrompt = `Act like ${character} from ${anime} to chat with me. Only write what you would say — no gestures, no descriptions, no narration, no asterisks. Use short, very human-like responses. You can even simply use exclamation marks. Stay fully in character at all times.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return jsonResponse(
          {
            ok: false,
            code: "RATE_LIMIT",
            error: "Rate limits exceeded, please wait about 20 seconds and try again.",
            retryAfterMs: 20000,
          },
          { headers: { "Retry-After": "20" } },
        );
      }

      if (response.status === 402) {
        return jsonResponse({
          ok: false,
          code: "NO_CREDITS",
          error: "AI credits are exhausted. Please add funds in workspace settings.",
        });
      }

      const details = await response.text();
      console.error("AI gateway error:", response.status, details);
      return jsonResponse({
        ok: false,
        code: "UPSTREAM_ERROR",
        error: "The AI service is temporarily unavailable. Please try again in a moment.",
      });
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("chat error:", error);
    return jsonResponse({
      ok: false,
      code: "SERVER_ERROR",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
