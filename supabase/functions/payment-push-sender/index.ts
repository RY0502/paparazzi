import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey"
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed, use POST" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
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
    } catch (_e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let { paymentData, paymentUrl } = body || {};
    if (!paymentData) {
      return new Response(JSON.stringify({ error: "paymentData is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Accept paymentData as object or JSON-stringified object
    if (typeof paymentData === "string") {
      try {
        paymentData = JSON.parse(paymentData);
      } catch (_e) {
        return new Response(JSON.stringify({ error: "paymentData is a string but not valid JSON" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    if (typeof paymentData !== "object" || Array.isArray(paymentData)) {
      return new Response(JSON.stringify({ error: "paymentData must be an object" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!paymentUrl || typeof paymentUrl !== "string") {
      return new Response(JSON.stringify({ error: "paymentUrl is required and must be a string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // --- validate numeric amount explicitly ---
    if (paymentData.amount !== undefined) {
      const amount = Number(paymentData.amount);
      if (Number.isNaN(amount)) {
        return new Response(JSON.stringify({ error: "paymentData.amount must be a valid number" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      paymentData.amount = amount.toFixed(2);
    }

    // Fetch subscription for specified UUID
    const targetId = "fd12b86c-a8c8-460c-8ced-003e4b05ac26";
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, keys")
      .eq("id", targetId)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message || "Failed to query subscriptions");
    if (!subs) {
      return new Response(JSON.stringify({ error: `No subscription found for id ${targetId}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const subscription: { endpoint: string; keys?: { p256dh?: string; auth?: string } } = {
      endpoint: subs.endpoint,
      keys: subs.keys || {}
    };

    // Build notification body text from paymentData key-value pairs
    const kvPairs = Object.entries(paymentData)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join("\n");
    const bodyText = `PaymentData:\n${kvPairs}\n\nPaymentURL: Click to Pay`;

    // Build payload (no special handling for data:/image URLs)
    const payload = {
      title: "Payment Request",
      body: bodyText,
      icon: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4b0.svg",
      tag: "payment-request",
      actions: [{ action: "pay", title: "Click to Pay" }],
      data: { url: paymentUrl }
    };

    // Configure VAPID and send
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    try {
      await webpush.sendNotification(subscription as any, JSON.stringify(payload), {
        TTL: 3600,
        urgency: "high"
      } as any);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as any)?.statusCode || (err as any)?.status || 0;

      // Cleanup on 404/410
      if (status === 404 || status === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", targetId);
      }
      throw new Error(`Failed to send push: ${msg}`);
    }

    return new Response(JSON.stringify({ message: "Push sent" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[payment-push-sender.error]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
