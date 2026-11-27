// Bild „ausbildungen“: Ausbildungen (/ausbildungen) der Feuerwehr Musterstadt am 19.11.2026, 09:41, Reiter
// Termine: die anstehenden Termine nach Monat, je mit Teilnehmenden (x/y TN), Dokumenten und Lernmodulen;
// der heutige Abend „Sanitätsausbildung Modul 2“ ist der nächste. Vergangene Termine sind abgeschlossen und
// stehen im Archiv (Zahl am Reiter).
// Dieselben Termine, Module und Teilnahmen nutzen lernbar.mjs (Lernbar von Lena Berger) und unitas.mjs (Zahl am
// Reiter Lernbar): ausbildungsDaten() unten baut sie für alle drei Bilder gleich.
// Nur erfundene Daten: erfundene Feuerwehr, erfundene Personen, keine Patientendaten, keine Markennamen.

// Ortszeit -> PocketBase-Zeit in UTC (bis 24.10.2026 Sommerzeit, UTC+2, danach MEZ, UTC+1)
export const pb = (tag, hm) => new Date(`${tag}T${hm}:00${tag < '2026-10-25' ? '+02:00' : '+01:00'}`).toISOString().replace('T', ' ')

// Erfundene Personen der Feuerwehr Musterstadt (die ersten wie in den übrigen Bildern); Rolle wie in users.role
export const PERSONEN = [
  ['lenaberger00001', 'Lena Berger', 'admin'],
  ['maxmustermann01', 'Max Mustermann', 'benutzer'],
  ['annabeispiel001', 'Anna Beispiel', 'benutzer'],
  ['murataksoy00001', 'Murat Aksoy', 'benutzer'],
  ['saralindner0001', 'Sara Lindner', 'benutzer'],
  ['jonaskeller0001', 'Jonas Keller', 'benutzer'],
  ['danielroth00001', 'Daniel Roth', 'benutzer'],
  ['tobiashahn00001', 'Tobias Hahn', 'benutzer'],
  ['katrinschulz001', 'Katrin Schulz', 'benutzer'],
  ['felixneumann001', 'Felix Neumann', 'benutzer'],
  ['ninahoffmann001', 'Nina Hoffmann', 'benutzer'],
  ['paulrichter0001', 'Paul Richter', 'benutzer'],
  ['laurawagner0001', 'Laura Wagner', 'benutzer'],
  ['emreyilmaz00001', 'Emre Yilmaz', 'benutzer'],
  ['sophiekrueger01', 'Sophie Krüger', 'benutzer'],
  // In der Grundausbildung, nur mit Zugang zur Lernbar
  ['janbecker000001', 'Jan Becker', 'teilnehmer'],
  ['miaschroeder001', 'Mia Schröder', 'teilnehmer'],
  ['benfischer00001', 'Ben Fischer', 'teilnehmer'],
  ['leonievogel0001', 'Leonie Vogel', 'teilnehmer'],
]

const SCHULUNGSRAUM = 'Schulungsraum Feuerwache Musterstadt'

/**
 * Die Termine. tn: Anzahl der Eingeladenen; lena: Antwort von Lena Berger (fehlt: nicht eingeladen);
 * module/dokumente: verknüpfte Lernmodule und Unterlagen.
 */
export const TERMINE_PLAN = [
  // Abgeschlossen (Archiv)
  { id: 'ausbtermabsi010', name: 'Absturzsicherung', tag: '2026-10-10', von: '09:00', bis: '13:00', ort: 'Übungsgelände Feuerwache', dozent: 'Max Mustermann', max: 12, tn: 11, status: 'abgeschlossen' },
  { id: 'ausbtermhyg1022', name: 'Hygiene im Einsatz', tag: '2026-10-22', von: '19:00', bis: '21:00', ort: SCHULUNGSRAUM, dozent: 'Sara Lindner', max: 24, tn: 18, status: 'abgeschlossen', lena: 'zugesagt', module: ['ausbmodhygiene1'] },
  { id: 'ausbtermsan1105', name: 'Sanitätsausbildung Modul 1', tag: '2026-11-05', von: '19:00', bis: '22:00', ort: SCHULUNGSRAUM, dozent: 'Anna Beispiel', max: 16, tn: 14, status: 'abgeschlossen', lena: 'zugesagt', module: ['ausbmodhlw00001'] },
  // Anstehend
  { id: 'ausbtermsan2119', name: 'Sanitätsausbildung Modul 2', tag: '2026-11-19', von: '19:00', bis: '22:00', ort: SCHULUNGSRAUM, dozent: 'Anna Beispiel', max: 16, tn: 14, status: 'geplant', lena: 'zugesagt',
    module: ['ausbmodxabcde01', 'ausbmodrauchgas'], dokumente: [['Skript Modul 2: Ersteinschätzung', 'teilnehmer'], ['Ablaufplan und Fallbeispiele', 'dozent']],
    beschreibung: 'Ersteinschätzung nach xABCDE, Rauchgasinhalation, Übergabe an den Rettungsdienst. Fallbeispiele in Kleingruppen.' },
  { id: 'ausbtermatem126', name: 'Atemschutz-Unterweisung', tag: '2026-11-26', von: '19:00', bis: '21:30', ort: 'Atemschutzübungsstrecke Feuerwache', dozent: 'Murat Aksoy', max: 12, tn: 12, status: 'geplant', lena: 'zugesagt',
    module: ['ausbmodatemsch1'], dokumente: [['Unterweisung Atemschutz 2026', 'teilnehmer']],
    beschreibung: 'Jährliche Unterweisung der Atemschutzgeräteträger mit Belastungsübung auf der Strecke.' },
  { id: 'ausbtermehilf28', name: 'Erste-Hilfe-Auffrischung', tag: '2026-11-28', von: '09:00', bis: '16:00', ort: SCHULUNGSRAUM, dozent: 'Sara Lindner', max: 20, tn: 9, status: 'geplant', lena: 'eingeladen',
    module: ['ausbmodhlw00001'], beschreibung: 'Neun Unterrichtseinheiten, Wiederbelebung mit AED, Wundversorgung, stabile Seitenlage.' },
  { id: 'ausbtermfunk123', name: 'Sprechfunk-Übung', tag: '2026-12-03', von: '19:00', bis: '21:00', ort: 'Fahrzeughalle Feuerwache', dozent: 'Max Mustermann', max: 24, tn: 15, status: 'geplant',
    module: ['ausbmodfunk0001'], dokumente: [['Funkrufnamen und Kanäle', 'teilnehmer']] },
  { id: 'ausbtermsan3210', name: 'Sanitätsausbildung Modul 3', tag: '2026-12-10', von: '19:00', bis: '22:00', ort: SCHULUNGSRAUM, dozent: 'Anna Beispiel', max: 16, tn: 13, status: 'geplant', lena: 'eingeladen',
    beschreibung: 'Trauma und Blutungskontrolle, Immobilisation, Zusammenarbeit mit dem Rettungsdienst.' },
  { id: 'ausbtermuvv0114', name: 'Jahresunterweisung Unfallverhütung', tag: '2027-01-14', von: '19:00', bis: '20:30', ort: SCHULUNGSRAUM, dozent: 'Lena Berger', max: 40, tn: 31, status: 'geplant' },
]

/** Die Lernmodule. Lena: Fortschritt von Lena Berger (fehlt: nicht zugewiesen); fertig: abgeschlossen am. */
export const MODULE_PLAN = [
  { id: 'ausbmodxabcde01', name: 'Ersteinschätzung nach xABCDE', beschreibung: 'Schritt für Schritt vom ersten Eindruck bis zur Übergabe', dauer: 25,
    bloecke: ['Der erste Eindruck', 'x: kritische Blutung', 'A und B: Atemwege und Atmung', 'C: Kreislauf', 'D und E: Bewusstsein und Umgebung', 'Quiz'], lena: { fertig: ['2026-11-12', '20:14'] } },
  { id: 'ausbmodrauchgas', name: 'Rauchgasinhalation erkennen', beschreibung: 'Anzeichen, CO-Messung und Maßnahmen bis zum Rettungsdienst', dauer: 15,
    bloecke: ['Was im Brandrauch steckt', 'Anzeichen beim Patienten', 'CO-Messung', 'Maßnahmen', 'Quiz'], lena: { prozent: 0 } },
  { id: 'ausbmodatemsch1', name: 'Atemschutz: Einsatzgrundsätze', beschreibung: 'Atemschutzüberwachung, Rückzugsweg, Notfallmeldung', dauer: 20,
    bloecke: ['Vor dem Einsatz', 'Atemschutzüberwachung', 'Rückzug und Notfall', 'Quiz'], lena: { prozent: 50 } },
  { id: 'ausbmodhlw00001', name: 'Wiederbelebung mit AED', beschreibung: 'Herzdruckmassage, Beatmung und Defibrillation im Team', dauer: 30,
    bloecke: ['Kreislaufstillstand erkennen', 'Herzdruckmassage', 'Beatmung', 'AED im Team', 'Quiz'], lena: { fertig: ['2026-11-02', '21:05'] } },
  { id: 'ausbmodhygiene1', name: 'Hygiene im Einsatz', beschreibung: 'Schwarz-Weiß-Trennung, Desinfektion, Schutzausrüstung', dauer: 15,
    bloecke: ['Schwarz-Weiß-Trennung', 'Händedesinfektion', 'Fahrzeug nach dem Einsatz', 'Quiz'], lena: { fertig: ['2026-10-20', '19:40'] } },
  { id: 'ausbmodfunk0001', name: 'Sprechfunk: Gesprächsdisziplin', beschreibung: 'Rufnamen, Meldungen, Lagemeldung nach Schema', dauer: 20,
    bloecke: ['Rufnamen und Gesprächsaufbau', 'Lagemeldung', 'Quiz'] },
]

/** Alle Datensätze der Ausbildung für die Organisation; dieselben in ausbildungen, lernbar und unitas. */
export function ausbildungsDaten(ORG, USER) {
  const termine = TERMINE_PLAN.map((t) => ({
    id: t.id, collectionId: 'pbc_ausbildungen_termine', collectionName: 'ausbildungen_termine',
    name: t.name, description: t.beschreibung || '', start_datetime: pb(t.tag, t.von), end_datetime: pb(t.tag, t.bis),
    location: t.ort, dozent: t.dozent, dozent_id: (PERSONEN.find((p) => p[1] === t.dozent) || [''])[0], max_teilnehmer: t.max,
    status: t.status, konzept_id: '', notizen: '', einladung_token: '', lernkonzept: '', teilnehmer_info: '',
    dateien: [], anhang: [], dozent_todos: '', co_dozenten: '', dozent_aufgaben: '', dateien_links: '', anhang_links: '',
    dateien_names: '', anhang_names: '', organization_id: ORG.id, organisation_id: ORG.id,
    created: pb('2026-09-15', '20:00'), updated: pb('2026-11-12', '18:00'),
  }))

  // Eingeladene: der Reihe nach aus den Personen ohne Dozentin bzw. Dozent; Lena Berger nur, wo sie geantwortet hat
  const teilnahmen = []
  TERMINE_PLAN.forEach((t, ti) => {
    const andere = PERSONEN.filter((p) => p[1] !== t.dozent && p[0] !== USER.id)
    const reihe = [...andere.slice(ti % andere.length), ...andere.slice(0, ti % andere.length)]
    const wer = t.lena ? [[USER.id, USER.name], ...reihe.slice(0, t.tn - 1)] : reihe.slice(0, t.tn)
    wer.forEach(([id], i) => {
      const status = id === USER.id ? t.lena
        : t.status === 'abgeschlossen' ? 'zugesagt'
          : i % 7 === 3 ? 'eingeladen' : i % 11 === 5 ? 'abgesagt' : 'zugesagt'
      teilnahmen.push({
        id: `tu${t.id.slice(-6)}${String(i).padStart(7, '0')}`, collectionId: 'pbc_ausbildungen_termine_user', collectionName: 'ausbildungen_termine_user',
        termin_id: t.id, teilnehmer_id: id, status, eingeladen_am: pb('2026-10-01', '19:00'), eingeladen_via: 'email',
        anwesend: t.status === 'abgeschlossen', anwesenheit_status: t.status === 'abgeschlossen' ? 'da' : '', notizen: '',
        organization_id: ORG.id, created: pb('2026-10-01', '19:00'), updated: pb('2026-11-12', '18:00'),
      })
    })
  })

  const dokumente = []
  TERMINE_PLAN.forEach((t) => (t.dokumente || []).forEach(([name, typ], i) => dokumente.push({
    id: `dok${t.id.slice(-6)}${String(i).padStart(6, '0')}`, collectionId: 'pbc_ausbildungen_dokumente', collectionName: 'ausbildungen_dokumente',
    termin_id: t.id, name, typ, datei: '', beschreibung: '', organization_id: ORG.id,
    created: pb('2026-11-10', '21:00'), updated: pb('2026-11-10', '21:00'),
  })))

  const module = MODULE_PLAN.map((m) => ({
    id: m.id, collectionId: 'pbc_ausbildungen_module', collectionName: 'ausbildungen_module',
    name: m.name, beschreibung: m.beschreibung, dauer_minuten: m.dauer, min_pass_percent: 80,
    inhalte: m.bloecke.map((titel, i) => ({ typ: titel === 'Quiz' ? 'quiz' : 'text', titel, inhalt: '', reihenfolge: i })),
    organization_id: ORG.id, created: pb('2026-09-20', '20:00'), updated: pb('2026-10-05', '20:00'),
  }))

  const modulTermine = []
  TERMINE_PLAN.forEach((t) => (t.module || []).forEach((modulId, i) => modulTermine.push({
    id: `mt${t.id.slice(-6)}${String(i).padStart(7, '0')}`, collectionId: 'pbc_ausbildungen_module_termine', collectionName: 'ausbildungen_module_termine',
    modul_id: modulId, termin_id: t.id, pflicht: true, frist_datum: pb(t.tag, '18:00'), organization_id: ORG.id,
    expand: { modul_id: module.find((m) => m.id === modulId) },
    created: pb('2026-10-01', '19:00'), updated: pb('2026-10-01', '19:00'),
  })))

  // Fortschritt: Lena Berger wie geplant, dazu die übrigen Teilnehmenden der verknüpften Termine (Zahlen in der Modulansicht)
  const fortschritt = []
  MODULE_PLAN.forEach((m) => {
    if (m.lena) {
      fortschritt.push({
        id: `mp${m.id.slice(-6)}lena001`, collectionId: 'pbc_ausbildungen_module_progress', collectionName: 'ausbildungen_module_progress',
        modul_id: m.id, teilnehmer_id: USER.id, termin_id: '', fortschritt_prozent: m.lena.fertig ? 100 : m.lena.prozent,
        gestartet_am: m.lena.prozent === 0 ? '' : pb('2026-10-15', '20:00'), abgeschlossen_am: m.lena.fertig ? pb(...m.lena.fertig) : '',
        notizen: '', organization_id: ORG.id, created: pb('2026-10-01', '19:00'), updated: pb('2026-11-12', '20:14'),
      })
    }
    const andere = teilnahmen.filter((x) => x.teilnehmer_id !== USER.id && modulTermine.some((mt) => mt.modul_id === m.id && mt.termin_id === x.termin_id))
    const gesehen = new Set()
    andere.forEach((x, i) => {
      if (gesehen.has(x.teilnehmer_id)) return
      gesehen.add(x.teilnehmer_id)
      const fertig = i % 3 !== 2
      fortschritt.push({
        id: `mp${m.id.slice(-6)}${String(i).padStart(7, '0')}`, collectionId: 'pbc_ausbildungen_module_progress', collectionName: 'ausbildungen_module_progress',
        modul_id: m.id, teilnehmer_id: x.teilnehmer_id, termin_id: x.termin_id, fortschritt_prozent: fertig ? 100 : 40,
        gestartet_am: pb('2026-10-20', '20:00'), abgeschlossen_am: fertig ? pb('2026-11-10', '20:30') : '',
        notizen: '', organization_id: ORG.id, created: pb('2026-10-01', '19:00'), updated: pb('2026-11-10', '20:30'),
      })
    })
  })

  const users = PERSONEN.map(([id, name, role]) => (id === USER.id ? USER : {
    id, collectionId: '_pb_users_auth_', collectionName: 'users', email: `${id}@kein-email.intern`, emailVisibility: false, verified: true,
    name, organization_id: ORG.id, organization_name: ORG.org_name, role, zusatzrollen: [], supervisor: false,
    contact_email: '', phone: '', whatsapp: '', notizen: '', ausbildung_typ: role === 'teilnehmer' ? 'Grundausbildung' : '',
    permissions: role === 'teilnehmer' ? { lernbar: true } : { dashboard: true, lernbar: true }, disabled: false,
    created: pb('2025-03-01', '10:00'), updated: pb('2026-11-01', '10:00'),
  }))

  return { termine, teilnahmen, dokumente, module, modulTermine, fortschritt, users }
}

const SAMMLUNGEN = {}
const KONZEPTE = []

function aufbauen({ ORG, USER }) {
  const d = ausbildungsDaten(ORG, USER)
  Object.assign(SAMMLUNGEN, {
    // Wie die Seite sie mit sort: '-start_datetime' vom Server bekommt
    ausbildungen_termine: [...d.termine].sort((a, b) => b.start_datetime.localeCompare(a.start_datetime)),
    ausbildungen_termine_user: d.teilnahmen,
    ausbildungen_dokumente: d.dokumente,
    ausbildungen_module: [...d.module].sort((a, b) => a.name.localeCompare(b.name, 'de')),
    ausbildungen_module_termine: d.modulTermine,
    ausbildungen_module_progress: d.fortschritt,
    ausbildungen_konzepte: KONZEPTE,
    ausbildungen_praesentationen: [],
    ausbildungen_einladungen: [],
    lernbar_beitraege: [],
    users: d.users,
  })
  KONZEPTE.push({
    id: 'ausbkonzeptsan1', collectionId: 'pbc_ausbildungen_konzepte', collectionName: 'ausbildungen_konzepte',
    name: 'Sanitätsausbildung Feuerwehr', beschreibung: 'Drei Abende für alle Einsatzkräfte: Patienten bis zum Eintreffen des Rettungsdienstes versorgen.',
    lernziele: ['Patienten nach xABCDE einschätzen', 'Lebensbedrohliche Zustände erkennen', 'Strukturiert an den Rettungsdienst übergeben'],
    handlungen: ['Ersteinschätzung im Team', 'Sauerstoffgabe', 'Blutungskontrolle'], koennen: ['Wiederbelebung mit AED'],
    wissensanhang_links: [], verknuepfte_module: ['ausbmodxabcde01', 'ausbmodrauchgas', 'ausbmodhlw00001'],
    verknuepfte_termine: ['ausbtermsan1105', 'ausbtermsan2119', 'ausbtermsan3210'],
    organization_id: ORG.id, created: pb('2026-09-10', '20:00'), updated: pb('2026-09-10', '20:00'),
  })
}
import('../daten.mjs').then(aufbauen)

export const bild = {
  name: 'ausbildungen',
  pfad: '/ausbildungen',
  warte: 1500,
  sammlungen: SAMMLUNGEN,
  routen: (methode, url) => {
    // Teilnehmende (role = "teilnehmer") filtert der Server; die Liste aller Konten der Organisation nicht
    if (methode === 'GET' && url.pathname === '/api/collections/users/records' && /role\s*=\s*"teilnehmer"/.test(url.searchParams.get('filter') || '')) {
      const items = (SAMMLUNGEN.users || []).filter((u) => u.role === 'teilnehmer')
      return { body: { page: 1, perPage: Number(url.searchParams.get('perPage') || 30), totalItems: items.length, totalPages: 1, items } }
    }
    return undefined
  },
}

/**
 * Antworten wie PocketBase für die Sicht einer Person (Lernbar, Unitas): Teilnahmen und Fortschritt nach
 * `teilnehmer_id = "…"`, Termine und Module nach `id = "…" || …`, Unterlagen für Teilnehmende nach Termin.
 * sammlungen: die Sammlungen des Bildes (gefüllt, sobald ausbildungsDaten gelaufen ist).
 */
export function personRouten(sammlungen) {
  const liste = (url, items) => ({ body: { page: 1, perPage: Number(url.searchParams.get('perPage') || 30), totalItems: items.length, totalPages: 1, items } })
  const werte = (filter, feld) => [...filter.matchAll(new RegExp(`(?:^|[^_a-z])${feld}\\s*=\\s*"([^"]+)"`, 'g'))].map((m) => m[1])
  return (methode, url) => {
    if (methode !== 'GET') return undefined
    const m = url.pathname.match(/^\/api\/collections\/(ausbildungen_[a-z_]+)\/records$/)
    if (!m) return undefined
    const filter = url.searchParams.get('filter') || ''
    const alle = sammlungen[m[1]] || []
    if (m[1] === 'ausbildungen_termine_user' || m[1] === 'ausbildungen_module_progress') {
      const wer = werte(filter, 'teilnehmer_id')
      return liste(url, wer.length ? alle.filter((x) => wer.includes(x.teilnehmer_id)) : alle)
    }
    if (m[1] === 'ausbildungen_termine' || m[1] === 'ausbildungen_module') {
      const ids = werte(filter, 'id')
      const items = ids.length ? alle.filter((x) => ids.includes(x.id)) : alle
      if (url.searchParams.get('sort') === 'start_datetime') items.sort((a, b) => a.start_datetime.localeCompare(b.start_datetime))
      return liste(url, items)
    }
    if (m[1] === 'ausbildungen_dokumente') {
      const ids = werte(filter, 'termin_id')
      const typ = werte(filter, 'typ')[0]
      return liste(url, alle.filter((x) => (!ids.length || ids.includes(x.termin_id)) && (!typ || x.typ === typ)))
    }
    return undefined
  }
}
