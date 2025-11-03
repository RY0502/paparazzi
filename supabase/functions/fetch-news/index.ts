import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey"
};
async function fetchFromGemini(category) {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }
  const prompts = {
    bollywood: `Generate exactly 15 latest entertainment news items about Indian Bollywood actors and singers from today. Each news item must be on a separate line in this exact format:
[Person Name] - [Single line news description]

Example:
Shah Rukh Khan - Announces new collaboration with international director
Deepika Padukone - Wins Best Actress award at film festival

Requirements:
- Use real, well-known Bollywood celebrities
- Keep each news item to one line
- Make news current and realistic
- Return exactly 15 items`,
    tv: `Generate exactly 15 latest entertainment news items about Indian daily soap and TV industry actors from today. Each news item must be on a separate line in this exact format:
[Person Name] - [Single line news description]

Example:
Hina Khan - Returns to popular TV show after break
Rupali Ganguly - Show reaches 1000 episode milestone

Requirements:
- Use real, well-known Indian TV actors
- Keep each news item to one line
- Make news current and realistic
- Return exactly 15 items`,
    hollywood: `Generate exactly 15 latest entertainment news items about American Hollywood actors and singers from today. Each news item must be on a separate line in this exact format:
[Person Name] - [Single line news description]

Example:
Leonardo DiCaprio - Signs for climate change documentary
Taylor Swift - Announces surprise album release

Requirements:
- Use real, well-known Hollywood celebrities
- Keep each news item to one line
- Make news current and realistic
- Return exactly 15 items`
  };
  const prompt = prompts[category];
  if (!prompt) {
    throw new Error(`Invalid category: ${category}`);
  }
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
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
    })
  });
  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const lines = text.split("\n").filter((line)=>line.trim().length > 0);
  const newsItems = [];
  for (const line of lines){
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
}
async function fetchPersonImage(personName) {
  try {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: personName,
      gsrnamespace: '6',
      gsrlimit: '1',
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
        const firstPage = Object.values(data.query.pages)[0];
        const info = firstPage.imageinfo?.[0];
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
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    if (!category || ![
      "bollywood",
      "tv",
      "hollywood"
    ].includes(category)) {
      return new Response(JSON.stringify({
        error: "Invalid category. Must be bollywood, tv, or hollywood"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const newsItems = await fetchFromGemini(category);
    const newsWithImages = await Promise.all(newsItems.map(async (item)=>({
        ...item,
        image_url: await fetchPersonImage(item.person_name)
      })));
    return new Response(JSON.stringify({
      success: true,
      news: newsWithImages
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Error in fetch-news function:", error);
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
