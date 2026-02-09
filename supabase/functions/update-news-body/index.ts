import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey"
};
function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function bad(body: unknown) {
  return new Response(JSON.stringify(body), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function fail(body: unknown) {
  return new Response(JSON.stringify(body), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return fail({ success: false, error: "Supabase credentials not configured" });
    }
    const client = createClient(supabaseUrl, supabaseServiceKey);
    const payload = await req.json().catch(() => null) as { table?: string; id?: string; news_body?: string };
    if (!payload || !payload.table || !payload.id || typeof payload.news_body !== "string") {
      return bad({ success: false, error: "Invalid request payload" });
    }
    const allowed = new Set(["bollywood_news", "tv_news", "hollywood_news"]);
    if (!allowed.has(payload.table)) {
      return bad({ success: false, error: "Invalid table" });
    }
    const { data, error } = await client
      .from(payload.table)
      .update({ news_body: payload.news_body })
      .eq("id", payload.id)
      .select("id");
    if (error) {
      return fail({ success: false, error: String(error.message || error) });
    }
    const updated = Array.isArray(data) ? data.length : (data ? 1 : 0);
    return ok({ success: true, updated });
  } catch (e) {
    return fail({ success: false, error: e instanceof Error ? e.message : "Internal error" });
  }
})
