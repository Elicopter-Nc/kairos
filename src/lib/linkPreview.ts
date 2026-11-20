import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// Aperçu des liens collés dans les notes (titre, description, image de la page).
// La page est téléchargée une fois puis gardée sur le téléphone 30 jours :
// hors-ligne, l'aperçu en cache reste affiché. Les échecs sont mémorisés 1 jour
// pour ne pas réessayer en boucle un site qui bloque.

export interface LinkPreviewData {
  url: string;
  ok: boolean;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  icon?: string;
  fetchedAt: number;
}

const PREFIX = 'kairos:link:';
const TTL_OK = 30 * 24 * 3600 * 1000;
const TTL_FAIL = 24 * 3600 * 1000;
const TIMEOUT = 6000;
const MAX_BYTES = 300 * 1024;

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"'()]+[^\s<>"'().,;:!?»])/gi;

/** URL trouvées dans un texte (« www. » est complété en https://), sans doublons. */
export function findUrls(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(URL_RE)) {
    const u = normalizeUrl(m[1]);
    if (!out.includes(u)) out.push(u);
  }
  return out;
}

/** Découpe un texte en morceaux texte / lien (pour rendre les liens cliquables). */
export function splitLinks(text: string): { text: string; url?: string }[] {
  const parts: { text: string; url?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const i = m.index ?? 0;
    if (i > last) parts.push({ text: text.slice(last, i) });
    parts.push({ text: m[1], url: normalizeUrl(m[1]) });
    last = i + m[1].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

export function normalizeUrl(u: string): string {
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

export function domainOf(url: string): string {
  const m = /^https?:\/\/([^/?#]+)/i.exec(url);
  return (m ? m[1] : url).replace(/^www\./i, '');
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à',
  acirc: 'â', ccedil: 'ç', ocirc: 'ô', ucirc: 'û', ugrave: 'ù', icirc: 'î', iuml: 'ï', euml: 'ë', rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', laquo: '«', raquo: '»', hellip: '…', mdash: '—', ndash: '–', copy: '©', reg: '®', trade: '™',
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

function safeChar(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

function absolute(href: string | undefined, base: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(decodeEntities(href), base).toString();
  } catch {
    return undefined;
  }
}

/** Extrait les métadonnées utiles d'une page HTML. */
export function parseHtml(html: string, url: string): Omit<LinkPreviewData, 'fetchedAt' | 'ok' | 'url'> {
  const head = html.slice(0, 200_000);
  const meta = (key: string): string | undefined => {
    // <meta property="og:title" content="…"> dans un ordre d'attributs quelconque
    const re = new RegExp(`<meta\\b[^>]*(?:property|name)\\s*=\\s*["']${key}["'][^>]*>`, 'i');
    const tag = re.exec(head)?.[0];
    const content = tag ? /content\s*=\s*(["'])([\s\S]*?)\1/i.exec(tag)?.[2] : undefined;
    return content ? decodeEntities(content) : undefined;
  };
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  const iconTag = /<link\b[^>]*rel\s*=\s*["'][^"']*icon[^"']*["'][^>]*>/i.exec(head)?.[0];
  const iconHref = iconTag ? /href\s*=\s*(["'])(.*?)\1/i.exec(iconTag)?.[2] : undefined;
  return {
    title: meta('og:title') ?? meta('twitter:title') ?? (titleTag ? decodeEntities(titleTag) : undefined),
    description: meta('og:description') ?? meta('twitter:description') ?? meta('description'),
    image: absolute(meta('og:image') ?? meta('og:image:url') ?? meta('twitter:image'), url),
    siteName: meta('og:site_name'),
    icon: absolute(iconHref ?? '/favicon.ico', url),
  };
}

// ─── Cache ─────────────────────────────────────────────────────────────────
const memory = new Map<string, LinkPreviewData>();
const inflight = new Map<string, Promise<LinkPreviewData>>();

function fresh(p: LinkPreviewData): boolean {
  return Date.now() - p.fetchedAt < (p.ok ? TTL_OK : TTL_FAIL);
}

/** Aperçu en cache uniquement (aucune requête réseau). */
export async function cachedPreview(url: string): Promise<LinkPreviewData | null> {
  const mem = memory.get(url);
  if (mem) return mem;
  try {
    const s = await AsyncStorage.getItem(PREFIX + url);
    if (!s) return null;
    const p = JSON.parse(s) as LinkPreviewData;
    memory.set(url, p);
    return p;
  } catch {
    return null;
  }
}

async function readLimited(res: Response): Promise<string> {
  // Lecture partielle si le flux est disponible, sinon texte complet tronqué.
  const body = res.body as ReadableStream<Uint8Array> | null | undefined;
  if (body && typeof body.getReader === 'function' && typeof TextDecoder !== 'undefined') {
    const reader = body.getReader();
    const dec = new TextDecoder('utf-8');
    let out = '';
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      size += value.length;
      out += dec.decode(value, { stream: true });
      if (/<\/head>/i.test(out)) break; // les balises utiles sont dans <head>
    }
    reader.cancel().catch(() => {});
    return out;
  }
  const text = await res.text();
  return text.slice(0, MAX_BYTES);
}

async function download(url: string): Promise<LinkPreviewData> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    // YouTube renvoie une page de consentement aux clients non-navigateurs : on passe par oEmbed
    if (/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(url)) {
      const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, { signal: ctrl.signal });
      if (r.ok) {
        const j = await r.json();
        return { url, ok: true, title: j.title, description: j.author_name, image: j.thumbnail_url, siteName: 'YouTube', fetchedAt: Date.now() };
      }
    }
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android) KairosApp',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'Accept-Language': 'fr,en;q=0.8',
      },
    });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (type.startsWith('image/')) return { url, ok: true, image: res.url || url, title: domainOf(url), fetchedAt: Date.now() };
    if (type && !/html|xml/i.test(type)) return { url, ok: true, title: domainOf(url), siteName: type.split(';')[0], fetchedAt: Date.now() };
    const html = await readLimited(res);
    const meta = parseHtml(html, res.url || url);
    return { url, ok: !!(meta.title || meta.image || meta.description), ...meta, fetchedAt: Date.now() };
  } catch {
    return { url, ok: false, fetchedAt: Date.now() };
  } finally {
    clearTimeout(timer);
  }
}

/** Aperçu d'un lien : cache d'abord, réseau si absent ou périmé. */
export async function getPreview(url: string): Promise<LinkPreviewData> {
  const cached = await cachedPreview(url);
  if (cached && fresh(cached)) return cached;
  const pending = inflight.get(url);
  if (pending) return pending;
  const job = download(url).then(async (p) => {
    // hors-ligne : on garde l'ancien aperçu réussi plutôt qu'un échec
    const result = !p.ok && cached?.ok ? cached : p;
    memory.set(url, result);
    await AsyncStorage.setItem(PREFIX + url, JSON.stringify(result)).catch(() => {});
    inflight.delete(url);
    return result;
  });
  inflight.set(url, job);
  return job;
}

/**
 * Hook : aperçu d'un lien. `enabled = false` → cache seulement, aucune requête
 * (utilisé par la liste des notes et quand le réglage est désactivé).
 */
export function useLinkPreview(url: string | undefined, enabled: boolean) {
  const [state, setState] = useState<{ data: LinkPreviewData | null; loading: boolean; for?: string }>({ data: null, loading: false });
  useEffect(() => {
    if (!url) return;
    let alive = true;
    cachedPreview(url).then((c) => {
      if (!alive) return;
      const needFetch = enabled && (!c || !fresh(c));
      setState({ data: c, loading: needFetch, for: url });
      if (!needFetch) return;
      getPreview(url).then((p) => {
        if (alive) setState({ data: p, loading: false, for: url });
      });
    });
    return () => {
      alive = false;
    };
  }, [url, enabled]);
  if (!url || state.for !== url) return { data: null, loading: !!url && enabled };
  return { data: state.data, loading: state.loading };
}
