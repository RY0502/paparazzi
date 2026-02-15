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
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  try {
    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GROQ_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const payload = (await req.json().catch(() => null)) as GroqRequest | null;
    if (!payload || typeof payload.system !== "string" || typeof payload.user !== "string") {
      return new Response(JSON.stringify({ error: "Invalid payload: requires 'system' and 'user' strings" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groq = new Groq({ apiKey });
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: payload.system },
        { role: "user", content: payload.user },
      ],
      model: "openai/gpt-oss-20b",
      stream: false,
    });

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
