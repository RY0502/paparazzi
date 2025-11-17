import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey"
};
function safeSample(obj, maxLen = 2000) {
  try {
    const s = JSON.stringify(obj);
    return s.length > maxLen ? s.slice(0, maxLen) + '...[truncated]' : s;
  } catch (e) {
    return String(obj);
  }
}
async function fetchWithRetry(url, options = {}, retries = 2, backoff = 500) {
  for(let i = 0; i <= retries; i++){
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`Fetch failed, retrying (${i + 1}/${retries})`, err);
      await new Promise((r)=>setTimeout(r, backoff));
    }
  }
}
async function fetchFromGemini(category) {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }
  const prompts = {
    bollywood: `Generate exactly 15 latest entertainment news items about Indian Bollywood actors and singers from today. Each news item must be on a separate line in this exact format:\n[Person Name] - [Single line news description]\n\nRequirements:\n- Use real, well-known Bollywood celebrities\n- Keep each news item to one line\n- Make news current and tabloid worthy\n- Return exactly 15 items`,
    tv: `Generate exactly 15 latest entertainment news items about Indian daily soap and TV industry actors from today. Each news item must be on a separate line in this exact format:\n[Person Name] - [Single line news description]\n\nRequirements:\n- Use real, well-known Indian TV actors\n- Keep each news item to one line\n- Make news current and  tabloid worthy\n- Return exactly 15 items`,
    hollywood: `Generate exactly 15 latest entertainment news items about American Hollywood actors and singers from today. Each news item must be on a separate line in this exact format:\n[Person Name] - [Single line news description]\n\nRequirements:\n- Use real, well-known Hollywood celebrities\n- Keep each news item to one line\n- Make news current and  tabloid worthy\n- Return exactly 15 items`
  };
  const prompt = prompts[category];
  if (!prompt) {
    throw new Error(`Invalid category: ${category}`);
  }
  const body = JSON.stringify({
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
  });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body
  }, 2, 700);
  if (!response.ok) {
    const txt = await response.text().catch(()=>'<no body>');
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${txt.slice(0, 500)}`);
  }
  const data = await response.json();
  //console.info(`Gemini raw response sample for ${category}:`, safeSample(data));
  // Try multiple paths to extract text
  let assembled = '';
  if (Array.isArray(data.candidates) && data.candidates.length > 0) {
    for (const cand of data.candidates){
      // content.parts[*].text
      const parts = cand?.content?.parts;
      if (Array.isArray(parts)) {
        assembled += parts.map((p)=>p?.text || '').join('\n') + '\n';
        continue;
      }
      // content.parts may be nested in other shapes
      if (typeof cand?.content?.text === 'string') {
        assembled += cand.content.text + '\n';
        continue;
      }
      // fallback to groundingMetadata renderedContent
      const rc = cand?.groundingMetadata?.searchEntryPoint?.renderedContent;
      if (typeof rc === 'string') {
        // strip tags
        const stripped = rc.replace(/<[^>]+>/g, '\n').replace(/&nbsp;|&amp;/g, ' ');
        assembled += stripped + '\n';
        continue;
      }
    }
  }
  // As last resort, check top-level fields
  if (!assembled && typeof data?.candidates?.[0]?.content?.role === 'string') {
    // sometimes model returns structured content elsewhere
    if (typeof data?.candidates?.[0]?.content?.message?.content?.[0]?.text === 'string') {
      assembled = data.candidates[0].content.message.content[0].text;
    }
  }
  assembled = assembled.trim();
  if (!assembled) {
    console.warn('No assembled text from Gemini response', safeSample(data));
    return [];
  }
  // normalize newlines and remove extra html
  const text = assembled.replace(/\r/g, '').replace(/<br\s*\/?>/gi, '\n');
  const lines = text.split(/\n+/).map((l)=>l.trim()).filter((l)=>l.length > 0);
  const newsItems = [];
  const sepRegex = /^(?:\d+\.\s*)?(.+?)\s*(?:[-–—:|])\s*(.+)$/;
  for (const line of lines){
    const match = line.match(sepRegex);
    if (match && newsItems.length < 15) {
      const [, personName, newsText] = match;
      newsItems.push({
        news_text: newsText.trim(),
        person_name: personName.trim(),
        search_query: `${personName.trim()} ${newsText.trim()}`
      });
    }
  }
  if (newsItems.length === 0) {
    console.warn('Parsed zero news items after normalization. Sample lines:', lines.slice(0, 10));
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
        if (info) return info.thumburl || info.url;
      }
    }
  } catch (error) {
    console.error(`Error fetching image for ${personName}:`, error);
  }
  return `https://images.pexels.com/photos/1065084/pexels-photo-1065084.jpeg?auto=compress&cs=tinysrgb&w=800`;
}
async function updateNewsForCategory(supabase, category) {
  try {
    console.info(`Fetching news for ${category}...`);
    const newsItems = await fetchFromGemini(category);
    console.info(`Fetched ${newsItems.length} news items for ${category}`);
    if (newsItems.length === 0) {
      // capture a diagnostic event to logs to help debugging
      console.warn(`Zero news items parsed for ${category} - will skip DB insert`);
      return {
        success: true,
        count: 0
      };
    }
    const newsWithImages = await Promise.all(newsItems.map(async (item)=>({
        ...item,
        image_url: await fetchPersonImage(item.person_name),
        created_at: new Date().toISOString()
      })));
    const tableName = `${category}_news`;
    const { data: delData, error: deleteError } = await supabase.from(tableName).delete().lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if (deleteError) console.error(`Error clearing old news for ${category}:`, deleteError);
    const { error: insertError } = await supabase.from(tableName).insert(newsWithImages);
    if (insertError) {
      console.error(`Error inserting news for ${category}:`, insertError);
      throw insertError;
    }
    console.info(`Successfully updated ${category} news with ${newsWithImages.length} items`);
    return {
      success: true,
      count: newsWithImages.length
    };
  } catch (error) {
    console.error(`Error updating ${category} news:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response(null, {
    status: 200,
    headers: corsHeaders
  });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase credentials not configured');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const results = await Promise.allSettled([
      updateNewsForCategory(supabase, 'bollywood'),
      updateNewsForCategory(supabase, 'tv'),
      updateNewsForCategory(supabase, 'hollywood')
    ]);
    const summary = results.map((result, index)=>{
      const category = [
        'bollywood',
        'tv',
        'hollywood'
      ][index];
      if (result.status === 'fulfilled') return {
        category,
        ...result.value
      };
      return {
        category,
        success: false,
        error: result.reason?.message || 'Unknown error'
      };
    });
    return new Response(JSON.stringify({
      message: 'News update completed',
      results: summary,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in news-scheduler function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
