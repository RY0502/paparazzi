import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey"
};
async function fetchFromGemini(category) {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) throw new Error("GEMINI_API_KEY not configured");
  const prompts = {
    bollywood: `Generate exactly 15 latest entertainment news items about Indian Bollywood actors and singers from today. Each news item must be on a separate line in this exact format:
[Person Name] - [Single line news description]

Example:
Shah Rukh Khan - Announces new collaboration with international director
Deepika Padukone - Wins Best Actress award at film festival

Requirements:
- Use real, well-known Bollywood celebrities
- Keep each news item to one line
- Make news current and tabloid worthy
- Return exactly 15 items`,
    tv: `Generate exactly 15 latest entertainment news items about Indian daily soap and TV industry actors from today. Each news item must be on a separate line in this exact format:
[Person Name] - [Single line news description]

Example:
Hina Khan - Returns to popular TV show after break
Rupali Ganguly - Show reaches 1000 episode milestone

Requirements:
- Use real, well-known Indian TV actors
- Keep each news item to one line
- Make news current and  tabloid worthy
- Return exactly 15 items`,
    hollywood: `Generate exactly 15 latest entertainment news items about American Hollywood actors and singers from today. Each news item must be on a separate line in this exact format:
[Person Name] - [Single line news description]

Example:
Leonardo DiCaprio - Signs for climate change documentary
Taylor Swift - Announces surprise album release

Requirements:
- Use real, well-known Hollywood celebrities
- Keep each news item to one line
- Make news current and  tabloid worthy
- Return exactly 15 items`
  };
  const prompt = prompts[category];
  if (!prompt) throw new Error(`Invalid category: ${category}`);
  const body = {
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
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error(`Gemini API error: ${resp.status} ${resp.statusText}`);
  const data = await resp.json();
  const extractTextFromCandidate = (candidate)=>{
    if (!candidate) return "";
    const parts = candidate?.content?.parts;
    if (Array.isArray(parts)) {
      const joined = parts.map((p)=>p?.text || "").join("\n");
      if (joined.trim()) return joined;
    }
    if (typeof candidate?.content?.text === "string" && candidate.content.text.trim()) {
      return candidate.content.text;
    }
    const msgParts = candidate?.content?.message?.content;
    if (Array.isArray(msgParts)) {
      const joined = msgParts.map((p)=>p?.text || "").join("\n");
      if (joined.trim()) return joined;
    }
    return "";
  };
  const sanitize = (input)=>{
    if (!input) return "";
    let t = input.replace(/<style[\s\S]*?<\/style>/gi, " ");
    t = t.replace(/<script[\s\S]*?<\/script>/gi, " ");
    t = t.replace(/<[^>]+>/g, " ");
    t = t.replace(/\b[a-z-]+:\s*[^;"']+;/gi, " ");
    t = t.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
    t = t.replace(/\r\n|\r/g, "\n").replace(/\n{2,}/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
    return t;
  };
  let combinedText = "";
  if (Array.isArray(data?.candidates) && data.candidates.length > 0) {
    for (const cand of data.candidates){
      const txt = extractTextFromCandidate(cand);
      if (txt) {
        combinedText += txt + "\n";
      }
    }
  }
  if (!combinedText && data?.candidates?.[0]?.groundingMetadata?.searchEntryPoint?.renderedContent) {
    combinedText = String(data.candidates[0].groundingMetadata.searchEntryPoint.renderedContent);
  }
  if (!combinedText) {
    const sample = JSON.stringify({
      keys: Object.keys(data || {}).slice(0, 10),
      candidatesLength: Array.isArray(data?.candidates) ? data.candidates.length : 0
    });
    console.warn("Gemini: no usable text found, response sample:", sample);
    return [];
  }
  const cleaned = sanitize(combinedText);
  const lines = cleaned.split("\n").map((l)=>l.trim()).filter((l)=>l.length > 0);
  const sepRegex = /^(?:\d+\.\s*)?(.+?)\s*(?:[-–—:|])\s*(.+)$/;
  const newsItems = [];
  for (const line of lines){
    const match = line.match(sepRegex);
    if (match && newsItems.length < 15) {
      const [, personName, newsText] = match;
      const pn = personName.trim();
      const nt = newsText.trim();
      if (pn.length > 0 && nt.length > 5) {
        newsItems.push({
          news_text: nt,
          person_name: pn,
          search_query: `${pn} ${nt}`
        });
      } else {
        console.warn("Rejected parsed line as implausible:", {
          line,
          personName: pn,
          newsText: nt
        });
      }
    } else {
      console.debug("Non-matching line (ignored):", line.length > 200 ? line.slice(0, 200) + "..." : line);
    }
    if (newsItems.length >= 15) break;
  }
  if (newsItems.length === 0) {
    const sampleLines = lines.slice(0, 10).map((l)=>l.length > 200 ? l.slice(0, 200) + "..." : l);
    console.warn("Parsed zero news items from Gemini. Cleaned sample lines:", sampleLines);
    console.debug("Raw candidates sample:", JSON.stringify((data?.candidates || []).slice(0, 2).map((c)=>({
        keys: Object.keys(c || {}).slice(0, 6),
        textSnippet: String(c?.content?.parts?.[0]?.text || c?.content?.text || "").slice(0, 200)
      })), null, 2));
  }
  return newsItems.slice(0, 15);
}
async function fetchPersonImage(personName) {
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
    if (response.ok) {
      const data = await response.json();
      if (data.query && data.query.pages) {
        const pages = Object.values(data.query.pages);
        const randIndex = Math.floor(Math.random() * 15);
        const chosenPage = pages[randIndex] ?? pages[0];
        const info = chosenPage?.imageinfo?.[0];
        if (info) {
          return info.thumburl || info.url;
        }
      }
    }
  } catch (error) {
    console.error(`Error fetching image for ${personName}:`, error);
  }
  return `https://images.pexels.com/photos/1065084/pexels-photo-1065084.jpeg?auto=compress&cs=tinysrgb&w=800`;
}
async function updateNewsForCategory(supabase, category) {
  try {
    console.log(`Fetching news for ${category}...`);
    const newsItems = await fetchFromGemini(category);
    console.log(`Fetched ${newsItems.length} news items for ${category}`);
    const newsWithImages = await Promise.all(newsItems.map(async (item)=>({
        ...item,
        image_url: await fetchPersonImage(item.person_name),
        created_at: new Date().toISOString()
      })));
    const tableName = `${category}_news`;
    const { data, deleteError } = await supabase.from(tableName).delete().lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
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
Deno.serve(async (req)=>{
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
    const summary = results.map((result, index)=>{
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
