// apps/web/supabase/functions/sync-github/parse.ts

const TECH_KEYWORDS = [
  'next.js', 'react', 'vue', 'angular', 'svelte', 'nuxt',
  'supabase', 'postgresql', 'mysql', 'sqlite', 'mongodb', 'redis',
  'typescript', 'javascript', 'python', 'go', 'rust', 'swift', 'kotlin', 'java',
  'docker', 'kubernetes', 'graphql', 'prisma', 'drizzle', 'tailwind',
  'node.js', 'express', 'fastapi', 'django', 'rails',
]

const CONTEXT_MARKER = '<!-- PROJECT CONTEXT BELOW -->'

export function extractContext(content: string): string | null {
  if (!content.trim()) return null
  const idx = content.indexOf(CONTEXT_MARKER)
  if (idx === -1) return content.trim() || null
  const after = content.slice(idx + CONTEXT_MARKER.length).trim()
  return after || null
}

export function extractStack(content: string): string[] {
  const sectionMatch = content.match(/##\s+(?:Stack|Tech)\b[^\n]*\n([\s\S]*?)(?=\n##|$)/i)
  if (sectionMatch) {
    const sectionContent = sectionMatch[1]
    const keywords: string[] = []
    for (const match of sectionContent.matchAll(/^[-*]\s+([^\n|]+)/gm)) {
      const kw = match[1].trim().toLowerCase()
      if (kw) keywords.push(kw)
    }
    for (const match of sectionContent.matchAll(/^\|\s*([^|\n-][^|\n]*?)\s*\|/gm)) {
      const kw = match[1].trim().toLowerCase()
      if (kw && !['layer', 'technologie', 'tech', 'stack'].includes(kw)) keywords.push(kw)
    }
    if (keywords.length > 0) return [...new Set(keywords)].slice(0, 10)
  }
  const lower = content.toLowerCase()
  return TECH_KEYWORDS.filter(kw => lower.includes(kw)).slice(0, 10)
}
