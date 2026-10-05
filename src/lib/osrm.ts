// Adresse zu Koordinate, Koordinate zu Fahrzeit.
//
// Zwei offene Dienste, die die App schon im alten Formular benutzt:
// Nominatim sucht die Adresse, OSRM rechnet die Strecke. Beide liegen
// außerhalb — ohne Netz gibt es keine Route, und das muss die Maske sagen
// statt zu rechnen, als hätte sie eine.
//
// Nominatim erlaubt eine Anfrage je Sekunde. Wer zwei Adressen sucht, wartet
// zwischen ihnen; das steht hier und nicht in der Maske, damit es nicht
// irgendwann vergessen wird.

export type Koordinate = { breite: number; laenge: number }

export type Strecke = {
  /** Fahrzeit in Sekunden. */
  sekunden: number
  /** Länge in Metern. */
  meter: number
  /** Der Streckenverlauf als GeoJSON, für die Karte. */
  verlauf: unknown
}

/** Wartezeit zwischen zwei Nominatim-Anfragen. */
export const NOMINATIM_PAUSE_MS = 1100

export class OhneNetz extends Error {}

/** Eine Adresse suchen. Null heißt: nicht gefunden, nicht: kein Netz. */
export async function adresseSuchen(adresse: string): Promise<Koordinate | null> {
  const q = adresse.trim()
  if (!q) return null
  let antwort: Response
  try {
    antwort = await fetch(
      'https://nominatim.openstreetmap.org/search?'
      + new URLSearchParams({ q: `${q}, Deutschland`, format: 'json', limit: '1', countrycodes: 'de' }),
      { headers: { 'Accept-Language': 'de' } },
    )
  } catch {
    throw new OhneNetz('Adresssuche nicht erreichbar')
  }
  if (!antwort.ok) throw new OhneNetz('Adresssuche antwortet nicht')
  const daten = await antwort.json()
  if (!Array.isArray(daten) || daten.length === 0) return null
  const breite = Number(daten[0]?.lat)
  const laenge = Number(daten[0]?.lon)
  if (!Number.isFinite(breite) || !Number.isFinite(laenge)) return null
  return { breite, laenge }
}

/** Die Fahrstrecke zwischen zwei Punkten. Null heißt: keine Route. */
export async function fahrstrecke(von: Koordinate, nach: Koordinate): Promise<Strecke | null> {
  let antwort: Response
  try {
    antwort = await fetch(
      'https://router.project-osrm.org/route/v1/driving/'
      + `${von.laenge},${von.breite};${nach.laenge},${nach.breite}`
      + '?overview=full&geometries=geojson',
    )
  } catch {
    throw new OhneNetz('Routendienst nicht erreichbar')
  }
  if (!antwort.ok) throw new OhneNetz('Routendienst antwortet nicht')
  const daten = await antwort.json()
  const route = daten?.routes?.[0]
  if (!route) return null
  return { sekunden: Number(route.duration), meter: Number(route.distance), verlauf: route.geometry }
}

/** Sekunden als angefangene Minuten — eine halbe Minute Fahrt ist eine Minute. */
export function fahrminuten(sekunden: number): number {
  return Math.ceil(sekunden / 60)
}

/** Eine Dauer, wie man sie sagt. */
export function dauerText(minuten: number): string {
  if (minuten < 60) return `${minuten} min`
  const h = Math.floor(minuten / 60)
  const m = minuten % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** Eine Strecke, wie man sie sagt. */
export function streckeText(meter: number): string {
  return meter < 1000 ? `${Math.round(meter)} m` : `${(meter / 1000).toFixed(1).replace('.', ',')} km`
}
