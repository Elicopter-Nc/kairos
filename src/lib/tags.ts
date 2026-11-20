// Tags des notes : créés librement par l'utilisateur, sans liste à gérer à part.
// Ils sont rangés en minuscules, sans « # » ni espaces (« Idées cadeaux » → « idées-cadeaux »).

export function cleanTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/[\s,;]+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

/** Tous les tags utilisés, du plus fréquent au plus rare (puis par ordre alphabétique). */
export function allTags(items: { tags?: string[] }[]): { tag: string; count: number }[] {
  const m = new Map<string, number>();
  for (const n of items) for (const tag of n.tags ?? []) m.set(tag, (m.get(tag) ?? 0) + 1);
  return [...m.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'fr'));
}

/** Requête « #mot » → le tag cherché (sinon null). */
export function tagQuery(q: string): string | null {
  const m = q.trim().match(/^#(\S*)$/);
  return m ? cleanTag(m[1]) : null;
}

/** La note porte un tag qui commence par `prefix` (vide = n'importe quel tag). */
export function hasTag(n: { tags?: string[] }, prefix: string): boolean {
  return (n.tags ?? []).some((t) => t.startsWith(prefix));
}
