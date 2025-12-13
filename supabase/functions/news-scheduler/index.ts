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

async function fetchFromGemini(category: string) {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }
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
- Return exactly 15 items`,
    tv: `Using ONLY real-time web results get exactly 15 latest entertainment news items about Indian daily soap and TV industry actors trending from the past 24 hours. Each news item must be on a separate line in this exact format:
[Person Name] - [Single line news description]

Example:
Hina Khan - Returns to popular TV show after break
Rupali Ganguly - Show reaches 1000 episode milestone

Requirements:
- Use real, well-known Indian TV actors
- Keep each news item to one line
- Make news current and  tabloid worthy
- Return exactly 15 items`,
    hollywood: `Using ONLY real-time web results get exactly 15 latest entertainment news items about American Hollywood actors and singers trending from the past 24 hours. Each news item must be on a separate line in this exact format:
[Person Name] - [Single line news description]

Example:
Leonardo DiCaprio - Signs for climate change documentary
Taylor Swift - Announces surprise album release

Requirements:
- Use real, well-known Hollywood celebrities
- Keep each news item to one line
- Make news current and tabloid worthy
- Return exactly 15 items`
  };
  const prompt = prompts[category];
  if (!prompt) {
    throw new Error(`Invalid category: ${category}`);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
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

  const maxAttempts = 3; // initial attempt + 2 retries
  const retryDelayMs = 5000; // 5 seconds

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
        // If not last attempt, wait then retry
        if (attempt < maxAttempts) {
          console.warn(`Gemini request failed (attempt ${attempt}/${maxAttempts}). Retrying in ${retryDelayMs}ms...`, lastError);
          await sleep(retryDelayMs);
          continue;
        } else {
          // last attempt failed
          throw lastError;
        }
      }

      // success
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const lines = text.split("\n").filter((line: string) => line.trim().length > 0);
      const newsItems: { news_text: string; person_name: string; search_query: string }[] = [];
      for (const line of lines) {
        const match = line.match(/^(?:\d+\.\s*)?(.+?)\s*[-–]\s*(.+)$/);
        if (match && newsItems.length < 15) {
          const [, personName, newsText] = match;
          newsItems.push({
            news_text: newsText.trim(),
            person_name: personName.trim(),
            search_query: `${personName.trim()} ${newsText.trim()}`
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

  // If somehow falls through, throw last error
  throw lastError || new Error("Unknown error calling Gemini API");
}

async function fetchPersonImage(personName: string) {
  try {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: personName,
      gsrnamespace: '6',
      gsrlimit: '15',
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: '800',
      format: 'json',
      origin: '*'
    });
    const url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Wikimedia API returned non-OK status ${response.status} for ${personName}`);
      return FALLBACK_IMAGE();
    }

    const data = await response.json();
    if (!data.query || !data.query.pages) {
      console.warn(`Wikimedia API returned no pages for ${personName}`);
      return FALLBACK_IMAGE();
    }

    const pages = Object.values<any>(data.query.pages);
    if (pages.length === 0) {
      console.warn(`Wikimedia returned empty pages array for ${personName}`);
      return FALLBACK_IMAGE();
    }

    // Helper: Check if URL is valid (not PDF, not document). Allow svg
    const isValidImageUrl = (imageUrl: any) => {
      if (!imageUrl) return false;
      const urlLower = String(imageUrl).toLowerCase();
      // Reject PDF or document types
      if (urlLower.includes('.pdf')) return false;
      if (urlLower.match(/\.(doc|docx|txt|odt|rtf)/)) return false;
      // Accept common image formats including svg
      if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/)) return true;
      // Accept some Wikimedia thumb URLs that may not end with ext but contain /thumb/
      if (urlLower.includes('/thumb/')) return true;
      return false;
    };

    // Helper: soft match filename to person's name (not mandatory)
    const filenameMatchesPerson = (imageUrl: any, personName: string) => {
      if (!imageUrl) return false;
      const filename = String(imageUrl).toLowerCase();
      const nameParts = personName.toLowerCase().split(/\s+/).filter(p => p.length > 2);
      if (nameParts.length === 0) return false;
      // Score: return true if at least one strong part is present
      return nameParts.some(part => filename.includes(part));
    };

    // Collect candidate image URLs (thumburl preferred)
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

    // Prefer a candidate whose filename matches person name
    const matched = candidates.find(c => filenameMatchesPerson(c, personName));
    if (matched) {
      // console.log(`Selected matched image for ${personName}: ${matched}`);
      return matched;
    }

    // If no filename match, try up to 3 random candidates, otherwise pick first
    const maxAttempts = Math.min(3, candidates.length);
    const tried = new Set<number>();
    for (let i = 0; i < maxAttempts; i++) {
      let idx: number;
      do {
        idx = Math.floor(Math.random() * candidates.length);
      } while (tried.has(idx) && tried.size < candidates.length);
      tried.add(idx);
      const candidate = candidates[idx];
      // accept candidate (we already filtered by isValidImageUrl)
      // console.log(`Selected random image for ${personName}: ${candidate}`);
      return candidate;
    }

    // fallback to first candidate (shouldn't usually reach here)
    // console.log(`Using first candidate image for ${personName}: ${candidates[0]}`);
    return candidates[0];
  } catch (error) {
    console.error(`Error fetching image for ${personName}:`, error);
    return FALLBACK_IMAGE();
  }

  // fallback helper
  function FALLBACK_IMAGE() {
    return 'https://images.pexels.com/photos/1065084/pexels-photo-1065084.jpeg?auto=compress&cs=tinysrgb&w=800';
  }
}

async function updateNewsForCategory(supabase: any, category: string) {
  try {
    console.log(`Fetching news for ${category}...`);
    const newsItems = await fetchFromGemini(category);
    console.log(`Fetched ${newsItems.length} news items for ${category}`);
    const newsWithImages = await Promise.all(newsItems.map(async (item) => ({
      ...item,
      image_url: await fetchPersonImage(item.person_name),
      created_at: new Date().toISOString()
    })));
    const tableName = `${category}_news`;
    const { data, deleteError } = await supabase.from(tableName).delete().lt('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());
    if (deleteError) {
      console.error(`Error clearing old news for ${category}:`, deleteError);
    }
    const { error: insertError } = await supabase.from(tableName).insert(newsWithImages);
    if (insertError) {
      console.error(`Error inserting news for ${category}:`, insertError);
      throw insertError;
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