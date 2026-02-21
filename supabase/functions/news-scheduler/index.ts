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
    bollywood: `Using ONLY real-time web results get exactly 15 latest breaking entertainment news items about Indian Bollywood actors and singers trending from the past 24 hours. Each news item must be on a separate line in this exact format:
[Person Name] - [Short single-line headline (<=12 words)] <SEP> [news details about 7-8 sentences, no citations]

Example:
Shah Rukh Khan - Announces new collaboration with international director || A paragraph of news details about 8 sentences long about the news context, who/what/why/impact.
Deepika Padukone - Wins Best Actress award at film festival || A paragraph of news details about 8 sentences long about the news context, who/what/why/impact.

Requirements:
- Use real, well-known Bollywood celebrities
- Keep each news item to one line
- Make news current and tabloid worthy
- Return exactly 15 items
- The single-line description must be short like a title, maximum 12 words
- After the single-line description, add " <SEP> " and then news details 7-8 sentences long. Do not include sources or citations. Do not include brackets. Important: Ensure the news details MUST be at least 6 sentences long
- Do not use "||" anywhere. Use ONLY "<SEP>" as the separator
- Constraint:  Return only 1 when news are similar. E.g.
Ranveer Singh - Dhurandhar marches towards Rs 750
and
Ranveer Singh - his film Dhurandhar marches towards RS 750 crores mark
should result in single news item and not 2`,
    tv: `Using ONLY real-time web results get exactly 15 latest breaking entertainment news items about Indian daily soap and TV industry actors trending from the past 24 hours. Each news item must be on a separate line in this exact format:
[Person Name] - [Short single-line headline (<=12 words)] <SEP> [news details about 7-8 sentences, no citations]

Example:
Hina Khan - Returns to popular TV show after break || A paragraph of news details about 8 sentences long  about the news context, who/what/why/impact.
Rupali Ganguly - Show reaches 1000 episode milestone || A paragraph of news details about 8 sentences long  about the news context, who/what/why/impact.

Requirements:
- Use real, well-known Indian TV actors
- Keep each news item to one line
- Make news current and  tabloid worthy
- Return exactly 15 items
- The single-line description must be short like a title, maximum 12 words
- After the single-line description, add " <SEP> " and then news details 7-8 sentences long. Do not include sources or citations. Do not include brackets. Important: Ensure the news details MUST be at least 6 sentences long
- Do not use "||" anywhere. Use ONLY "<SEP>" as the separator
- Constraint: return only 1 when news are similar. E.g.
Gaurav khanna wins big boss 18
and
Gaurav khanna revived his tv career after big boss 18 win
should result in single news item and not 2`,
    hollywood: `Using ONLY real-time web results get exactly 15 latest breaking entertainment news items about American Hollywood actors and singers trending from the past 24 hours. Each news item must be on a separate line in this exact format:
[Person Name] - [Short single-line headline (<=12 words)] <SEP> [news details about 7-8 sentences, no citations]

Example:
Leonardo DiCaprio - Signs for climate change documentary || A paragraph of news details about 8 sentences long about the news context, who/what/why/impact.
Taylor Swift - Announces surprise album release || A paragraph of news details about 8 sentences long  about the news context, who/what/why/impact.

Requirements:
- Use real, well-known Hollywood celebrities
- Keep each news item to one line
- Make news current and tabloid worthy
- Return exactly 15 items
- The single-line description must be short like a title, maximum 12 words
- After the single-line description, add " <SEP> " and then news details 7-8 sentences long. Do not include sources or citations. Do not include brackets. Important: Ensure the news details MUST be at least 6 sentences long
- Do not use "||" anywhere. Use ONLY "<SEP>" as the separator
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
const newsItems: { news_text: string; person_name: string; search_query: string; news_body: string }[] = [];

for (const line of lines) {
  const match = line.match(/^(?:\d+\.\s*)?(.+?)\s*[-–]\s*(.+)$/);
  if (match && newsItems.length < 15) {
    const personNameRaw = match[1];
    const newsTextRaw = match[2];
    const personName = personNameRaw.trim();
    const parts = newsTextRaw.split('<SEP>');
    const headlinePart = parts[0] ? parts[0] : newsTextRaw;
    const summaryPart = parts[1] ? parts[1] : '';
    const stripCitations = (s: string) => {
      const lower = s.toLowerCase();
      let cutIndex = -1;
      const indexBracket = lower.indexOf('[');
      if (indexBracket !== -1) cutIndex = indexBracket;
      const indexCiteNoSpace = lower.indexOf('[cite');
      if (indexCiteNoSpace !== -1) cutIndex = cutIndex === -1 ? indexCiteNoSpace : Math.min(cutIndex, indexCiteNoSpace);
      const indexCiteWithSpace = lower.indexOf('[ cite');
      if (indexCiteWithSpace !== -1) cutIndex = cutIndex === -1 ? indexCiteWithSpace : Math.min(cutIndex, indexCiteWithSpace);
      if (cutIndex !== -1) {
        s = s.slice(0, cutIndex);
      }
      return s.trim();
    };
    const cleanedHeadline = stripCitations(headlinePart.trim());
    const cleanedSummary = stripCitations(summaryPart.trim());
    const headlineFinal = (cleanedHeadline.split(/\s+/).filter(Boolean).length < 6)
      ? (() => {
          const w = cleanedSummary.split(/\s+/).filter(Boolean).slice(0, 10).join(' ');
          return w ? `${w}...` : cleanedHeadline;
        })()
      : cleanedHeadline;
    newsItems.push({
      news_text: headlineFinal,
      person_name: personName,
      search_query: `${personName} ${headlineFinal}`,
      news_body: cleanedSummary
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

async function fetchWikimediaApiResponse(personName: string): Promise<Response | null> {
  const WIKIMEDIA_ACCESS_TOKEN = Deno.env.get("WIKIMEDIA_ACCESS_TOKEN") || "";
  const WIKIMEDIA_APP_NAME = Deno.env.get("WIKIMEDIA_APP_NAME") || "";
  const WIKIMEDIA_REFERER = Deno.env.get("WIKIMEDIA_REFERER") || "";

  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: personName,
    gsrnamespace: "6",
    gsrlimit: "10",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "800",
    format: "json",
    origin: "*"
  });

  let url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
  if (url.endsWith(".")) {
    url = url.slice(0, -1);
  }

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
        Accept: "application/json"
      };
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
          //const bodyText = await response.text().catch(() => "");
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
        return null;
      }

      return response;
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      const waitMs = randomJitter(WM_BASE_RETRY_MS * Math.pow(2, attempt - 1));
      await sleep(waitMs);
      continue;
    }
  }

  return null;
}

async function fetchPersonImage(personName: string, category: string) {
  let normalizedPersonName = personName;
  const lower = normalizedPersonName.toLowerCase();
  let marker = ' and ';
  let idx = lower.indexOf(marker);
  if (idx !== -1) {
    normalizedPersonName = normalizedPersonName.slice(0, idx).trim();
  }
  marker = ' & ';
  idx = lower.indexOf(marker);
  if (idx !== -1) {
    normalizedPersonName = normalizedPersonName.slice(0, idx).trim();
  }
  const normalizedPersonNameWithCat = normalizedPersonName + ' ' + category;

  const isValidImageUrl = (imageUrl: any) => {
    if (!imageUrl) return false;
    const urlLower = String(imageUrl).toLowerCase();
    if (urlLower.includes('.pdf')) return false;
    if (urlLower.match(/\.(doc|docx|txt|odt|rtf)/)) return false;
    if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/)) return true;
    if (urlLower.includes('/thumb/')) return true;
    return false;
  };

  const hasOnlyPersonName = async (imageUrl: string, personName: string): Promise<boolean> => {
    const endpoint = Deno.env.get("GROQ_CALL_URL") || "";
    if (!endpoint) return false;
    const apiKey = Deno.env.get("GROQ_API_KEY") || "";
    if (!apiKey) return false;
    const system =
      "You are a URL Content Analyzer. Your task is to determine if a provided URL contains ONLY the name of the specified celebrity with only two exception rules. Rules: 1. If the URL contains any other person's name alongside the celebrity, the answer is 'no'. 2. If the URL exclusively identifies the celebrity, even with dates or event names, the answer is 'yes'. 3. If the given person name is NOT in the URL, answer 'no'. 4. If the given person name is the only person name in the URL, answer 'yes'.\n Exception rule one: If the URL contains words suggesting other people are present with the celebrity (only allowed words: 'and', '&', '+') and the other celebrity name is directly connected with the given celebrity in the url, the answer is 'yes'.\n Exception rule two (directional): Return 'yes' ONLY when the given person's name appears BEFORE 'at' (as the attendee) and the name AFTER 'at' is another person (host/venue). If the given person's name appears AFTER 'at' (as host/venue), return 'no'. Examples: URL: '...Shah_Rukh_Khan_Kajol.jpg' Name: 'Shah Rukh Khan' -> no. URL: '...Shah_Rukh_Khan_and_Kajol.jpg' Name: 'Shah Rukh Khan' -> yes. URL: '...Shah_Rukh_Khan_and_Kajol_spotted_at_Sonu_Nigam_concert.jpg' Name: 'Sonu Nigam' -> no. URL: '...Ranveer_Singh_&_Tamannaah.jpg' Name: 'Ranveer Singh' -> yes. URL: '...Shahid_Kapoor_2009.jpg' Name: 'Shahid_Kapoor' -> yes. URL: '...Tamannaah_at_Ranveer_Singh_birthday_party.jpg' Name: 'Ranveer Singh' -> no. URL: '...Tamannaah_at_Ranveer_Singh_birthday_party.jpg' Name: 'Tamannaah' -> yes. URL: '...Mawra_Hocane_at_Arijit_Singh_concert02.jpg' Name: 'Arijit Singh' -> no. Instructions: Analyze the provided URL and Person Name and respond with ONLY 'yes' or 'no'.";
    const user = `Respond strictly with yes or no whether the url contains only given the celebrity name including exception cases.\nurl: ${imageUrl}\ncelebrityName: ${personName}`;
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`,
        },
        body: JSON.stringify({ system, user, api_key: apiKey }),
      });
      if (!r.ok) return false;
      const j = await r.json().catch(() => null) as { content?: string } | null;
      const content = j?.content || "";
      const match = String(content).toLowerCase().match(/^\s*(yes|no)\b/);
      const norm = match ? match[1] : "";
      if (norm === "no") {
        console.log(`[news-scheduler] hasOnlyPersonName: NO url="${imageUrl}" person="${personName}"`);
      }
      return norm === "yes";
    } catch {
      return false;
    }
  };

  const filenameMatchesPerson = (imageUrl: any, personName: string) => {
    if (!imageUrl) return false;
    const filename = String(imageUrl).toLowerCase();
    const nameParts = personName.toLowerCase().split(/\s+/).filter(p => p.length > 2);
    if (nameParts.length === 0) return false;
    return nameParts.some(part => filename.includes(part));
  };

  const selectBestFromData = async (data: any, isWithCat: boolean, firstInfoOut?: { value: string }): Promise<string | null> => {
    if (!data || !data.query || !data.query.pages) return null;
    const pages = Object.values<any>(data.query.pages);
    if (pages.length === 0) return null;
    if (firstInfoOut) {
      const fp = pages[0];
      const fi = fp?.imageinfo?.[0];
      firstInfoOut.value = fi ? JSON.stringify(fi) : "";
    }
    const candidates: string[] = [];
    for (const page of pages) {
      const info = page?.imageinfo?.[0];
      const imageUrl = info?.thumburl || info?.url;
      if (imageUrl && isValidImageUrl(imageUrl) && await hasOnlyPersonName(imageUrl, normalizedPersonName)) {
        candidates.push(imageUrl);
      }
    }
    if (candidates.length === 0) return null;
    const matches = candidates.filter(c => filenameMatchesPerson(c, normalizedPersonName));
    if (matches.length === 0) {
      return isWithCat ? null : candidates[0];
    }
    const randomIndex = Math.floor(Math.random() * matches.length);
    return matches[randomIndex];
  };

  let response = await fetchWikimediaApiResponse(normalizedPersonNameWithCat);
  if (!response) {
    return FALLBACK_IMAGE();
  }
  let data = await response.json().catch(() => null);
  const firstInfoWithCat = { value: "" };
  let selected = await selectBestFromData(data, true, firstInfoWithCat);
  if (selected) return selected;

  response = await fetchWikimediaApiResponse(normalizedPersonName);
  if (!response) {
    return FALLBACK_IMAGE();
  }
  data = await response.json().catch(() => null);
  const firstInfoPlain = { value: "" };
  selected = await selectBestFromData(data, false, firstInfoPlain);
  if (selected) return selected;

  if (firstInfoWithCat.value) {
    try {
      const o = JSON.parse(firstInfoWithCat.value);
      const u = o?.thumburl || o?.url;
      if (u && isValidImageUrl(u)) return u;
    } catch {}
  }
  if (firstInfoPlain.value) {
    try {
      const o = JSON.parse(firstInfoPlain.value);
      const u = o?.thumburl || o?.url;
      if (u && isValidImageUrl(u)) return u;
    } catch {}
  }
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
    const VIDEO_KEYWORDS = ['shows','shares','shared','video','videos','clip','clips','reels','tape','captured','caught','camera','tik tok','tik-tok','footage','reel','videotape','instagram', 'insta','announced','revealed'];
    const YT_API_KEY = Deno.env.get('YOUTUBE_API_KEY') || '';
    const OPENROUTER_PROXY = Deno.env.get('OPENROUTER_PROXY') || '';
    const ytSearch = async (q: string): Promise<{ url: string; title: string } | null> => {
      if (!YT_API_KEY) return null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      try {
        console.log(`YouTube search query: ${q}`);
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
      console.log(`LLM similarity check titles: "${query}" vs "${ytTitle}"`);
      const res = await fetch(OPENROUTER_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: payload
      });
      if (!res.ok) return false;
      let value = '';
      try {
        const j = await res.json();
        value = String(j?.json ?? '');
      } catch {
        value = await res.text();
      }
      const match = String(value).toLowerCase().match(/^\s*(yes|no)\b/);
      const norm = match ? match[1] : '';
      return norm === 'yes';
    };
    const newsWithImages = await Promise.all(newsItems.map(async (item) => {
      const image_url = await fetchPersonImage(item.person_name, category);
      let youtube_url = '';
      if (shouldAttachVideo(item.news_text)) {
        const yt = await ytSearch(item.search_query || `${item.person_name} ${item.news_text}`);
        if (yt) {
          const q = item.search_query || `${item.person_name} ${item.news_text}`;
          const isSim = await verifySimilarYesNo(q, yt.title);
          if (isSim) {
            youtube_url = yt.url;
          } else {
            console.log(`Not saving YouTube URL: LLM said "${q}" and "${yt.title}" are not similar`);
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
    // Try insert with optional columns; if schema lacks columns, fall back progressively
    let insertError: unknown = null;
    let payload: Record<string, unknown>[] = newsWithImages as unknown as Record<string, unknown>[];
    {
      const { error } = await supabase.from(tableName).insert(payload);
      insertError = error || null;
    }
    if (insertError && typeof (insertError as any).message === 'string' && /column.*youtube_url.*does not exist/i.test((insertError as any).message)) {
      console.warn(`youtube_url column missing in ${tableName}, inserting without it`);
      payload = payload.map(({ youtube_url, ...rest }) => rest);
      const { error: fbError } = await supabase.from(tableName).insert(payload);
      insertError = fbError || null;
    }
    if (insertError && typeof (insertError as any).message === 'string' && /column.*news_body.*does not exist/i.test((insertError as any).message)) {
      console.warn(`news_body column missing in ${tableName}, inserting without it`);
      payload = payload.map(({ news_body, ...rest }) => rest);
      const { error: fbError2 } = await supabase.from(tableName).insert(payload);
      insertError = fbError2 || null;
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
