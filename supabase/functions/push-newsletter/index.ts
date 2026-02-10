import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey"
};

type NewsRow = {
  id: string;
  person_name: string;
  news_text: string;
  image_url: string | null;
  created_at: string;
};

async function getTopStories(supabase: ReturnType<typeof createClient>) {
  const categories = ["bollywood", "tv", "hollywood"] as const;
  const results: Record<string, NewsRow[]> = {};
  for (const cat of categories) {
    const { data, error } = await supabase
      .from(`${cat}_news`)
      .select("id, person_name, news_text, image_url, created_at")
      .order("created_at", { ascending: false })
      .limit(3);
    if (error) {
      results[cat] = [];
    } else {
      results[cat] = (data || []) as NewsRow[];
    }
  }
  return results;
}

function buildPayload(stories: Awaited<ReturnType<typeof getTopStories>>) {
  const pick = (arr: NewsRow[]) => (arr && arr[0] ? arr[0] : null);
  const b = pick(stories["bollywood"]);
  const t = pick(stories["tv"]);
  const h = pick(stories["hollywood"]);
  const blocks: string[] = [];
  if (b) {
    blocks.push(`🎬 Bollywood\n• ${b.person_name} — ${b.news_text}`);
  }
  if (h) {
    blocks.push(`🌟 Hollywood\n• ${h.person_name} — ${h.news_text}`);
  }
  if (t) {
    blocks.push(`📺 TV\n• ${t.person_name} — ${t.news_text}`);
  }
  const body = blocks.join("\n\n");
  const image = (b && b.image_url) || (t && t.image_url) || (h && h.image_url) || undefined;
  return {
    title: "• It's Paparazzi time 😊 •",
    body: body || "Your daily entertainment highlights are here!",
    url: "/", // open app at root
    icon: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4f0.svg",
    image,
    tag: "paparazzi-daily",
    actions: [{ action: "open", title: "Open App" }]
  };
}

type PushPayload = {
  title: string;
  body: string;
  url: string;
  icon: string;
  image?: string;
  tag?: string;
  actions?: Array<{ action: string; title: string }>;
};

async function sendToAll(
  supabase: ReturnType<typeof createClient>,
  payload: PushPayload,
  vapid: { subject: string; publicKey: string; privateKey: string }
) {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, keys");
  if (error) {
    throw new Error(error.message || "Failed to load subscriptions");
  }
  const results: { id: string; ok: boolean; error?: string }[] = [];
  const list = (subs || []) as Array<{ id: string; endpoint: string; keys?: { p256dh?: string; auth?: string } }>;
  console.log(`[push-newsletter] Sending push to ${list.length} subscriptions`);
  for (const s of list) {
    const subscription: { endpoint: string; keys: { p256dh?: string; auth?: string } } = {
      endpoint: s.endpoint,
      keys: s.keys || {},
    };
    try {
      await webpush.sendNotification(subscription as unknown as webpush.PushSubscription, JSON.stringify(payload), {
        TTL: 3600,
        urgency: "high",
      } as webpush.RequestOptions);
      results.push({ id: s.id, ok: true });
      const ep = String(s.endpoint || "");
      const epShort = ep.length > 32 ? `${ep.slice(0, 16)}…${ep.slice(-8)}` : ep;
      console.log(`[push-newsletter] OK id=${s.id} endpoint=${epShort}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ id: s.id, ok: false, error: msg });
      const status = (err as { statusCode?: number; status?: number } | undefined)?.statusCode ||
        (err as { status?: number } | undefined)?.status ||
        0;
      if (status === 404 || status === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", s.id);
      }
      const ep = String(s.endpoint || "");
      const epShort = ep.length > 32 ? `${ep.slice(0, 16)}…${ep.slice(-8)}` : ep;
      console.warn(`[push-newsletter] FAIL id=${s.id} endpoint=${epShort} status=${status} error=${msg}`);
    }
  }
  const ok = results.filter(r => r.ok).length;
  const fail = results.length - ok;
  console.log(`[push-newsletter] Summary: sent=${ok} failed=${fail}`);
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }
    if (!vapidPublic || !vapidPrivate) {
      throw new Error("VAPID keys not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stories = await getTopStories(supabase);
    const payload = buildPayload(stories);
    const results = await sendToAll(supabase, payload, {
      subject: vapidSubject,
      publicKey: vapidPublic,
      privateKey: vapidPrivate,
    });
    console.log(`[push-newsletter] Completed send. ok=${results.filter(r => r.ok).length} failed=${results.filter(r => !r.ok).length}`);

    return new Response(JSON.stringify({
      message: "Push notifications sent",
      sent: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[push-newsletter.error]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
