// apps/web/src/lib/utils/initials.ts
export function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}
