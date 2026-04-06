import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type NewsRow = {
  id: string;
  person_name: string;
  news_text: string;
  image_url: string | null;
  created_at: string;
};

function toBold(input: string) {
  const mapChar = (ch: string) => {
    const code = ch.codePointAt(0)!;
    if (code >= 65 && code <= 90) return String.fromCodePoint(0x1d400 + (code - 65));
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x1d41a + (code - 97));
    if (code >= 48 && code <= 57) return String.fromCodePoint(0x1d7ce + (code - 48));
    return ch;
  };
  return Array.from(input).map(mapChar).join("");
}

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
    blocks.push(`🎬 ${toBold("Bollywood")}\n🔸 ${toBold(b.person_name)} — ${b.news_text}`);
  }
  if (h) {
    blocks.push(`📰 ${toBold("Hollywood")}\n🔸 ${toBold(h.person_name)} — ${h.news_text}`);
  }
  if (t) {
    blocks.push(`📺 ${toBold("TV")}\n🔸 ${toBold(t.person_name)} — ${t.news_text}`);
  }
  const body = blocks.join("\n\n");
  const image = (b && b.image_url) || (t && t.image_url) || (h && h.image_url) || undefined;
  return {
    title: "🌟 It's Paparazzi time 🌟",
    body: body || "Your daily entertainment highlights are here!",
    url: "/", // open app at root
    icon: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4f0.svg",
    image,
    tag: "paparazzi-daily",
    actions: [{ action: "open", title: "Open App" }],
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

function getIstHourAsString() {
  // Asia/Kolkata is IST (UTC+5:30)
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  return hour; // e.g. "22"
}

async function sendToAll(
  supabase: ReturnType<typeof createClient>,
  payload: PushPayload,
  vapid: { subject: string; publicKey: string; privateKey: string }
) {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const { data: subs, error } = await supabase.from("push_subscriptions").select("id, endpoint, keys");
  if (error) {
    throw new Error(error.message || "Failed to load subscriptions");
  }

  // ✅ Filter condition:
  // If subscription id is this value AND current hour in IST is "22",
  // then do NOT send notification to that subscription.
  const blockedSubscriptionId = "59f40387-2864-48bb-b87c-0dfa1bb0610d";
  const istHour = getIstHourAsString();
  const shouldBlock = istHour === "22";

  const results: { id: string; ok: boolean; error?: string; skipped?: boolean }[] = [];
  const list = (subs || []) as Array<{ id: string; endpoint: string; keys?: { p256dh?: string; auth?: string } }>;

  console.log(`[push-newsletter] Sending push to ${list.length} subscriptions`);
  for (const s of list) {
    if (shouldBlock && s.id === blockedSubscriptionId) {
      console.log(
        `[push-newsletter] SKIP id=${s.id} because IST hour=${istHour} and id matches blocked id`
      );
      results.push({ id: s.id, ok: true, skipped: true });
      continue;
    }

    const subscription: { endpoint: string; keys: { p256dh?: string; auth?: string } } = {
      endpoint: s.endpoint,
      keys: s.keys || {},
    };

    try {
      await webpush.sendNotification(
        subscription as unknown as webpush.PushSubscription,
        JSON.stringify(payload),
        {
          TTL: 3600,
          urgency: "high",
        } as webpush.RequestOptions
      );

      results.push({ id: s.id, ok: true });
      const ep = String(s.endpoint || "");
      const epShort = ep.length > 32 ? `${ep.slice(0, 16)}…${ep.slice(-8)}` : ep;
      console.log(`[push-newsletter] OK id=${s.id} endpoint=${epShort}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ id: s.id, ok: false, error: msg });

      const status =
        (err as { statusCode?: number; status?: number } | undefined)?.statusCode ||
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

  const ok = results.filter((r) => r.ok && !r.skipped).length;
  const fail = results.filter((r) => !r.ok).length;
  const skipped = results.filter((r) => r.skipped).length;

  console.log(`[push-newsletter] Summary: sent=${ok} failed=${fail} skipped=${skipped}`);
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

    const sent = results.filter((r) => r.ok && !r.skipped).length;
    const failed = results.filter((r) => !r.ok).length;
    const skipped = results.filter((r) => r.skipped).length;

    console.log(
      `[push-newsletter] Completed send. ok=${sent} failed=${failed} skipped=${skipped}`
    );

    return new Response(
      JSON.stringify({
        message: "Push notifications sent",
        sent,
        failed,
        skipped,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[push-newsletter.error]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json", ...corsHeaders },
    });
  }
});