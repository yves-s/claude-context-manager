import { describe, it, expect } from 'vitest'
import { extractContext, extractStack } from './parse'

describe('extractContext', () => {
  it('returns null for empty content', () => {
    expect(extractContext('')).toBeNull()
    expect(extractContext('   ')).toBeNull()
  })

  it('returns full content if no marker', () => {
    const content = '# My Repo\nSome description'
    expect(extractContext(content)).toBe('# My Repo\nSome description')
  })

  it('returns content after marker', () => {
    const content = `# Header
Meta stuff here
<!-- PROJECT CONTEXT BELOW -->
# Project
This is the project context.`
    expect(extractContext(content)).toBe('# Project\nThis is the project context.')
  })

  it('returns null if marker exists but nothing after it', () => {
    const content = '# Header\n<!-- PROJECT CONTEXT BELOW -->\n   '
    expect(extractContext(content)).toBeNull()
  })

  it('returns null if marker exists but nothing after it (no trailing whitespace)', () => {
    const content = '# Header\n<!-- PROJECT CONTEXT BELOW -->'
    expect(extractContext(content)).toBeNull()
  })
})

describe('extractStack', () => {
  it('returns empty array for empty content', () => {
    expect(extractStack('')).toEqual([])
  })

  it('extracts from ## Stack section bullet points', () => {
    const content = `# My Repo
## Stack
- Next.js
- TypeScript
- Supabase
`
    const result = extractStack(content)
    expect(result).toContain('next.js')
    expect(result).toContain('typescript')
    expect(result).toContain('supabase')
  })

  it('extracts from ## Tech section', () => {
    const content = `# My Repo
## Tech
- React
- Python
`
    const result = extractStack(content)
    expect(result).toContain('react')
    expect(result).toContain('python')
  })

  it('extracts from table rows in stack section', () => {
    const content = `## Stack
| Next.js | Frontend framework |
| PostgreSQL | Database |
`
    const result = extractStack(content)
    expect(result).toContain('next.js')
    expect(result).toContain('postgresql')
  })

  it('extracts from table rows where tech is in second column', () => {
    const content = `## Stack
| Frontend | Next.js |
| Database | Supabase |
`
    const result = extractStack(content)
    expect(result).toContain('next.js')
    expect(result).toContain('supabase')
  })

  it('falls back to keyword matching on full text', () => {
    const content = `# My Repo
We use Docker and Go for the backend.
`
    const result = extractStack(content)
    expect(result).toContain('docker')
    expect(result).toContain('go')
  })

  it('returns at most 10 items', () => {
    // Create content with more than 10 keywords
    const content = 'React Vue Angular Svelte Next.js TypeScript JavaScript Python Go Rust Swift Kotlin'
    const result = extractStack(content)
    expect(result.length).toBeLessThanOrEqual(10)
  })

  it('returns lowercase results', () => {
    const content = '## Stack\n- Next.js\n- TypeScript'
    const result = extractStack(content)
    result.forEach(item => expect(item).toBe(item.toLowerCase()))
  })

  it('removes duplicates', () => {
    const content = '## Stack\n- React\n- React'
    const result = extractStack(content)
    expect(result.filter(x => x === 'react').length).toBe(1)
  })
})
