const API_KEY = Deno.env.get('YOUTUBE_API_KEY');

if (!API_KEY) console.warn('Warning: YOUTUBE_API_KEY is not set');

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    if (req.method !== 'GET' || url.pathname !== '/api/youtube/search-first') {
      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const q = String(url.searchParams.get('q') || '').trim();
    if (!q) return new Response(JSON.stringify({ error: 'Missing q' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const apiKey = Deno.env.get('YOUTUBE_API_KEY') || API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: 'Server misconfiguration: missing YOUTUBE_API_KEY' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

    const ytUrl = 'https://www.googleapis.com/youtube/v3/search' +
      `?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(q)}` +
      `&key=${encodeURIComponent(apiKey)}`;

    const r = await fetch(ytUrl);
    if (!r.ok) return new Response(JSON.stringify({ error: 'Oops...something went wrong. Please check back later.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

    const data = await r.json();
    const first = data.items?.[0];
    const videoId = first?.id?.videoId;

    if (!videoId) return new Response(JSON.stringify({ error: 'Unable to find video for news' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

    return new Response(JSON.stringify({ videoId }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Function error', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});