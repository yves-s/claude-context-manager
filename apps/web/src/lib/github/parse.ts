const TECH_KEYWORDS = [
  'next.js', 'react', 'vue', 'angular', 'svelte',
  'supabase', 'postgresql', 'mysql',
  'typescript', 'javascript', 'python', 'go', 'rust',
  'swift', 'kotlin', 'docker',
]

const SECTION_HEADER_RE = /^##\s+(Stack|Tech)\s*$/im

/**
 * Extracts the project context from CLAUDE.md content.
 * Returns content after <!-- PROJECT CONTEXT BELOW --> if present,
 * otherwise returns the full content. Returns null if content is empty.
 */
export function extractContext(content: string): string | null {
  if (!content.trim()) return null
  const MARKER = '<!-- PROJECT CONTEXT BELOW -->'
  const idx = content.indexOf(MARKER)
  if (idx === -1) return content.trim() || null
  const after = content.slice(idx + MARKER.length).trim()
  return after || null
}

/**
 * Extracts tech stack keywords from CLAUDE.md content.
 * 1. Looks for ## Stack or ## Tech section, extracts from bullet points / table rows
 * 2. Falls back to keyword match on full text
 * Returns lowercase array, max 10 items, no duplicates.
 */
export function extractStack(content: string): string[] {
  if (!content.trim()) return []

  // Try to find ## Stack or ## Tech section
  const sectionMatch = SECTION_HEADER_RE.exec(content)
  if (sectionMatch) {
    const sectionStart = sectionMatch.index + sectionMatch[0].length
    // Find next ## heading or end of string
    const nextHeading = content.slice(sectionStart).search(/^##\s/m)
    const sectionText = nextHeading === -1
      ? content.slice(sectionStart)
      : content.slice(sectionStart, sectionStart + nextHeading)

    const items: string[] = []
    for (const line of sectionText.split('\n')) {
      // Bullet point: "- Next.js" or "* Next.js"
      const bulletMatch = line.match(/^[-*]\s+(.+)/)
      if (bulletMatch) {
        items.push(bulletMatch[1].trim().toLowerCase())
        continue
      }
      // Table row: "| Next.js | ..."
      const tableMatch = line.match(/^\|\s*([^|]+?)\s*\|/)
      if (tableMatch && !tableMatch[1].startsWith('-')) {
        items.push(tableMatch[1].trim().toLowerCase())
      }
    }

    if (items.length > 0) {
      return [...new Set(items)].slice(0, 10)
    }
  }

  // Fallback: keyword match on full text
  const lower = content.toLowerCase()
  const found = TECH_KEYWORDS.filter(kw => lower.includes(kw))
  return [...new Set(found)].slice(0, 10)
}
