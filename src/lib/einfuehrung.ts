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
import { appFrei, modulFrei } from './freigabe'
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
 * Welcher Stand gilt: das Feld am Benutzer, sobald es dort steht — sonst der
 * Cookie. Nicht vereinigt: ein zurückgenommener Haken käme sonst aus dem
 * jeweils anderen Speicher wieder.
 *
 * Steht das Feld zwar im Schema, ist aber noch leer (null), gilt der Cookie —
 * so geht nichts verloren, was vor dem Anlegen des Felds vermerkt wurde; das
 * nächste Speichern schreibt es ins Feld.
 */
export function standWaehlen(user: object, cookie: Stand): Stand {
  const feld = (user as { einfuehrung?: unknown }).einfuehrung
  return feld !== undefined && feld !== null ? standLesen(feld) : cookie
}

/** Steht etwas darin? */
export function standLeer(s: Stand): boolean {
  return !s.basis && !s.organisation && !(s.abgehakt && Object.keys(s.abgehakt).length)
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

/**
 * Hat jemand nur die Lernbar? Dieselbe Regel wie beim Login (Login.tsx):
 * solche Benutzer landen nach dem Anmelden in der Lernbar, nicht im Hub.
 */
export function nurLernbar(user: User | null | undefined): boolean {
  const p = user?.permissions ?? {}
  return !!p.lernbar && !Object.entries(p).some(([k, v]) => k !== 'lernbar' && v)
}

/**
 * Ist jemand verantwortlich für die Organisation? Wer Benutzer verwalten darf
 * — dauerhaft. Ein befristetes Recht (Vertretung) macht noch niemanden zum
 * Verantwortlichen, und die Benutzerverwaltung selbst lässt dann auch nicht hinein.
 */
export function istVerantwortlich(user: User | null | undefined): boolean {
  return !!user && (user.supervisor === true || user.permissions?.unitarii === true)
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
  /** Nur für die, die nach dem Login im Hub landen (nicht Nur-Lernbar). */
  imHub?: true
  /** Nur, wenn dieses Modul für die Organisation freigeschaltet ist. */
  modul?: string
}

/**
 * Kurz, was jedes Modul ist — für den Überblick über die eigenen Module.
 * Jede Aussage ist am Code belegt; was ein Modul nicht kann, steht hier nicht.
 */
export const MODULE: { id: string; recht: string; name: string; satz: string }[] = [
  // Reihenfolge wie die Kacheln im Hub (lib/apps.ts)
  { id: 'einsaetze', recht: 'einsaetze', name: 'Einsätze', satz: 'Aktive und vergangene Einsätze deiner Organisation: anlegen, Personal zuordnen, abschließen.' },
  { id: 'eks', recht: 'eks', name: 'EKS', satz: 'Einsatzführung: Atemschutz überwachen, Einsatztagebuch führen, Kräfte und Abschnitte im Blick — auch ohne Netz.' },
  { id: 'patienten', recht: 'patienten', name: 'Patienten', satz: 'Eingereichte Protokolle prüfen, Rückfragen stellen, gegenzeichnen und archivieren.' },
  { id: 'dokumente', recht: 'dokumente', name: 'Vorgänge', satz: 'Festlegen, welche Formulare auf der Seite deiner Organisation stehen, und CIRS-Meldungen bearbeiten.' },
  { id: 'lager', recht: 'lager', name: 'Lager', satz: 'Bestände je Standort ein- und ausbuchen, Ablaufdaten im Blick behalten und nachbestellen.' },
  { id: 'dateien', recht: 'dateien', name: 'Dateien', satz: 'Die gemeinsame Ablage: Ordner anlegen, Dateien hochladen und wiederfinden.' },
  { id: 'office', recht: 'dateien', name: 'Schreibstube', satz: 'Dokumente, Tabellen und Präsentationen anlegen und im Office-Editor öffnen.' },
  { id: 'lernbar', recht: 'lernbar', name: 'Unitas', satz: 'Deine Protokolle, deine Vorgänge und die Lernbar mit Terminen, Modulen und Bibliothek.' },
  { id: 'ausbildungen', recht: 'ausbildungen_manage', name: 'Ausbildungen', satz: 'Ausbildungstermine planen, Teilnehmer und Lernmodule verwalten, per Link einladen.' },
  { id: 'unitarii', recht: 'unitarii', name: 'Benutzer', satz: 'Benutzer deiner Organisation anlegen und ihre Rechte vergeben.' },
  { id: 'mpg', recht: 'dashboard', name: 'MPG', satz: 'Medizinprodukte verwalten, nach Vorlage prüfen und Defekte melden.' },
  { id: 'chat', recht: 'chat', name: 'Chat', satz: 'Direktnachrichten an Personen deiner Organisation, auf deinem Gerät verschlüsselt.' },
  { id: 'notizen', recht: 'notizen', name: 'Notizen', satz: 'Notizen für dich oder mit deiner Organisation geteilt, mit Tags und Anpinnen.' },
]

/**
 * Wo die Einführung später zu finden ist — nach dem, was jemand erreicht.
 * Das Profil im Hub (Initialen oben rechts) erreicht jeder; die Einstellungen
 * nur mit dem Recht "dashboard".
 */
function woWieder(user: User): string {
  if (hatRecht(user, 'dashboard')) return 'Du findest die Einführung jederzeit unter Einstellungen → Einführung oder im Hub über deine Initialen oben rechts.'
  if (nurLernbar(user)) return 'Du findest die Einführung jederzeit im Hub über deine Initialen oben rechts — ins Hub kommst du über den Pfeil oben links.'
  return 'Du findest die Einführung jederzeit im Hub über deine Initialen oben rechts.'
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
    text: 'Nach der Anmeldung landest du im Hub. Deine Module liegen dort als Kacheln — neue erscheinen, sobald du das Recht dafür bekommst.',
    punkte: [
      'Unter „Neuigkeiten“ stehen offene Punkte, zum Beispiel offene Protokolle. Antippen öffnet das Modul.',
      'Fehlt dir ein Modul, das du brauchst? Die Verantwortlichen deiner Organisation vergeben die Rechte.',
    ],
    imHub: true,
  },
  {
    id: 'control', teil: 'basis', bild: 'control',
    titel: 'Control und Kurzbefehle',
    text: 'Rechts unter der Kopfzeile sitzt „Control“. Antippen oder nach oben wischen öffnet die Kurzbefehle: Sprünge in häufige Module und das Umschalten der Darstellung.',
    punkte: [
      'Mit „Bearbeiten“ legst du fest, welche Kurzbefehle erscheinen.',
      'Ein Kurzbefehl öffnet nur das Modul; angelegt wird dabei noch nichts.',
      'Daneben tippen oder nach unten wischen schließt das Fenster.',
    ],
    imHub: true,
  },
  {
    id: 'profil', teil: 'basis', bild: 'profil',
    titel: 'Dein Profil',
    text: 'Oben rechts stehen deine Initialen. Dahinter findest du Name, Rolle und deinen Ausweis — und dort meldest du dich ab.',
    punkte: [
      '„Zum Homebildschirm hinzufügen“: Responda startet dann wie eine App.',
      'Dort findest du auch diese Einführung wieder.',
      'Beim Abmelden werden Kachelauswahl, Kurzbefehle und Darstellung auf diesem Gerät zurückgesetzt — und Protokolle, die dort noch auf die Übertragung warten, gehen verloren.',
    ],
    imHub: true,
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
    modul: 'lernbar',
  },
  {
    id: 'doku', teil: 'basis', bild: 'patienten',
    titel: 'Einsätze dokumentieren',
    text: 'Protokolle entstehen über die Seite deiner Organisation — ohne Anmeldung, auf jedem Gerät. Wer mit Konto in der Besatzung steht, findet das Protokoll danach in Unitas.',
    punkte: [
      'Die Reiter am Rand zeigen den Stand: rot fehlt in diesem Block ein Pflichtfeld, grün sind seine Pflichtfelder ausgefüllt.',
      'Nach dem Absenden bleibt ein Tag zum Ändern, dann ist das Protokoll eingereicht.',
      'Ohne Netz wartet das Protokoll auf dem Gerät und geht raus, sobald du die Dokumentation mit Netz wieder öffnest.',
    ],
    rechte: ['lernbar', 'patienten'],
    modul: 'patienten',
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
    text: 'Unter „Benutzer“ legst du die Mitglieder deiner Organisation an und bestimmst, welche Module sie nutzen dürfen. Beim ersten Login bekommen sie automatisch ihre Einführung.',
    punkte: [
      'Neuer Benutzer: Name und E-Mail. Er bekommt eine Willkommens-E-Mail und legt sein Passwort selbst fest.',
      'Die Rolle setzt Häkchen nach Vorlage, danach passt du sie einzeln an. Unter Benutzer → Rollen änderst du die Vorlagen und legst eigene Rollen für deine Organisation an, zum Beispiel „Gerätewart“.',
      'Zusatzrechte lassen sich befristet freigeben, von einer Stunde bis zu sieben Tagen.',
      '„Gesperrt“ einschalten sperrt die Anmeldung. Das ist besser als Löschen.',
    ],
    rechte: ['unitarii'],
  },
  {
    id: 'org-seite', teil: 'organisation', bild: 'organisation', module: ['dokumente', 'patienten'],
    titel: 'Die Seite deiner Organisation',
    text: 'Über die öffentliche Seite deiner Organisation dokumentieren und melden Einsatzkräfte ohne Anmeldung: Patientendokumentation, Produktausgabe, CIRS-Meldung und Defektmeldung.',
    punkte: [
      'Unter Vorgänge → Formulare schaltest du Patientendokumentation, Produktausgabe und CIRS-Meldung ein und aus und baust eigene Vorlagen.',
      'Unter Vorgänge → CIRS bearbeitest du eingegangene CIRS-Meldungen.',
    ],
    rechte: ['dokumente'],
    modul: 'dokumente',
  },
  {
    id: 'org-checkliste', teil: 'organisation', bild: 'checkliste',
    titel: 'Deine Checkliste',
    text: 'Erledigtes wird erkannt oder lässt sich abhaken. „Öffnen“ bringt dich direkt an die richtige Stelle.',
    hinweis: 'Die Checkliste findest du jederzeit wieder in der Einführung.',
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
  const darf = (s: EinfSchritt) => (!s.rechte || s.rechte.some((r) => hatRecht(user, r))) && (!s.imHub || !nurLernbar(user))
    && (!s.modul || modulFrei(user.organization, s.modul))
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

/**
 * EKS lässt nur mit dem dauerhaften Recht hinein (EksAuswahl.tsx) — ein befristetes
 * zeigt zwar die Kachel, öffnet die Seite aber nicht. Der Überblick verspricht deshalb
 * nur, was auch aufgeht. Die Benutzerverwaltung öffnet auch befristet (Unitarii.tsx,
 * hatRecht), wie die users-Regeln auf dem Server.
 */
const NUR_DAUERHAFT = new Set(['eks'])

export function meineModule(user: User) {
  return MODULE.filter((m) => appFrei(user.organization, m.id) && (NUR_DAUERHAFT.has(m.recht)
    ? user.supervisor === true || user.permissions?.[m.recht] === true
    : hatRecht(user, m.recht)))
}

// ── Checkliste "Organisation einrichten" ────────────────────────────────────

/** Was sich automatisch feststellen lässt. Fehlt ein Befund, bleibt der Punkt zum Abhaken. */
export type Befund = 'benutzer' | 'rechte' | 'eks' | 'formulare' | 'cirs'
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
  /** Nur, wenn dieses Modul für die Organisation freigeschaltet ist. */
  modul?: string
}

export const CHECKLISTE: Punkt[] = [
  {
    id: 'benutzer', titel: 'Mitglieder anlegen', befund: 'benutzer', recht: 'unitarii', pfad: '/unitarii',
    text: 'Lege die Benutzer deiner Organisation an. Das Passwort gibst du ihnen selbst weiter — in der Benutzerverwaltung verschickt Responda beim Anlegen keine E-Mail.',
  },
  {
    id: 'vorlagen', titel: 'Rollen-Vorlagen anpassen', befund: 'rechte', recht: 'unitarii', pfad: '/unitarii?tab=rollen',
    text: 'Lege unter Benutzer → Rollen fest, welche Rechte jede Rolle beim Anlegen vorschlägt. Passt keine, legst du dort eine eigene Rolle an. Das spart Häkchen und hält die Rechte einheitlich.',
  },
  {
    id: 'eks', titel: 'Einsatzführung (EKS) freigeben', befund: 'eks', recht: 'unitarii', pfad: '/unitarii', modul: 'eks',
    text: 'Das Recht für die Einsatzführung steckt in keiner der vorgegebenen Rollen-Vorlagen. Wenn ihr EKS nutzt, vergib es einzeln an die, die Einsätze führen.',
  },
  {
    id: 'formulare', titel: 'Formulare der Seite festlegen', befund: 'formulare', recht: 'dokumente', pfad: '/vorgaenge', modul: 'dokumente',
    text: 'Schalte unter Vorgänge → Formulare Patientendokumentation, Produktausgabe und CIRS-Meldung für die Seite deiner Organisation ein oder aus. Eigene Vorlagen kannst du dort ergänzen.',
  },
  {
    id: 'seite', titel: 'Seite der Organisation weitergeben', pfad: '/:org',
    text: 'Über die Seite deiner Organisation erreichen alle ohne Anmeldung Patientendokumentation, CIRS-Meldung und eure weiteren Formulare. Gib die Adresse an alle weiter, die dokumentieren oder melden.',
  },
  {
    id: 'cirs', titel: 'CIRS-Bearbeitung klären', befund: 'cirs', recht: 'unitarii', pfad: '/unitarii', modul: 'dokumente',
    text: 'CIRS-Meldungen sieht nur, wer das Recht für Vorgänge hat. Vergib es an die Personen, die Meldungen bewerten; die Zuständigkeit legt ihr dann je Meldung fest.',
  },
  {
    id: 'app', titel: 'Responda auf die Telefone', pfad: '/app',
    text: 'Unter app.responda.systems/app steht für iPhone und Android, wie Responda auf den Startbildschirm kommt — am Computer zeigt die Seite einen Code zum Scannen mit dem Telefon. Schick den Link an deine Mitglieder.',
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
