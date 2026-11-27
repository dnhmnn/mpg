// Bild „vorgaenge“: Vorgänge und CIRS (/vorgaenge) der Feuerwehr Musterstadt am 19.11.2026, angemeldet als Leitung
// Lena Berger (Recht Vorgänge, darf die Formulare einstellen). Reiter Formulare: die vier Standardformulare (Vorgaben
// der Absender, alle öffentlich, CIRS anonym), darunter die eigenen Formulare der Wache mit der Zahl neuer
// Einsendungen, ein archiviertes eingeklappt (darunter, nicht mehr im Bild, die Seite der Organisation). Am Reiter
// Eingang die neuen
// Einsendungen, am Reiter CIRS die neue Meldung zur Absaugpumpe des HLF 20/1 aus dem erfundenen Einsatz E-2026-0417
// (dieselbe Kennung und dieselben Angaben wie in einsaetze.mjs; der Defekt steht in mpg.mjs).
//
// Wie die Seite lädt (src/pages/Vorgaenge.tsx, src/pages/vorgaenge/): Vorlagen aus form_templates (Titel, aktiv,
// Absender, archiviert), Zahlen aus form_submissions gefiltert nach `status = "neu"`; darum beantwortet routen die
// Liste der Einsendungen selbst. CIRS aus cirs_reports, die Bearbeitung steht in payload.bearbeitung und zählt nur,
// wenn der Datensatz nach dem Anlegen geändert wurde (updated später als created).
// Nur erfundene Daten: erfundene Feuerwehr, erfundene Personen, keine Angaben zu Patienten, Musterstadt.

// ORG und USER kommen aus '../daten.mjs', nachgeladen wie in mpg.mjs (ein statischer Import hinge im Kreis fest).
const VORLAGEN = []
const EINSENDUNGEN = []
const CIRS = []
const BENUTZER = []

// Ortszeit -> PocketBase-Zeit in UTC (bis 24.10.2026 Sommerzeit, UTC+2, danach MEZ, UTC+1)
const pb = (tag, hm) => new Date(`${tag}T${hm}:00${tag < '2026-10-25' ? '+02:00' : '+01:00'}`).toISOString().replace('T', ' ')
const iso = (tag, hm) => pb(tag, hm).replace(' ', 'T')

// Erfundene Personen der Feuerwehr Musterstadt (dieselben wie in den übrigen Bildern)
const P = {
  lena: { id: 'lenaberger00001', name: 'Lena Berger' },
  murat: { id: 'murataksoy00001', name: 'Murat Aksoy' },
  sara: { id: 'saralindner0001', name: 'Sara Lindner' },
  max: { id: 'maxmustermann01', name: 'Max Mustermann' },
  anna: { id: 'annabeispiel001', name: 'Anna Beispiel' },
}

function aufbauen({ ORG, USER }) {
  // Alle Konten der Wache (die CIRS-Verwaltung bietet sie als zuständig an)
  BENUTZER.push(USER, ...[P.murat, P.sara, P.max, P.anna].map((p) => ({
    ...USER, id: p.id, name: p.name, email: `${p.id}@example.org`, role: 'mitglied', permissions: {}, hub_apps: null,
  })))

  // Eigene Formulare der Wache (form_templates); die Felder braucht die Liste nicht
  const vorlage = (id, title, absender, seit, o = {}) => ({
    id, collectionId: 'pbc_form_templates', collectionName: 'form_templates', organization_id: ORG.id,
    title, absender, is_active: o.aktiv ?? true, archiviert: o.archiviert ?? false, version: o.version ?? 1,
    created: pb(seit, '20:15'), updated: pb(o.geaendert ?? seit, '20:15'),
  })
  VORLAGEN.push(
    vorlage('formdienstbef01', 'Antrag auf Dienstbefreiung', 'passwort', '2026-02-10', { version: 2, geaendert: '2026-06-03' }),
    vorlage('formatemschutz1', 'Atemschutz: Einsatzzeit nachtragen', 'passwort', '2026-03-04'),
    vorlage('formkleiderk001', 'Kleiderkammer: Bestellung', 'passwort', '2026-04-21'),
    vorlage('formschutzkl001', 'Schaden an Schutzkleidung', 'frei', '2026-03-04'),
    vorlage('formvorschlag01', 'Verbesserungsvorschlag', 'anonym', '2026-05-12'),
    vorlage('formsommerfest1', 'Helfer für das Sommerfest', 'passwort', '2026-05-30', { aktiv: false, archiviert: true, geaendert: '2026-07-20' }),
  )

  // Einsendungen (form_submissions): nur Kennung, Vorlage, Status und Eingang zählen in der Liste
  let n = 0
  const einsendung = (vorlageId, status, tag, hm) => ({
    id: `einsendung${String(++n).padStart(5, '0')}`, collectionId: 'pbc_form_submissions', collectionName: 'form_submissions',
    template_id: vorlageId, organization_id: ORG.id, status, notiz: '', payload: {},
    created: pb(tag, hm), updated: pb(tag, hm),
  })
  EINSENDUNGEN.push(
    // Nach dem Wohnungsbrand: Atemschutz nachtragen, eine angesengte Überjacke
    einsendung('formatemschutz1', 'neu', '2026-11-19', '09:36'),
    einsendung('formatemschutz1', 'neu', '2026-11-19', '09:33'),
    einsendung('formschutzkl001', 'neu', '2026-11-19', '09:30'),
    einsendung('formdienstbef01', 'neu', '2026-11-18', '18:42'),
    einsendung('formkleiderk001', 'in_bearbeitung', '2026-11-16', '20:05'),
    einsendung('formatemschutz1', 'in_bearbeitung', '2026-11-13', '10:10'),
    einsendung('formdienstbef01', 'erledigt', '2026-11-04', '07:58'),
    einsendung('formschutzkl001', 'erledigt', '2026-10-28', '21:14'),
    einsendung('formdienstbef01', 'erledigt', '2026-10-12', '16:20'),
    einsendung('formsommerfest1', 'erledigt', '2026-06-14', '19:02'),
    einsendung('formsommerfest1', 'erledigt', '2026-06-11', '12:47'),
  )

  // CIRS-Meldungen (cirs_reports), neueste zuerst wie mit sort: '-created'. Nur Ereignisse, nie Angaben zu Patienten.
  const meldung = (o) => {
    const angelegt = pb(o.tag, o.hm)
    const geaendert = o.bearbeitung ? pb(o.geaendertTag, o.geaendertHm) : angelegt
    return {
      id: o.id, collectionId: 'pbc_cirs_reports', collectionName: 'cirs_reports', title: 'CIRS-Meldung',
      status: o.bearbeitung && ['abgeschlossen', 'kein_handlungsbedarf'].includes(o.bearbeitung.phase) ? 'erledigt' : 'offen',
      organization_id: ORG.id, einsatz_id: o.einsatz || '',
      payload: { ...o.meldung, ...(o.bearbeitung ? { bearbeitung: { v: 1, bewertung: {}, massnahmen: [], verlauf: [], abschluss: null, zustaendig: null, frist: null, ...o.bearbeitung } } : {}) },
      created: angelegt, updated: geaendert,
    }
  }
  const schritt = (id, tag, hm, von, art, text) => ({ id, am: iso(tag, hm), von, art, text })
  CIRS.push(
    // Dieselbe Meldung wie in einsaetze.mjs: neu, noch niemand zuständig
    meldung({
      id: 'q7m2x9ka4tb1c3d', tag: '2026-11-19', hm: '10:24', einsatz: 'einsatz00000417',
      meldung: {
        datum: '2026-11-19', ort: 'Einsatzstelle, HLF 20/1', kategorie: 'material', schwere: 'mittel',
        was: 'Die Absaugpumpe des HLF 20/1 baute keinen Unterdruck auf. Absaugung vom Rettungsdienst übernommen.',
        warum: 'Bei der Wochenprüfung am Montag lief sie noch. Akku oder Dichtung?',
        vorschlag: 'Zweite Absaugung im Fahrzeug oder Prüfung mit Probelauf unter Last.',
      },
    }),
    // In Bewertung bei Murat Aksoy, Frist in einer Woche
    meldung({
      id: 'h3t8w1pz6nr2v5e', tag: '2026-11-08', hm: '21:40', geaendertTag: '2026-11-10', geaendertHm: '19:05',
      meldung: {
        datum: '2026-11-08', ort: 'Übungsgelände Feuerwache', kategorie: 'einsatz', schwere: 'hoch',
        was: 'Bei der Atemschutzübung stand die Überwachungstafel ohne Uhr. Die Rückzugszeit wurde geschätzt.',
        vorschlag: 'Uhr fest an der Tafel anbringen.',
      },
      bearbeitung: {
        phase: 'bewertung', zustaendig: P.murat, frist: '2026-11-26',
        bewertung: { haeufigkeit: 'gelegentlich' },
        verlauf: [
          schritt('v1108a', '2026-11-10', '19:03', P.lena.name, 'zustaendig', 'Zuständig: Murat Aksoy'),
          schritt('v1108b', '2026-11-10', '19:05', P.lena.name, 'frist', 'Frist: 26.11.2026'),
        ],
      },
    }),
    // Maßnahmen laufen, eine von zwei erledigt
    meldung({
      id: 'b9c4e7jy2ms5k1f', tag: '2026-11-02', hm: '22:15', geaendertTag: '2026-11-12', geaendertHm: '20:30',
      meldung: {
        datum: '2026-11-02', ort: 'Einsatz Industriestraße', kategorie: 'kommunikation', schwere: 'mittel',
        was: 'Zwei Fahrzeuge meldeten sich im Funk mit demselben Rufnamen. Rückfragen der Leitstelle kosteten Zeit.',
      },
      bearbeitung: {
        phase: 'massnahmen', zustaendig: P.lena, frist: '2026-11-30',
        bewertung: { haeufigkeit: 'einmalig' },
        massnahmen: [
          { id: 'm1102a', text: 'Rufnamen an den Fahrzeugen neu beschriften', verantwortlich: 'Max Mustermann', frist: '2026-11-15', erledigtAm: iso('2026-11-12', '20:28'), erledigtVon: P.lena.name, angelegtAm: iso('2026-11-05', '19:10'), angelegtVon: P.lena.name },
          { id: 'm1102b', text: 'Sprechfunk-Übung für alle Gruppen', verantwortlich: 'Max Mustermann', frist: '2026-12-03', angelegtAm: iso('2026-11-05', '19:12'), angelegtVon: P.lena.name },
        ],
      },
    }),
    // Abgeschlossen
    meldung({
      id: 'u5n1d8rv3gq6w2a', tag: '2026-10-14', hm: '18:50', geaendertTag: '2026-10-29', geaendertHm: '19:40',
      meldung: {
        datum: '2026-10-14', ort: 'Fahrzeughalle', kategorie: 'fahrzeug', schwere: 'gering',
        was: 'Rückfahrkamera des LF 10/2 zeigte beim Rangieren kein Bild.',
      },
      bearbeitung: {
        phase: 'abgeschlossen', zustaendig: P.max,
        abschluss: { am: iso('2026-10-29', '19:40'), von: P.max.name, text: 'Stecker der Kamera getauscht, Einweiser beim Rückwärtsfahren bleibt Pflicht.' },
      },
    }),
  )
}
import('../daten.mjs').then(aufbauen)

/** Wie PocketBase: Einsendungen nach Status und Vorlage gefiltert (nur was die Seite fragt). */
function einsendungenListe(url) {
  const filter = url.searchParams.get('filter') || ''
  let items = EINSENDUNGEN
  if (/status\s*=\s*"neu"/.test(filter)) items = items.filter((e) => e.status === 'neu' || e.status === '')
  // Eine oder mehrere Vorlagen (`template_id = '…' || template_id = '…'`)
  const vorlagen = [...filter.matchAll(/template_id\s*=\s*['"]([a-z0-9]+)['"]/g)].map((m) => m[1])
  if (vorlagen.length) items = items.filter((e) => vorlagen.includes(e.template_id))
  const perPage = Number(url.searchParams.get('perPage') || 30)
  return { body: { page: 1, perPage, totalItems: items.length, totalPages: 1, items: items.slice(0, perPage) } }
}

const sammlungen = {
  users: BENUTZER,
  form_templates: VORLAGEN,
  form_submissions: EINSENDUNGEN,
  cirs_reports: CIRS,
}
const routen = (methode, url) => {
  if (methode === 'GET' && url.pathname === '/api/collections/form_submissions/records') return einsendungenListe(url)
  return undefined
}

// Reiter Formulare: zeigt am meisten von dem, was die Website dazu sagt (eigene Formulare und Anträge, CIRS anonym,
// öffentlich über Link). Die Reiter Eingang und CIRS (?tab=eingang, ?tab=cirs) laden mit denselben Daten voll.
export const bild = { name: 'vorgaenge', pfad: '/vorgaenge', warte: 1400, sammlungen, routen }
