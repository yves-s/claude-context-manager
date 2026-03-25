const TECH_KEYWORDS = [
  'next.js', 'react', 'vue', 'angular', 'svelte',
  'supabase', 'postgresql', 'mysql',
  'typescript', 'javascript', 'python', 'go', 'rust',
  'swift', 'kotlin', 'docker',
]

const SECTION_HEADER_RE = /^##\s+(Stack|Tech)\s*$/im

/**
 * Matches text against a keyword using word boundaries to avoid false positives.
 * For example, "go" won't match within "mongo".
 */
function matchesKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text)
}

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
      // Table row: scan all cells against keyword list
      if (line.trim().startsWith('|') && !line.includes('---')) {
        const cells = line.split('|').slice(1, -1).map(c => c.trim().toLowerCase())
        for (const cell of cells) {
          if (TECH_KEYWORDS.some(kw => matchesKeyword(cell, kw))) {
            items.push(cell)
          }
        }
      }
    }

    if (items.length > 0) {
      return [...new Set(items)].slice(0, 10)
    }
  }

  // Fallback: keyword match on full text
  const found = TECH_KEYWORDS.filter(kw => matchesKeyword(content, kw))
  return [...new Set(found)].slice(0, 10)
}
