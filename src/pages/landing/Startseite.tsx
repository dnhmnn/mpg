// Startseite von responda.systems, solange Responda in Entwicklung ist: ohne Preise
// und Pakete, für alle Hilfsorganisationen, im Dunkelrot-Design der App.
// Die Unterseiten aus dem Website-Editor zeigt weiter LandingRenderer.

import { useState } from 'react'
import AppIcon from '../../components/AppIcon'
import { useStatusleiste } from '../../hooks/useStatusleiste'
import { API_URL, APP_URL } from '../../lib/landingSchema'
import { RS_CSS } from './stil'

// Warme Erkennungsfarben wie bei den Rollen (Bordeaux, Cognac, Oliva, Petrolio, Prugna, Senape, Salvia, Ardesia)
const F = ['#600812', '#7a4a1e', '#55602f', '#2f5a60', '#5e2a4c', '#86620f', '#4f6a58', '#4f4640']

const MODULE: { icon: string; farbe: string; name: string; text: string }[] = [
  { icon: 'clipboard', farbe: F[0], name: 'Patientendokumentation', text: 'Protokolle auf dem Handy oder Tablet, mit Freigabe und Rückfragen.' },
  { icon: 'eks', farbe: F[3], name: 'Einsatzführung', text: 'Einsatztagebuch, Kräfte, Abschnitte und Atemschutzüberwachung. Arbeitet auch ohne Netz.' },
  { icon: 'siren', farbe: F[1], name: 'Einsätze', text: 'Einsätze anlegen oder über Alamos automatisch übernehmen.' },
  { icon: 'mpg', farbe: F[6], name: 'Medizinprodukte', text: 'Geräte, Prüfungen und Fristen wie STK und MTK, mit Gerätebuch und Defektmeldung.' },
  { icon: 'package', farbe: F[5], name: 'Lager und Material', text: 'Bestände, Entnahmen, Inventur und Bestellungen.' },
  { icon: 'book', farbe: F[2], name: 'Ausbildung', text: 'Kurse und Termine, Einladungen und Anwesenheit.' },
  { icon: 'graduation', farbe: F[4], name: 'Unitas', text: 'Neuigkeiten, Lernmodule und Quizze für das ganze Team.' },
  { icon: 'file', farbe: F[7], name: 'Vorgänge', text: 'Formulare, Dokumente und CIRS-Meldungen.' },
  { icon: 'chat', farbe: F[3], name: 'Chat und Notizen', text: 'Ende-zu-Ende verschlüsselt, ohne fremde Dienste.' },
  { icon: 'folder', farbe: F[1], name: 'Dateien und Schreibstube', text: 'Gemeinsame Ablage und Dokumente schreiben.' },
  { icon: 'users', farbe: F[0], name: 'Benutzer und Rollen', text: 'Eigene Rollen je Organisation, befristete Rechte und Zugänge für Gäste.' },
]

const FUER_WEN: { name: string; text: string }[] = [
  { name: 'Sanitätsdienste und Bereitschaften', text: 'DRK, ASB, Johanniter, Malteser und andere, vom Sanitätswachdienst bis zur Großveranstaltung.' },
  { name: 'Wasser- und Bergrettung', text: 'DLRG, Wasserwacht, Bergwacht.' },
  { name: 'Feuerwehren', text: 'Freiwillige Feuerwehren und Werkfeuerwehren, mit Einsatzführung und Atemschutzüberwachung.' },
  { name: 'Betriebe und Ausbildungsstätten', text: 'Betriebssanitäter, Schulungszentren und Ausbildungsträger.' },
]

const GRUNDSAETZE: { name: string; text: string }[] = [
  { name: 'Daten in Deutschland', text: 'Responda läuft auf einem eigenen Server in Deutschland.' },
  { name: 'Ohne Installation', text: 'Im Browser auf Handy, Tablet und PC. Auf Wunsch wie eine App auf dem Startbildschirm.' },
  { name: 'Verlässlich im Einsatz', text: 'Die Einsatzführung arbeitet ohne Netz weiter und gleicht danach ab.' },
  { name: 'Gut lesbar', text: 'Große, klare Schrift und ein Dunkelmodus für die Nacht.' },
]

const KACHELN = ['clipboard', 'eks', 'mpg', 'package', 'book', 'chat', 'siren', 'graduation', 'users']

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

  if (stand === 'gesendet') return <div className="rs-form"><p className="rs-gesendet">Danke, wir melden uns.</p></div>

  return (
    <form className="rs-form" onSubmit={senden}>
      <div className="rs-feld"><label htmlFor="rs-name">Name</label><input id="rs-name" className="rs-eingabe" name="name" required autoComplete="name" /></div>
      <div className="rs-feld"><label htmlFor="rs-mail">E-Mail</label><input id="rs-mail" className="rs-eingabe" type="email" name="email" required autoComplete="email" /></div>
      <div className="rs-feld"><label htmlFor="rs-org">Organisation<small>optional</small></label><input id="rs-org" className="rs-eingabe" name="organisation" autoComplete="organization" placeholder="z. B. Bereitschaft, Ortsgruppe, Wache" /></div>
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
  useStatusleiste('--rs-kopf')
  const links = [
    { label: 'Module', href: '#module' },
    { label: 'Für wen', href: '#fuer-wen' },
    { label: 'Stand', href: '#stand' },
    ...unterseiten,
    { label: 'Kontakt', href: '#kontakt' },
  ]

  return (
    <div className="rs">
      <style>{RS_CSS}</style>
      <div className="rs-statusleiste" aria-hidden="true" />
      <div className="rs-bodenkante" aria-hidden="true" />

      <nav className="rs-nav rs-dunkel" aria-label="Hauptmenü">
        <div className="rs-innen">
          <a href="/" className="rs-marke">
            <span className="rs-logo"><img src="/logo.svg" alt="" /></span>
            Responda
          </a>
          <div className="rs-links">
            {links.map(l => <a key={l.href} href={l.href}>{l.label}</a>)}
          </div>
          <a className="rs-knopf creme klein" href={APP_URL}>Zur App</a>
        </div>
      </nav>

      <header className="rs-held rs-dunkel">
        <div className="rs-innen">
          <div>
            <p className="rs-stand"><i aria-hidden="true" />In Entwicklung, im Test mit ersten Organisationen</p>
            <h1>Einsatz, Dokumentation, Material und Ausbildung in einer App</h1>
            <p className="rs-einl">Für Hilfsorganisationen, Sanitätsdienste und Feuerwehren. Auf dem Handy, dem Tablet im Fahrzeug und am PC.</p>
            <div className="rs-knoepfe">
              <a className="rs-knopf creme" href="#kontakt">Interesse melden</a>
              <a className="rs-knopf rand" href="#module">Was Responda kann</a>
            </div>
          </div>
          <div className="rs-kacheln" aria-hidden="true">
            {KACHELN.map((k, i) => (
              <span key={k} className="rs-kachel" style={{ background: F[(i * 3) % F.length] }}><AppIcon icon={k} /></span>
            ))}
          </div>
        </div>
      </header>

      <main className="rs-blatt">
        <section id="module" className="rs-ab">
          <div className="rs-innen">
            <h2>Was Responda kann</h2>
            <p className="rs-unter">Alles, was im Dienst anfällt, an einem Ort. Jede Organisation schaltet frei, was sie braucht.</p>
            <div className="rs-spalten">
              {[MODULE.slice(0, 6), MODULE.slice(6)].map((teil, i) => (
                <div key={i} className="rs-flaeche">
                  {teil.map(m => (
                    <div key={m.name} className="rs-z">
                      <span className="rs-ic" style={{ background: m.farbe }} aria-hidden="true"><AppIcon icon={m.icon} /></span>
                      <div><b>{m.name}</b><span>{m.text}</span></div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="fuer-wen" className="rs-ab">
          <div className="rs-innen">
            <h2>Für wen</h2>
            <p className="rs-unter">Für Ehrenamt und Hauptamt, für kleine Ortsgruppen und große Verbände.</p>
            <div className="rs-spalten">
              <div className="rs-flaeche">
                {FUER_WEN.map(f => <div key={f.name} className="rs-z ohne"><div><b>{f.name}</b><span>{f.text}</span></div></div>)}
              </div>
              <div className="rs-flaeche">
                {GRUNDSAETZE.map(g => <div key={g.name} className="rs-z ohne"><div><b>{g.name}</b><span>{g.text}</span></div></div>)}
              </div>
            </div>
          </div>
        </section>

        <section id="stand" className="rs-ab">
          <div className="rs-innen">
            <h2>Stand der Entwicklung</h2>
            <div className="rs-notiz" style={{ marginTop: 14 }}>
              <p>Responda ist noch in Entwicklung. Wir erproben es mit ersten Organisationen im echten Dienst, und es kommen laufend Funktionen dazu.</p>
              <p>Preise und Pakete legen wir fest, wenn die Erprobung abgeschlossen ist. Wer jetzt mitmacht, gestaltet Responda mit.</p>
            </div>
          </div>
        </section>

        <section id="kontakt" className="rs-ab">
          <div className="rs-innen">
            <h2>Interesse oder Fragen?</h2>
            <div className="rs-kontakt" style={{ marginTop: 14 }}>
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
            <button type="button" onClick={() => onLegal('impressum')}>Impressum</button>
            <button type="button" onClick={() => onLegal('datenschutz')}>Datenschutz</button>
            <a href={APP_URL}>Zur App</a>
          </footer>
        </div>
      </main>
    </div>
  )
}
