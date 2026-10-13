// Die Einführung für neue Benutzer und neue Organisationen.
//
// Wer ab dem Stichtag angelegt wird, bekommt sie beim ersten Login
// automatisch — einmal. Bestehende Benutzer werden nicht unterbrochen; alle
// können sie jederzeit unter Einstellungen → Einführung ansehen.
//
// Zwei Teile:
//   basis         — die Grundlagen, zugeschnitten auf die eigenen Rechte
//   organisation  — für Verantwortliche (Recht "Benutzer verwalten") einer
//                   neuen Organisation: was einzurichten ist, mit Checkliste
//
// Gemerkt wird am Benutzer im JSON-Feld "einfuehrung" (in PocketBase
// anzulegen). Fehlt das Feld noch, ignoriert PocketBase es beim Speichern;
// dann hält ein Cookie den Stand, denn beim Abmelden wird der lokale Speicher
// geleert — ein Vermerk dort wäre nach dem nächsten Login weg.

import { hatRecht } from './apps'
import type { User } from '../types'

/** Ab diesem Tag angelegte Benutzer und Organisationen bekommen die Einführung automatisch. */
export const STICHTAG = '2026-10-13'

export type Teil = 'basis' | 'organisation'

export interface Stand {
  v: 1
  /** Wann die Grundlagen durchlaufen oder übersprungen wurden (ISO). */
  basis?: string
  /** Wann der Teil "Organisation einrichten" durchlaufen oder übersprungen wurde (ISO). */
  organisation?: string
  /** Von Hand abgehakte Punkte der Checkliste: id → Zeitpunkt (ISO). */
  abgehakt?: Record<string, string>
}

const LEER: Stand = { v: 1 }

/** Ein Stand aus dem Benutzerfeld oder dem Cookie — was nicht passt, wird verworfen. */
export function standLesen(roh: unknown): Stand {
  let w = roh
  if (typeof w === 'string') {
    try { w = JSON.parse(w) } catch { return { ...LEER } }
  }
  if (!w || typeof w !== 'object' || Array.isArray(w)) return { ...LEER }
  const o = w as Record<string, unknown>
  const zeit = (x: unknown) => (typeof x === 'string' && x ? x : undefined)
  const abgehakt: Record<string, string> = {}
  if (o.abgehakt && typeof o.abgehakt === 'object' && !Array.isArray(o.abgehakt)) {
    for (const [k, v] of Object.entries(o.abgehakt as Record<string, unknown>)) if (typeof v === 'string' && v) abgehakt[k] = v
  }
  return { v: 1, basis: zeit(o.basis), organisation: zeit(o.organisation), ...(Object.keys(abgehakt).length ? { abgehakt } : {}) }
}

/**
 * Zwei Stände zusammenführen — gesehen ist gesehen, egal wo es vermerkt ist.
 * Abgehakt ist, was in einem der beiden abgehakt ist.
 */
export function standVereinen(a: Stand, b: Stand): Stand {
  const abgehakt = { ...(b.abgehakt ?? {}), ...(a.abgehakt ?? {}) }
  return {
    v: 1,
    basis: a.basis ?? b.basis,
    organisation: a.organisation ?? b.organisation,
    ...(Object.keys(abgehakt).length ? { abgehakt } : {}),
  }
}

/** Ein Teil als erledigt vermerken. */
export function vermerken(stand: Stand, teile: Teil[], jetzt: Date): Stand {
  const neu: Stand = { ...stand }
  for (const t of teile) if (!neu[t]) neu[t] = jetzt.toISOString()
  return neu
}

export function abhaken(stand: Stand, id: string, an: boolean, jetzt: Date): Stand {
  const abgehakt = { ...(stand.abgehakt ?? {}) }
  if (an) abgehakt[id] = abgehakt[id] ?? jetzt.toISOString()
  else delete abgehakt[id]
  const { abgehakt: _alt, ...rest } = stand
  return Object.keys(abgehakt).length ? { ...rest, abgehakt } : rest
}

/** PocketBase schreibt "2026-10-13 07:42:27.123Z" — der Kalendertag in UTC reicht für den Stichtag. */
function tag(wert?: string): string | null {
  if (!wert) return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(wert)
  return m ? m[1] : null
}

/** Darf jemand die Organisation einrichten? Wer Benutzer verwalten darf. */
export function istVerantwortlich(user: User | null | undefined): boolean {
  return hatRecht(user, 'unitarii')
}

/**
 * Welche Teile gleich beim Login erscheinen. Leer, wenn nichts automatisch kommt.
 *
 * Ohne bekanntes Anlagedatum kommt nichts automatisch: lieber einmal zu wenig
 * als einen alten Hasen unterbrechen.
 */
export function automatisch(user: (User & { created?: string }) | null | undefined, stand: Stand): Teil[] {
  if (!user) return []
  const angelegt = tag(user.created)
  if (!angelegt) return []
  const teile: Teil[] = []
  if (angelegt >= STICHTAG && !stand.basis) teile.push('basis')
  const orgAngelegt = tag((user.organization as { created?: string } | undefined)?.created)
  if (istVerantwortlich(user) && !user.supervisor && orgAngelegt && orgAngelegt >= STICHTAG && !stand.organisation) teile.push('organisation')
  return teile
}

// ── Cookie: der Stand übersteht das Abmelden ──────────────────────────────

const COOKIE = (userId: string) => `responda_einfuehrung_${userId.replace(/[^a-z0-9]/gi, '')}`

export function cookieLesen(userId: string, cookies: string = typeof document !== 'undefined' ? document.cookie : ''): Stand {
  const name = COOKIE(userId) + '='
  const teil = cookies.split(';').map((s) => s.trim()).find((s) => s.startsWith(name))
  if (!teil) return { ...LEER }
  try { return standLesen(decodeURIComponent(teil.slice(name.length))) } catch { return { ...LEER } }
}

export function cookieText(userId: string, stand: Stand): string {
  // Fünf Jahre; nur der Vermerk, keine Inhalte
  return `${COOKIE(userId)}=${encodeURIComponent(JSON.stringify(stand))}; max-age=${5 * 365 * 24 * 3600}; path=/; SameSite=Lax`
}

// ── Die Schritte ────────────────────────────────────────────────────────────

export type Bild = 'willkommen' | 'hub' | 'control' | 'profil' | 'module' | 'unitas' | 'patienten' | 'einstellungen' | 'organisation' | 'checkliste' | 'fertig'

export interface EinfSchritt {
  id: string
  teil: Teil
  titel: string
  text: string
  punkte?: string[]
  /** Kleiner Hinweis unter dem Text. */
  hinweis?: string
  bild: Bild
  /** Für Bilder mit Kacheln: welche Module gezeigt werden. */
  module?: string[]
  /** Nur zeigen, wenn der Benutzer dieses Recht hat (eines davon). */
  rechte?: string[]
}

/**
 * Kurz, was jedes Modul ist — für den Überblick über die eigenen Module.
 * Jede Aussage ist am Code belegt; was ein Modul nicht kann, steht hier nicht.
 */
export const MODULE: { id: string; recht: string; name: string; satz: string }[] = [
  // Reihenfolge wie die Kacheln im Hub
  { id: 'einsaetze', recht: 'einsaetze', name: 'Einsätze', satz: 'Aktive und vergangene Einsätze deiner Organisation: anlegen, Personal zuordnen, abschließen.' },
  { id: 'eks', recht: 'eks', name: 'EKS', satz: 'Einsatzführung: Atemschutz überwachen, Einsatztagebuch führen, Kräfte und Abschnitte im Blick — auch ohne Netz.' },
  { id: 'patienten', recht: 'patienten', name: 'Patienten', satz: 'Eingereichte Protokolle prüfen, Rückfragen stellen, gegenzeichnen und archivieren.' },
  { id: 'dokumente', recht: 'dokumente', name: 'Vorgänge', satz: 'Festlegen, welche Formulare auf der Seite deiner Organisation stehen, und CIRS-Meldungen bearbeiten.' },
  { id: 'lager', recht: 'lager', name: 'Lager', satz: 'Bestände je Standort ein- und ausbuchen, Ablaufdaten im Blick behalten und nachbestellen.' },
  { id: 'dateien', recht: 'dateien', name: 'Dateien', satz: 'Die gemeinsame Ablage: Ordner anlegen, Dateien hochladen und wiederfinden.' },
  { id: 'lernbar', recht: 'lernbar', name: 'Unitas', satz: 'Deine Protokolle, deine Vorgänge und die Lernbar mit Terminen, Modulen und Bibliothek.' },
  { id: 'ausbildungen', recht: 'ausbildungen_manage', name: 'Ausbildungen', satz: 'Ausbildungstermine, Teilnehmer und Lernmodule planen.' },
  { id: 'unitarii', recht: 'unitarii', name: 'Benutzer', satz: 'Benutzer deiner Organisation anlegen und ihre Rechte vergeben.' },
  { id: 'mpg', recht: 'dashboard', name: 'MPG', satz: 'Medizinprodukte verwalten, nach Vorlage prüfen und Defekte melden.' },
  { id: 'chat', recht: 'chat', name: 'Chat', satz: 'Direktnachrichten an Personen deiner Organisation, auf deinem Gerät verschlüsselt.' },
  { id: 'office', recht: 'dateien', name: 'Schreibstube', satz: 'Dokumente, Tabellen und Präsentationen anlegen und im Office-Editor öffnen.' },
  { id: 'notizen', recht: 'notizen', name: 'Notizen', satz: 'Notizen für dich oder mit deiner Organisation geteilt, mit Tags und Anpinnen.' },
]

/** Wo die Einführung später zu finden ist — je nachdem, was jemand erreichen kann. */
function woWieder(user: User): string {
  return hatRecht(user, 'dashboard')
    ? 'Du findest die Einführung jederzeit unter Einstellungen → Einführung.'
    : 'Du findest die Einführung jederzeit in Unitas unter Konto (deine Initialen oben rechts).'
}

export const SCHRITTE: EinfSchritt[] = [
  // ── Grundlagen ──
  {
    id: 'willkommen', teil: 'basis', bild: 'willkommen',
    titel: 'Willkommen bei Responda',
    text: 'Responda bündelt, was deine Organisation im Einsatz und drumherum braucht: Dokumentation, Ausbildung und Verwaltung. In ein paar Schritten siehst du die Grundlagen — zugeschnitten auf die Rechte, die du hast.',
    hinweis: 'Du kannst jederzeit überspringen und die Einführung später noch einmal ansehen.',
  },
  {
    id: 'hub', teil: 'basis', bild: 'hub',
    titel: 'Das Hub — dein Startpunkt',
    text: 'Nach der Anmeldung landest du im Hub. Deine Module liegen dort als Kacheln — du siehst nur, wofür du ein Recht hast.',
    punkte: [
      'Unter „Neuigkeiten“ stehen offene Punkte, zum Beispiel offene Protokolle. Antippen öffnet das Modul.',
      'Fehlt dir ein Modul, das du brauchst? Die Verantwortlichen deiner Organisation vergeben die Rechte.',
    ],
    // Wer nur die Lernbar hat, landet nach dem Login dort, nicht im Hub
    rechte: ['dashboard'],
  },
  {
    id: 'control', teil: 'basis', bild: 'control',
    titel: 'Control und Kurzbefehle',
    text: 'Rechts unter der Kopfzeile sitzt „Control“. Antippen oder nach oben wischen öffnet deine Kurzbefehle — ein Tipp, und du bist im passenden Modul.',
    punkte: [
      'Mit „Bearbeiten“ legst du fest, welche Kurzbefehle erscheinen.',
      'Ein Kurzbefehl öffnet das Modul; angelegt wird dabei noch nichts.',
      'Daneben tippen oder nach unten wischen schließt das Fenster.',
    ],
    rechte: ['dashboard'],
  },
  {
    id: 'profil', teil: 'basis', bild: 'profil',
    titel: 'Dein Profil',
    text: 'Oben rechts stehen deine Initialen. Dahinter findest du Name, Rolle und deinen Ausweis — und dort meldest du dich ab.',
    punkte: [
      '„Zum Homebildschirm hinzufügen“: Responda startet dann wie eine App.',
      'Beim Abmelden werden Kachelauswahl, Kurzbefehle und Darstellung auf diesem Gerät zurückgesetzt.',
    ],
    rechte: ['dashboard'],
  },
  {
    id: 'module', teil: 'basis', bild: 'module',
    titel: 'Deine Module',
    text: 'Das kannst du mit deinen Rechten nutzen:',
  },
  {
    id: 'unitas', teil: 'basis', bild: 'unitas',
    titel: 'Unitas — für dich im Einsatzdienst',
    text: 'In Unitas findest du die Protokolle, bei denen du zur Besatzung gehörst, deine Vorgänge wie Produktausgaben und Defektmeldungen und die Lernbar.',
    punkte: [
      'Als Teamführer bearbeitest und gibst du ein Protokoll frei, solange die Frist läuft.',
      'Hat jemand eine Rückfrage zu einem Protokoll, antwortest du mit einer Stellungnahme.',
      'Lernbar: Termine zu- oder absagen, zugewiesene Module bearbeiten, Bibliothek und EKG-Training.',
    ],
    rechte: ['lernbar'],
  },
  {
    id: 'doku', teil: 'basis', bild: 'patienten',
    titel: 'Einsätze dokumentieren',
    text: 'Protokolle entstehen über die Seite deiner Organisation — ohne Anmeldung, auf jedem Gerät. Wer mit Konto in der Besatzung steht, findet das Protokoll danach in Unitas.',
    punkte: [
      'Die Reiter am Rand zeigen den Stand: rot heißt Pflichtfeld offen, grün vollständig.',
      'Nach dem Absenden bleibt ein Tag zum Ändern, dann ist das Protokoll eingereicht.',
      'Ohne Netz wartet das Protokoll auf dem Gerät und wird später übertragen.',
    ],
    rechte: ['lernbar', 'patienten'],
  },
  {
    id: 'einstellungen', teil: 'basis', bild: 'einstellungen',
    titel: 'Einstellungen',
    text: 'In den Einstellungen wählst du die Darstellung — hell, dunkel oder wie dein Gerät — und legst fest, welche Hinweise unter „Neuigkeiten“ erscheinen. Dort änderst du auch Profil und Passwort.',
    punkte: ['Darstellung und Hinweise gelten für dieses Gerät.'],
    rechte: ['dashboard'],
  },

  // ── Organisation einrichten ──
  {
    id: 'org-start', teil: 'organisation', bild: 'organisation',
    titel: 'Deine Organisation einrichten',
    text: 'Du darfst Benutzer verwalten. Damit deine Organisation gut startet, sind am Anfang ein paar Dinge einzurichten — die Checkliste am Ende zählt mit.',
  },
  {
    id: 'org-benutzer', teil: 'organisation', bild: 'organisation', module: ['unitarii'],
    titel: 'Benutzer und Rechte',
    text: 'Unter „Benutzer“ legst du die Mitglieder deiner Organisation an. Die Rolle schlägt passende Rechte vor; die Häkchen passt du danach für jede Person einzeln an.',
    punkte: [
      'Rollen-Vorlagen legen fest, welche Rechte eine Rolle vorschlägt. Bestehende Benutzer bleiben davon unberührt.',
      'Rechte lassen sich auch befristet vergeben, zum Beispiel für eine Vertretung.',
      'Neue Benutzer bekommen beim ersten Login automatisch ihre Einführung.',
    ],
    rechte: ['unitarii'],
  },
  {
    id: 'org-seite', teil: 'organisation', bild: 'organisation', module: ['dokumente', 'patienten'],
    titel: 'Die Seite deiner Organisation',
    text: 'Über die öffentliche Seite deiner Organisation dokumentieren und melden Einsatzkräfte ohne Anmeldung: Patientendokumentation, Produktausgabe, CIRS-Meldung und Defektmeldung.',
    punkte: [
      'Unter Vorgänge → Formulare schaltest du Formulare ein und aus und baust eigene Vorlagen.',
      'Unter Vorgänge → CIRS bearbeitest du eingegangene CIRS-Meldungen.',
    ],
    rechte: ['dokumente'],
  },
  {
    id: 'org-checkliste', teil: 'organisation', bild: 'checkliste',
    titel: 'Deine Checkliste',
    text: 'Erledigtes wird erkannt oder lässt sich abhaken. „Öffnen“ bringt dich direkt an die richtige Stelle.',
    hinweis: 'Die Checkliste findest du jederzeit unter Einstellungen → Einführung.',
  },
]

/** Der Abschluss — immer der letzte Schritt. */
function fertig(user: User, teil: Teil): EinfSchritt {
  return {
    id: 'fertig', teil, bild: 'fertig',
    titel: 'Alles bereit',
    text: teil === 'organisation'
      ? 'Das war der Überblick für Verantwortliche. Neue Benutzer deiner Organisation bekommen ihre Einführung beim ersten Login automatisch.'
      : 'Das waren die Grundlagen. Fragen zu einzelnen Abläufen klärst du am besten mit den Verantwortlichen deiner Organisation.',
    hinweis: woWieder(user),
  }
}

/** Die Schritte für diesen Benutzer und diese Teile — nur, was er auch nutzen darf. */
export function schritte(user: User, teile: Teil[]): EinfSchritt[] {
  if (!teile.length) return []
  const darf = (s: EinfSchritt) => !s.rechte || s.rechte.some((r) => hatRecht(user, r))
  const liste = SCHRITTE
    .filter((s) => teile.includes(s.teil) && darf(s))
    // Der Überblick zeigt nur die eigenen Module, mit einem Satz je Modul; ohne eigene Module entfällt er
    .map((s) => {
      if (s.id === 'org-seite') {
        const code = (user.organization as { org_code?: string } | undefined)?.org_code
        return code ? { ...s, hinweis: `Die Adresse deiner Seite: app.responda.systems/${code}` } : s
      }
      if (s.bild !== 'module') return s
      const meine = meineModule(user)
      return { ...s, module: meine.map((m) => m.id), punkte: meine.map((m) => `${m.name}: ${m.satz}`) }
    })
    .filter((s) => s.bild !== 'module' || (s.module?.length ?? 0) > 0)
  // Grundlagen zuerst, dann die Einrichtung, zum Schluss der Abschluss
  const reihe = (['basis', 'organisation'] as Teil[]).flatMap((t) => liste.filter((s) => s.teil === t))
  return [...reihe, fertig(user, teile.includes('organisation') ? 'organisation' : 'basis')]
}

export function meineModule(user: User) {
  return MODULE.filter((m) => hatRecht(user, m.recht))
}

// ── Checkliste "Organisation einrichten" ────────────────────────────────────

/** Was sich automatisch feststellen lässt. Fehlt ein Befund, bleibt der Punkt zum Abhaken. */
export type Befund = 'benutzer' | 'rechte' | 'eks' | 'formulare' | 'homescreen'
export type Befunde = Partial<Record<Befund, boolean>>

export interface Punkt {
  id: string
  titel: string
  text: string
  pfad?: string
  /** Nur für Benutzer mit diesem Recht (sonst kann er es nicht tun). */
  recht?: string
  /** Woran es automatisch erkannt wird. */
  befund?: Befund
}

export const CHECKLISTE: Punkt[] = [
  {
    id: 'benutzer', titel: 'Mitglieder anlegen', befund: 'benutzer', recht: 'unitarii', pfad: '/unitarii',
    text: 'Lege die Benutzer deiner Organisation an. Jeder bekommt beim ersten Login seine Einführung.',
  },
  {
    id: 'vorlagen', titel: 'Rollen-Vorlagen prüfen', befund: 'rechte', recht: 'unitarii', pfad: '/unitarii',
    text: 'Lege fest, welche Rechte eine Rolle vorschlägt. Das spart Häkchen bei jedem neuen Benutzer.',
  },
  {
    id: 'eks', titel: 'EKS-Recht vergeben', befund: 'eks', recht: 'unitarii', pfad: '/unitarii',
    text: 'Die Einsatzführung (EKS) steckt in keiner Rollen-Vorlage. Vergib das Recht einzeln an die, die führen.',
  },
  {
    id: 'formulare', titel: 'Formulare festlegen', befund: 'formulare', recht: 'dokumente', pfad: '/vorgaenge',
    text: 'Bestimme unter Vorgänge → Formulare, was auf der Seite deiner Organisation erscheint.',
  },
  {
    id: 'seite', titel: 'Seite bekannt machen', pfad: '/:org',
    text: 'Gib die Adresse der Seite deiner Organisation an die Einsatzkräfte weiter, zum Beispiel als Aushang auf der Wache.',
  },
  {
    id: 'cirs', titel: 'CIRS-Zuständigkeit klären', recht: 'dokumente', pfad: '/vorgaenge?bereich=cirs',
    text: 'Lege fest, wer eingehende CIRS-Meldungen bearbeitet. Neue Meldungen erscheinen im Hub unter „Neuigkeiten“.',
  },
  {
    id: 'homescreen', titel: 'Responda auf den Homebildschirm', befund: 'homescreen',
    text: 'Über deine Initialen im Hub: „Zum Homebildschirm hinzufügen“. Dann startet Responda wie eine App.',
  },
]

export interface PunktStand extends Punkt {
  erledigt: boolean
  /** erkannt = automatisch festgestellt, abgehakt = von Hand */
  quelle: 'erkannt' | 'abgehakt' | null
}

/** Der Stand der Checkliste: erkannt geht vor abgehakt. */
export function checklistenStand(punkte: Punkt[], befunde: Befunde, stand: Stand): PunktStand[] {
  return punkte.map((p) => {
    if (p.befund && befunde[p.befund]) return { ...p, erledigt: true, quelle: 'erkannt' as const }
    if (stand.abgehakt?.[p.id]) return { ...p, erledigt: true, quelle: 'abgehakt' as const }
    return { ...p, erledigt: false, quelle: null }
  })
}
