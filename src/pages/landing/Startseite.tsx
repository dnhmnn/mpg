// Website responda.systems, solange Responda in Entwicklung ist: ohne Preise und Pakete, für alle
// Hilfsorganisationen. Ganz in Dunkelrot wie der Eingang der App (Owner, 19.11.2026): großes Logo, große
// helle Schrift, die App selbst in Telefonrahmen statt Listen und Kacheln. Die Bilder der App entstehen mit
// erfundenen Testdaten (docs/entwuerfe/website/aufnahme.mjs) und liegen unter public/website/.
// Die Unterseiten aus dem Website-Editor zeigt weiter LandingRenderer.

import { useEffect, useState } from 'react'
import { useStatusleiste } from '../../hooks/useStatusleiste'
import { API_URL, APP_URL } from '../../lib/landingSchema'
import { RS_CSS } from './stil'

// Ein erfundener Einsatz von Alarm bis Nachbereitung (Owner, 19.11.2026: „ein Einsatz simuliert, wo man direkt
// sieht, was die App kann, statt es ewig zu erklären“). Jede Aussage muss in der App stimmen; die Bilder zeigen
// genau diesen Einsatz mit erfundenen Daten (docs/entwuerfe/website/daten/).
const SCHRITTE: { zeit: string; titel: string; text: string; bild: string; alt: string }[] = [
  { zeit: '09:41', titel: 'Patientin versorgt.', bild: 'protokoll',
    text: 'Das Protokoll entsteht am Telefon, direkt bei ihr. Feld für Feld, auch ohne Netz.',
    alt: 'Responda auf dem Telefon: Patientendokumentation, erfundene Testdaten' },
  { zeit: '10:05', titel: 'Gerät gesperrt.', bild: 'mpg',
    text: 'Die Absaugpumpe fällt aus. Defekt gemeldet, Gerät gesperrt, bis es geprüft ist. Niemand nimmt es versehentlich mit.',
    alt: 'Responda auf dem Telefon: Medizinprodukte mit einem gesperrten Gerät, erfundene Testdaten' },
  { zeit: '10:20', titel: 'Material nachfüllen.', bild: 'lager',
    text: 'Verbrauchtes Material ist gebucht. Was knapp wird oder abläuft, fällt auf, bevor es fehlt.',
    alt: 'Responda auf dem Telefon: Lager mit Beständen, erfundene Testdaten' },
  { zeit: '11:30', titel: 'Nachbereitung.', bild: 'unitas',
    text: 'Zurück an der Wache wartet das Protokoll auf die Unterschrift der Einsatzleiterin. Unterschreiben, freigeben, fertig.',
    alt: 'Responda auf dem Telefon: Unitas mit einem Protokoll, das auf die Unterschrift wartet, erfundene Testdaten' },
]

const WEITERE: { name: string; text: string }[] = [
  { name: 'Vorgänge und CIRS', text: 'Eigene Formulare, Anträge und CIRS-Meldungen, auf Wunsch anonym.' },
  { name: 'Benachrichtigungen', text: 'Push auf Handy und PC, mit Ruhezeit. Keine Alarmierung, sie ersetzt sie nicht.' },
  { name: 'Chat und Notizen', text: 'Nachrichten und Notizen im Team, ohne fremde Dienste.' },
  { name: 'Dateien und Schreibstube', text: 'Gemeinsame Ablage und Schreiben für eure Dokumente.' },
  { name: 'Benutzer und Rollen', text: 'Eigene Rollen je Organisation, befristete Rechte und Zugänge für Gäste.' },
  { name: 'Öffentliche Formulare', text: 'Patientendoku, Produktausgabe, CIRS und Defektmeldung über Link oder QR-Code.' },
]

const FUER_WEN: { name: string; text: string }[] = [
  { name: 'Sanitätsdienste und Bereitschaften', text: 'BRK, DRK, ASB, Johanniter, Malteser: Patientendokumentation vom Dorffest bis zur Großveranstaltung, dazu Medizinprodukte und Material.' },
  { name: 'Wasser- und Bergrettung', text: 'DLRG, Wasserwacht, Bergwacht: Einsätze dokumentieren, Geräte und Material im Blick.' },
  { name: 'Feuerwehren', text: 'Freiwillige Feuerwehren und Werkfeuerwehren: Patientendokumentation, Geräte und Material an einem Ort.' },
  { name: 'Betriebe', text: 'Betriebssanitäter und Werksdienste: Protokolle, Geräte und Verbandmaterial ohne Papier.' },
]

const GRUNDSAETZE: { name: string; text: string }[] = [
  { name: 'Daten in Franken', text: 'Eure Daten liegen auf einem eigenen Server in Nürnberg.' },
  { name: 'Ohne Installation', text: 'Im Browser auf Handy, Tablet und PC. Auf Wunsch wie eine App auf dem Startbildschirm.' },
  { name: 'Auch ohne Netz', text: 'Was im Funkloch abgeschickt wird, wartet verschlüsselt auf dem Gerät und geht raus, sobald wieder Netz da ist.' },
  { name: 'Ihr behaltet die Kontrolle', text: 'Jede Organisation entscheidet selbst über Rollen, Rechte und öffentliche Formulare.' },
]

function Telefon({ bild, alt, klasse = '', sofort = false }: { bild: string; alt: string; klasse?: string; sofort?: boolean }) {
  return (
    <figure className={`rs-telefon ${klasse}`}>
      <img src={`/website/${bild}.webp`} alt={alt} width={780} height={1688} loading={sofort ? 'eager' : 'lazy'} decoding="async" />
    </figure>
  )
}

function Kontakt({ email }: { email: string }) {
  const [stand, setStand] = useState<'offen' | 'laeuft' | 'gesendet' | 'fehler'>('offen')

  async function senden(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setStand('laeuft')
    try {
      const r = await fetch(`${API_URL}/api/collections/landing_leads/records`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fd.get('name'), email: fd.get('email'), organisation: fd.get('organisation'), nachricht: fd.get('nachricht') }),
      })
      setStand(r.ok ? 'gesendet' : 'fehler')
    } catch { setStand('fehler') }
  }

  if (stand === 'gesendet') return <div className="rs-form rs-hell"><p className="rs-gesendet" role="status">Danke, wir melden uns.</p></div>

  return (
    <form className="rs-form rs-hell" onSubmit={senden}>
      <div className="rs-feld"><label htmlFor="rs-name">Name</label><input id="rs-name" className="rs-eingabe" name="name" required autoComplete="name" /></div>
      <div className="rs-feld"><label htmlFor="rs-mail">E-Mail</label><input id="rs-mail" className="rs-eingabe" type="email" name="email" required autoComplete="email" /></div>
      <div className="rs-feld"><label htmlFor="rs-org">Organisation<small>optional</small></label><input id="rs-org" className="rs-eingabe" name="organisation" autoComplete="organization" placeholder="z. B. BRK-Bereitschaft, FF Musterdorf, DLRG-Ortsgruppe" /></div>
      <div className="rs-feld"><label htmlFor="rs-text">Nachricht</label><textarea id="rs-text" className="rs-eingabe" name="nachricht" placeholder="Was möchtet ihr wissen?" /></div>
      {stand === 'fehler' && (
        <p className="rs-fehler" role="alert">Das hat nicht geklappt. Schreibt uns bitte direkt an <a href={`mailto:${email}`}>{email}</a>.</p>
      )}
      <div><button className="rs-knopf rot" type="submit" disabled={stand === 'laeuft'}>{stand === 'laeuft' ? 'Wird gesendet…' : 'Nachricht senden'}</button></div>
    </form>
  )
}

export default function Startseite({ email, unterseiten, onLegal }: {
  email: string
  unterseiten: { label: string; href: string }[]
  onLegal: (which: 'impressum' | 'datenschutz') => void
}) {
  // Ganz in Dunkelrot: html und body bleiben rot (oben wie unten), wie auf den Zugangsseiten der App
  useStatusleiste('--rs-kopf')
  const [unter, setUnter] = useState(false)
  // Welcher Schritt des Einsatzes gerade in der Mitte steht (das Telefon zeigt seinen Bildschirm)
  const [aktiv, setAktiv] = useState(0)
  useEffect(() => {
    const schritte = Array.from(document.querySelectorAll<HTMLElement>('.rs-schritt'))
    if (!schritte.length || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((eintraege) => {
      for (const e of eintraege) if (e.isIntersecting) setAktiv(Number((e.target as HTMLElement).dataset.schritt) || 0)
    }, { rootMargin: '-45% 0px -45% 0px' })
    schritte.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    const pruefen = () => setUnter(window.scrollY > 8)
    pruefen()
    window.addEventListener('scroll', pruefen, { passive: true })
    return () => window.removeEventListener('scroll', pruefen)
  }, [])
  const links = [
    { label: 'Der Einsatz', href: '#einsatz' },
    { label: 'Für wen', href: '#fuer-wen' },
    ...unterseiten,
    { label: 'Kontakt', href: '#kontakt' },
  ]

  return (
    <div className="rs">
      <style>{RS_CSS}</style>
      <div className="rs-statusleiste" aria-hidden="true" />

      <nav className={`rs-nav${unter ? ' unter' : ''}`} aria-label="Hauptmenü">
        <div className="rs-innen">
          <a href="/" className="rs-marke"><span className="rs-mini"><img src="/logo.svg" alt="" /></span>Responda</a>
          <div className="rs-links">{links.map(l => <a key={l.href} href={l.href}>{l.label}</a>)}</div>
          <a className="rs-knopf creme klein" href={APP_URL}>Zur App</a>
        </div>
      </nav>

      <header className="rs-held">
        <div className="rs-innen">
          <span className="rs-gross"><img src="/logo.svg" alt="" /></span>
          <p className="rs-stand"><i aria-hidden="true" />In Entwicklung und in Erprobung mit ersten Organisationen</p>
          <h1>Responda</h1>
          <p className="rs-claim">Dokumentation, Geräte und Material. <em>In einer App.</em></p>
          <p className="rs-einl">Für Hilfsorganisationen und Feuerwehren, vom Sanitätsdienst bis zur Wasser- und Bergrettung. Auf dem Handy, dem Tablet im Fahrzeug und am PC.</p>
          <div className="rs-knoepfe">
            <a className="rs-knopf creme" href="#kontakt">Interesse melden</a>
            <a className="rs-knopf rand" href="#einsatz">Einsatz ansehen</a>
          </div>
        </div>
        <div className="rs-schau" aria-hidden="true">
          <Telefon bild="mpg" alt="" klasse="seite links" sofort />
          <Telefon bild="hub" alt="" klasse="mitte" sofort />
          <Telefon bild="protokoll" alt="" klasse="seite rechts" sofort />
        </div>
      </header>

      <main>
        <section id="einsatz" className="rs-band tief" aria-labelledby="rs-einsatz">
          <div className="rs-innen">
            <p className="rs-ueber">Ein Einsatz mit Responda</p>
            <h2 id="rs-einsatz">Donnerstag, 9:12 Uhr. <em>Alarm.</em></h2>
            <p className="rs-lead">Wohnungsbrand im Lindenweg, eine Bewohnerin hat Rauch eingeatmet. Ein erfundener Einsatz der Feuerwehr Musterstadt, Schritt für Schritt. Alles, was ihr seht, ist die App, mit Beispieldaten.</p>
            <div className="rs-einsatz">
              <ol className="rs-schritte">
                {SCHRITTE.map((s, i) => (
                  <li key={s.bild} className={`rs-schritt${i === aktiv ? ' aktiv' : ''}`} data-schritt={i}>
                    <span className="rs-zeit">{s.zeit}</span>
                    <h3>{s.titel}</h3>
                    <p>{s.text}</p>
                    <Telefon bild={s.bild} alt={s.alt} klasse="inline" />
                  </li>
                ))}
              </ol>
              <div className="rs-buehne" aria-hidden="true">
                <div className="rs-telefon">
                  {SCHRITTE.map((s, i) => (
                    <img key={s.bild} src={`/website/${s.bild}.webp`} alt="" width={780} height={1688} loading={i < 2 ? 'eager' : 'lazy'} decoding="async"
                      className={i === aktiv ? 'an' : ''} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rs-band" aria-labelledby="rs-weitere">
          <div className="rs-innen">
            <p className="rs-ueber">Und außerdem</p>
            <h2 id="rs-weitere">Was sonst noch <em>dazugehört.</em></h2>
            <div className="rs-raster drei">{WEITERE.map(w => <div key={w.name}><b>{w.name}</b><span>{w.text}</span></div>)}</div>
          </div>
        </section>

        <section id="fuer-wen" className="rs-band tief" aria-labelledby="rs-fuer-wen">
          <div className="rs-innen">
            <p className="rs-ueber">Für wen</p>
            <h2 id="rs-fuer-wen">Für Ehrenamt und Hauptamt, <em>von der Ortsgruppe bis zur Bereitschaft.</em></h2>
            <div className="rs-raster">{FUER_WEN.map(f => <div key={f.name}><b>{f.name}</b><span>{f.text}</span></div>)}</div>
          </div>
        </section>

        <section className="rs-band" aria-labelledby="rs-verlass">
          <div className="rs-innen">
            <p className="rs-ueber">Worauf ihr euch verlassen könnt</p>
            <h2 id="rs-verlass">Gebaut für den <em>Dienst.</em></h2>
            <div className="rs-raster">{GRUNDSAETZE.map(g => <div key={g.name}><b>{g.name}</b><span>{g.text}</span></div>)}</div>
          </div>
        </section>

        <section id="stand" className="rs-band tief" aria-labelledby="rs-stand">
          <div className="rs-innen">
            <p className="rs-ueber">Stand der Entwicklung</p>
            <h2 id="rs-stand">Noch in Entwicklung, <em>schon im Dienst.</em></h2>
            <p className="rs-zitat">Wir erproben Responda mit ersten Organisationen im echten Dienst, und es kommen laufend Funktionen dazu.</p>
            <p>Über Kosten sprechen wir, wenn die Erprobung abgeschlossen ist. Wer jetzt mitmacht, gestaltet Responda mit.</p>
          </div>
        </section>

        <section id="kontakt" className="rs-band" aria-labelledby="rs-kontakt">
          <div className="rs-innen">
            <p className="rs-ueber">Kontakt</p>
            <h2 id="rs-kontakt">Interesse <em>oder Fragen?</em></h2>
            <div className="rs-kontakt">
              <div className="rs-kontakt-text">
                <p>Ihr möchtet Responda in eurer Organisation ausprobieren oder wissen, ob es zu euch passt? Schreibt uns, wir melden uns.</p>
                <p>Oder per E-Mail an <a href={`mailto:${email}`}>{email}</a></p>
              </div>
              <Kontakt email={email} />
            </div>
          </div>
        </section>

        <div className="rs-innen">
          <footer className="rs-fuss">
            <b>Responda Systems</b>
            {unterseiten.map(l => <a key={l.href} href={l.href}>{l.label}</a>)}
            <button type="button" onClick={() => onLegal('impressum')}>Impressum</button>
            <button type="button" onClick={() => onLegal('datenschutz')}>Datenschutz</button>
            <a href={APP_URL}>Zur App</a>
          </footer>
        </div>
      </main>
    </div>
  )
}
