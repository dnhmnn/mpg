// Website responda.systems, solange Responda in Entwicklung ist: ohne Preise und Pakete, für alle
// Hilfsorganisationen. Ganz in Dunkelrot wie der Eingang der App (Owner, 19.11.2026).
// Szene am Scrollen (Owner, 26.11.2026: „durchscrollen wie auf der Apple-Website, anfangs zückt einer sein Handy“):
// Das Handy steckt in der Brusttasche einer Einsatzjacke, gleitet heraus, der Bildschirm geht an, dann zeigt es
// nacheinander alle Apps (auch Einsätze und Ausbildungen, Owner 26.11.2026; hebt den 20.11.2026 auf).
// Designrunde 27.11.2026 („Editorial ruhig“): vier große Kapitelmomente, gewichtete Schritte, ein Schluss, der den
// Kreis schließt („Für den ganzen Dienst. In einer App.“), danach ein durchgehendes Rot mit großer Schrift:
// Grundsätze als Lesezeilen, „Für wen“ als ein Satz, Kontakt als Schlussbild. Bewegung fast nur über Deckkraft,
// ohne Federn; wer weniger Bewegung eingestellt hat, sieht dieselbe Seite nur mit Überblenden.
// Ablauf und Texte der Szene: ./ablauf.ts (mit Prüffällen), Scroll: ./scroll.ts, Stile: ./stil.ts.
// Die Bilder der App entstehen mit erfundenen Testdaten (docs/entwuerfe/website/aufnahme.mjs).

import { Fragment, useEffect, useRef, useState } from 'react'
import { useStatusleiste } from '../../hooks/useStatusleiste'
import { API_URL, APP_URL, DEF_NAV } from '../../lib/landingSchema'
import { RS_CSS } from './stil'
import {
  ANKER, BILDER, FUER_WEN, GESAMT, GRUNDSAETZE, KAPITEL, KAPITEL_SPANNEN, MODULE, NUMMER, SCHLUSSSATZ, TEXTTEILE,
  auftakt, bildDeckkraft, bildFenster, kapitelBei, schluss, textDeckkraft, zeileHell, zurueck, zwischen,
} from './ablauf'
import { setz, useEinblenden, useScrollMaler, type Mass, type Teilnehmer } from './scroll'

type Stil = React.CSSProperties & Record<`--${string}`, string | number>

// ── Die Szene ────────────────────────────────────────────────────────────────

/** Malt die Szene: liest Größen nur in messen, schreibt in malen nur geänderte Werte */
function szeneMaler(root: HTMLElement, ruhig: boolean, anstossen: () => void): Teilnehmer {
  const el = root.querySelector<HTMLElement>('.rs-szene')!
  const q = (s: string) => el.querySelector<HTMLElement>(s)
  const buehne = q('.rs-sz-bild'), held = q('.rs-sz-held'), hinweis = q('.rs-sz-hinweis'), jacke = q('.rs-sz-jacke'), vorn = q('.rs-sz-vorn')
  const handy = q('.rs-sz-handy'), schein = q('.rs-sz-schein'), aus = q('.rs-sz-aus'), zeichen = q('.rs-sz-zeichen'), texteEl = q('.rs-sz-texte')
  const heldKnopf = held?.querySelector<HTMLElement>('a') ?? null
  const nav = root.querySelector<HTMLElement>('.rs-nav')
  const bilder = Array.from(el.querySelectorAll<HTMLImageElement>('img.rs-sz-app'))
  const texte = Array.from(el.querySelectorAll<HTMLElement>('.rs-sz-text'))
  const kapitelEls = Array.from(el.querySelectorAll<HTMLElement>('.rs-sz-kapitel'))
  const textEls = TEXTTEILE.map(t => t.art === 'app' ? texte[t.modul] : t.art === 'kapitel' ? kapitelEls[t.kapitel] : null)
  const z1 = q('.rs-sz-schluss .z1'), z2 = q('.rs-sz-schluss .z2'), schlussKnopf = q('.rs-sz-schluss .rs-knopf')
  const zeile = q('.rs-sz-kapitelzeile')
  const zeilenKnoepfe = Array.from(el.querySelectorAll<HTMLElement>('.rs-sz-kapitelzeile button'))
  const bereit = BILDER.map(() => false)
  const laeuft = new Set<number>()
  let anfang = 0, startY = 0, xZiel = 0

  const tab = (a: HTMLElement | null, an: boolean) => { if (!a) return; const t = an ? '0' : '-1'; if (a.getAttribute('tabindex') !== t) a.setAttribute('tabindex', t) }

  const laden = (i: number) => {
    const img = bilder[i]
    if (!img || laeuft.has(i)) return
    if (!img.getAttribute('src') && img.dataset.bild) img.setAttribute('src', img.dataset.bild)
    laeuft.add(i)
    const fertig = () => { laeuft.delete(i); bereit[i] = true; anstossen() }
    if (typeof img.decode === 'function') img.decode().then(fertig, () => { laeuft.delete(i); if (img.complete && img.naturalWidth) fertig() })
    else if (img.complete) fertig()
    else img.addEventListener('load', fertig, { once: true })
  }

  return {
    messen(m: Mass, voll: boolean) {
      el.classList.toggle('breit', m.breit)
      el.classList.toggle('ruhig', ruhig)
      const navH = nav?.offsetHeight ?? 64
      if (voll || !el.style.getPropertyValue('--hh')) {
        let hh: number, oben: number
        if (m.breit) {
          hh = Math.min(m.H * 0.8, 760, m.H - navH - 24)
          oben = Math.max((m.H - hh) / 2, navH + 12)
        } else {
          // Am Telefon: Handy oben, darunter der Text; auf kleinen Bildschirmen ohne Erklärzeile (.knapp)
          oben = Math.max(navH + 12, m.H * 0.1)
          const breiteGrenze = (m.vw - 72) / 0.4627 + 20
          const rechne = () => {
            const textH = Math.max(0, ...texte.map(t => t.offsetHeight))
            const b = buehne?.getBoundingClientRect(), tb = texteEl?.getBoundingClientRect()
            const unten = b && tb ? Math.max(0, b.bottom - tb.bottom) : 22
            return Math.min(m.H * 0.6, m.H - oben - textH - unten - 32, breiteGrenze)
          }
          el.classList.remove('knapp')
          hh = rechne()
          if (hh < 260) { el.classList.add('knapp'); hh = rechne() }
          hh = Math.max(220, hh)
        }
        const hw = (hh - 20) * 0.4627 + 20
        setz(el, '--hh', `${hh}px`); setz(el, '--hw', `${hw}px`); setz(el, '--oben', `${oben}px`)
        // Anfangs schaut das Handy nur ein Stück aus der Tasche (Oberkante der Jacke bei 72 %)
        startY = m.H * 0.72 - hh * (m.breit ? 0.12 : 0.2) - oben
        xZiel = m.breit ? Math.min(m.vw * 0.2, 280) : 0
      }
      anfang = el.getBoundingClientRect().top + window.scrollY
    },

    malen(y: number, m: Mass) {
      const sv = Math.min(Math.max(0, (y - anfang) / m.H), GESAMT)
      const A = auftakt(sv), S = schluss(sv), zur = zurueck(sv)

      // Einstieg: blendet aus, bleibt aber im Baum (h1); der Knopf ist nur erreichbar, solange er zu sehen ist
      setz(held, 'opacity', 1 - A.held)
      setz(held, 'transform', ruhig ? 'none' : `translate3d(0, ${-40 * A.held}px, 0)`)
      setz(held, 'pointerEvents', A.held > 0.5 ? 'none' : '')
      tab(heldKnopf, A.held <= 0.5)
      setz(hinweis, 'opacity', A.hinweis)
      for (const j of [jacke, vorn]) {
        setz(j, 'transform', `translate3d(0, ${A.jacke * m.H * 0.5}px, 0)`)
        setz(j, 'opacity', 1 - A.jackeAus)
      }

      // Handy
      if (ruhig) {
        setz(handy, 'transform', `translate3d(${xZiel}px, 0, 0)`)
        setz(handy, 'opacity', A.ruhigEin * (1 - 0.88 * zur) * (1 - S.handyAus))
      } else {
        const y0 = zwischen(startY, 0, A.raus)
        const kipp = zwischen(-7, 0, A.raus)
        const gross = zwischen(0.84, 1, A.raus) * (1 - 0.08 * zur) * (1 - 0.1 * S.handyAus)
        const x = xZiel * A.rechts * (1 - S.mitte)
        setz(handy, 'transform', `translate3d(${x}px, ${y0}px, 0) rotate(${kipp}deg) scale(${gross})`)
        setz(handy, 'opacity', (1 - 0.88 * zur) * (1 - S.handyAus))
      }
      setz(aus, 'opacity', 1 - A.an)
      setz(zeichen, 'opacity', A.zeichen)
      setz(schein, 'opacity', A.schein)

      // Bilder: nur ein Fenster um das aktuelle laden und zeigen, der Rest display: none (Speicher am iPhone)
      const fenster = bildFenster(sv)
      bilder.forEach((img, i) => {
        if (fenster.has(i)) { setz(img, 'display', ''); if (!bereit[i]) laden(i) }
        else { setz(img, 'display', 'none'); bereit[i] = false }
      })
      const B = bildDeckkraft(sv, bereit)
      bilder.forEach((img, i) => {
        // Die Checkliste der Hygiene schiebt sich deckend von rechts herein wie ein Seitenwechsel in der App
        const schiebt = i === B.oben && B.geschoben && !ruhig && B.schieben < 1
        setz(img, 'opacity', schiebt ? (B.schieben > 0 ? 1 : 0) : B.deckkraft[i])
        setz(img, 'zIndex', i === B.oben ? '2' : B.deckkraft[i] > 0 ? '1' : '0')
        setz(img, 'transform', schiebt ? `translate3d(${100 * (1 - B.schieben)}%, 0, 0)` : 'none')
        setz(img, 'boxShadow', schiebt ? '-12px 0 28px rgba(0,0,0,0.18)' : 'none')
      })

      // Texte der Apps und die großen Kapitelnamen
      TEXTTEILE.forEach((_, k) => {
        const t = textEls[k]
        if (!t) return
        const d = textDeckkraft(k, sv)
        setz(t, 'opacity', d.deckkraft)
        setz(t, 'transform', ruhig ? 'none' : `translate3d(0, ${(1 - d.ein) * 16 - (1 - d.aus) * 16}px, 0)`)
        setz(t, 'visibility', d.deckkraft > 0.01 ? 'visible' : 'hidden')
      })

      // Schluss: der Satz bleibt im Baum, der Knopf ist erst erreichbar, wenn er zu sehen ist
      const z1d = ruhig ? S.ruhig : S.vor + 0.8 * S.zeile1
      const z2d = ruhig ? S.ruhig : S.vor + 0.8 * S.zeile2
      const kd = ruhig ? S.ruhig : S.knopf
      setz(z1, 'opacity', z1d); setz(z2, 'opacity', z2d)
      setz(schlussKnopf, 'opacity', kd)
      setz(schlussKnopf, 'transform', ruhig ? 'none' : `translate3d(0, ${12 * (1 - kd)}px, 0)`)
      setz(schlussKnopf, 'visibility', kd >= 0.5 ? 'visible' : 'hidden')

      // Kapitelzeile (nur am Rechner sichtbar, per CSS)
      const K = kapitelBei(sv)
      setz(zeile, 'opacity', K.sichtbar)
      setz(zeile, 'visibility', K.sichtbar > 0.01 ? 'visible' : 'hidden')
      zeilenKnoepfe.forEach((b, i) => {
        const aktiv = i === K.kapitel
        if (aktiv !== b.hasAttribute('aria-current')) { if (aktiv) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current') }
        setz(b.querySelector('i'), 'transform', `scaleX(${aktiv ? K.anteil : 0})`)
      })
    },
  }
}

/** Grundsätze: Zeilen sind unten blass und werden beim Hochrollen hell (nur Deckkraft) */
function zeilenMaler(root: HTMLElement, ruhig: boolean): Teilnehmer {
  const zeilen = Array.from(root.querySelectorAll<HTMLElement>('.rs-zeile'))
  let mitten: number[] = []
  return {
    messen() { mitten = zeilen.map(z => { const r = z.getBoundingClientRect(); return r.top + window.scrollY + r.height / 2 }) },
    malen(y: number, m: Mass) { zeilen.forEach((z, i) => setz(z, 'opacity', ruhig ? 1 : zeileHell((mitten[i] - y) / m.H))) },
  }
}

/** Bilder im Leerlauf in den Zwischenspeicher holen, je zwei gleichzeitig (nicht bei „Daten sparen“) */
function useVorladen() {
  useEffect(() => {
    const nc = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (nc?.saveData) return
    let ende = false
    const liste = BILDER.slice(1).map(b => `/website/${b}.webp`)
    const holen = () => {
      if (ende) return
      const b = liste.shift()
      if (!b) return
      const img = new Image()
      img.onload = img.onerror = () => holen()
      img.src = b
    }
    const los = () => { holen(); holen() }
    const w = window as Window & { requestIdleCallback?: (f: () => void) => number }
    let h = 0
    const start = () => { h = w.requestIdleCallback ? w.requestIdleCallback(los) : window.setTimeout(los, 1500) }
    if (document.readyState === 'complete') start(); else window.addEventListener('load', start, { once: true })
    return () => { ende = true; window.removeEventListener('load', start); if (!w.requestIdleCallback) clearTimeout(h) }
  }, [])
}

function Szene({ ruhig }: { ruhig: boolean }) {
  const springen = (k: number) => {
    const el = document.querySelector<HTMLElement>('.rs-szene'), mass = document.querySelector<HTMLElement>('.rs-mass')
    if (!el || !mass) return
    const H = mass.getBoundingClientRect().height
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + (KAPITEL_SPANNEN[k].von + 0.25) * H)
  }
  return (
    <section className={`rs-szene${ruhig ? ' ruhig' : ''}`} aria-label="Was Responda kann" style={{ '--n': GESAMT + 1 } as Stil}>
      <a className="rs-sprung" href="#grundsaetze">Apps überspringen</a>
      <span id="apps" className="rs-anker" style={{ '--ab': ANKER } as Stil} />
      <span id="module" className="rs-anker" style={{ '--ab': ANKER } as Stil} />
      <div className="rs-sz-bild">
        <div className="rs-sz-held"><Einstieg /></div>
        {/* Für Screenreader: die Szene als Gliederung (die bewegten Ebenen sind aria-hidden) */}
        <div className="rs-sr">
          <p>Alle Bilder zeigen Responda mit erfundenen Beispieldaten.</p>
          <h2>{MODULE[0].titel[0]} {MODULE[0].titel[1]}</h2>
          <p>{MODULE[0].text}</p>
          {KAPITEL.map(k => (
            <Fragment key={k.name}>
              <h2>{k.name}</h2>
              {MODULE.filter(m => m.kapitel === k.name).map(m => (
                <Fragment key={m.name}><h3>{m.name}: {m.titel[0]} {m.titel[1]}</h3><p>{m.text}</p></Fragment>
              ))}
            </Fragment>
          ))}
        </div>
        <p className="rs-sz-hinweis" aria-hidden="true">Scrollen</p>
        {/* Die Einsatzjacke: Stoff mit Reflexstreifen, die Brusttasche liegt vor dem Handy */}
        <div className="rs-sz-jacke" aria-hidden="true"><i className="rs-sz-reflex" /><i className="rs-sz-naht" /></div>
        <div className="rs-sz-handy" aria-hidden="true">
          <div className="rs-sz-schein" />
          <div className="rs-telefon">
            <div className="rs-sz-schirm">
              {BILDER.map((b, i) => (
                <img key={b} className="rs-sz-app" src={i === 0 ? `/website/${b}.webp` : undefined} data-bild={`/website/${b}.webp`} alt="" width={780} height={1688} decoding="async" />
              ))}
              <div className="rs-sz-zeichen"><span><img src="/logo.svg" alt="" /></span></div>
              <div className="rs-sz-aus" />
            </div>
          </div>
        </div>
        <div className="rs-sz-vorn" aria-hidden="true"><i className="rs-sz-tasche" /><i className="rs-sz-reflex klein" /></div>
        <div className="rs-sz-texte" aria-hidden="true">
          {MODULE.map((m, i) => <div key={m.name} className="rs-sz-text"><ModulText m={m} i={i} /></div>)}
        </div>
        {KAPITEL.map((k, i) => (
          <div key={k.name} className="rs-sz-kapitel" aria-hidden="true">
            <p className="rs-vorzeile">{i + 1} von {KAPITEL.length}</p>
            <p className="rs-sz-kapitelname">{k.titel[0] && <>{k.titel[0]} </>}<em>{k.titel[1]}</em></p>
            <p className="rs-sz-kapitelapps">{MODULE.filter(m => m.kapitel === k.name).map(m => m.name).join(', ')}</p>
          </div>
        ))}
        <nav className="rs-sz-kapitelzeile" aria-label="Kapitel">
          {KAPITEL.map((k, i) => (
            <button key={k.name} type="button" onClick={() => springen(i)}>
              {k.name}<span className="rs-sz-kz-von"> · {i + 1} von {KAPITEL.length}</span><i aria-hidden="true" />
            </button>
          ))}
        </nav>
        <div className="rs-sz-schluss">
          <h2 className="rs-sz-schlusssatz"><span className="z1">{SCHLUSSSATZ[0]}</span> <em className="z2">{SCHLUSSSATZ[1]}</em></h2>
          <a className="rs-knopf creme" href="#kontakt">Interesse melden</a>
        </div>
      </div>
    </section>
  )
}

function ModulText({ m, i }: { m: (typeof MODULE)[number]; i: number }) {
  return (
    <>
      <p className="rs-ueber">{i === 0 ? 'Responda' : <><span className="rs-nr">{NUMMER[i]}</span>{m.name}</>}{m.neu && <span className="rs-neu">Neu</span>}</p>
      <p className="rs-sz-titel">{m.titel[0]} <em>{m.titel[1]}</em></p>
      <p className="rs-lead">{m.text}</p>
    </>
  )
}

function Einstieg() {
  return (
    <div className="rs-held">
      <div className="rs-innen">
        <span className="rs-gross"><img src="/logo.svg" alt="" /></span>
        <p className="rs-vorzeile">In Erprobung</p>
        <h1>Responda</h1>
        <p className="rs-claim">Für den ganzen Dienst. <em>In einer App.</em></p>
        <p className="rs-einl">Für Hilfsorganisationen und Feuerwehren, vom Einsatz bis zur Hygiene.</p>
        <div className="rs-knoepfe">
          <a className="rs-knopf creme" href="#kontakt">Interesse melden</a>
        </div>
      </div>
    </div>
  )
}

function Kontakt({ email, onLegal }: { email: string; onLegal: (which: 'impressum' | 'datenschutz') => void }) {
  const [stand, setStand] = useState<'offen' | 'laeuft' | 'gesendet' | 'fehler'>('offen')
  const dankRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => { if (stand === 'gesendet') dankRef.current?.focus() }, [stand])

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

  return (
    <div className="rs-form rs-hell">
      {/* Von Anfang an da, damit Screenreader die Bestätigung ansagen */}
      <p className="rs-gesendet" role="status" tabIndex={-1} ref={dankRef}>{stand === 'gesendet' ? 'Danke, wir melden uns.' : ''}</p>
      {stand !== 'gesendet' && (
        <form onSubmit={senden}>
          <div className="rs-feld"><label htmlFor="rs-name">Name</label><input id="rs-name" className="rs-eingabe" name="name" required autoComplete="name" /></div>
          <div className="rs-feld"><label htmlFor="rs-mail">E-Mail</label><input id="rs-mail" className="rs-eingabe" type="email" name="email" required autoComplete="email" /></div>
          <div className="rs-feld"><label htmlFor="rs-org">Organisation<small>optional</small></label><input id="rs-org" className="rs-eingabe" name="organisation" autoComplete="organization" placeholder="z. B. FF Musterdorf" /></div>
          <div className="rs-feld"><label htmlFor="rs-text">Nachricht<small>optional</small></label><textarea id="rs-text" className="rs-eingabe" name="nachricht" placeholder="Was möchtet ihr wissen?" /></div>
          {stand === 'fehler' && (
            <p className="rs-fehler" role="alert">Das hat nicht geklappt. Schreibt uns bitte direkt an <a href={`mailto:${email}`}>{email}</a>.</p>
          )}
          <button className="rs-knopf rot" type="submit" disabled={stand === 'laeuft'}>{stand === 'laeuft' ? 'Wird gesendet…' : 'Nachricht senden'}</button>
          <p className="rs-form-hinweis">Wie wir mit euren Angaben umgehen, steht im <button type="button" onClick={() => onLegal('datenschutz')}>Datenschutz</button>.</p>
        </form>
      )}
    </div>
  )
}

export default function Startseite({ email, unterseiten, onLegal }: {
  email: string
  unterseiten: { label: string; href: string }[]
  onLegal: (which: 'impressum' | 'datenschutz') => void
}) {
  // Ganz in Dunkelrot: html und body bleiben rot (oben wie unten), wie auf den Zugangsseiten der App
  useStatusleiste('--rs-kopf')
  const rootRef = useRef<HTMLDivElement>(null)
  const [ruhig, setRuhig] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const m = matchMedia('(prefers-reduced-motion: reduce)')
    const aendern = () => setRuhig(m.matches)
    m.addEventListener?.('change', aendern)
    return () => m.removeEventListener?.('change', aendern)
  }, [])
  const [unter, setUnter] = useState(false)
  useEffect(() => {
    const pruefen = () => setUnter(window.scrollY > 8)
    pruefen()
    window.addEventListener('scroll', pruefen, { passive: true })
    return () => window.removeEventListener('scroll', pruefen)
  }, [])
  useScrollMaler(rootRef, (anstossen) => [szeneMaler(rootRef.current!, ruhig, anstossen), zeilenMaler(rootRef.current!, ruhig)], [ruhig])
  useEinblenden(rootRef)
  useVorladen()

  const links = [...DEF_NAV.filter(l => l.href !== '/#kontakt').map(l => ({ ...l, href: l.href.replace(/^\//, '') })), ...unterseiten]

  return (
    <div className="rs" ref={rootRef}>
      <style>{RS_CSS}</style>
      <div className="rs-mass" aria-hidden="true" />
      <a className="rs-sprung" href="#kontakt">Zum Kontakt</a>
      <div className="rs-statusleiste" aria-hidden="true" />

      <nav className={`rs-nav${unter ? ' unter' : ''}`} aria-label="Hauptmenü">
        <div className="rs-innen">
          <a href="/" className="rs-marke" aria-label="Responda, zum Anfang"><span className="rs-mini"><img src="/logo.svg" alt="" /></span><span className="rs-marke-name">Responda</span></a>
          <div className="rs-links">{links.map(l => <a key={l.href} href={l.href}>{l.label}</a>)}</div>
          <a className="rs-anmelden" href={APP_URL}>Anmelden</a>
          <a className="rs-knopf creme klein" href="#kontakt">Kontakt</a>
        </div>
      </nav>

      <main>
        <Szene ruhig={ruhig} />

        <section id="grundsaetze" className="rs-teil erst" aria-labelledby="rs-verlass">
          <div className="rs-innen rs-schmal">
            <h2 id="rs-verlass" className="rs-vorzeile">Darauf ist Verlass</h2>
            <div className="rs-lesen">
              {GRUNDSAETZE.map(g => (
                <div key={g.name.join(' ')} className="rs-zeile"><h3>{g.name[0]} <em>{g.name[1]}</em></h3><p>{g.text}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section id="fuer-wen" className="rs-teil" aria-labelledby="rs-fuer-wen">
          <div className="rs-innen rs-schmal">
            <h2 id="rs-fuer-wen" className="rs-vorzeile rs-ein">Für wen</h2>
            <p className="rs-satz rs-ein" style={{ '--i': 1 } as Stil}>
              Für {FUER_WEN.map((f, i) => <Fragment key={f}>{i > 0 && (i === FUER_WEN.length - 1 ? ' und ' : ', ')}<em>{f}</em></Fragment>)}.
            </p>
            <p className="rs-satz-zeile rs-ein" style={{ '--i': 2 } as Stil}>Im Ehrenamt und im Hauptamt.</p>
          </div>
        </section>

        <section id="kontakt" className="rs-teil rs-kontaktbild" aria-labelledby="rs-kontakt">
          <span id="stand" className="rs-anker-hier" />
          <div className="rs-innen rs-schmal">
            <span className="rs-gross rs-ein rs-zeichen-ein"><img src="/logo.svg" alt="" /></span>
            <p className="rs-vorzeile rs-ein" style={{ '--i': 1 } as Stil}>Kontakt</p>
            <h2 id="rs-kontakt" className="rs-ein" style={{ '--i': 1 } as Stil}>Schreibt <em>uns.</em></h2>
            <p className="rs-kontakt-satz rs-ein" style={{ '--i': 2 } as Stil}>Responda ist in Erprobung, mit ersten Organisationen im echten Dienst. Wer jetzt mitmacht, gestaltet es mit.</p>
            <p className="rs-kontakt-kosten rs-ein" style={{ '--i': 2 } as Stil}>Über Kosten sprechen wir nach der Erprobung.</p>
            <div className="rs-ein" style={{ '--i': 3 } as Stil}><Kontakt email={email} onLegal={onLegal} /></div>
            <p className="rs-direkt rs-ein" style={{ '--i': 4 } as Stil}>Oder direkt an <a href={`mailto:${email}`}>{email}</a></p>
          </div>
        </section>

        <footer className="rs-fuss">
          <span className="rs-mini rs-fuss-zeichen"><img src="/logo.svg" alt="" /></span>
          <b>Responda Systems</b>
          <div className="rs-fuss-links">
            {unterseiten.map(l => <a key={l.href} href={l.href}>{l.label}</a>)}
            <button type="button" onClick={() => onLegal('impressum')}>Impressum</button>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={() => onLegal('datenschutz')}>Datenschutz</button>
          </div>
          <p className="rs-bildhinweis">Alle Bilder zeigen Responda mit erfundenen Beispieldaten.</p>
        </footer>
      </main>
    </div>
  )
}
