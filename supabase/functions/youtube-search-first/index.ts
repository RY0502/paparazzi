const API_KEY = Deno.env.get('YOUTUBE_API_KEY');

if (!API_KEY) console.warn('Warning: YOUTUBE_API_KEY is not set');

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);

    // Accept q from JSON body, form data, or query string (fallback)
    let q = '';

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const body = await req.json();
        q = String(body.q ?? '').trim();
        console.log(q);
      } catch (e) {
        // ignore json parse errors
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formText = await req.text();
      const params = new URLSearchParams(formText);
      q = String(params.get('q') ?? '').trim();
    }

    // fallback to query param if body not provided
    if (!q) {
      q = String(url.searchParams.get('q') || '').trim();
    }

    if (!q) return new Response(JSON.stringify({ error: 'Missing q' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const apiKey = Deno.env.get('YOUTUBE_API_KEY') || API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: 'Server misconfiguration: missing YOUTUBE_API_KEY' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

    const ytUrl = 'https://www.googleapis.com/youtube/v3/search' +
      `?part=snippet&type=all&maxResults=1&q=${encodeURIComponent(q)}` +
      `&key=${encodeURIComponent(apiKey)}`;

      console.log(ytUrl);

    const r = await fetch(ytUrl);
    if (!r.ok) return new Response(JSON.stringify({ error: 'Oops...something went wrong. Please check back later.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

    const data = await r.json();
    const first = data.items?.[0];
    const videoId = first?.id?.videoId;

    if (!videoId) return new Response(JSON.stringify({ error: 'Unable to find the video for news' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

    return new Response(JSON.stringify({ videoId }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Function error', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});