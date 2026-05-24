import { useState, useEffect } from 'react'

const APP_URL = 'https://app.responda.systems'
const API_URL = 'https://api.responda.systems'

interface LandingContent {
  hero_title?: string
  hero_subtitle?: string
  audience?: { title: string; description: string }[]
  features?: { title: string; description: string }[]
  contact_email?: string
}

const FEATURE_ICONS = [
  '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
  '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>',
  '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
  '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
]

const DEFAULT_FEATURES = [
  { title: 'Einsatzverwaltung', description: 'Einsätze manuell anlegen oder per Alamos-Webhook automatisch empfangen. Realtime-Übersicht für alle.' },
  { title: 'Patientenprotokolle', description: 'Lückenlose Dokumentation mit Freigabe-Workflow zwischen Teamleader und Administration.' },
  { title: 'Lagerverwaltung', description: 'Bestände überwachen, Produktausgaben erfassen und Inventur digital abwickeln.' },
  { title: 'Unitas — Lernplattform', description: 'Interne Wissensmodule, Quizze und Neuigkeiten für das gesamte Team an einem Ort.' },
  { title: 'Ausbildungsmanagement', description: 'Termine anlegen, Teilnehmer einladen und Nachweise digital verwalten.' },
  { title: 'MPG-Prüfungen', description: 'Medizinprodukte prüfen, Ergebnisse dokumentieren und Fristen im Blick behalten.' },
  { title: 'Verschlüsselter Chat', description: 'Ende-zu-Ende-verschlüsselte Kommunikation für das gesamte Team — ohne externe Dienste.' },
  { title: 'Dateiverwaltung', description: 'Zentrale Ablage für alle Organisationsdokumente, sicher und zugriffsgesteuert.' },
  { title: 'Benutzerverwaltung', description: 'Rollen, individuelle Rechte, temporäre Zugänge und Supervisor-Funktionen für Admins.' },
]

const DEFAULT_AUDIENCE = [
  { title: 'Freiwillige Feuerwehren', description: 'Einsatzverwaltung, Alamos-Integration, Ausbildungsplanung und digitale Dokumentation für den Ehrenamt-Alltag.' },
  { title: 'Bereitschaften & Hilfsorganisationen', description: 'BRK, DRK, ASB, MHD, JUH — Responda passt sich eurer Struktur an, nicht umgekehrt.' },
  { title: 'Werkfeuerwehren & Betriebssanitäter', description: 'MPG-Prüfungen, Lagerverwaltung und digitale Protokolle für betriebliche Sicherheitsorganisationen.' },
  { title: 'Ausbildungseinrichtungen', description: 'Lernplattform, Terminverwaltung und Nachweisführung für Schulungs- und Ausbildungszentren.' },
]

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function FeatureSvg({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
  )
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [legalOpen, setLegalOpen] = useState<'impressum' | 'datenschutz' | null>(null)
  const [formSent, setFormSent] = useState(false)
  const [formSending, setFormSending] = useState(false)
  const [content, setContent] = useState<LandingContent>({})

  useEffect(() => {
    fetch(`${API_URL}/api/collections/landing_content/records?page=1&perPage=1`, { cache: 'no-cache' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.items?.[0]) setContent(data.items[0]) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLegalOpen(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    document.body.style.overflow = legalOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [legalOpen])

  const features = content.features?.length ? content.features : DEFAULT_FEATURES
  const audience = content.audience?.length ? content.audience : DEFAULT_AUDIENCE
  const contactEmail = content.contact_email || 'info@responda.systems'
  const heroTitle = content.hero_title || 'Das <em>digitale Rückgrat</em><br>deiner Organisation.'
  const heroSubtitle = content.hero_subtitle || 'Einsätze, Protokolle, Lager, Ausbildungen und mehr — sicher, schnell und von überall erreichbar.'

  function handleForm(e: React.FormEvent) {
    e.preventDefault()
    setFormSending(true)
    setTimeout(() => { setFormSending(false); setFormSent(true) }, 900)
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
        html { scroll-behavior: smooth }
        body { font-family: 'Atkinson Hyperlegible', -apple-system, sans-serif; background: #faf9f7; color: #1a0e08; -webkit-font-smoothing: antialiased; overflow-x: hidden }
        :root {
          --red: #600812; --red-dark: #3d0408; --red-light: rgba(96,8,18,0.08);
          --text: #1a0e08; --gray: #8a7a68; --bg: #faf9f7; --white: #ffffff;
          --border: rgba(96,8,18,0.10); --radius: 14px;
          --shadow: 0 1px 6px rgba(0,0,0,0.07); --shadow-lg: 0 4px 24px rgba(0,0,0,0.10);
        }
        .lp-nav { position:sticky;top:0;z-index:100;background:rgba(250,249,247,0.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:0.5px solid var(--border);padding:0 clamp(1.25rem,5vw,4rem);height:60px;display:flex;align-items:center;justify-content:space-between;gap:16px }
        .lp-nav-logo { display:flex;align-items:center;gap:10px;text-decoration:none;flex-shrink:0 }
        .lp-nav-logo img { height:30px;width:30px;object-fit:contain }
        .lp-nav-logo span { font-weight:700;font-size:1.05rem;color:var(--text);letter-spacing:-0.01em }
        .lp-nav-links { display:flex;align-items:center;gap:28px;list-style:none }
        .lp-nav-links a { text-decoration:none;color:var(--gray);font-size:0.875rem;font-weight:600;transition:color 0.15s }
        .lp-nav-links a:hover { color:var(--red) }
        .lp-nav-cta { background:var(--red)!important;color:#fff!important;padding:8px 18px!important;border-radius:99px!important;font-size:0.85rem!important;font-weight:700!important }
        .lp-nav-cta:hover { opacity:0.88 }
        .lp-hamburger { display:none;background:none;border:none;cursor:pointer;padding:4px;color:var(--text) }
        .lp-mobile-menu { display:none;position:fixed;inset:60px 0 0;background:var(--white);z-index:99;padding:24px;flex-direction:column;gap:4px;border-top:0.5px solid var(--border) }
        .lp-mobile-menu.open { display:flex }
        .lp-mobile-menu a { text-decoration:none;color:var(--text);font-size:1.05rem;font-weight:700;padding:14px 0;border-bottom:0.5px solid var(--border) }
        .lp-mobile-menu a.cta { margin-top:12px;background:var(--red);color:#fff;text-align:center;padding:14px;border-radius:var(--radius);border:none }
        @media(max-width:680px){.lp-nav-links{display:none}.lp-hamburger{display:flex}}
        .lp-section { padding:clamp(4rem,8vw,7rem) clamp(1.25rem,5vw,4rem) }
        .lp-container { max-width:1100px;margin:0 auto }
        .lp-label { font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.16em;color:var(--red);margin-bottom:10px }
        .lp-hero { background:var(--red-dark);padding:clamp(5rem,10vw,9rem) clamp(1.25rem,5vw,4rem);text-align:center;position:relative;overflow:hidden }
        .lp-hero::before { content:'';position:absolute;top:-60px;right:-80px;width:400px;height:400px;border-radius:50%;background:rgba(255,255,255,0.03);pointer-events:none }
        .lp-hero::after  { content:'';position:absolute;bottom:-80px;left:-60px;width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,0.025);pointer-events:none }
        .lp-hero-eyebrow { font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:rgba(253,232,216,0.5);margin-bottom:18px }
        .lp-hero h1 { font-size:clamp(2.4rem,6vw,4.2rem);font-weight:800;color:#fde8d8;line-height:1.08;max-width:820px;margin:0 auto 14px;letter-spacing:-0.02em }
        .lp-hero h1 em { font-style:italic;color:#fff }
        .lp-hero > p { font-size:clamp(1rem,2vw,1.2rem);color:rgba(253,232,216,0.65);font-style:italic;max-width:560px;margin:0 auto 40px;line-height:1.6 }
        .lp-hero-actions { display:flex;gap:12px;justify-content:center;flex-wrap:wrap }
        .lp-btn-primary { display:inline-block;background:#fde8d8;color:var(--red-dark);font-weight:700;font-size:0.95rem;padding:14px 28px;border-radius:99px;text-decoration:none;transition:opacity 0.15s,transform 0.12s;font-family:inherit;border:none;cursor:pointer }
        .lp-btn-primary:hover { opacity:0.9;transform:translateY(-1px) }
        .lp-btn-secondary { display:inline-block;background:rgba(255,255,255,0.10);color:rgba(253,232,216,0.85);font-weight:700;font-size:0.95rem;padding:14px 28px;border-radius:99px;text-decoration:none;border:1px solid rgba(253,232,216,0.2);transition:background 0.15s;font-family:inherit;cursor:pointer }
        .lp-btn-secondary:hover { background:rgba(255,255,255,0.15) }
        .lp-hero-badges { display:flex;gap:20px;justify-content:center;flex-wrap:wrap;margin-top:48px;padding-top:40px;border-top:0.5px solid rgba(255,255,255,0.08) }
        .lp-hero-badge { font-size:0.75rem;color:rgba(253,232,216,0.4);font-style:italic;display:flex;align-items:center;gap:6px }
        .lp-features-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px }
        .lp-feature-card { background:var(--white);border-radius:var(--radius);padding:28px 24px;box-shadow:var(--shadow);border:0.5px solid var(--border);display:flex;gap:16px;transition:box-shadow 0.2s,transform 0.15s }
        .lp-feature-card:hover { box-shadow:var(--shadow-lg);transform:translateY(-2px) }
        .lp-feature-icon { width:44px;height:44px;border-radius:11px;background:var(--red-light);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--red) }
        .lp-feature-card h3 { font-size:1rem;font-weight:700;color:var(--text);margin-bottom:5px;letter-spacing:-0.01em }
        .lp-feature-card p { font-size:0.85rem;color:var(--gray);line-height:1.55;font-style:italic }
        .lp-audience-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px }
        .lp-audience-card { background:var(--bg);border-radius:var(--radius);padding:24px 20px;border-left:3px solid var(--red) }
        .lp-audience-card h3 { font-size:1rem;font-weight:700;margin-bottom:6px;font-style:italic }
        .lp-audience-card p { font-size:0.83rem;color:var(--gray);line-height:1.5 }
        .lp-pricing-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;align-items:start }
        .lp-pricing-card { background:var(--white);border-radius:var(--radius);padding:32px 28px;box-shadow:var(--shadow);border:0.5px solid var(--border);position:relative }
        .lp-pricing-card.featured { background:var(--red-dark);border-color:transparent;box-shadow:var(--shadow-lg) }
        .lp-pricing-badge { position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--red);color:#fff;font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;padding:4px 14px;border-radius:99px;white-space:nowrap }
        .lp-pricing-name { font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:var(--red);margin-bottom:10px }
        .lp-pricing-card.featured .lp-pricing-name { color:rgba(253,232,216,0.55) }
        .lp-pricing-price { font-size:2.6rem;font-weight:800;color:var(--text);letter-spacing:-0.03em;line-height:1;margin-bottom:4px }
        .lp-pricing-card.featured .lp-pricing-price { color:#fde8d8 }
        .lp-pricing-period { font-size:0.8rem;color:var(--gray);font-style:italic;margin-bottom:24px }
        .lp-pricing-card.featured .lp-pricing-period { color:rgba(253,232,216,0.45) }
        .lp-pricing-divider { height:0.5px;background:var(--border);margin-bottom:20px }
        .lp-pricing-card.featured .lp-pricing-divider { background:rgba(255,255,255,0.1) }
        .lp-pricing-features { list-style:none;display:flex;flex-direction:column;gap:10px;margin-bottom:28px }
        .lp-pricing-features li { display:flex;align-items:flex-start;gap:8px;font-size:0.875rem;color:var(--text) }
        .lp-pricing-card.featured .lp-pricing-features li { color:rgba(253,232,216,0.8) }
        .lp-pricing-features li svg { flex-shrink:0;margin-top:2px;color:var(--red) }
        .lp-pricing-card.featured .lp-pricing-features li svg { color:rgba(253,232,216,0.55) }
        .lp-btn-pricing { display:block;width:100%;text-align:center;padding:13px;border-radius:10px;font-weight:700;font-size:0.9rem;font-family:inherit;cursor:pointer;text-decoration:none;transition:opacity 0.15s;border:none }
        .lp-btn-outline { background:var(--red-light);color:var(--red) }
        .lp-btn-outline:hover { opacity:0.75 }
        .lp-btn-solid { background:#fde8d8;color:var(--red-dark) }
        .lp-btn-solid:hover { opacity:0.88 }
        .lp-contact-grid { display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start }
        @media(max-width:680px){.lp-contact-grid{grid-template-columns:1fr}}
        .lp-contact-form { display:flex;flex-direction:column;gap:14px }
        .lp-form-group { display:flex;flex-direction:column;gap:6px }
        .lp-form-label { font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--red) }
        .lp-form-input,.lp-form-textarea { padding:12px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg);color:var(--text);font-size:0.95rem;font-family:inherit;transition:border-color 0.2s;outline:none;-webkit-appearance:none }
        .lp-form-input:focus,.lp-form-textarea:focus { border-color:var(--red) }
        .lp-form-textarea { min-height:120px;resize:vertical }
        .lp-form-input::placeholder,.lp-form-textarea::placeholder { color:var(--gray);opacity:0.6 }
        .lp-btn-form { background:var(--red);color:#fff;border:none;padding:14px;border-radius:10px;font-weight:700;font-size:0.95rem;font-family:inherit;cursor:pointer;transition:opacity 0.15s }
        .lp-btn-form:hover { opacity:0.88 }
        .lp-contact-info { display:flex;flex-direction:column;gap:28px }
        .lp-contact-block h3 { font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:var(--red);margin-bottom:8px }
        .lp-contact-block p { font-size:0.95rem;color:var(--text);font-style:italic;line-height:1.6 }
        .lp-contact-block a { color:var(--red);text-decoration:none }
        .lp-contact-block a:hover { text-decoration:underline }
        .lp-footer { background:var(--red-dark);padding:40px clamp(1.25rem,5vw,4rem) }
        .lp-footer-inner { max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px }
        .lp-footer-logo { display:flex;align-items:center;gap:10px;text-decoration:none }
        .lp-footer-logo span { font-weight:700;color:rgba(253,232,216,0.8);font-size:0.95rem }
        .lp-footer-copy { font-size:0.8rem;color:rgba(253,232,216,0.35);font-style:italic }
        .lp-footer-links { display:flex;gap:20px;list-style:none }
        .lp-footer-links a { font-size:0.8rem;color:rgba(253,232,216,0.45);text-decoration:none;transition:color 0.15s;background:none;border:none;cursor:pointer;font-family:inherit }
        .lp-footer-links a:hover { color:rgba(253,232,216,0.85) }
        .lp-legal-overlay { display:none;position:fixed;inset:0;z-index:200;background:rgba(26,14,8,0.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);overflow-y:auto;padding:40px 20px }
        .lp-legal-overlay.open { display:block }
        .lp-legal-modal { background:var(--white);border-radius:20px;max-width:760px;margin:0 auto;padding:clamp(28px,5vw,52px);position:relative }
        .lp-legal-close { position:absolute;top:20px;right:20px;width:32px;height:32px;border-radius:50%;background:var(--red-light);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--red);font-size:18px;font-family:inherit }
        .lp-legal-modal h1 { font-size:1.8rem;letter-spacing:-0.02em;margin-bottom:0 }
        .lp-legal-modal h1 em { color:var(--red) }
        .lp-legal-section { margin-top:28px }
        .lp-legal-section h2 { font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:var(--red);margin-bottom:8px }
        .lp-legal-section p { font-size:0.9rem;color:var(--text);line-height:1.7;margin-bottom:8px }
        .lp-legal-section a { color:var(--red) }
        h2.lp-h2 { font-size:clamp(1.8rem,4vw,2.8rem);font-weight:800;margin-bottom:10px;letter-spacing:-0.02em;line-height:1.15 }
        h2.lp-h2 em { color:var(--red);font-style:italic }
        .lp-sub { font-size:1.05rem;color:var(--gray);font-style:italic;margin-bottom:48px }
      `}</style>

      {/* NAV */}
      <nav className="lp-nav">
        <a href="#" className="lp-nav-logo">
          <img src={`${APP_URL}/logoklein.svg`} alt="Responda" onError={e => (e.currentTarget.style.display = 'none')} />
          <span>Responda</span>
        </a>
        <ul className="lp-nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#fuer-wen">Für wen</a></li>
          <li><a href="#preise">Preise</a></li>
          <li><a href="#kontakt">Kontakt</a></li>
          <li><a href={APP_URL} className="lp-nav-cta">Zur App →</a></li>
        </ul>
        <button className="lp-hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Menü">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
        </button>
      </nav>

      <div className={`lp-mobile-menu${menuOpen ? ' open' : ''}`}>
        <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
        <a href="#fuer-wen" onClick={() => setMenuOpen(false)}>Für wen</a>
        <a href="#preise" onClick={() => setMenuOpen(false)}>Preise</a>
        <a href="#kontakt" onClick={() => setMenuOpen(false)}>Kontakt</a>
        <a href={APP_URL} className="cta">Zur App →</a>
      </div>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-container">
          <div className="lp-hero-eyebrow">Digitale Einsatzverwaltung</div>
          <h1 dangerouslySetInnerHTML={{ __html: heroTitle }} />
          <p>{heroSubtitle}</p>
          <div className="lp-hero-actions">
            <a href="#kontakt" className="lp-btn-primary">Demo anfragen</a>
            <a href={APP_URL} className="lp-btn-secondary">Zur App →</a>
          </div>
          <div className="lp-hero-badges">
            {[
              { icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', label: 'DSGVO-konform' },
              { icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', label: 'Multi-Mandanten' },
              { icon: '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>', label: 'Mobile-first PWA' },
              { icon: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>', label: 'Echtzeit-Sync' },
            ].map(b => (
              <span key={b.label} className="lp-hero-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: b.icon }} />
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="lp-section" style={{ background: '#faf9f7' }}>
        <div className="lp-container">
          <div className="lp-label">Alles in einer Plattform</div>
          <h2 className="lp-h2">Was <em>Responda</em> kann</h2>
          <p className="lp-sub">Von der Alarmierung bis zum archivierten Protokoll — kein Medienbruch mehr.</p>
          <div className="lp-features-grid">
            {features.map((f, i) => (
              <div key={i} className="lp-feature-card">
                <div className="lp-feature-icon"><FeatureSvg d={FEATURE_ICONS[i % FEATURE_ICONS.length]} /></div>
                <div><h3>{f.title}</h3><p>{f.description}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FÜR WEN */}
      <section id="fuer-wen" className="lp-section" style={{ background: '#fff' }}>
        <div className="lp-container">
          <div className="lp-label">Zielgruppen</div>
          <h2 className="lp-h2">Gemacht für <em>Einsatzorganisationen</em></h2>
          <p className="lp-sub">Responda wurde von Einsatzkräften für Einsatzkräfte entwickelt.</p>
          <div className="lp-audience-grid">
            {audience.map((a, i) => (
              <div key={i} className="lp-audience-card">
                <h3>{a.title}</h3>
                <p>{a.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PREISE */}
      <section id="preise" className="lp-section" style={{ background: '#faf9f7' }}>
        <div className="lp-container">
          <div className="lp-label">Lizenzmodelle</div>
          <h2 className="lp-h2">Klare <em>Preise,</em> keine Überraschungen</h2>
          <p className="lp-sub">Monatlich kündbar. Keine Einrichtungsgebühr. Alle Pläne inkl. Updates und Support.</p>
          <div className="lp-pricing-grid">
            <div className="lp-pricing-card">
              <div className="lp-pricing-name">Starter</div>
              <div className="lp-pricing-price"><sup style={{ fontSize: '1.1rem', fontWeight: 700, verticalAlign: 'super', marginRight: 2 }}>€</sup>49</div>
              <div className="lp-pricing-period">pro Monat · bis 25 Nutzer</div>
              <div className="lp-pricing-divider" />
              <ul className="lp-pricing-features">
                {['Einsatzverwaltung', 'Patientenprotokolle', 'Unitas Lernplattform', 'Team-Chat', 'Dateiverwaltung'].map(f => (
                  <li key={f}><CheckIcon />{f}</li>
                ))}
              </ul>
              <a href="#kontakt" className="lp-btn-pricing lp-btn-outline">Jetzt anfragen</a>
            </div>

            <div className="lp-pricing-card featured">
              <div className="lp-pricing-badge">Empfohlen</div>
              <div className="lp-pricing-name">Team</div>
              <div className="lp-pricing-price"><sup style={{ fontSize: '1.1rem', fontWeight: 700, verticalAlign: 'super', marginRight: 2 }}>€</sup>149</div>
              <div className="lp-pricing-period">pro Monat · bis 100 Nutzer</div>
              <div className="lp-pricing-divider" />
              <ul className="lp-pricing-features">
                {['Alles aus Starter', 'Lagerverwaltung', 'Ausbildungsmanagement', 'MPG-Prüfungen', 'Alamos-Webhook', 'Prioritäts-Support'].map(f => (
                  <li key={f}><CheckIcon />{f}</li>
                ))}
              </ul>
              <a href="#kontakt" className="lp-btn-pricing lp-btn-solid">Jetzt anfragen</a>
            </div>

            <div className="lp-pricing-card">
              <div className="lp-pricing-name">Enterprise</div>
              <div className="lp-pricing-price" style={{ fontSize: '1.9rem', paddingTop: 4, fontStyle: 'italic' }}>Auf Anfrage</div>
              <div className="lp-pricing-period">unbegrenzte Nutzer · individuell</div>
              <div className="lp-pricing-divider" />
              <ul className="lp-pricing-features">
                {['Alles aus Team', 'Mehrere Standorte', 'Individuelle Integrationen', 'Dedizierter Ansprechpartner', 'SLA-Vereinbarung'].map(f => (
                  <li key={f}><CheckIcon />{f}</li>
                ))}
              </ul>
              <a href="#kontakt" className="lp-btn-pricing lp-btn-outline">Kontakt aufnehmen</a>
            </div>
          </div>
        </div>
      </section>

      {/* KONTAKT */}
      <section id="kontakt" className="lp-section" style={{ background: '#fff' }}>
        <div className="lp-container">
          <div className="lp-label">Kontakt</div>
          <h2 className="lp-h2">Bereit für <em>Responda?</em></h2>
          <p style={{ fontSize: '1.05rem', color: 'var(--gray)', fontStyle: 'italic', marginBottom: 40, maxWidth: 560 }}>
            Schreib uns — wir melden uns innerhalb von 24 Stunden und richten gerne eine kostenlose Demo ein.
          </p>
          <div className="lp-contact-grid">
            <form className="lp-contact-form" onSubmit={handleForm}>
              <div className="lp-form-group"><label className="lp-form-label">Name</label><input className="lp-form-input" type="text" placeholder="Max Mustermann" required /></div>
              <div className="lp-form-group"><label className="lp-form-label">Organisation</label><input className="lp-form-input" type="text" placeholder="Musterrettungsdienst GmbH" /></div>
              <div className="lp-form-group"><label className="lp-form-label">E-Mail</label><input className="lp-form-input" type="email" placeholder="max@organisation.de" required /></div>
              <div className="lp-form-group"><label className="lp-form-label">Nachricht</label><textarea className="lp-form-textarea" placeholder="Erzähl uns von eurer Organisation und was ihr braucht…" /></div>
              {!formSent
                ? <button type="submit" className="lp-btn-form" disabled={formSending}>{formSending ? 'Wird gesendet…' : 'Nachricht senden'}</button>
                : <p style={{ fontSize: '0.875rem', color: '#16a34a', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>Danke — wir melden uns innerhalb von 24 Stunden bei dir.</p>
              }
            </form>
            <div className="lp-contact-info">
              {[
                { title: 'E-Mail', content: <a href={`mailto:${contactEmail}`}>{contactEmail}</a> },
                { title: 'Reaktionszeit', content: <span>Wir antworten in der Regel innerhalb eines Werktages.</span> },
                { title: '30 Tage kostenlos testen', content: <span>Wir richten eine Demo-Instanz für euch ein — unverbindlich, vollständig konfiguriert, ohne Kreditkarte.</span> },
                { title: 'Datenschutz', content: <span>Eure Daten werden ausschließlich zur Bearbeitung eurer Anfrage verwendet. Details in unserer <button onClick={() => setLegalOpen('datenschutz')} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', fontStyle: 'inherit', padding: 0 }}>Datenschutzerklärung</button>.</span> },
              ].map(b => (
                <div key={b.title} className="lp-contact-block">
                  <h3>{b.title}</h3>
                  <p>{b.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <a href="#" className="lp-footer-logo"><span>Responda</span></a>
          <span className="lp-footer-copy">© {new Date().getFullYear()} Responda Systems</span>
          <ul className="lp-footer-links">
            <li><a onClick={() => setLegalOpen('impressum')}>Impressum</a></li>
            <li><a onClick={() => setLegalOpen('datenschutz')}>Datenschutz</a></li>
            <li><a href={APP_URL}>Zur App</a></li>
          </ul>
        </div>
      </footer>

      {/* IMPRESSUM MODAL */}
      <div className={`lp-legal-overlay${legalOpen === 'impressum' ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setLegalOpen(null) }}>
        <div className="lp-legal-modal">
          <button className="lp-legal-close" onClick={() => setLegalOpen(null)}>×</button>
          <div className="lp-label">Rechtliches</div>
          <h1><em>Impressum</em></h1>
          <div className="lp-legal-section"><h2>Angaben gemäß § 5 TMG</h2><p>Responda Systems<br />[Straße und Hausnummer]<br />[PLZ] [Stadt]<br />Deutschland</p></div>
          <div className="lp-legal-section"><h2>Kontakt</h2><p>E-Mail: <a href={`mailto:${contactEmail}`}>{contactEmail}</a></p></div>
          <div className="lp-legal-section"><h2>Verantwortlich für den Inhalt</h2><p>[Name des Verantwortlichen]</p></div>
          <div className="lp-legal-section"><h2>Haftungsausschluss</h2><p>Die Inhalte dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.</p></div>
          <div className="lp-legal-section"><h2>Urheberrecht</h2><p>Die durch die Seitenbetreiber erstellten Inhalte und Werke unterliegen dem deutschen Urheberrecht. Vervielfältigung, Bearbeitung und Verbreitung bedürfen der schriftlichen Zustimmung des Erstellers.</p></div>
        </div>
      </div>

      {/* DATENSCHUTZ MODAL */}
      <div className={`lp-legal-overlay${legalOpen === 'datenschutz' ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setLegalOpen(null) }}>
        <div className="lp-legal-modal">
          <button className="lp-legal-close" onClick={() => setLegalOpen(null)}>×</button>
          <div className="lp-label">Rechtliches</div>
          <h1><em>Datenschutz&shy;erklärung</em></h1>
          <div className="lp-legal-section"><h2>1. Verantwortlicher</h2><p>Responda Systems · [Adresse] · <a href={`mailto:${contactEmail}`}>{contactEmail}</a></p></div>
          <div className="lp-legal-section"><h2>2. Erhobene Daten beim Seitenbesuch</h2><p>Beim Besuch dieser Website erfasst der Webserver automatisch: anonymisierte IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Referrer-URL und Browsertyp. Diese Daten dienen ausschließlich der technischen Bereitstellung und werden nach 7 Tagen gelöscht.</p></div>
          <div className="lp-legal-section"><h2>3. Kontaktformular</h2><p>Wenn Sie uns über das Kontaktformular kontaktieren, werden Ihre Angaben zur Bearbeitung der Anfrage gespeichert. Wir geben diese Daten nicht ohne Ihre Einwilligung weiter.</p></div>
          <div className="lp-legal-section"><h2>4. Cookies</h2><p>Diese Website verwendet keine Tracking-Cookies und keine Analyse-Tools. Es werden ausschließlich technisch notwendige Verbindungen zu Google Fonts hergestellt.</p></div>
          <div className="lp-legal-section"><h2>5. Google Fonts</h2><p>Für eine einheitliche Darstellung nutzen wir Google Fonts (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland). Dabei wird Ihre IP-Adresse an Google übertragen.</p></div>
          <div className="lp-legal-section"><h2>6. Ihre Rechte (DSGVO)</h2><p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung sowie Datenübertragbarkeit. Wenden Sie sich dazu an: <a href={`mailto:${contactEmail}`}>{contactEmail}</a></p></div>
          <div className="lp-legal-section"><h2>7. Beschwerderecht</h2><p>Sie haben das Recht, sich bei der zuständigen Datenschutz-Aufsichtsbehörde zu beschweren.</p></div>
          <div className="lp-legal-section"><h2>Stand</h2><p>Mai 2025</p></div>
        </div>
      </div>
    </>
  )
}
