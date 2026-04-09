import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey"
};

function isDataUrl(url: string) {
  return typeof url === "string" && url.startsWith("data:");
}

function dataUrlToBytes(dataUrl: string) {
  // Supports: data:<mime>;base64,<base64>
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) throw new Error("Invalid data URL format");

  const contentType = match[1];
  const base64 = match[2];

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return { contentType, bytes };
}

function guessExtensionFromMime(contentType: string) {
  const ct = contentType.toLowerCase().trim();
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  // fallback
  return "png";
}

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
    } catch {
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
      } catch {
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

    // If paymentUrl is a data URL, upload bytes to 'QRs' with a NEW unique name,
    // then replace paymentUrl with the HTTPS public URL.
    if (isDataUrl(paymentUrl)) {
      const { contentType, bytes } = dataUrlToBytes(paymentUrl);

      const bucket = "QRs";
      const ext = guessExtensionFromMime(contentType);

      const now = new Date();
      const ts = now.toISOString().replace(/[:.]/g, "-");
      const rand = crypto.randomUUID();
      const objectPath = `payment-qr-${ts}-${rand}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(objectPath, bytes, {
          contentType,
          upsert: false
        });

      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);

      if (!publicUrlData?.publicUrl) throw new Error("Failed to build public URL for uploaded image");

      paymentUrl = publicUrlData.publicUrl;
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
    const targetId = "4d81af9c-1aff-47d5-ba12-327c7a1e21df";
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

    // Build payload
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

    // After push is sent: delete images in bucket 'QRs' older than 24 hours.
    // Non-fatal: if cleanup fails, we still return success for the push.
    try {
      const bucket = "QRs";
      const cutoffMs = Date.now() - 24 * 60 * 60 * 1000; // 24 hours

      let start = 0;
      const limit = 100;

      while (true) {
        const { data: listed, error: listError } = await supabase.storage
          .from(bucket)
          .list("", { limit, offset: start });

        if (listError) throw new Error(listError.message);

        if (!listed || listed.length === 0) break;

        for (const obj of listed as any[]) {
          const createdAt = obj?.created_at ?? obj?.updated_at ?? null;
          if (!createdAt) continue;

          const t = new Date(createdAt).getTime();
          if (!Number.isNaN(t) && t < cutoffMs) {
            const name = obj.name as string;
            // delete expects the object path relative to the bucket
            await supabase.storage.from(bucket).remove([name]);
          }
        }

        // If fewer than limit returned, we reached the end
        if (listed.length < limit) break;
        start += limit;
      }
    } catch (cleanupErr) {
      console.error("[payment-push-sender.cleanup.error]", cleanupErr);
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