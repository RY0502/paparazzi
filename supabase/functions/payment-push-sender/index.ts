import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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

function isUpiLink(url: string) {
  return typeof url === "string" && url.trim().toLowerCase().startsWith("upi://");
}

// Escape for embedding into HTML attributes/text
function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildPaymentHtml(upiUrl: string) {
  // IMPORTANT: we keep the real href as escaped HTML attribute content
  const safeUpi = escapeHtml(upiUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Pay with UPI</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;padding:16px;margin:0}
      .btn{display:inline-block;padding:12px 16px;background:#111;color:#fff;border-radius:10px;text-decoration:none;cursor:pointer;user-select:none}
      .muted{margin-top:12px;color:#555;font-size:13px;word-break:break-all}
      .wrap{max-width:720px}
      .note{margin-top:10px;font-size:13px;color:#666}
    </style>
  </head>
  <body>
    <div class="wrap">
      <a id="upiBtn" class="btn" href="${safeUpi}" target="_self" rel="noopener">
        Pay with UPI
      </a>

      <div class="note">
        If clicking doesn't open on desktop, that's normal—desktop browsers often block <code>upi://</code> links.
        Use your mobile device for UPI handling.
      </div>

      <div class="muted">
        UPI link: <a href="${safeUpi}" target="_self" rel="noopener">${safeUpi}</a>
      </div>
    </div>

    <script>
      (function(){
        var upi = "${safeUpi}";
        var btn = document.getElementById("upiBtn");

        // Some webviews require navigation from JS to recognize the gesture.
        btn.addEventListener("click", function(e){
          try{
            e.preventDefault();
          }catch(_){}
          // Navigate to the deep link
          window.location.href = upi;
        });

        // Optional auto-redirect could be blocked; we avoid auto-navigation.
      })();
    </script>
  </body>
</html>`;
}

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

    let { paymentData, paymentUrl } = body || {};
    if (!paymentData) {
      return new Response(JSON.stringify({ error: "paymentData is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof paymentData === "string") {
      try {
        paymentData = JSON.parse(paymentData);
      } catch {
        return new Response(JSON.stringify({ error: "paymentData is a string but not valid JSON" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (typeof paymentData !== "object" || Array.isArray(paymentData)) {
      return new Response(JSON.stringify({ error: "paymentData must be an object" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!paymentUrl || typeof paymentUrl !== "string") {
      return new Response(JSON.stringify({ error: "paymentUrl is required and must be a string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const incomingPaymentUrl = paymentUrl;
    console.log("[payment-push-sender] incoming paymentUrl:", incomingPaymentUrl);

    // If paymentUrl is a data URL, upload it to public bucket 'QRs' and replace paymentUrl with the HTTPS public URL.
    if (isDataUrl(paymentUrl)) {
      const { contentType, bytes } = dataUrlToBytes(paymentUrl);

      const bucket = "QRs";
      const objectPath = "image.png";

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(objectPath, bytes, { contentType, upsert: true });

      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
      if (!publicUrlData?.publicUrl) throw new Error("Failed to build public URL for uploaded image");

      paymentUrl = publicUrlData.publicUrl;
      console.log("[payment-push-sender] data: url replaced with public QRs URL:", paymentUrl);
    }

    // If paymentUrl is a UPI deep link, wrap it in a hosted HTML page.
    // Then push the HTTPS URL (payment.html) so the user can open the hosted page.
    let upiDeepLink: string | null = null;

    if (isUpiLink(paymentUrl)) {
      upiDeepLink = paymentUrl;

      const bucket = "upi";
      const objectPath = "payment.html";

      const html = buildPaymentHtml(upiDeepLink);
      const bytes = new TextEncoder().encode(html);

      const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
        contentType: "text/html; charset=utf-8",
        upsert: true,
      });

      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
      if (!publicUrlData?.publicUrl) throw new Error("Failed to build public URL for payment.html");

      // The URL that should be opened by user click:
      paymentUrl = publicUrlData.publicUrl;

      console.log("[payment-push-sender] detected upi:// link");
      console.log("[payment-push-sender] will upload/override:", `storage://${bucket}/${objectPath}`);
      console.log("[payment-push-sender] payment.html HTTPS URL (what user should open):", paymentUrl);
      console.log("[payment-push-sender] embedded UPI deep link inside HTML:", upiDeepLink);
    }

    // validate amount
    if (paymentData.amount !== undefined) {
      const amount = Number(paymentData.amount);
      if (Number.isNaN(amount)) {
        return new Response(JSON.stringify({ error: "paymentData.amount must be a valid number" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      paymentData.amount = amount.toFixed(2);
    }

    // Fetch subscription
    const targetId = "d807b815-d70f-49ad-aa92-339ff49ad930";
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subscription: { endpoint: string; keys?: { p256dh?: string; auth?: string } } = {
      endpoint: subs.endpoint,
      keys: subs.keys || {},
    };

    // Build body text
    const kvPairs = Object.entries(paymentData)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join("\n");
    const bodyText = `PaymentData:\n${kvPairs}\n\nPaymentURL: Click to Pay`;

    // Build notification payload
    const payload = {
      title: "Payment Request",
      body: bodyText,
      icon: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4b0.svg",
      tag: "payment-request",
      actions: [{ action: "pay", title: "Click to Pay" }],
      // ✅ What your client should open
      data: { url: paymentUrl },
    };

    console.log("[payment-push-sender] final notification payload data.url (opened on click):", paymentUrl);

    // Send
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
        await supabase.from("push_subscriptions").delete().eq("id", targetId);
      }
      throw new Error(`Failed to send push: ${msg}`);
    }

    return new Response(JSON.stringify({ message: "Push sent" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[payment-push-sender.error]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});