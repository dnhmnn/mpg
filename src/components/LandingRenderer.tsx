import { useState } from 'react'
import {
  APP_URL, API_URL, DEFAULT_DESIGN, DEF_NAV, ICONS, buildCss, safeHtml,
  type Btn, type Design, type GlobalSettings, type PageRec, type Section,
} from '../lib/landingSchema'

// Rendert eine Seite aus Sektionen — identisch für die echte Website und die
// Vorschau im Editor. `preview` unterdrückt Formular-Versand und Navigation.

const check = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>

function bgOf(s: Section, d: Design): string {
  if (s.bg === 'dark') return d.dark
  if (s.bg === 'white') return d.white
  return d.bg
}

function Buttons({ list }: { list?: Btn[] }) {
  if (!list?.length) return null
  return (
    <div className="hero-btns">
      {list.map((b, i) => (
        <a key={i} href={b.href || '#'} className={b.style === 'ghost' ? 'btn-ghost' : b.style === 'primary' ? 'btn-primary' : 'btn-cream'}>{b.label}</a>
      ))}
    </div>
  )
}

function ContactForm({ email, preview }: { email: string; preview?: boolean }) {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (preview) return
    const fd = new FormData(e.currentTarget)
    setSending(true)
    try {
      await fetch(`${API_URL}/api/collections/landing_leads/records`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'), email: fd.get('email'),
          organisation: fd.get('organisation'), nachricht: fd.get('nachricht'),
        }),
      })
      setSent(true)
    } catch {
      window.location.href = `mailto:${email}?subject=${encodeURIComponent('Anfrage Responda')}&body=${encodeURIComponent(String(fd.get('nachricht') || ''))}`
    } finally { setSending(false) }
  }

  if (sent) return <p style={{ fontStyle: 'italic', color: '#16a34a', fontWeight: 700 }}>Danke! Wir melden uns zeitnah.</p>

  return (
    <form className="cform" onSubmit={submit}>
      <div className="fg"><label className="flabel">Name</label><input className="finput" name="name" required /></div>
      <div className="fg"><label className="flabel">E-Mail</label><input className="finput" type="email" name="email" required /></div>
      <div className="fg"><label className="flabel">Organisation</label><input className="finput" name="organisation" /></div>
      <div className="fg"><label className="flabel">Nachricht</label><textarea className="ftextarea" name="nachricht" /></div>
      <button className="btn-form" type="submit" disabled={sending}>{sending ? 'Wird gesendet…' : 'Anfrage senden'}</button>
    </form>
  )
}

function SectionView({ s, d, preview }: { s: Section; d: Design; preview?: boolean }) {
  const dark = s.bg === 'dark'
  const common = { id: s.anchor || undefined, className: dark ? 's-dark' : undefined, style: { background: bgOf(s, d) } }

  if (s.type === 'hero') {
    return (
      <section className="hero" id={s.anchor || undefined} style={{ background: s.image ? `linear-gradient(rgba(61,4,8,0.82),rgba(61,4,8,0.82)), url(${s.image}) center/cover` : d.dark }}>
        <div className="wrap">
          {s.eyebrow && <div className="hero-eye">{s.eyebrow}</div>}
          <h1 dangerouslySetInnerHTML={{ __html: safeHtml(s.heading || '') }} />
          {s.sub && <p className="hero-sub">{s.sub}</p>}
          <Buttons list={s.buttons} />
          {!!s.badges?.length && (
            <div className="badges">
              {s.badges.map(b => <span key={b} className="badge">{b}</span>)}
            </div>
          )}
        </div>
      </section>
    )
  }

  if (s.type === 'cards') {
    const aud = s.variant === 'audience'
    return (
      <section {...common}>
        <div className="wrap">
          {s.eyebrow && <div className="eyebrow">{s.eyebrow}</div>}
          <h2 dangerouslySetInnerHTML={{ __html: safeHtml(s.heading || '') }} />
          {s.sub && <p className="sub">{s.sub}</p>}
          <div className={aud ? 'aud-grid' : 'features-grid'}>
            {(s.items || []).map((it, i) => aud ? (
              <div key={i} className="ac"><h3>{it.title}</h3><p>{it.description}</p></div>
            ) : (
              <div key={i} className="fc">
                <div className="fc-icon">
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[i % ICONS.length] }} />
                </div>
                <div><h3>{it.title}</h3><p>{it.description}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (s.type === 'pricing') {
    return (
      <section {...common}>
        <div className="wrap">
          {s.eyebrow && <div className="eyebrow">{s.eyebrow}</div>}
          <h2 dangerouslySetInnerHTML={{ __html: safeHtml(s.heading || '') }} />
          {s.sub && <p className="sub">{s.sub}</p>}
          <div className="price-grid">
            {(s.tiers || []).map((t, i) => (
              <div key={i} className={`pc${t.featured ? ' feat' : ''}`}>
                {t.badge && <div className="pc-badge">{t.badge}</div>}
                <div className="pc-name">{t.name}</div>
                <div className="pc-price">{/^\d+$/.test(t.price) ? `${t.price} €` : t.price}</div>
                <div className="pc-period">{t.period}</div>
                <div className="pc-div" />
                <ul className="pc-feats">
                  {(t.features || []).filter(Boolean).map(f => <li key={f}>{check}<span>{f}</span></li>)}
                </ul>
                <a href="#kontakt" className={`btn-p ${t.featured ? 'btn-solid' : 'btn-outline'}`}>{t.cta || 'Jetzt anfragen'}</a>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (s.type === 'text') {
    return (
      <section {...common}>
        <div className="wrap">
          {s.eyebrow && <div className="eyebrow">{s.eyebrow}</div>}
          {s.heading && <h2 dangerouslySetInnerHTML={{ __html: safeHtml(s.heading) }} />}
          {s.sub && <p className="sub">{s.sub}</p>}
          <div className="prose">{s.body}</div>
        </div>
      </section>
    )
  }

  if (s.type === 'cta') {
    return (
      <section {...common} style={{ background: bgOf(s, d), textAlign: 'center' }}>
        <div className="wrap">
          <h2 dangerouslySetInnerHTML={{ __html: safeHtml(s.heading || '') }} />
          {s.sub && <p className="sub" style={{ marginBottom: 32 }}>{s.sub}</p>}
          <Buttons list={s.buttons} />
        </div>
      </section>
    )
  }

  if (s.type === 'image') {
    return (
      <section {...common}>
        <div className="wrap">
          {s.heading && <h2 dangerouslySetInnerHTML={{ __html: safeHtml(s.heading) }} />}
          {s.image
            ? <img className="sec-img" src={s.image} alt={s.caption || ''} />
            : <div style={{ padding: 40, textAlign: 'center', border: '1.5px dashed rgba(96,8,18,0.25)', borderRadius: 12, color: '#8a7a68', fontStyle: 'italic' }}>Noch kein Bild gewählt</div>}
          {s.caption && <div className="cap">{s.caption}</div>}
        </div>
      </section>
    )
  }

  // contact
  return (
    <section {...common}>
      <div className="wrap">
        <h2 dangerouslySetInnerHTML={{ __html: safeHtml(s.heading || '') }} />
        {s.sub && <p className="sub">{s.sub}</p>}
        <div className="contact-grid">
          <ContactForm email={s.email || 'info@responda.systems'} preview={preview} />
          <div className="cinfo">
            <div className="cblock"><h3>E-Mail</h3><p><a href={`mailto:${s.email}`}>{s.email}</a></p></div>
            <div className="cblock"><h3>Zugang</h3><p>Bestandskunden gelangen über <a href={APP_URL}>app.responda.systems</a> zur Anwendung.</p></div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function LandingRenderer({ page, global, preview, onLegal }: {
  page: PageRec
  global: GlobalSettings
  preview?: boolean
  onLegal?: (which: 'impressum' | 'datenschutz') => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const d: Design = { ...DEFAULT_DESIGN, ...(global.design || {}) }
  const navItems = global.nav_items?.length ? global.nav_items : DEF_NAV

  return (
    <div className="lp">
      <style>{buildCss(d)}</style>

      <nav>
        <a href={preview ? undefined : '/'} className="nav-logo">
          <img src="/logo.svg" alt="" onError={e => (e.currentTarget.style.display = 'none')} />
          <span>Responda</span>
        </a>
        <ul className="nav-links">
          {navItems.map(item => <li key={item.href + item.label}><a href={preview ? undefined : item.href}>{item.label}</a></li>)}
          <li><a href={preview ? undefined : APP_URL} className="nav-cta">Zur App →</a></li>
        </ul>
        <button className="hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Menü">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </nav>
      <div className={`mob-menu${menuOpen ? ' open' : ''}`}>
        {navItems.map(item => <a key={item.href + item.label} href={preview ? undefined : item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>)}
        <a href={preview ? undefined : APP_URL} className="cta">Zur App →</a>
      </div>

      {(page.sections || []).map(s => <SectionView key={s.id} s={s} d={d} preview={preview} />)}

      <footer>
        <div className="foot-inner">
          <div className="foot-logo"><span>Responda</span></div>
          <div className="foot-copy">{global.footer_copy || `© ${new Date().getFullYear()} Responda Systems`}</div>
          <ul className="foot-links">
            <li><button onClick={() => onLegal?.('impressum')}>Impressum</button></li>
            <li><button onClick={() => onLegal?.('datenschutz')}>Datenschutz</button></li>
            <li><a href={preview ? undefined : APP_URL}>Zur App</a></li>
          </ul>
        </div>
      </footer>
    </div>
  )
}
