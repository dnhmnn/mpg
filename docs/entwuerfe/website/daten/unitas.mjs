// Bild „unitas“: Schritt Nachbereitung. Unitas (/unitas) für die angemeldete Lena Berger, Reiter Protokolle:
// oben „Wartet auf deine Unterschrift“ mit dem Protokoll der erfundenen Bewohnerin „Erika Mustermann“ aus dem
// erfundenen Einsatz E-2026-0417 (dieselbe Kennung wie in protokoll.mjs), darunter frühere Protokolle, in deren
// Besatzung Lena Berger steht. Die Neuigkeiten der Feuerwehr Musterstadt stehen im Reiter Übersicht (gleiche Daten).
// Nur erfundene Daten: erfundene Feuerwehr, erfundene Personen, Musterstadt, Platzhalternamen für Patienten.
//
// Wie die Karte zustande kommt (src/pages/Unitas.tsx): Die Liste „Wartet auf deine Unterschrift“ holt die App über
// GET /api/responda/formular/unterschriften (offeneUnterschriften, src/lib/formular/api.ts); der Server gibt dort
// die Protokolle, deren Absender ausstehend und mit dieser Person verknüpft ist (formular.pb.js). Solange die
// Unterschrift aussteht, zählt das Protokoll nicht zu den eigenen (istMeinProtokoll), steht also nur oben.

// ORG und USER kommen aus '../daten.mjs', nachgeladen wie in eks.mjs (ein statischer Import hinge im Kreis fest).
const PATIENTS = []
const NEUIGKEITEN = []
const TERMINE = []
const TERMIN_USER = []
const EINTRAEGE = []

const PROTOKOLL_ID = 'protokollerika1'

// Ortszeit (ab 25.10. MEZ, UTC+1) -> PocketBase-Zeit in UTC
const pb = (tag, hm, monat = '11') => new Date(`2026-${monat}-${tag}T${hm}:00+01:00`).toISOString().replace('T', ' ')
const iso = (tag, hm) => new Date(`2026-11-${tag}T${hm}:00+01:00`).toISOString()

function protokoll({ id, status, tag, hm, monat, werte, absender_status = '' }, ORG) {
  return {
    id, collectionId: 'pbc_patients', collectionName: 'patients',
    title: `Patientendoku: ${werte.vorname} ${werte.name}`, status, organization_id: ORG.id,
    payload: { protokoll_version: 2, ...werte }, absender_status,
    created: pb(tag, hm, monat), updated: pb(tag, hm, monat),
  }
}

function neuigkeit({ id, titel, inhalt, von, tag, hm, gepinnt = false }, ORG) {
  return {
    id, collectionId: 'pbc_unitas_neuigkeiten', collectionName: 'unitas_neuigkeiten',
    titel, inhalt, anhang: '', organisation_id: ORG.id, erstellt_von: von, gepinnt,
    created: pb(tag, hm), updated: pb(tag, hm),
  }
}

function aufbauen({ ORG, USER }) {
  const lena = { id: USER.id, name: USER.name }

  PATIENTS.push(
    // Erika Mustermann: abgesendet am Tablet im ELW unter dem Namen Lena Berger, wartet auf ihre Unterschrift
    protokoll({
      id: PROTOKOLL_ID, status: 'offen', tag: '19', hm: '09:39', absender_status: 'ausstehend',
      werte: {
        vorname: 'Erika', name: 'Mustermann', einsatz_nr: 'E-2026-0417', einsatz_datum: '2026-11-19', rufname: 'HLF 20/1',
        mannschaft_tf: 'Murat Aksoy', mannschaft_1: 'Sara Lindner',
        absender: { id: lena.id, name: lena.name, status: 'ausstehend', weg: 'formular', modus: 'frei', am: iso('19', '09:39') },
        abgesendet: iso('19', '09:39'), frist: new Date(Date.parse(iso('19', '09:39')) + 24 * 3600_000).toISOString(),
      },
    }, ORG),
    // Frühere Einsätze (einsaetze.mjs): Verkehrsunfall am 13.11. freigegeben, Türöffnung am 11.11. archiviert
    protokoll({
      id: 'protokollmax013', status: 'freigegeben', tag: '13', hm: '08:31',
      werte: {
        vorname: 'Max', name: 'Mustermann', einsatz_nr: 'E-2026-0414', einsatz_datum: '2026-11-13', rufname: 'HLF 20/1',
        mannschaft_tf: lena.name, mannschaft_1: 'Jonas Keller', mannschaft: { tf: lena, m1: { id: 'jonaskeller0001', name: 'Jonas Keller' } },
      },
    }, ORG),
    protokoll({
      id: 'protokolllies11', status: 'archiviert', tag: '11', hm: '22:58',
      werte: {
        vorname: 'Lieschen', name: 'Müller', einsatz_nr: 'E-2026-0413', einsatz_datum: '2026-11-11', rufname: 'HLF 20/1',
        mannschaft_tf: 'Daniel Roth', mannschaft_1: lena.name, mannschaft: { tf: { id: 'danielroth00001', name: 'Daniel Roth' }, m1: lena },
      },
    }, ORG),
    // Ein Einsatz aus dem Oktober, vor der Einsatzliste in einsaetze.mjs
    protokoll({
      id: 'protokollhans28', status: 'archiviert', monat: '10', tag: '28', hm: '18:20',
      werte: {
        vorname: 'Hans', name: 'Muster', einsatz_nr: 'E-2026-0398', einsatz_datum: '2026-10-28', rufname: 'HLF 20/1',
        mannschaft_tf: lena.name, mannschaft_1: 'Tobias Hahn', mannschaft: { tf: lena, m1: { id: 'tobiashahn00001', name: 'Tobias Hahn' } },
      },
    }, ORG),
  )

  // Was der Server unter /unterschriften meldet (unterschriftEintrag in formular-regeln.js)
  const erika = PATIENTS[0]
  EINTRAEGE.push({
    formular: 'patienten', id: erika.id, titel: erika.title, zusammenfassung: erika.title,
    angelegt: erika.created, absender_name: lena.name,
  })

  NEUIGKEITEN.push(
    neuigkeit({
      id: 'neuigkeitnach01', gepinnt: true, von: lena.name, tag: '19', hm: '09:40',
      titel: 'Nachbesprechung B3 Lindenweg 14',
      inhalt: 'Montag, 23.11., 19:30 Uhr im Schulungsraum. Alle Kräfte des Einsatzes bitte dabei sein. '
        + 'Protokolle und Produktausgaben bitte bis Freitag in Responda unterschreiben.',
    }, ORG),
    neuigkeit({
      id: 'neuigkeitatem02', von: 'Murat Aksoy', tag: '19', hm: '09:36',
      titel: 'Atemschutzgeräte zur Prüfung',
      inhalt: 'Die Geräte vom Einsatz gehen heute in die Atemschutzwerkstatt. Bis dahin sind auf dem HLF 20/1 die Reservegeräte verlastet.',
    }, ORG),
    neuigkeit({
      id: 'neuigkeitdien03', von: 'Katrin Schulz', tag: '16', hm: '18:05',
      titel: 'Dienstplan Dezember steht',
      inhalt: 'Übungsdienste jeden Montag, am 14.12. Jahresabschluss mit Fahrzeugpflege.',
    }, ORG),
  )

  // Ein anstehender Termin in der Lernbar (Zahl am Reiter)
  TERMINE.push({
    id: 'terminatemuebg1', collectionId: 'pbc_ausbildungen_termine', collectionName: 'ausbildungen_termine',
    name: 'Atemschutz-Belastungsübung', start_datetime: pb('26', '19:00'), status: 'geplant', organisation_id: ORG.id,
    created: pb('02', '10:00'), updated: pb('02', '10:00'),
  })
  TERMIN_USER.push({
    id: 'terminuserlena1', collectionId: 'pbc_ausbildungen_termine_user', collectionName: 'ausbildungen_termine_user',
    termin_id: 'terminatemuebg1', teilnehmer_id: USER.id, status: 'zugesagt',
    created: pb('02', '10:00'), updated: pb('02', '10:00'),
  })
}
import('../daten.mjs').then(aufbauen)

// Echtzeit (Unitas abonniert patients): Die erste Verbindung gelingt mit PB_CONNECT, sonst verwürfe das SDK das
// Abo mit einem unbehandelten Fehler. Spätere Verbindungsversuche werden abgebrochen (wie in einsaetze.mjs), das
// SDK versucht es dann still mit wachsendem Abstand weiter.
const CLIENT_ID = 'rtclientunitas1'
let verbindungen = 0
function echtzeit(methode) {
  if (methode === 'POST') return { body: {} }
  verbindungen++
  if (verbindungen > 1) return 'abbrechen'
  return { typ: 'text/event-stream', body: `id:${CLIENT_ID}\nevent:PB_CONNECT\ndata:${JSON.stringify({ clientId: CLIENT_ID })}\n\n` }
}

/** Wie PocketBase: die Liste der Protokolle nach `status = "…"` gefiltert (Unitas lädt offen, freigegeben, archiviert getrennt). */
function patientenListe(url) {
  const m = (url.searchParams.get('filter') || '').match(/status\s*=\s*"([a-z_]+)"/)
  const items = m ? PATIENTS.filter((p) => p.status === m[1]) : PATIENTS
  const perPage = Number(url.searchParams.get('perPage') || 30)
  return { body: { page: 1, perPage, totalItems: items.length, totalPages: 1, items } }
}

export const bild = {
  name: 'unitas',
  pfad: '/unitas',
  warte: 1200,
  sammlungen: {
    patients: PATIENTS,
    unitas_neuigkeiten: NEUIGKEITEN,
    ausbildungen_termine: TERMINE,
    ausbildungen_termine_user: TERMIN_USER,
  },
  routen: (methode, url) => {
    if (methode === 'GET' && url.pathname === '/api/responda/formular/unterschriften') return { body: { eintraege: EINTRAEGE } }
    if (methode === 'GET' && url.pathname === '/api/collections/patients/records') return patientenListe(url)
    if (url.pathname === '/api/realtime') return echtzeit(methode)
    return undefined
  },
  vorher: async (page) => {
    // Der Reiter Protokolle (wie ein Tipp auf die Zahl „Unterschriften“ in der Übersicht)
    await page.getByRole('button', { name: /Protokolle/ }).last().click()
    await page.waitForTimeout(600)
  },
}
