import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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

// Fetch the Gemini API key from the URL stored in NEWS_URL_KEY env var.
// Expects JSON with keys[0].vault_keys.decrypted_value.
// Retries up to 3 attempts (initial + 2 retries) with exponential backoff + jitter.
async function fetchGeminiKeyFromNewsUrl() {
  const url = Deno.env.get("NEWS_URL_KEY");
  if (!url) {
    throw new Error("NEWS_URL_KEY not configured");
  }

  const MAX_ATTEMPTS = 3;
  const BASE_DELAY_MS = 500;
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
        lastErr = new Error(`Key fetch returned ${res.status} ${res.statusText} ${txt ? `- ${txt.slice(0,200)}` : ""}`);
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

async function streamNewsContent(category: string, personName: string, newsTitle: string, controller: ReadableStreamDefaultController) {
  try {
    // fetch per-request gemini key
    let geminiApiKey =  Deno.env.get('NEWS_GEMINI_KEY') &&  Deno.env.get('NEWS_GEMINI_KEY').trim();
if (!geminiApiKey) {
  geminiApiKey = await fetchGeminiKeyFromNewsUrl();
}
if (!geminiApiKey) {
  throw new Error("Gemini API key not available");
}

    const prompt = `Generate a short text summary of the given news regarding the provided celebrity. Provide the latest available contents through search quickly. ${category} ${personName} - ${newsTitle}`;

    // Add a small timeout guard for obtaining the response stream
    const controllerTimeout = new AbortController();
    const overallTimeoutMs = 20000; // 20s to establish stream
    const timer = setTimeout(() => controllerTimeout.abort(), overallTimeoutMs);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${encodeURIComponent(geminiApiKey)}&alt=sse`, {
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
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      }),
      signal: controllerTimeout.signal
    });
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }
    const decoder = new TextDecoder();
    let buffer = "";

    // Read SSE-like stream chunks and forward text payloads as SSE 'data: ...' events
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // process all complete lines, leave last partial line in buffer
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trimRight();
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (typeof text === "string" && text.length > 0) {
              const payload = JSON.stringify({ text });
              controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
            }
          } catch (e) {
            // ignore JSON parse errors for partial or non-JSON lines
          }
        }
      }
      buffer = lines[lines.length - 1];
    }

    // process remaining buffer if any
    if (buffer.trim().startsWith("data: ")) {
      const jsonStr = buffer.trim().slice(6);
      try {
        const data = JSON.parse(jsonStr);
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text === "string" && text.length > 0) {
          const payload = JSON.stringify({ text });
          controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
        }
      } catch (e) {
        // ignore
      }
    }

    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true })}\n\n`));
    controller.close();
  } catch (error) {
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" })}\n\n`));
    controller.close();
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
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const personName = url.searchParams.get("personName");
    const newsTitle = url.searchParams.get("newsTitle");
    if (!category || !personName || !newsTitle) {
      return new Response(JSON.stringify({
        error: "Missing required parameters: category, personName, newsTitle"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          await streamNewsContent(category, personName, newsTitle, controller);
        } catch (err) {
          console.error("streamNewsContent error:", err);
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: err?.message ?? String(err) })}\n\n`));
          controller.close();
        }
      },
      cancel(reason) {
        console.info("stream cancelled:", reason);
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      }
    });
  } catch (error) {
    console.error("Error in stream-news-content function:", error);
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