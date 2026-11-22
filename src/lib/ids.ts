// Kennungen, die der Client vergibt (Formulare, Lager, MPG).
//
// PocketBase-IDs sind Text mit Muster ^[a-z0-9]+$ und genau 15 Zeichen; crypto.randomUUID() passt
// deshalb nicht. Weil die Client-ID zugleich die Server-ID ist, wird ein erneutes Senden nach
// verlorener Bestätigung idempotent. (Früher in src/lib/eks/ids.ts; EKS ist seit 22.11.2026 entfernt.)

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function newId(): string {
  const bytes = new Uint8Array(15)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < 15; i++) out += ALPHABET[bytes[i] % 36]
  return out
}
