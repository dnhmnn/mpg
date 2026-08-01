// IDs, Hybrid Logical Clock und Hashing für EKS.
//
// WICHTIG: PocketBase-IDs sind Text mit Muster ^[a-z0-9]+$ und exakt 15 Zeichen.
// crypto.randomUUID() ist daher NICHT verwendbar. Weil die Client-ID zugleich die
// Server-ID ist, wird ein erneutes Senden nach verlorener Bestätigung idempotent.

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function newId(): string {
  const bytes = new Uint8Array(15)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < 15; i++) out += ALPHABET[bytes[i] % 36]
  return out
}

// ── Hybrid Logical Clock ─────────────────────────────────────────────────────
// Erzeugt eine geräteübergreifend deterministische Gesamtordnung, die auch bei
// abweichenden Uhren stabil bleibt. Vergleich = einfacher String-Vergleich.

export interface Hlc { wall: number; ctr: number; dev: string }

export function hlcToSeq(h: Hlc): string {
  return `${h.wall.toString(16).padStart(13, '0')}-${h.ctr.toString(16).padStart(4, '0')}-${h.dev}`
}

export function hlcNext(last: Hlc | null, nowMs: number, dev: string, remoteWall?: number): Hlc {
  const base = Math.max(nowMs, last?.wall ?? 0, remoteWall ?? 0)
  if (last && base === last.wall) return { wall: base, ctr: last.ctr + 1, dev }
  return { wall: base, ctr: 0, dev }
}

export function seqLess(a: string, b: string): boolean { return a < b }

// ── Kanonisches JSON + Hash ──────────────────────────────────────────────────
// Sortierte Schlüssel, keine Leerzeichen — sonst ist die Hash-Kette nicht reproduzierbar.

export function canonicalJSON(v: any): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null)
  if (Array.isArray(v)) return '[' + v.map(canonicalJSON).join(',') + ']'
  const keys = Object.keys(v).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJSON(v[k])).join(',') + '}'
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Uhrzeit-Korrektur ────────────────────────────────────────────────────────
// Offset gegen die Serverzeit (aus dem HTTP-Date-Header), damit das Einsatztagebuch
// geräteübergreifend eine plausible Chronologie hat.

let clockOffsetMs = 0
let offsetKnown = false

export function setClockOffset(ms: number) { clockOffsetMs = ms; offsetKnown = true }
export function getClockOffset(): number | null { return offsetKnown ? clockOffsetMs : null }
export function correctedNow(): number { return Date.now() + clockOffsetMs }
export function correctedISO(): string { return new Date(correctedNow()).toISOString() }
