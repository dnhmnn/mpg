// Die Besatzung des Protokolls.
//
// Sie wird einmal eingetragen und steht danach an zwei Stellen, weil zwei
// Dinge an ihr hängen:
//
// DER BOGEN druckt vier Namen: `mannschaft_tf` und `mannschaft_1..3`. Das
// sind gewöhnliche Textfelder des Katalogs; sie zählen im Fortschritt mit und
// landen im Ausdruck.
//
// UNITAS entscheidet an `payload.mannschaft` darüber, wer das Protokoll in
// seiner Liste findet: `['tf','m1','m2','m3'].some(k => mannschaft[k]?.id ===
// user.id)`. Dafür braucht es die Benutzerkennung, nicht den Namen.
//
// KENNUNGEN SETZT NUR DER SERVER (Bauplan v2, 2.5). Die Maske schreibt Namen;
// beim Absenden verknüpft der Server jeden Namen, der genau auf ein aktives
// Mitglied passt, und baut `mannschaft` neu. Eine Kennung, die die Maske
// mitschickt, zählt bei anonymem Senden nie. Beim Ändern eines geladenen
// Protokolls behält ein unveränderter Name seine Verknüpfung. Deshalb räumt
// `besatzungSetzen` mit leerer Kennung den verschachtelten Eintrag: wer einen
// Namen ändert, lässt ihn am Server neu auflösen.

import type { Werte } from './DokuFeld'

export type Posten = {
  /** Der Schlüssel, unter dem Unitas die Stelle führt. */
  pos: 'tf' | 'm1' | 'm2' | 'm3'
  /** Das Feld des Bogens, das den Namen druckt. */
  feld: string
  label: string
}

export const POSTEN: Posten[] = [
  { pos: 'tf', feld: 'mannschaft_tf', label: 'Teamführer' },
  { pos: 'm1', feld: 'mannschaft_1', label: '1. Mannschaft' },
  { pos: 'm2', feld: 'mannschaft_2', label: '2. Mannschaft' },
  { pos: 'm3', feld: 'mannschaft_3', label: '3. Mannschaft' },
]

/** Ein besetzter Posten. Ohne `id` ist es ein Name ohne Konto. */
export type Besetzung = { id: string; name: string }

function verschachtelt(werte: Werte): Record<string, { id?: unknown; name?: unknown } | null> {
  const m = werte.mannschaft
  if (!m || typeof m !== 'object' || Array.isArray(m)) return {}
  return m as Record<string, { id?: unknown; name?: unknown } | null>
}

function eintrag(werte: Werte, pos: string): Besetzung | null {
  const e = verschachtelt(werte)[pos]
  if (!e || typeof e !== 'object') return null
  const name = typeof e.name === 'string' ? e.name.trim() : ''
  if (!name) return null
  return { id: typeof e.id === 'string' ? e.id : '', name }
}

/**
 * Wer auf den vier Posten steht.
 *
 * Gelesen wird beides, und zwar in derselben Rangfolge wie im Ausdruck: der
 * flache Name gilt. Die Kennung kommt nur dann dazu, wenn der verschachtelte
 * Eintrag denselben Namen trägt — sonst zeigte die Maske eine Einsicht an,
 * die zu einem anderen Namen gehört.
 */
export function besatzungLesen(werte: Werte): Record<string, Besetzung | null> {
  const aus: Record<string, Besetzung | null> = {}
  for (const p of POSTEN) {
    const flach = typeof werte[p.feld] === 'string' ? (werte[p.feld] as string).trim() : ''
    const e = eintrag(werte, p.pos)
    if (flach) aus[p.pos] = { id: e && e.name === flach ? e.id : '', name: flach }
    else aus[p.pos] = e
  }
  return aus
}

/**
 * Einen Posten besetzen oder räumen — in beiden Formen zugleich.
 *
 * Wird nur eine von ihnen geschrieben, geht entweder der Name im Ausdruck
 * verloren oder die Einsicht in Unitas.
 */
export function besatzungSetzen(werte: Werte, pos: Posten['pos'], person: Besetzung | null): Werte {
  const posten = POSTEN.find((p) => p.pos === pos)
  if (!posten) return werte
  const name = person ? person.name.trim() : ''
  const mannschaft = { ...verschachtelt(werte) }
  // Nur ein Benutzer kommt in die verschachtelte Form. Ein Name ohne Konto
  // bekäme dort eine leere Kennung — und `mannschaft[k]?.id === user.id`
  // träfe damit auf jeden zu, dessen Kennung leer ist. Der Name steht im
  // Feld des Bogens, das genügt für den Ausdruck.
  mannschaft[pos] = name && person!.id ? { id: person!.id, name } : null
  return { ...werte, [posten.feld]: name, mannschaft }
}

/** Die Benutzer, die das Protokoll damit in Unitas sehen. */
export function einsichtIds(werte: Werte): string[] {
  const besetzt = besatzungLesen(werte)
  const ids = POSTEN.map((p) => besetzt[p.pos]?.id ?? '').filter((id) => id !== '')
  return [...new Set(ids)]
}

/** Ob überhaupt jemand auf dem Protokoll steht. */
export function besatzungLeer(werte: Werte): boolean {
  const besetzt = besatzungLesen(werte)
  return POSTEN.every((p) => !besetzt[p.pos])
}

/** Die vier Namen der Besatzung, je Posten (alte Maske, Schnelldoku). */
export type Namen = Record<Posten['pos'], string>

export const KEINE_NAMEN: Namen = { tf: '', m1: '', m2: '', m3: '' }

/** Die vier Namen aus einer Nutzlast: der flache Name zuerst, sonst der verschachtelte (ältere Entwürfe). */
export function namenLesen(werte: Werte): Namen {
  const b = besatzungLesen(werte)
  return { tf: b.tf?.name ?? '', m1: b.m1?.name ?? '', m2: b.m2?.name ?? '', m3: b.m3?.name ?? '' }
}

/**
 * Die vier Namen als flache Felder des Bogens (`mannschaft_tf`, `mannschaft_1..3`),
 * getrimmt. Kennungen setzt nur der Server (Bauplan v2, 2.5).
 */
export function namenFelder(namen: Partial<Namen>): Record<string, string> {
  const aus: Record<string, string> = {}
  for (const p of POSTEN) aus[p.feld] = String(namen[p.pos] ?? '').trim()
  return aus
}
