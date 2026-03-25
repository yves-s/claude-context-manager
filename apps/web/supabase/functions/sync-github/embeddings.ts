// apps/web/supabase/functions/sync-github/embeddings.ts

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return null

  // Truncate to roughly 8192 tokens (approx 4 chars/token)
  const truncated = text.length > 32768 ? text.slice(0, 32768) : text

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: truncated,
      }),
    })

    if (res.status === 429) {
      console.warn('OpenAI rate limit — skipping embedding')
      return null
    }
    if (!res.ok) {
      console.warn(`OpenAI error ${res.status} — skipping embedding`)
      return null
    }

    const data = await res.json() as { data: Array<{ embedding: number[] }> }
    return data.data[0]?.embedding ?? null
  } catch (err) {
    console.warn('OpenAI fetch failed:', err)
    return null
  }
}
