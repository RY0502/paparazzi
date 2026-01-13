import { createClient } from "npm:@supabase/supabase-js@2.27.0";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENROUTER_PROXY = Deno.env.get('OPENROUTER_PROXY') || 'https://689cc68f00299eeb37ee.fra.appwrite.run/';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchLatest(table: string) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

function extractFirstJsonChunk(text: string) {
  // Find first [...] or {...} chunk and return it (string)
  const m = text.match(/\[[\s\S]*?\]|\{[\s\S]*?\}/);
  return m ? m[0] : null;
}

async function askProxy(rows: any[]) {
  const prompt = `You are given a list of news items in JSON array with fields id, title, body. Identify pairs of items that are semantically duplicates (same meaning). Return a JSON array of objects {keep_id, delete_id, reason}. Choose one of each duplicate pair to keep and mark the other for deletion. Only return pairs that are clear duplicates.`;
  const payload = `${prompt}\n\n${JSON.stringify(rows)}`;

  //console.log(`[proxy.request] ${new Date().toISOString()} ${OPENROUTER_PROXY} payload_length=${String(payload.length)}`);

  const res = await fetch(OPENROUTER_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: payload
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`[proxy.error] ${OPENROUTER_PROXY} ${res.status} - ${txt}`);
    throw new Error(`Proxy error: ${res.status} ${txt}`);
  }

  const text = await res.text();
  //console.log(`[proxy.response] ${new Date().toISOString()} ${OPENROUTER_PROXY} response_length=${String(text.length)}`);

  // Attempt 1: parse whole response as JSON
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
    console.log('[proxy.debug] parsed top-level JSON successfully');
  } catch (e) {
    parsed = null;
    console.log('[proxy.debug] top-level JSON parse failed, will try extraction', e.message);
  }

  // If parsed is an object with a string 'json' field, try to extract array inside that string
  if (parsed && typeof parsed === 'object' && typeof parsed.json === 'string') {
    const innerText = parsed.json;
    console.log(`[proxy.debug] found parsed.json string (length=${innerText.length}), attempting to extract JSON chunk inside it`);
    // First try direct parse
    try {
      const innerParsed = JSON.parse(innerText);
      parsed = innerParsed;
      console.log('[proxy.debug] parsed parsed.json directly as JSON');
    } catch (e) {
      // Fails because there may be trailing HTML after array. Extract first JSON chunk from innerText.
      const chunk = extractFirstJsonChunk(innerText);
      if (chunk) {
        try {
          parsed = JSON.parse(chunk);
          console.log('[proxy.debug] extracted and parsed first JSON chunk from parsed.json');
        } catch (e2) {
          console.warn('[proxy.debug] failed to parse extracted chunk from parsed.json', e2.message);
          parsed = null;
        }
      } else {
        console.warn('[proxy.debug] no JSON chunk found inside parsed.json');
        parsed = null;
      }
    }
  }

  // If still not an array/object, try extracting first JSON chunk from the raw response text
  if (!parsed) {
    const chunk = extractFirstJsonChunk(text);
    if (chunk) {
      try {
        parsed = JSON.parse(chunk);
        console.log('[proxy.debug] extracted and parsed first JSON chunk from raw response');
      } catch (e) {
        console.warn('[proxy.debug] failed to parse extracted chunk from raw response', e.message);
        parsed = null;
      }
    } else {
      console.warn('[proxy.debug] no JSON chunk found in raw response');
    }
  }

  if (!parsed) {
    throw new Error('Failed to extract JSON array/object from proxy response. Raw response preview: ' + text.slice(0, 2000));
  }

  // If parsed is an object, but one of its values is an array, use that array
  if (!Array.isArray(parsed) && typeof parsed === 'object') {
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(v)) {
        console.log(`[proxy.debug] using array found in parsed.${k}`);
        return v;
      }
      // also handle case where parsed[k] is a JSON string containing array
      if (typeof v === 'string') {
        const chunk = extractFirstJsonChunk(v);
        if (chunk) {
          try {
            const inner = JSON.parse(chunk);
            if (Array.isArray(inner)) {
              console.log(`[proxy.debug] parsed array from parsed.${k} string chunk`);
              return inner;
            }
          } catch {
            // ignore
          }
        }
      }
    }
    // Not an array; return parsed as-is so caller can see what it is
    console.log('[proxy.debug] parsed value is an object but contains no array; returning object');
    return parsed;
  }

  // If we reach here and parsed is an array, return it
  if (Array.isArray(parsed)) {
    console.log(`[proxy.debug] returning array of length=${parsed.length}`);
    return parsed;
  }

  // Fallback
  throw new Error('Unhandled parsed response shape. Preview: ' + JSON.stringify(parsed).slice(0, 2000));
}

async function deleteAndLog(table: string, deleteId: any, keepId: any, reason: any) {
  console.log(`[delete.attempt] ${new Date().toISOString()} table=${table} deleteId=${deleteId} keepId=${keepId} reason=${String(reason).slice(0,200)}`);
  // Optional: Check existence first (uncomment if you want)
  // const { data: exists, error: existErr } = await supabase.from(table).select('id').eq('id', deleteId).limit(1);
  // if (existErr) console.error('[delete.error] existence check failed', existErr);
  // if (Array.isArray(exists) && exists.length === 0) {
  //   console.log('[delete.skip] id not found in table', table, deleteId);
  //   return;
  // }

  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', deleteId);

  if (error) {
    console.error('[delete.error]', table, deleteId, error);
    throw error;
  }
  console.log(JSON.stringify({ action: 'deleted', table, deleted_id: deleteId, kept_id: keepId, reason, at: new Date().toISOString() }));
}

console.info('server started');
Deno.serve(async (req: Request) => {
  try {
    const tables = ['bollywood_news','hollywood_news','tv_news'];
    for (const table of tables) {
      const rows = await fetchLatest(table);
      if (rows.length === 0) {
        console.log(`[table.skip] ${table} no rows`);
        continue;
      }
      const payload = rows.map(r => ({ id: r.id, title: r.person_name, body: r.news_text }));
      const pairs = await askProxy(payload);
      if (!Array.isArray(pairs)) {
        console.log(`[proxy.result.skip] table=${table} result_not_array preview=${JSON.stringify(pairs).slice(0,500)}`);
        continue;
      }
      for (const p of pairs) {
        const deleteId = p.delete_id || p.deleteId || p.deleteid || p["delete_id"];
        const keepId = p.keep_id || p.keepId || p.keepid || p["keep_id"];
        const reason = p.reason || null;
        if (!deleteId) {
          console.log('[proxy.pair.skip] missing delete_id on pair', JSON.stringify(p));
          continue;
        }
        await deleteAndLog(table, deleteId, keepId || null, reason);
      }
    }
    return new Response(JSON.stringify({ status: 'done' }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('[handler.error]', err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});