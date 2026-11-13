import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import LandingRenderer from '../components/LandingRenderer'
import Startseite from './landing/Startseite'
import {
  API_URL, APP_URL, KONTAKT_EMAIL, defaultHomeSections,
  type GlobalSettings, type PageRec,
} from '../lib/landingSchema'

const BESCHREIBUNG = 'Responda verbindet Einsatzführung, Patientendokumentation, Medizinprodukte, Lager und Ausbildung für Hilfsorganisationen und Feuerwehren, vom Sanitätsdienst bis zur Wasser- und Bergrettung. Derzeit in Entwicklung.'

const JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Responda',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, iOS, Android',
  url: 'https://responda.systems',
  // In Entwicklung: keine Preise (kein "offers"), bis Pakete feststehen
  description: 'Responda verbindet Einsatzführung, Patientendokumentation, Medizinprodukte, Lager und Ausbildung für Hilfsorganisationen und Feuerwehren, vom Sanitätsdienst bis zur Wasser- und Bergrettung. In Entwicklung.',
  provider: { '@type': 'Organization', name: 'Responda Systems', url: 'https://responda.systems', email: KONTAKT_EMAIL },
  inLanguage: 'de',
  keywords: 'Einsatzverwaltung, Hilfsorganisation, Sanitätsdienst, Feuerwehr, Patientendokumentation, Medizinprodukte, Lagerverwaltung, Ausbildung',
})

export default function LandingPage() {
  const [legal, setLegal] = useState<'impressum' | 'datenschutz' | null>(null)
  const [content, setContent] = useState<GlobalSettings>({})
  const [pages, setPages] = useState<PageRec[]>([])
  const [loaded, setLoaded] = useState(false)

  const slug = window.location.pathname.replace(/^\/+|\/+$/g, '')

  useEffect(() => {
    const g = fetch(`${API_URL}/api/collections/landing_content/records?page=1&perPage=1`, { cache: 'no-cache' })
      .then(r => r.ok ? r.json() : null).then(d => { if (d?.items?.[0]) setContent(d.items[0]) }).catch(() => {})
    const p = fetch(`${API_URL}/api/collections/landing_pages/records?perPage=100&sort=sort&filter=${encodeURIComponent('published=true')}`, { cache: 'no-cache' })
      .then(r => r.ok ? r.json() : null).then(d => { if (Array.isArray(d?.items)) setPages(d.items) }).catch(() => {})
    Promise.all([g, p]).finally(() => setLoaded(true))
  }, [])

  const rec = pages.find(p => (p.slug || '') === slug)
  // Die Startseite steht während der Entwicklung fest im Code (landing/Startseite.tsx);
  // eine im Website-Editor gespeicherte Startseite gilt bis dahin nicht.
  const istStart = slug === ''

  // Unbekannter Pfad auf der Marketing-Domain -> weiter zur App (wie bisher)
  useEffect(() => {
    if (loaded && slug && !rec) {
      window.location.replace(APP_URL + window.location.pathname + window.location.search)
    }
  }, [loaded, slug, rec])

  const page: PageRec = rec
    ? { ...rec, sections: Array.isArray(rec.sections) ? rec.sections : [] }
    : { slug: '', title: 'Start', sections: defaultHomeSections(content) }

  useEffect(() => {
    document.title = (!istStart && page.seo_title) || 'Responda: Digitale Einsatzverwaltung für Hilfsorganisationen'
    const beschreibung = istStart ? BESCHREIBUNG : page.seo_description
    if (beschreibung) {
      let m = document.querySelector('meta[name="description"]') as HTMLMetaElement | null
      if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m) }
      m.content = beschreibung
    }
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = 'lp-jsonld'
    script.text = JSON_LD
    document.head.appendChild(script)
    return () => { document.getElementById('lp-jsonld')?.remove() }
  }, [istStart, page.seo_title, page.seo_description])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setLegal(null) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  useEffect(() => { document.body.style.overflow = legal ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [legal])

  const email = KONTAKT_EMAIL

  // Unterseiten mit "In Navigation zeigen" automatisch ans Menü anhängen
  const navExtra = pages
    .filter(p => p.in_nav && (p.slug || '') !== '')
    .map(p => ({ label: p.title, href: `/${p.slug}` }))
  const globalWithNav: GlobalSettings = {
    ...content,
    // Unterseiten führen zurück zu den Abschnitten der Startseite (alte Menüs mit "Preise" gelten nicht mehr)
    nav_items: [
      { label: 'Module', href: '/#module' }, { label: 'Für wen', href: '/#fuer-wen' }, { label: 'Stand', href: '/#stand' },
      ...navExtra, { label: 'Kontakt', href: '/#kontakt' },
    ],
  }

  const modalStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(26,14,8,0.65)', backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)', overflowY: 'auto',
    padding: '40px 20px', fontFamily: "'Atkinson Hyperlegible',-apple-system,sans-serif",
  }
  const boxStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 20, maxWidth: 760, margin: '0 auto',
    padding: 'clamp(28px,5vw,52px)', position: 'relative',
  }
  const eyeStyle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: '#6b5c4d', marginBottom: 6 }
  const h1Style: React.CSSProperties = { fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#1a0e08', marginBottom: 0 }
  const emStyle: React.CSSProperties = { color: '#1a0e08' }
  const secStyle: React.CSSProperties = { marginTop: 28 }
  const secH: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: '#1a0e08', marginBottom: 6 }
  const secP: React.CSSProperties = { fontSize: '0.9rem', color: '#1a0e08', lineHeight: 1.7, marginBottom: 8 }
  const closeBtn: React.CSSProperties = { position: 'absolute', top: 20, right: 20, width: 32, height: 32, borderRadius: '50%', background: 'rgba(96,8,18,0.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#600812', fontSize: 18, fontFamily: 'inherit' }

  const lnk = (href: string, label: string) => <a href={href} style={{ color: '#600812' }}>{label}</a>
  const pb_impressum = content.impressum
  const pb_datenschutz = content.datenschutz

  return (
    <>
      {istStart
        ? <Startseite email={email} unterseiten={navExtra} onLegal={setLegal} />
        // Unterseite noch nicht geladen (oder gleich weitergeleitet): ruhig Elfenbein statt der alten Vorgabe-Startseite
        : rec ? <LandingRenderer page={page} global={globalWithNav} onLegal={setLegal} />
        : <div style={{ minHeight: '100dvh', background: '#faf9f7' }} />}

      {legal === 'impressum' && createPortal(
        <div style={modalStyle} onClick={e => { if (e.target === e.currentTarget) setLegal(null) }}>
          <div style={boxStyle}>
            <button style={closeBtn} onClick={() => setLegal(null)}>×</button>
            <div style={eyeStyle}>Rechtliches</div>
            <h1 style={h1Style}><span style={emStyle}>Impressum</span></h1>
            {pb_impressum
              ? <div style={{ marginTop: 24, fontSize: '0.9rem', color: '#1a0e08', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{pb_impressum}</div>
              : <>
                <div style={secStyle}><h2 style={secH}>Angaben gemäß § 5 DDG</h2><p style={secP}>Daniel Heilmann<br/>Alter Keller 5<br/>91541 Rothenburg ob der Tauber<br/>Deutschland</p></div>
                <div style={secStyle}><h2 style={secH}>Kontakt</h2><p style={secP}>E-Mail: {lnk('mailto:daniel@responda.systems', 'daniel@responda.systems')}</p></div>
                <div style={secStyle}><h2 style={secH}>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2><p style={secP}>Daniel Heilmann<br/>Alter Keller 5<br/>91541 Rothenburg ob der Tauber</p></div>
                <div style={secStyle}><h2 style={secH}>Haftungsausschluss</h2><p style={secP}>Die Inhalte dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen. Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.</p></div>
                <div style={secStyle}><h2 style={secH}>Urheberrecht</h2><p style={secP}>Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.</p></div>
              </>
            }
          </div>
        </div>,
        document.body
      )}

      {legal === 'datenschutz' && createPortal(
        <div style={modalStyle} onClick={e => { if (e.target === e.currentTarget) setLegal(null) }}>
          <div style={boxStyle}>
            <button style={closeBtn} onClick={() => setLegal(null)}>×</button>
            <div style={eyeStyle}>Rechtliches</div>
            <h1 style={h1Style}><span style={emStyle}>Datenschutzerklärung</span></h1>
            {pb_datenschutz
              ? <div style={{ marginTop: 24, fontSize: '0.9rem', color: '#1a0e08', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{pb_datenschutz}</div>
              : <>
                <div style={secStyle}><h2 style={secH}>1. Verantwortlicher</h2>
                  <p style={secP}>Verantwortlicher im Sinne der DSGVO ist:<br/><strong>Daniel Heilmann</strong><br/>Alter Keller 5<br/>91541 Rothenburg ob der Tauber<br/>Deutschland<br/>E-Mail: {lnk('mailto:daniel@responda.systems', 'daniel@responda.systems')}</p>
                </div>
                {/*
                  Standardtext (gilt, solange in PocketBase kein eigener Text `datenschutz` gesetzt ist).
                  Stand November 2026, Plan Vorgänge 5.9: Auslieferung über Netlify, Dienste Dritter,
                  Speicher auf dem Gerät (nach Review richtiggestellt: der Schlüssel des Tresors liegt im
                  selben Browserprofil; Zwischenspeicher der API). Rechtlich vom Betreiber zu prüfen.
                */}
                <div style={secStyle}><h2 style={secH}>2. Verbindungsdaten und Server-Protokolle</h2>
                  <p style={secP}>Beim Aufrufen der Website und der App werden technisch notwendige Verbindungsdaten verarbeitet: IP-Adresse, Datum und Uhrzeit des Zugriffs, aufgerufene Adresse, verwendeter Browser und Betriebssystem. Ohne diese Daten lassen sich die Seiten nicht ausliefern und der Betrieb nicht absichern.</p>
                  <p style={secP}>Der Server, auf dem die Inhalte liegen (siehe 3.), protokolliert Anfragen mit diesen Angaben, um Fehler und Missbrauch erkennen zu können. Die Protokolle löscht er automatisch nach Ablauf der eingestellten Aufbewahrungsfrist. Anfragen an die öffentlichen Formulare ohne Anmeldung zählt er außerdem zur Abwehr von Missbrauch kurz im Arbeitsspeicher, je nach Zweck 5 bis 60 Minuten lang; danach werden die Zähler verworfen.</p>
                  <p style={secP}>Diese Daten werden nicht mit anderen Datenquellen zusammengeführt. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren Betrieb).</p>
                </div>
                <div style={secStyle}><h2 style={secH}>3. Hosting</h2>
                  <p style={secP}>Alle Inhalte, die in Responda eingegeben werden (zum Beispiel Protokolle, Formulare, Konten), liegen auf einem eigenen, dedizierten Server in <strong>Nürnberg, Deutschland</strong>, der im ausschließlichen Eigentum des Anbieters steht.</p>
                  <p style={secP}>Die Dateien der Website und der App (Programmcode, Bilder, Schriften) liefert <strong>Netlify, Inc.</strong> (San Francisco, USA) aus. Dabei verarbeitet Netlify die technisch nötigen Verbindungsdaten: IP-Adresse, Zeitpunkt, aufgerufene Datei und Browser. Inhalte, die in Responda eingegeben werden, gehen nicht über Netlify; die App schickt sie direkt an den Server in Nürnberg. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer schnellen und sicheren Auslieferung). Dabei können Verbindungsdaten in die USA übermittelt werden; Grundlage ist der Angemessenheitsbeschluss der EU-Kommission zum EU-US Data Privacy Framework bzw. die Standardvertragsklauseln der EU-Kommission.</p>
                </div>
                <div style={secStyle}><h2 style={secH}>4. Dienste Dritter beim Benutzen der App</h2>
                  <p style={secP}>Einige Teile der App laden Daten von anderen Anbietern. Dabei erhält der jeweilige Anbieter die IP-Adresse des Geräts und die unten genannten Angaben:</p>
                  <p style={secP}><strong>Kartenkacheln</strong> von OpenStreetMap (tile.openstreetmap.org, OpenStreetMap Foundation): der angezeigte Kartenausschnitt.<br/>
                    <strong>Adresssuche</strong> über Nominatim (nominatim.openstreetmap.org, OpenStreetMap Foundation): der gesuchte Ort als Suchtext, etwa der Einsatzort.<br/>
                    <strong>Routen</strong> über OSRM (router.project-osrm.org): Start- und Zielpunkt der Route.<br/>
                    <strong>Kartenbibliothek</strong> Leaflet von unpkg.com: nur der Abruf des Programms.<br/>
                    <strong>Einsatzkarte</strong> der Bayerischen Vermessungsverwaltung (geoservices.bayern.de): der angezeigte Kartenausschnitt.<br/>
                    <strong>Texterkennung der Gesundheitskarte</strong>: Programm und Sprachdaten von cdn.jsdelivr.net und tessdata.projectnaptha.com, nur beim ersten Gebrauch. Die Erkennung selbst läuft auf dem Gerät; das Bild der Karte verlässt das Gerät nicht.<br/>
                    <strong>Google Kalender</strong>: Wer einen Termin über den Knopf „Google“ in den eigenen Kalender übernimmt, öffnet eine Seite von Google mit den Angaben des Termins.</p>
                  <p style={secP}>Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an den Funktionen Karte, Adresssuche, Route und Texterkennung).</p>
                </div>
                <div style={secStyle}><h2 style={secH}>5. Speicher auf dem Gerät</h2>
                  <p style={secP}>Formulare, die ohne Netz abgeschickt werden, und begonnene Protokolle legt die App auf dem Gerät ab, damit nichts verloren geht. Sie liegen verschlüsselt im Speicher des Browsers (AES-GCM), bis sie gesendet oder verworfen sind. So stehen die Inhalte nicht im Klartext auf dem Gerät. Der Schlüssel liegt allerdings ebenfalls im Speicher des Browsers auf demselben Gerät: Wer die Dateien des Browsers selbst ausliest, kann die Einträge entschlüsseln. Dagegen schützen die Sperre und die Verschlüsselung des Geräts. Ein begonnenes Protokoll wird nach einem Tag nicht mehr angeboten und beim nächsten Öffnen der App vom Gerät entfernt, beim Abmelden sofort gelöscht. Ohne Anmeldung zeigt die App ein liegendes Protokoll erst nach einer Rückfrage. Lässt ein Browser die Verschlüsselung nicht zu, liegen die Einträge unverschlüsselt im Browser; die App zeigt das an.</p>
                  <p style={secP}>Damit die App kurz ohne Netz weiterläuft, hält der Browser außerdem Antworten des Servers unverschlüsselt in einem Zwischenspeicher, zum Beispiel Termine, Beiträge der Lernbar oder Geräte. Diese Antworten können Namen von Mitgliedern enthalten, etwa wer eine Meldung erfasst hat. Patientendaten (Protokolle, Nacherfassungen, Zugriffs- und Änderungsprotokolle), Einsätze, Benutzerkonten, Chat und Notizen fragt die App immer neu beim Server ab und legt sie nicht im Zwischenspeicher ab. Antworten, die älter als 24 Stunden sind, verwendet die App nicht mehr und löscht sie beim nächsten Start. Beim Abmelden, beim Wechsel der angemeldeten Person und beim Start ohne Anmeldung löscht die App den Zwischenspeicher; nur die Angaben zur Organisation bleiben (Name und Einstellungen der Formulare), damit die öffentlichen Formulare auch ohne Netz öffnen.</p>
                  <p style={secP}>Auf Geräten, die das unterstützen (etwa Android mit Chrome), sendet die App abgelegte Formulare im Hintergrund, sobald wieder Netz da ist, auch wenn die Seite geschlossen ist. Auch dann gehen sie direkt an den Server in Nürnberg. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO bzw. die Vereinbarung mit der Organisation, für die das Formular ausgefüllt wird.</p>
                </div>
                <div style={secStyle}><h2 style={secH}>6. Kontaktformular</h2>
                  <p style={secP}>Wenn Sie uns über das Kontaktformular eine Anfrage zukommen lassen, werden Ihre Angaben (Name, E-Mail-Adresse, Nachricht) zur Bearbeitung der Anfrage und für den Fall von Anschlussfragen bei uns gespeichert. Diese Daten geben wir nicht ohne Ihre Einwilligung weiter. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung) bzw. Art. 6 Abs. 1 lit. f DSGVO.</p>
                </div>
                <div style={secStyle}><h2 style={secH}>7. Schriftarten</h2>
                  <p style={secP}>Die Schriftarten (Atkinson Hyperlegible, Inter) werden mit der Website und der App ausgeliefert (siehe 3.). Ein Abruf bei Schriftanbietern wie Google Fonts findet nicht statt.</p>
                </div>
                <div style={secStyle}><h2 style={secH}>8. Cookies und Tracking</h2>
                  <p style={secP}>Diese Website verwendet keine Tracking-Cookies und keine Analyse-Tools (z. B. Google Analytics). Es werden ausschließlich technisch notwendige Daten verarbeitet.</p>
                </div>
                <div style={secStyle}><h2 style={secH}>9. Ihre Rechte (Art. 15 bis 21 DSGVO)</h2>
                  <p style={secP}>Sie haben das Recht auf <strong>Auskunft</strong> über die zu Ihrer Person gespeicherten Daten (Art. 15), <strong>Berichtigung</strong> unrichtiger Daten (Art. 16), <strong>Löschung</strong> Ihrer Daten (Art. 17), <strong>Einschränkung der Verarbeitung</strong> (Art. 18), <strong>Datenübertragbarkeit</strong> (Art. 20) sowie <strong>Widerspruch</strong> gegen die Verarbeitung (Art. 21). Zur Ausübung Ihrer Rechte wenden Sie sich an: {lnk(`mailto:${email}`, email)}.</p>
                  <p style={secP}>Sie haben zudem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, z. B. beim <strong>Bayerischen Landesamt für Datenschutzaufsicht (BayLDA)</strong>, Promenade 27, 91522 Ansbach.</p>
                </div>
                <div style={secStyle}><h2 style={secH}>10. Änderungen dieser Datenschutzerklärung</h2>
                  <p style={secP}>Wir behalten uns vor, diese Datenschutzerklärung bei Bedarf anzupassen, um sie stets den aktuellen rechtlichen Anforderungen zu entsprechen.</p>
                </div>
                <div style={secStyle}><h2 style={secH}>Stand</h2><p style={secP}>November 2026</p></div>
              </>
            }
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
