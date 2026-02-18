import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
// Groq is invoked via a generic edge function (groq-call)

const API_KEY = Deno.env.get("YOUTUBE_API_KEY") || "";
const GROQ_API_KEY = Deno.env.get("ANOTHER_GROQ_API_KEY") || "";
const CORS_ALLOW_ORIGIN = "*";
const CORS_ALLOW_METHODS = "GET, POST, OPTIONS";
const CORS_ALLOW_HEADERS = "Content-Type, Authorization";
const CORS_MAX_AGE = "600";

function corsHeaders(overrides?: Record<string, string>) {
  return {
    "Access-Control-Allow-Origin": CORS_ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": CORS_ALLOW_METHODS,
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
    "Access-Control-Max-Age": CORS_MAX_AGE,
    "Content-Type": "application/json",
    ...(overrides ?? {}),
  };
}

function yesNo(value: string): string {
  const m = String(value).toLowerCase().match(/^\s*(yes|no)\b/);
  return m ? m[1] : "";
}

function nowUtcIso(): string {
  return new Date().toISOString();
}

function hoursAgoUtcIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function ytSearchTitle(q: string): Promise<{ id: string; title: string } | null> {
  if (!API_KEY) return null;
  const url =
    "https://www.googleapis.com/youtube/v3/search" +
    `?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(q)}` +
    `&key=${encodeURIComponent(API_KEY)}`;
  console.log(`[youtube-first] YouTube search query: ${q}`);
  const r = await fetch(url);
  if (!r.ok) return null;
  const data = await r.json().catch(() => null);
  const id = data?.items?.[0]?.id?.videoId;
  const title = data?.items?.[0]?.snippet?.title;
  if (id && title) {
    console.log(`[youtube-first] YouTube first result: id=${id} title="${title}"`);
  } else {
    console.log(`[youtube-first] No YouTube video found for query`);
  }
  return id && title ? { id, title } : null;
}

async function groqSimilar(newsText: string, ytTitle: string): Promise<boolean> {
  console.log(`[youtube-first] LLM similarity check titles:\nTitle1: "${newsText}"\nTitle2: "${ytTitle}"`);
  const endpoint = Deno.env.get("GROQ_CALL_URL") || "";
  if (!endpoint) {
    console.warn("[youtube-first] GROQ_CALL_URL not set");
    return false;
  }
  if (!GROQ_API_KEY) {
    console.warn("[youtube-first] GROQ_API_KEY not set");
    return false;
  }
  const system =
    "You are an expert at determining if two titles describe the same underlying news event for the same primary subject. Decision policy: 1) Define similarity by core event + subject match: if both titles are about the same person and the same core event (e.g., death, mourning/tribute, announcement, arrest, wedding), answer 'yes' even if minor details differ. 2) Ignore HTML entities, punctuation, casing, synonyms, and location/time specifics unless they change the core event. 3) Allow additional related names (family, colleagues, co-stars) without penalizing similarity if the main subject and event remain the same. 4) Answer 'no' only if the primary subject or the core event differs. Respond with ONLY 'yes' or 'no'. Examples: Title1: Tommy Lee Jones Daughter Victoria's tragic cause of death revealed as overdose; Title2: Tommy Lee Jones' Daughter Found Dead in Ritzy Hotel Room -> yes. Title1: Sidharth Malhotra Mourns father's passing; Kiara Advani shares heartfelt tribute; Title2: Sidharth Malhotra’s Father Sunil Malhotra Passes Away in Delhi; Actor Shares Emotional Tribute -> yes.";
  const user = `Respond strictly with yes or no whether these two titles are of similar news of the celebrity or not.\nTitle1: ${newsText}\nTitle2: ${ytTitle}`;
  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`,
    },
    body: JSON.stringify({ system, user, api_key: GROQ_API_KEY }),
  });
  const json = await r.json().catch(() => null) as { content?: string } | null;
  const content = json?.content || "";
  const norm = yesNo(content);
  console.log(`[youtube-first] LLM raw="${content}" normalized="${norm}"`);
  return norm === "yes";
}

async function processCategory(supabase: ReturnType<typeof createClient>, category: string) {
  const table = `${category}_news`;
  const nowIso = nowUtcIso();
  const sinceIso = hoursAgoUtcIso(6);
  console.log(`[youtube-first] UTC window for ${category}: now=${nowIso} since=${sinceIso}`);
  const { data, error } = await supabase
    .from(table)
    .select("id, person_name, news_text, created_at")
    .gte("created_at", sinceIso)
    .or("youtube_url.is.null,youtube_url.eq.");
  if (error) return { category, processed: 0, updated: 0, error: error.message };
  const rows = (data || []) as Array<{ id: string; person_name: string; news_text: string; created_at: string }>;
  console.log(`[youtube-first] Eligible news for ${category}: count=${rows.length}`);
  let processed = 0;
  let updated = 0;
  for (const row of rows) {
    processed++;
    const q = `${row.person_name || ""} ${row.news_text || ""}`.trim();
    if (!q.trim()) continue;
    console.log(
      `[youtube-first] Processing news id=${row.id} created_at=${row.created_at} text="${q.slice(0, 200)}"`
    );
    const yt = await ytSearchTitle(q);
    if (!yt) continue;
    const isYes = await groqSimilar(q, yt.title);
    if (!isYes) continue;
    const url = `https://www.youtube.com/watch?v=${yt.id}`;
    const { error: upErr } = await supabase.from(table).update({ youtube_url: url }).eq("id", row.id);
    if (!upErr) updated++;
  }
  return { category, processed, updated };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !supabaseServiceKey || !API_KEY || !GROQ_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "Missing required server configuration",
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceKey,
        YOUTUBE_API_KEY: !!API_KEY,
        GROQ_API_KEY: !!GROQ_API_KEY,
      }),
      { status: 500, headers: corsHeaders() }
    );
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const results = [];
  for (const cat of ["bollywood", "tv", "hollywood"]) {
    const res = await processCategory(supabase, cat);
    results.push(res);
  }
  const summary = {
    timestamp: new Date().toISOString(),
    results,
    totalProcessed: results.reduce((a, r: any) => a + (r.processed || 0), 0),
    totalUpdated: results.reduce((a, r: any) => a + (r.updated || 0), 0),
  };
  return new Response(JSON.stringify(summary), { status: 200, headers: corsHeaders() });
});
