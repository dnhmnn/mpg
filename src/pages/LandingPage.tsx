import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import LandingRenderer from '../components/LandingRenderer'
import {
  API_URL, APP_URL, defaultHomeSections,
  type GlobalSettings, type PageRec,
} from '../lib/landingSchema'

const JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Responda',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, iOS, Android',
  url: 'https://responda.systems',
  description: 'Responda digitalisiert Einsätze, Patientenprotokolle, Lagerverwaltung und Ausbildungen für Feuerwehren, Rettungsdienste und Hilfsorganisationen.',
  offers: { '@type': 'Offer', price: '49', priceCurrency: 'EUR', priceSpecification: { '@type': 'UnitPriceSpecification', price: '49', priceCurrency: 'EUR', unitText: 'Monat' } },
  provider: { '@type': 'Organization', name: 'Responda Systems', url: 'https://responda.systems', email: 'info@responda.systems' },
  inLanguage: 'de',
  keywords: 'Einsatzverwaltung, Feuerwehr, Rettungsdienst, Patientenprotokoll, Lagerverwaltung, Ausbildung',
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
    document.title = page.seo_title || 'Responda — Digitale Einsatzverwaltung für Feuerwehr & Rettungsdienst'
    if (page.seo_description) {
      let m = document.querySelector('meta[name="description"]') as HTMLMetaElement | null
      if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m) }
      m.content = page.seo_description
    }
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = 'lp-jsonld'
    script.text = JSON_LD
    document.head.appendChild(script)
    return () => { document.getElementById('lp-jsonld')?.remove() }
  }, [page.seo_title, page.seo_description])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setLegal(null) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  useEffect(() => { document.body.style.overflow = legal ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [legal])

  const email = content.contact_email || 'info@responda.systems'

  // Unterseiten mit "In Navigation zeigen" automatisch ans Menü anhängen
  const navExtra = pages
    .filter(p => p.in_nav && (p.slug || '') !== '')
    .map(p => ({ label: p.title, href: `/${p.slug}` }))
  const globalWithNav: GlobalSettings = {
    ...content,
    nav_items: [...(content.nav_items?.length ? content.nav_items : []), ...navExtra],
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
  const eyeStyle: React.CSSProperties = { fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: '#600812', marginBottom: 10 }
  const h1Style: React.CSSProperties = { fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#1a0e08', marginBottom: 0 }
  const emStyle: React.CSSProperties = { color: '#600812', fontStyle: 'italic' }
  const secStyle: React.CSSProperties = { marginTop: 28 }
  const secH: React.CSSProperties = { fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#600812', marginBottom: 8 }
  const secP: React.CSSProperties = { fontSize: '0.9rem', color: '#1a0e08', lineHeight: 1.7, marginBottom: 8 }
  const closeBtn: React.CSSProperties = { position: 'absolute', top: 20, right: 20, width: 32, height: 32, borderRadius: '50%', background: 'rgba(96,8,18,0.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#600812', fontSize: 18, fontFamily: 'inherit' }

  const lnk = (href: string, label: string) => <a href={href} style={{ color: '#600812' }}>{label}</a>
  const pb_impressum = content.impressum
  const pb_datenschutz = content.datenschutz

  return (
    <>
      <LandingRenderer page={page} global={globalWithNav} onLegal={setLegal} />

      {legal === 'impressum' && createPortal(
        <div style={modalStyle} onClick={e => { if (e.target === e.currentTarget) setLegal(null) }}>
          <div style={boxStyle}>
            <button style={closeBtn} onClick={() => setLegal(null)}>×</button>
            <div style={eyeStyle}>Rechtliches</div>
            <h1 style={h1Style}><span style={emStyle}>Impressum</span></h1>
            {pb_impressum
              ? <div style={{ marginTop: 24, fontSize: '0.9rem', color: '#1a0e08', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{pb_impressum}</div>
              : <>
                <div style={secStyle}><h2 style={secH}>Angaben gemäß § 5 TMG</h2><p style={secP}>Daniel Heilmann<br/>Alter Keller 5<br/>91541 Rothenburg ob der Tauber<br/>Deutschland</p></div>
                <div style={secStyle}><h2 style={secH}>Kontakt</h2><p style={secP}>E-Mail: {lnk('mailto:daniel@responda.systems', 'daniel@responda.systems')}</p></div>
                <div style={secStyle}><h2 style={secH}>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2><p style={secP}>Daniel Heilmann<br/>Alter Keller 5<br/>91541 Rothenburg ob der Tauber</p></div>
                <div style={secStyle}><h2 style={secH}>Haftungsausschluss</h2><p style={secP}>Die Inhalte dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen. Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.</p></div>
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
                <div style={secStyle}><h2 style={secH}>2. Erhebung und Speicherung personenbezogener Daten</h2>
                  <p style={secP}>Beim Aufrufen unserer Website werden durch den Hosting-Anbieter automatisch Informationen in Server-Logfiles gespeichert. Dies umfasst: IP-Adresse (anonymisiert), Datum und Uhrzeit des Zugriffs, aufgerufene Seite, verwendeter Browser und Betriebssystem. Diese Daten sind nicht einer bestimmten Person zuordenbar und werden nicht mit anderen Datenquellen zusammengeführt. Die Löschung erfolgt automatisch nach 7 Tagen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren Betrieb).</p>
                </div>
                <div style={secStyle}><h2 style={secH}>3. Hosting</h2>
                  <p style={secP}>Diese Website und die zugehörige App werden auf einem eigenen, dedizierten Server betrieben, der sich physisch in <strong>Nürnberg, Deutschland</strong> befindet und im ausschließlichen Eigentum des Anbieters steht. Es findet keine Übermittlung von Daten an externe Hosting-Dienstleister statt. Alle Daten verbleiben innerhalb der Europäischen Union.</p>
                </div>
                <div style={secStyle}><h2 style={secH}>4. Kontaktformular</h2>
                  <p style={secP}>Wenn Sie uns über das Kontaktformular eine Anfrage zukommen lassen, werden Ihre Angaben (Name, E-Mail-Adresse, Nachricht) zur Bearbeitung der Anfrage und für den Fall von Anschlussfragen bei uns gespeichert. Diese Daten geben wir nicht ohne Ihre Einwilligung weiter. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung) bzw. Art. 6 Abs. 1 lit. f DSGVO.</p>
                </div>
                <div style={secStyle}><h2 style={secH}>5. Schriftarten</h2>
                  <p style={secP}>Diese Website verwendet Schriftarten (<em>Atkinson Hyperlegible</em>, <em>Inter</em>), die auf unseren eigenen Servern gehostet werden. Es findet keine Übertragung von Daten an externe Schriftanbieter statt.</p>
                </div>
                <div style={secStyle}><h2 style={secH}>6. Cookies und Tracking</h2>
                  <p style={secP}>Diese Website verwendet keine Tracking-Cookies und keine Analyse-Tools (z. B. Google Analytics). Es werden ausschließlich technisch notwendige Daten verarbeitet.</p>
                </div>
                <div style={secStyle}><h2 style={secH}>7. Ihre Rechte (Art. 15–21 DSGVO)</h2>
                  <p style={secP}>Sie haben das Recht auf <strong>Auskunft</strong> über die zu Ihrer Person gespeicherten Daten (Art. 15), <strong>Berichtigung</strong> unrichtiger Daten (Art. 16), <strong>Löschung</strong> Ihrer Daten (Art. 17), <strong>Einschränkung der Verarbeitung</strong> (Art. 18), <strong>Datenübertragbarkeit</strong> (Art. 20) sowie <strong>Widerspruch</strong> gegen die Verarbeitung (Art. 21). Zur Ausübung Ihrer Rechte wenden Sie sich an: {lnk(`mailto:${email}`, email)}.</p>
                  <p style={secP}>Sie haben zudem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, z. B. beim <strong>Bayerischen Landesamt für Datenschutzaufsicht (BayLDA)</strong>, Promenade 27, 91522 Ansbach.</p>
                </div>
                <div style={secStyle}><h2 style={secH}>8. Änderungen dieser Datenschutzerklärung</h2>
                  <p style={secP}>Wir behalten uns vor, diese Datenschutzerklärung bei Bedarf anzupassen, um sie stets den aktuellen rechtlichen Anforderungen zu entsprechen.</p>
                </div>
                <div style={secStyle}><h2 style={secH}>Stand</h2><p style={secP}>Mai 2025</p></div>
              </>
            }
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
