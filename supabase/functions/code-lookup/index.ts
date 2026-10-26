import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed, use GET or POST" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let identifier: string | undefined;

    if (req.method === "GET") {
      // Support `/code-lookup?identifier=<id>` for convenience.
      try {
        const url = new URL(req.url);
        identifier = url.searchParams.get("identifier") || undefined;
      } catch {
        identifier = undefined;
      }
    } else {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      identifier = body?.identifier;
    }

    if (!identifier || typeof identifier !== "string" || identifier.length === 0) {
      return new Response(JSON.stringify({ error: "identifier is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return the most recent code for this identifier (newest first).
    const { data, error } = await supabase
      .from("codes")
      .select("code, created_at")
      .eq("identifier", identifier)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message || "Failed to query codes");

    // Retention: keep at most the 10 newest rows for this identifier (by
    // created_at desc). If there are more than 10, delete the older ones.
    // Non-fatal: cleanup failures don't break the lookup response.
    try {
      const { data: allRows, error: listError } = await supabase
        .from("codes")
        .select("id")
        .eq("identifier", identifier)
        .order("created_at", { ascending: false });

      if (listError) throw listError;

      if (allRows && allRows.length > 10) {
        const keepIds = allRows.slice(0, 10).map((r: any) => r.id);
        // Delete rows for this identifier whose id is not among the kept 10.
        const { error: deleteError } = await supabase
          .from("codes")
          .delete()
          .eq("identifier", identifier)
          .not("id", "in", `(${keepIds.map((id: string) => id).join(",")})`);

        if (deleteError) throw deleteError;
      }
    } catch (cleanupErr) {
      const msg = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
      console.error("[code-lookup.cleanup.error]", msg);
    }

    // maybeSingle() returns null when no row matches; that maps to code: null.
    return new Response(
      JSON.stringify({ identifier, code: data ? data.code : null, created_at: data ? data.created_at : null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[code-lookup.error]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
