// Bild „patienten“: die Protokollverwaltung (/patienten) der Feuerwehr Musterstadt am 19.11.2026, 09:41, Reiter Dokus,
// angemeldet als Leitung Lena Berger. Oben „Zum Gegenzeichnen“ die freigegebenen Protokolle, darunter „Noch nicht
// freigegeben“ das der erfundenen Bewohnerin „Erika Mustermann“ aus dem erfundenen Einsatz E-2026-0417 (dieselbe
// Kennung und dieselben Angaben wie in protokoll.mjs und unitas.mjs), das noch auf die Unterschrift von Lena Berger
// wartet (abgesendet am Tablet im ELW unter ihrem Namen).
// - Martina Musterfrau (E-2026-0416, Tragehilfe, 17.11.): freigegeben, eine Rückfrage der Leitung ist offen, darum
//   lässt sich noch nicht gegenzeichnen (archivHindernis).
// - Max Mustermann (E-2026-0414, Verkehrsunfall, 13.11.): freigegeben wie in unitas.mjs, bereit zum Gegenzeichnen.
// Die Seite zeigt den Patienten als „Name Vorname“ (Patienten.tsx). Nur Platzhalternamen, keine echten Patientendaten.
// Wie die Seite lädt (src/pages/patienten/Patienten.tsx): offen und freigegeben getrennt über `status = "…"`, darum
// beantwortet routen die Liste der Protokolle selbst. Offene Protokolle über der Frist gäbe die Seite selbst frei;
// das der Bewohnerin wartet auf die Unterschrift und bleibt offen.
// Nur erfundene Daten: erfundene Feuerwehr, erfundene Personen, Musterstadt.

// ORG und USER kommen aus '../daten.mjs', nachgeladen wie in mpg.mjs (ein statischer Import hinge im Kreis fest).
const PATIENTS = []
const NACHERFASSUNGEN = []

// Ortszeit (ab 25.10. MEZ, UTC+1) -> PocketBase-Zeit in UTC bzw. ISO
const pb = (tag, hm) => new Date(`2026-11-${tag}T${hm}:00+01:00`).toISOString().replace('T', ' ')
const iso = (tag, hm) => new Date(`2026-11-${tag}T${hm}:00+01:00`).toISOString()

// Erfundene Personen der Feuerwehr Musterstadt (dieselben wie in den übrigen Bildern)
const P = {
  lena: { id: 'lenaberger00001', name: 'Lena Berger' },
  murat: { id: 'murataksoy00001', name: 'Murat Aksoy' },
  sara: { id: 'saralindner0001', name: 'Sara Lindner' },
  anna: { id: 'annabeispiel001', name: 'Anna Beispiel' },
  jonas: { id: 'jonaskeller0001', name: 'Jonas Keller' },
}

function protokoll({ id, status, tag, hm, werte, absender = null }, ORG) {
  const am = iso(tag, hm)
  return {
    id, collectionId: 'pbc_patients', collectionName: 'patients',
    title: `Patientendoku: ${werte.vorname} ${werte.name}`, status, organization_id: ORG.id,
    payload: {
      protokoll_version: 2, ...werte,
      ...(absender ? { absender: { ...absender, am } } : {}),
      abgesendet: am, frist: new Date(Date.parse(am) + 24 * 3600_000).toISOString(),
    },
    // Das Statusfeld setzt nur der Server; die App glaubt payload.absender nur, wenn beide gleich sind
    absender_status: absender ? absender.status : '',
    created: pb(tag, hm), updated: pb(tag, hm),
  }
}

/** Besatzung flach (Name im Ausdruck) und verschachtelt mit Kennung (Einsicht in Unitas), wie besatzungSetzen. */
const besatzung = (tf, m1) => ({ mannschaft_tf: tf.name, mannschaft_1: m1.name, mannschaft: { tf, m1 } })

function aufbauen({ ORG }) {
  PATIENTS.push(
    // Wartet auf die Unterschrift von Lena Berger (wie unitas.mjs)
    protokoll({
      id: 'protokollerika1', status: 'offen', tag: '19', hm: '09:39',
      absender: { id: P.lena.id, name: P.lena.name, status: 'ausstehend', weg: 'formular', modus: 'frei' },
      werte: {
        vorname: 'Erika', name: 'Mustermann', einsatz_nr: 'E-2026-0417', einsatz_datum: '2026-11-19', rufname: 'HLF 20/1',
        ...besatzung(P.murat, P.sara),
      },
    }, ORG),
    // Freigegeben, eine Rückfrage der Leitung wartet auf die Stellungnahme des Teamführers
    protokoll({
      id: 'protokollmarti1', status: 'freigegeben', tag: '17', hm: '15:12',
      absender: { id: P.murat.id, name: P.murat.name, status: 'bestaetigt', weg: 'formular', modus: 'passwort' },
      werte: {
        vorname: 'Martina', name: 'Musterfrau', einsatz_nr: 'E-2026-0416', einsatz_datum: '2026-11-17', rufname: 'HLF 20/1',
        ...besatzung(P.murat, P.anna),
        rueckfragen: [{
          id: '1795074600000', von: P.lena.name, felder: ['zeit_uebergabe'], status: 'offen', created: iso('19', '08:50'),
          frage: 'Die Uhrzeit der Übergabe an den Rettungsdienst fehlt. Bitte in einer Stellungnahme nachtragen.',
        }],
      },
    }, ORG),
    // Freigegeben wie in unitas.mjs (älteres Protokoll ohne Absender-Angabe), bereit zum Gegenzeichnen
    protokoll({
      id: 'protokollmax013', status: 'freigegeben', tag: '13', hm: '08:31',
      werte: {
        vorname: 'Max', name: 'Mustermann', einsatz_nr: 'E-2026-0414', einsatz_datum: '2026-11-13', rufname: 'HLF 20/1',
        ...besatzung(P.lena, P.jonas),
      },
    }, ORG),
  )

  // Eine offene Nacherfassung (Zahl am Reiter)
  NACHERFASSUNGEN.push({
    id: 'nacherfassung01', collectionId: 'pbc_patient_docs_nacherfassung', collectionName: 'patient_docs_nacherfassung',
    stichwort: 'Erste Hilfe beim Übungsdienst', nacherfasst_von_name: P.anna.name, status: 'offen', organization_id: ORG.id,
    created: pb('16', '21:05'), updated: pb('16', '21:05'),
  })
}
import('../daten.mjs').then(aufbauen)

// Echtzeit (die Seite abonniert patients ohne Fehlerbehandlung): Die erste Verbindung gelingt mit PB_CONNECT, sonst
// verwürfe das SDK das Abo mit einem unbehandelten Fehler. Spätere Verbindungsversuche werden abgebrochen (wie in
// unitas.mjs), das SDK versucht es dann still mit wachsendem Abstand weiter.
const CLIENT_ID = 'rtclientpatient'
let verbindungen = 0
function echtzeit(methode) {
  if (methode === 'POST') return { body: {} }
  verbindungen++
  if (verbindungen > 1) return 'abbrechen'
  return { typ: 'text/event-stream', body: `id:${CLIENT_ID}\nevent:PB_CONNECT\ndata:${JSON.stringify({ clientId: CLIENT_ID })}\n\n` }
}

/** Wie PocketBase: die Liste der Protokolle nach `status = "…"` gefiltert (offen, freigegeben, archiviert getrennt). */
function patientenListe(url) {
  const m = (url.searchParams.get('filter') || '').match(/status\s*=\s*"([a-z_]+)"/)
  const items = m ? PATIENTS.filter((p) => p.status === m[1]) : PATIENTS
  const perPage = Number(url.searchParams.get('perPage') || 30)
  return { body: { page: 1, perPage, totalItems: items.length, totalPages: 1, items } }
}

export const bild = {
  name: 'patienten',
  pfad: '/patienten',
  warte: 1200,
  sammlungen: {
    patients: PATIENTS,
    patient_docs_nacherfassung: NACHERFASSUNGEN,
  },
  routen: (methode, url) => {
    if (methode === 'GET' && url.pathname === '/api/collections/patients/records') return patientenListe(url)
    if (url.pathname === '/api/realtime') return echtzeit(methode)
    return undefined
  },
}
