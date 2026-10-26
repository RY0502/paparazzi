import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

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
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed, use POST" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase credentials not configured");
    if (!vapidPublic || !vapidPrivate) throw new Error("VAPID keys not configured");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message, identifier, targetId, appUrl } = body || {};

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message is required and must be a string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!identifier || typeof identifier !== "string") {
      return new Response(JSON.stringify({ error: "identifier is required and must be a string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The code-input page lives inside the Paparazzi web app, NOT at the
    // Supabase project URL. The caller must pass the app's public origin in
    // `appUrl` (e.g. "https://your-bolt-host.example"). We never derive it
    // from supabaseUrl — that would point at the API host and the SW/open
    // navigation would fail with "The requested path is invalid".
    let appBaseUrl = "";
    if (typeof appUrl === "string" && appUrl.length > 0) {
      try {
        const parsed = new URL(appUrl);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          appBaseUrl = parsed.origin;
        }
      } catch {
        // fall through to validation error
      }
    }
    if (!appBaseUrl) {
      return new Response(
        JSON.stringify({ error: "appUrl is required (the public origin of the Paparazzi app, e.g. https://your-host)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve the push subscription to send to.
    // If a targetId (push_subscriptions.id) is provided, use it; otherwise
    // fall back to the same fixed UUID used by payment-push-sender.
    const resolvedTargetId = typeof targetId === "string" && targetId.length > 0
      ? targetId
      : "4d81af9c-1aff-47d5-ba12-327c7a1e21df";

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, keys")
      .eq("id", resolvedTargetId)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message || "Failed to query subscriptions");
    if (!subs) {
      return new Response(JSON.stringify({ error: `No subscription found for id ${resolvedTargetId}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subscription: { endpoint: string; keys?: { p256dh?: string; auth?: string } } = {
      endpoint: subs.endpoint,
      keys: subs.keys || {},
    };

    // Build a deep-link URL that carries the identifier to the code-input page.
    // The page reads `?id=<identifier>` and renders the message + input box.
    const inputPageUrl = `${appBaseUrl}/?id=${encodeURIComponent(identifier)}`;

    const payload = {
      title: "Code Request",
      body: message,
      icon: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f511.svg",
      tag: "code-input",
      data: { url: inputPageUrl, identifier, message },
      actions: [{ action: "open", title: "Enter Code" }],
    };

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    try {
      await webpush.sendNotification(subscription as any, JSON.stringify(payload), {
        TTL: 3600,
        urgency: "high",
      } as any);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as any)?.statusCode || (err as any)?.status || 0;
      if (status === 404 || status === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", resolvedTargetId);
      }
      throw new Error(`Failed to send push: ${msg}`);
    }

    return new Response(JSON.stringify({ message: "Push sent", identifier }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[code-input-push-sender.error]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
