// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

function getISOWeekNumber(d: Date) {
  // Copy date so we don't mutate input
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  // Thursday in current week decides the year.
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return weekNo
}

function transformReadme(content: string, isOddWeek: boolean) {
  // We only touch the trailing "Changed" token (preceded by whitespace).
  // If odd week: append " Changed" if not already present.
  // If even week: remove trailing "Changed" if present.
  const trimmedRight = content.replace(/\s+$/, '')
  const changedSuffix = /\bChanged$/

  if (isOddWeek) {
    if (changedSuffix.test(trimmedRight)) return trimmedRight + content.slice(trimmedRight.length)
    // Ensure single space before Changed
    return trimmedRight + ' Changed' + content.slice(trimmedRight.length)
  } else {
    if (!changedSuffix.test(trimmedRight)) return content
    return trimmedRight.replace(/\s*\bChanged$/, '') + content.slice(trimmedRight.length)
  }
}

function base64ToUtf8(b64: string) {
  const normalized = b64.replace(/\n/g, '')
  const binStr = atob(normalized)
  const bytes = Uint8Array.from(binStr, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

function utf8ToBase64(str: string) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const githubToken = Deno.env.get('GITHUB_TOKEN')
  const owner = Deno.env.get('GITHUB_OWNER')
  const repo = Deno.env.get('GITHUB_REPO')
  const branch = Deno.env.get('GITHUB_BRANCH') || 'main'
  const filePath = Deno.env.get('GITHUB_FILE_PATH') || 'README.md'

  if (!githubToken || !owner || !repo) {
    return new Response(
      JSON.stringify({
        error: 'Missing env vars. Required: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO',
      }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }

  const now = new Date()
  const weekNo = getISOWeekNumber(now)
  const isOddWeek = weekNo % 2 === 1

  // 1) Get file contents
  const getUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(branch)}`
  const getRes = await fetch(getUrl, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!getRes.ok) {
    const text = await getRes.text().catch(() => '')
    return new Response(
      JSON.stringify({ error: 'Failed to fetch file from GitHub', status: getRes.status, body: text.slice(0, 2000) }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }

  const fileJson = await getRes.json()
  const sha = fileJson.sha
  const currentB64 = fileJson.content
  const currentContent = base64ToUtf8(currentB64)

  const newContent = transformReadme(currentContent, isOddWeek)

  // If content didn't change, treat as no-op
  if (newContent === currentContent.replace(/\s+$/, '') + (currentContent.match(/\s+$/)?.[0] ?? '')) {
    // Normalize trailing whitespace differences by comparing trimmed
    if (newContent.trimEnd() === currentContent.trimEnd()) {
      return new Response(
        JSON.stringify({
          ok: true,
          noChange: true,
          weekNo,
          isOddWeek,
          branch,
          filePath,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }
  }

  const putUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(filePath)}`
  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      message: isOddWeek ? 'Append Changed (odd ISO week)' : 'Remove Changed (even ISO week)',
      content: utf8ToBase64(newContent),
      sha,
      branch,
    }),
  })

  if (!putRes.ok) {
    const text = await putRes.text().catch(() => '')
    return new Response(
      JSON.stringify({ error: 'Failed to commit file on GitHub', status: putRes.status, body: text.slice(0, 2000) }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }

  const putJson = await putRes.json()

  return new Response(
    JSON.stringify({
      ok: true,
      weekNo,
      isOddWeek,
      branch,
      filePath,
      commit: putJson?.commit?.html_url,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
})
