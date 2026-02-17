import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Groq from "npm:groq-sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type GroqRequest = {
  system: string;
  user: string;
  api_key: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const payload = (await req.json().catch(() => null)) as GroqRequest | null;
    if (
      !payload ||
      typeof payload.system !== "string" ||
      typeof payload.user !== "string" ||
      typeof payload.api_key !== "string" ||
      !payload.api_key
    ) {
      return new Response(JSON.stringify({ error: "Invalid payload: requires 'system','user','api_key' strings" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groq = new Groq({ apiKey: payload.api_key });
    const callOnce = () =>
      groq.chat.completions.create({
        messages: [
          { role: "system", content: payload.system },
          { role: "user", content: payload.user },
        ],
        model: "openai/gpt-oss-20b",
        stream: false,
      });
    let chatCompletion;
    try {
      chatCompletion = await callOnce();
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
      chatCompletion = await callOnce();
    }

    const content = chatCompletion.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
