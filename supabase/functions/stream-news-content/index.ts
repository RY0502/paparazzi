import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function streamNewsContent(
  category: string,
  personName: string,
  newsTitle: string,
  controller: ReadableStreamDefaultController<Uint8Array>
) {
  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const prompt = `Generate a comprehensive text summary of the given news regarding the provided celebrity. Provide the latest available contents though search. ${category} ${personName} - ${newsTitle}`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": geminiApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          tools: [
            {
              google_search: {},
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith("data: ")) {
          try {
            const jsonStr = line.slice(6);
            const data = JSON.parse(jsonStr);
            if (
              data.candidates?.[0]?.content?.parts?.[0]?.text
            ) {
              const text = data.candidates[0].content.parts[0].text;
              controller.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`)
              );
            }
          } catch {
          }
        }
      }

      buffer = lines[lines.length - 1];
    }

    if (buffer.startsWith("data: ")) {
      try {
        const jsonStr = buffer.slice(6);
        const data = JSON.parse(jsonStr);
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          const text = data.candidates[0].content.parts[0].text;
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`)
          );
        }
      } catch {
      }
    }

    controller.enqueue(
      new TextEncoder().encode(`data: ${JSON.stringify({ done: true })}\n\n`)
    );
    controller.close();
  } catch (error) {
    controller.enqueue(
      new TextEncoder().encode(
        `data: ${JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        })}\n\n`
      )
    );
    controller.close();
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const personName = url.searchParams.get("personName");
    const newsTitle = url.searchParams.get("newsTitle");

    if (!category || !personName || !newsTitle) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameters: category, personName, newsTitle",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const stream = new ReadableStream((controller) => {
      streamNewsContent(category, personName, newsTitle, controller);
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in stream-news-content function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
