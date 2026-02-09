import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey"
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomJitter(baseMs: number) {
  const jitter = baseMs * 0.3;
  return Math.max(0, baseMs + (Math.random() * jitter * 2 - jitter));
}

// Fetch a per-category Gemini API key by calling the URL stored in env.
// The URL is expected to return JSON where keys[0].vault_keys.decrypted_value contains the key.
// Retries up to 3 attempts (initial + 2 retries) with exponential backoff + jitter.
async function fetchGeminiKeyFromUrl(envUrlVar: string) {
  const url = Deno.env.get(envUrlVar);
  if (!url) {
    throw new Error(`${envUrlVar} not configured`);
  }

  const MAX_ATTEMPTS = 3;
  const BASE_DELAY_MS = 500; // base backoff
  let lastErr: any = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutMs = 5000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, { method: "GET", signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        lastErr = new Error(`Key fetch returned ${res.status} ${res.statusText} ${txt ? `- ${txt.slice(0, 200)}` : ""}`);
        if (attempt < MAX_ATTEMPTS) {
          const wait = randomJitter(BASE_DELAY_MS * Math.pow(2, attempt - 1));
          await sleep(wait);
          continue;
        } else {
          throw lastErr;
        }
      }

      const data = await res.json().catch(() => null);
      if (!data || !Array.isArray(data.keys) || data.keys.length === 0) {
        lastErr = new Error("Key response missing keys array or empty");
        if (attempt < MAX_ATTEMPTS) {
          const wait = randomJitter(BASE_DELAY_MS * Math.pow(2, attempt - 1));
          await sleep(wait);
          continue;
        } else {
          throw lastErr;
        }
      }

      const vault = data.keys[0]?.vault_keys;
      const decrypted = vault?.decrypted_value;
      if (!decrypted) {
        lastErr = new Error("Missing keys[0].vault_keys.decrypted_value in key response");
        if (attempt < MAX_ATTEMPTS) {
          const wait = randomJitter(BASE_DELAY_MS * Math.pow(2, attempt - 1));
          await sleep(wait);
          continue;
        } else {
          throw lastErr;
        }
      }

      return String(decrypted);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) {
        const wait = randomJitter(BASE_DELAY_MS * Math.pow(2, attempt - 1));
        await sleep(wait);
        continue;
      } else {
        throw lastErr;
      }
    }
  }

  throw lastErr || new Error("Failed to fetch Gemini key");
}

async function fetchFromGeminiWithKey(category: string, geminiApiKey: string) {
  const prompts: Record<string, string> = {
    bollywood: `Using ONLY real-time web results get exactly 15 latest entertainment news items about Indian Bollywood actors and singers trending from the past 24 hours. Each news item must be on a separate line in this exact format:
[Person Name] - [Single line news description]

Example:
Shah Rukh Khan - Announces new collaboration with international director
Deepika Padukone - Wins Best Actress award at film festival

Requirements:
- Use real, well-known Bollywood celebrities
- Keep each news item to one line
- Make news current and tabloid worthy
- Constraint: Grammatical Completeness. The description must be a complete independent clause. It must contain a subject, a functional verb, and an object or context.
Reject: Fragmented keyword pairs (e.g., "Javed Akhtar - threaten" or "Stock market - rise").
Accept: Full narrative summaries (e.g., "Javed Akhtar receives a threatening email regarding his recent comments" or "The stock market rose by 2% following the federal announcement").
Standard of Quality: > If the line were read in isolation, a reader should understand exactly who did what and why, without needing to refer back to the source text.
- Return exactly 15 items
- Constraint:  Return only 1 when news are similar. E.g.
Ranveer Singh - Dhurandhar marches towards Rs 750
and
Ranveer Singh - his film Dhurandhar marches towards RS 750 crores mark
should result in single news item and not 2`,
    tv: `Using ONLY real-time web results get exactly 15 latest entertainment news items about Indian daily soap and TV industry actors trending from the past 24 hours. Each news item must be on a separate line in this exact format:
[Person Name] - [Single line news description]

Example:
Hina Khan - Returns to popular TV show after break
Rupali Ganguly - Show reaches 1000 episode milestone

Requirements:
- Use real, well-known Indian TV actors
- Keep each news item to one line
- Make news current and  tabloid worthy
- Constraint: Grammatical Completeness. The description must be a complete independent clause. It must contain a subject, a functional verb, and an object or context.
Reject: Fragmented keyword pairs (e.g., "Javed Akhtar - threaten" or "Stock market - rise").
Accept: Full narrative summaries (e.g., "Javed Akhtar receives a threatening email regarding his recent comments" or "The stock market rose by 2% following the federal announcement").
Standard of Quality: > If the line were read in isolation, a reader should understand exactly who did what and why, without needing to refer back to the source text.
- Return exactly 15 items
- Constraint: return only 1 when news are similar. E.g.
Gaurav khanna wins big boss 18
and
Gaurav khanna revived his tv career after big boss 18 win
should result in single news item and not 2`,
    hollywood: `Using ONLY real-time web results get exactly 15 latest entertainment news items about American Hollywood actors and singers trending from the past 24 hours. Each news item must be on a separate line in this exact format:
[Person Name] - [Single line news description]

Example:
Leonardo DiCaprio - Signs for climate change documentary
Taylor Swift - Announces surprise album release

Requirements:
- Use real, well-known Hollywood celebrities
- Keep each news item to one line
- Make news current and tabloid worthy
- Constraint: Grammatical Completeness. The description must be a complete independent clause. It must contain a subject, a functional verb, and an object or context.
Reject: Fragmented keyword pairs (e.g., "Javed Akhtar - threaten" or "Stock market - rise").
Accept: Full narrative summaries (e.g., "Javed Akhtar receives a threatening email regarding his recent comments" or "The stock market rose by 2% following the federal announcement").
Standard of Quality: > If the line were read in isolation, a reader should understand exactly who did what and why, without needing to refer back to the source text.
- Return exactly 15 items
- Constraint:  return only 1 when news are similar. E.g.
Killing of Rob Reiner and his wife stun hollywood
and
Rob Reiner found dead with his wife, son charged in connection with their murders
should result in single news item and not 2`
  };

  const prompt = prompts[category];
  if (!prompt) {
    throw new Error(`Invalid category: ${category}`);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
  const bodyPayload = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    tools: [
      {
        google_search: {}
      }
    ],
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 2048
    }
  };

  const maxAttempts = 3;
  const retryDelayMs = 5000;
  let lastError: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(bodyPayload)
      });

      if (!response.ok) {
        const text = await response.text().catch(() => null);
        lastError = new Error(`Gemini API error: ${response.status} ${response.statusText} ${text ? `- ${text}` : ""}`);
        if (attempt < maxAttempts) {
          console.warn(`Gemini request failed (attempt ${attempt}/${maxAttempts}). Retrying in ${retryDelayMs}ms...`, lastError);
          await sleep(retryDelayMs);
          continue;
        } else {
          throw lastError;
        }
      }

      const data = await response.json();
const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
const lines = text.split("\n").filter((line: string) => line.trim().length > 0);
const newsItems: { news_text: string; person_name: string; search_query: string }[] = [];

for (const line of lines) {
  const match = line.match(/^(?:\d+\.\s*)?(.+?)\s*[-–]\s*(.+)$/);
  if (match && newsItems.length < 15) {
    let [, personName, newsText] = match;
    personName = personName.trim();

    // find first occurrence of '[' or '[cite' or '[ cite' (case-insensitive)
    const lower = newsText.toLowerCase();
    let cutIndex = -1;

    const indexBracket = lower.indexOf('[');
    if (indexBracket !== -1) cutIndex = indexBracket;

    // also check for explicit '[cite' and '[ cite' but '[' handling above already covers them;
    // keep checks for clarity and in case you want different behavior later
    const indexCiteNoSpace = lower.indexOf('[cite');
    if (indexCiteNoSpace !== -1) cutIndex = cutIndex === -1 ? indexCiteNoSpace : Math.min(cutIndex, indexCiteNoSpace);

    const indexCiteWithSpace = lower.indexOf('[ cite');
    if (indexCiteWithSpace !== -1) cutIndex = cutIndex === -1 ? indexCiteWithSpace : Math.min(cutIndex, indexCiteWithSpace);

    if (cutIndex !== -1) {
      newsText = newsText.slice(0, cutIndex);
    }

    const cleanedNewsText = newsText.trim();

    newsItems.push({
      news_text: cleanedNewsText,
      person_name: personName,
      search_query: `${personName} ${cleanedNewsText}`
    });
  }
}
      return newsItems.slice(0, 15);
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        console.warn(`Gemini request error (attempt ${attempt}/${maxAttempts}):`, err, `Retrying in ${retryDelayMs}ms...`);
        await sleep(retryDelayMs);
        continue;
      } else {
        console.error(`Gemini request failed after ${maxAttempts} attempts:`, err);
        throw err;
      }
    }
  }
  throw lastError || new Error("Unknown error calling Gemini API");
}

async function fetchFromGemini(category: string) {
  // Determine which env var to use for the key URL
  const map: Record<string, string> = {
    bollywood: "BOLLYWOOD_URL_KEY",
    tv: "TV_URL_KEY",
    hollywood: "HOLLYWOOD_URL_KEY"
  };
  const envVar = map[category];
  if (!envVar) throw new Error(`No key URL mapping for category ${category}`);

  // Fetch the key (with retries inside the helper)
  const geminiKey = await fetchGeminiKeyFromUrl(envVar);
  return fetchFromGeminiWithKey(category, geminiKey);
}

async function fetchPersonImage(personName: string) {
  // Read Wikimedia env variables
  const WIKIMEDIA_ACCESS_TOKEN = Deno.env.get("WIKIMEDIA_ACCESS_TOKEN") || "";
  const WIKIMEDIA_APP_NAME = Deno.env.get("WIKIMEDIA_APP_NAME") || "";
  const WIKIMEDIA_REFERER = Deno.env.get("WIKIMEDIA_REFERER") || "";

  let normalizedPersonName = personName;
  const lower = normalizedPersonName.toLowerCase();
  
  let marker = ' and ';
  let idx = lower.indexOf(marker);
  if (idx !== -1) {
    normalizedPersonName.slice(0, idx).trim();
  }

  marker = ' & ';
  idx = lower.indexOf(marker);
  if (idx !== -1) {
    normalizedPersonName.slice(0, idx).trim();
  }

  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: normalizedPersonName,
    gsrnamespace: '6',
    gsrlimit: '10',
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '800',
    format: 'json',
    origin: '*'
  });

  let url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
  if (url.endsWith('.')) {
    url = url.slice(0, -1);
  }

  // Fetch configuration
  const WM_FETCH_TIMEOUT_MS = 10000;
  const WM_MAX_RETRIES = 5;
  const WM_BASE_RETRY_MS = 1000;

  let attempt = 0;
  let lastErr: any = null;
  while (attempt < WM_MAX_RETRIES) {
    attempt++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WM_FETCH_TIMEOUT_MS);

    if (attempt > 1) {
      const backoff = randomJitter(WM_BASE_RETRY_MS * Math.pow(2, attempt - 2));
      await sleep(backoff);
    }

    try {
      const headers: Record<string, string> = {
        "Accept": "application/json"
      };
      // Add User-Agent and Authorization from env if present
      if (WIKIMEDIA_APP_NAME) {
        headers["User-Agent"] = WIKIMEDIA_APP_NAME;
      }
      if (WIKIMEDIA_ACCESS_TOKEN) {
        headers["Authorization"] = `Bearer ${WIKIMEDIA_ACCESS_TOKEN}`;
      }
      if (WIKIMEDIA_REFERER) {
        headers["Referer"] = WIKIMEDIA_REFERER;
      }

      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        lastErr = new Error(`Wikimedia API returned ${response.status} ${response.statusText}`);
        console.warn(`Wikimedia API non-OK ${response.status} for "${personName}"`);

        if (response.status === 403 || response.status === 429) {
          const bodyText = await response.text().catch(() => "");
          console.warn(`Wikimedia response body (truncated): ${bodyText.slice(0, 500)}`);
          const extra = response.status === 403 ? 5000 : 0;
          const waitMs = randomJitter(WM_BASE_RETRY_MS * Math.pow(2, attempt - 1) + extra);
          await sleep(waitMs);
          continue;
        }

        if (response.status >= 500 && response.status < 600) {
          const waitMs = randomJitter(WM_BASE_RETRY_MS * Math.pow(2, attempt - 1));
          await sleep(waitMs);
          continue;
        }

        return FALLBACK_IMAGE();
      }

      const data = await response.json().catch(() => null);
      if (!data || !data.query || !data.query.pages) {
        console.warn(`Wikimedia API returned no pages for ${personName}`);
        return FALLBACK_IMAGE();
      }

      const pages = Object.values<any>(data.query.pages);
      if (pages.length === 0) {
        console.warn(`Wikimedia returned empty pages array for ${personName}`);
        return FALLBACK_IMAGE();
      }

      const isValidImageUrl = (imageUrl: any) => {
        if (!imageUrl) return false;
        const urlLower = String(imageUrl).toLowerCase();
        if (urlLower.includes('.pdf')) return false;
        if (urlLower.match(/\.(doc|docx|txt|odt|rtf)/)) return false;
        if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/)) return true;
        if (urlLower.includes('/thumb/')) return true;
        return false;
      };

      const filenameMatchesPerson = (imageUrl: any, personName: string) => {
        if (!imageUrl) return false;
        const filename = String(imageUrl).toLowerCase();
        const nameParts = personName.toLowerCase().split(/\s+/).filter(p => p.length > 2);
        if (nameParts.length === 0) return false;
        return nameParts.some(part => filename.includes(part));
      };

      const candidates: string[] = [];
      for (const page of pages) {
        const info = page?.imageinfo?.[0];
        const imageUrl = info?.thumburl || info?.url;
        if (imageUrl && isValidImageUrl(imageUrl)) {
          candidates.push(imageUrl);
        }
      }

      if (candidates.length === 0) {
        console.warn(`No valid candidate image URLs for ${personName}`);
        return FALLBACK_IMAGE();
      }

      const matches = candidates.filter(c => filenameMatchesPerson(c, personName));
if (matches.length === 0) {
  return candidates[0];// or simply `return;`
}
const randomIndex = Math.floor(Math.random() * matches.length);
return matches[randomIndex];
     
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      console.warn(`Error fetching Wikimedia for "${personName}" attempt ${attempt}:`, err);
      const waitMs = randomJitter(WM_BASE_RETRY_MS * Math.pow(2, attempt - 1));
      await sleep(waitMs);
      continue;
    }
  }

  console.error(`Failed to fetch Wikimedia image for "${personName}" after ${WM_MAX_RETRIES} attempts:`, lastErr);
  return FALLBACK_IMAGE();

  function FALLBACK_IMAGE() {
    return 'https://fr0jflsfvamy.objectstorage.eu-frankfurt-1.oci.customer-oci.com/n/fr0jflsfvamy/b/paparazzi/o/default.png';
  }
}

async function updateNewsForCategory(supabase: any, category: string) {
  try {
    console.log(`Fetching news for ${category}...`);
    const newsItems = await fetchFromGemini(category);
    console.log(`Fetched ${newsItems.length} news items for ${category}`);
    const VIDEO_KEYWORDS = ['shows','shares','shared','video','videos','clip','clips','reels','tape','captured','caught','camera','tik tok','tik-tok','footage','reel','videotape','instagram', 'insta'];
    const YT_API_KEY = Deno.env.get('YOUTUBE_API_KEY') || '';
    const OPENROUTER_PROXY = Deno.env.get('OPENROUTER_PROXY') || '';
    const ytSearch = async (q: string): Promise<{ url: string; title: string } | null> => {
      if (!YT_API_KEY) return null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      try {
        const url =
          'https://www.googleapis.com/youtube/v3/search' +
          `?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(q)}` +
          `&key=${encodeURIComponent(YT_API_KEY)}`;
        const r = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!r.ok) return null;
        const data = await r.json().catch(() => null);
        const id = data?.items?.[0]?.id?.videoId;
        const title = data?.items?.[0]?.snippet?.title;
        return id && title ? { url: `https://www.youtube.com/watch?v=${id}`, title } : null;
      } catch {
        clearTimeout(timeout);
        return null;
      }
    };
    const shouldAttachVideo = (text: string) => {
      const lower = (text || '').toLowerCase();
      return VIDEO_KEYWORDS.some(k => lower.includes(k));
    };
    const verifySimilarYesNo = async (query: string, ytTitle: string): Promise<boolean> => {
      if (!OPENROUTER_PROXY) return false;
      const payload = `Respond strictly with yes or no whether these two titles are similar or not.\nTitle1: ${query}\nTitle2: ${ytTitle}`;
      const res = await fetch(OPENROUTER_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: payload
      });
      if (!res.ok) return false;
      const text = (await res.text()).trim().toLowerCase();
      return text === 'yes';
    };
    const newsWithImages = await Promise.all(newsItems.map(async (item) => {
      const image_url = await fetchPersonImage(item.person_name);
      let youtube_url = '';
      if (shouldAttachVideo(item.news_text)) {
        const yt = await ytSearch(item.search_query || `${item.person_name} ${item.news_text}`);
        if (yt) {
          const isSim = await verifySimilarYesNo(item.search_query || `${item.person_name} ${item.news_text}`, yt.title);
          if (isSim) {
            youtube_url = yt.url;
          }
        }
      }
      return {
        ...item,
        image_url,
        youtube_url,
        created_at: new Date().toISOString()
      };
    }));
    const tableName = `${category}_news`;
    const { data, deleteError } = await supabase.from(tableName).delete().lt('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());
    if (deleteError) {
      console.error(`Error clearing old news for ${category}:`, deleteError);
    }
    // Try insert with youtube_url; if schema lacks column, fall back to insertion without youtube_url
    let insertError: any = null;
    {
      const { error } = await supabase.from(tableName).insert(newsWithImages);
      insertError = error || null;
    }
    if (insertError && typeof insertError.message === 'string' && /column.*youtube_url.*does not exist/i.test(insertError.message)) {
      console.warn(`youtube_url column missing in ${tableName}, inserting without it`);
      const fallback = newsWithImages.map(({ youtube_url, ...rest }) => rest);
      const { error: fbError } = await supabase.from(tableName).insert(fallback);
      if (fbError) insertError = fbError;
      else insertError = null;
    }
    if (insertError) {
      // Detect Postgres unique constraint violation (SQLSTATE '23505').
      // Supabase JS error objects typically include 'code' or 'details' fields.
      const sqlState = (insertError as any).code || (insertError as any).statusCode || (insertError as any).hint;
      const message = (insertError as any).message || insertError;
      const isUniqueViolation =
        // common patterns: error.code === '23505' OR message contains 'unique' OR details mention 'already exists'
        sqlState === '23505' ||
        typeof message === 'string' && /unique|duplicate|already exists/i.test(message) ||
        (typeof (insertError as any).details === 'string' && /unique|duplicate|already exists/i.test((insertError as any).details));
      if (isUniqueViolation) {
        console.warn(`Unique constraint violation inserting news for ${category}:`, insertError);
        // continue without throwing so the function completes successfully
      } else {
        console.error(`Error inserting news for ${category}:`, insertError);
        throw insertError;
      }
    }
    console.log(`Successfully updated ${category} news`);
    return {
      success: true,
      count: newsWithImages.length
    };
  } catch (error) {
    console.error(`Error updating ${category} news:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = await Promise.allSettled([
      updateNewsForCategory(supabase, "bollywood"),
      updateNewsForCategory(supabase, "tv"),
      updateNewsForCategory(supabase, "hollywood")
    ]);

    const summary = results.map((result, index) => {
      const category = [
        "bollywood",
        "tv",
        "hollywood"
      ][index];
      if (result.status === "fulfilled") {
        return {
          category,
          ...result.value
        };
      } else {
        return {
          category,
          success: false,
          error: result.reason?.message || "Unknown error"
        };
      }
    });
    return new Response(JSON.stringify({
      message: "News update completed",
      results: summary,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Error in news-scheduler function:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Internal server error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
