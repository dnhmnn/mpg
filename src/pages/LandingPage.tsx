import { useState, useEffect } from 'react'

const APP_URL = 'https://app.responda.systems'
const API_URL = 'https://api.responda.systems'

const C = {
  red: '#600812', dark: '#3d0408', redLight: 'rgba(96,8,18,0.08)',
  text: '#1a0e08', gray: '#8a7a68', bg: '#faf9f7', white: '#ffffff',
  border: 'rgba(96,8,18,0.10)',
}

interface Content { hero_title?: string; hero_subtitle?: string; audience?: {title:string;description:string}[]; features?: {title:string;description:string}[]; contact_email?: string }

const DEF_FEATURES = [
  {title:'Einsatzverwaltung',description:'Einsätze manuell anlegen oder per Alamos-Webhook automatisch empfangen. Realtime-Übersicht für alle.'},
  {title:'Patientenprotokolle',description:'Lückenlose Dokumentation mit Freigabe-Workflow zwischen Teamleader und Administration.'},
  {title:'Lagerverwaltung',description:'Bestände überwachen, Produktausgaben erfassen und Inventur digital abwickeln.'},
  {title:'Unitas — Lernplattform',description:'Interne Wissensmodule, Quizze und Neuigkeiten für das gesamte Team an einem Ort.'},
  {title:'Ausbildungsmanagement',description:'Termine anlegen, Teilnehmer einladen und Nachweise digital verwalten.'},
  {title:'MPG-Prüfungen',description:'Medizinprodukte prüfen, Ergebnisse dokumentieren und Fristen im Blick behalten.'},
  {title:'Verschlüsselter Chat',description:'Ende-zu-Ende-verschlüsselte Kommunikation für das gesamte Team — ohne externe Dienste.'},
  {title:'Dateiverwaltung',description:'Zentrale Ablage für alle Organisationsdokumente, sicher und zugriffsgesteuert.'},
  {title:'Benutzerverwaltung',description:'Rollen, individuelle Rechte, temporäre Zugänge und Supervisor-Funktionen für Admins.'},
]

const DEF_AUDIENCE = [
  {title:'Freiwillige Feuerwehren',description:'Einsatzverwaltung, Alamos-Integration, Ausbildungsplanung und digitale Dokumentation für den Ehrenamt-Alltag.'},
  {title:'Bereitschaften & Hilfsorganisationen',description:'BRK, DRK, ASB, MHD, JUH — Responda passt sich eurer Struktur an, nicht umgekehrt.'},
  {title:'Werkfeuerwehren & Betriebssanitäter',description:'MPG-Prüfungen, Lagerverwaltung und digitale Protokolle für betriebliche Sicherheitsorganisationen.'},
  {title:'Ausbildungseinrichtungen',description:'Lernplattform, Terminverwaltung und Nachweisführung für Schulungs- und Ausbildungszentren.'},
]

const ICONS = [
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

const CSS = `
  .lp *,.lp *::before,.lp *::after{box-sizing:border-box;margin:0;padding:0}
  .lp{font-family:'Atkinson Hyperlegible',-apple-system,sans-serif;background:#faf9f7;color:#1a0e08;-webkit-font-smoothing:antialiased;overflow-x:hidden;min-height:100dvh}
  .lp a{text-decoration:none}
  .lp nav{position:sticky;top:0;z-index:100;background:rgba(250,249,247,0.93);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:0.5px solid rgba(96,8,18,0.10);padding:0 clamp(1.25rem,5vw,4rem);height:60px;display:flex;align-items:center;justify-content:space-between;gap:16px}
  .lp .nav-logo{display:flex;align-items:center;gap:10px;flex-shrink:0}
  .lp .nav-logo img{height:30px;width:30px;object-fit:contain}
  .lp .nav-logo span{font-weight:700;font-size:1.05rem;color:#1a0e08;letter-spacing:-0.01em}
  .lp .nav-links{display:flex;align-items:center;gap:28px;list-style:none}
  .lp .nav-links a{color:#8a7a68;font-size:0.875rem;font-weight:600;transition:color 0.15s}
  .lp .nav-links a:hover{color:#600812}
  .lp .nav-cta{background:#600812!important;color:#fff!important;padding:8px 18px!important;border-radius:99px!important;font-size:0.85rem!important;font-weight:700!important}
  .lp .nav-cta:hover{opacity:0.88}
  .lp .hamburger{display:none;background:none;border:none;cursor:pointer;padding:4px;color:#1a0e08}
  .lp .mob-menu{display:none;position:fixed;inset:60px 0 0;background:#fff;z-index:99;padding:24px;flex-direction:column;gap:4px;border-top:0.5px solid rgba(96,8,18,0.10)}
  .lp .mob-menu.open{display:flex}
  .lp .mob-menu a{color:#1a0e08;font-size:1.05rem;font-weight:700;padding:14px 0;border-bottom:0.5px solid rgba(96,8,18,0.10);display:block}
  .lp .mob-menu a.cta{margin-top:12px;background:#600812;color:#fff;text-align:center;padding:14px;border-radius:14px;border:none}
  @media(max-width:680px){.lp .nav-links{display:none}.lp .hamburger{display:flex}}
  .lp section{padding:clamp(4rem,8vw,7rem) clamp(1.25rem,5vw,4rem)}
  .lp .wrap{max-width:1100px;margin:0 auto}
  .lp .eyebrow{font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.16em;color:#600812;margin-bottom:10px}
  .lp h2{font-size:clamp(1.8rem,4vw,2.8rem);font-weight:800;margin-bottom:10px;letter-spacing:-0.02em;line-height:1.15}
  .lp h2 em{color:#600812;font-style:italic}
  .lp .sub{font-size:1.05rem;color:#8a7a68;font-style:italic;margin-bottom:48px}
  .lp .hero{background:#3d0408;padding:clamp(5rem,10vw,9rem) clamp(1.25rem,5vw,4rem);text-align:center;position:relative;overflow:hidden}
  .lp .hero::before{content:'';position:absolute;top:-60px;right:-80px;width:400px;height:400px;border-radius:50%;background:rgba(255,255,255,0.03);pointer-events:none}
  .lp .hero::after{content:'';position:absolute;bottom:-80px;left:-60px;width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,0.025);pointer-events:none}
  .lp .hero-eye{font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:rgba(253,232,216,0.5);margin-bottom:18px}
  .lp .hero h1{font-size:clamp(2.4rem,6vw,4.2rem);font-weight:800;color:#fde8d8;line-height:1.08;max-width:820px;margin:0 auto 14px;letter-spacing:-0.02em}
  .lp .hero h1 em{font-style:italic;color:#fff}
  .lp .hero-sub{font-size:clamp(1rem,2vw,1.2rem);color:rgba(253,232,216,0.65);font-style:italic;max-width:560px;margin:0 auto 40px;line-height:1.6}
  .lp .hero-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
  .lp .btn-cream{display:inline-block;background:#fde8d8;color:#3d0408;font-weight:700;font-size:0.95rem;padding:14px 28px;border-radius:99px;transition:opacity 0.15s,transform 0.12s;font-family:inherit;border:none;cursor:pointer}
  .lp .btn-cream:hover{opacity:0.9;transform:translateY(-1px)}
  .lp .btn-ghost{display:inline-block;background:rgba(255,255,255,0.10);color:rgba(253,232,216,0.85);font-weight:700;font-size:0.95rem;padding:14px 28px;border-radius:99px;border:1px solid rgba(253,232,216,0.2);transition:background 0.15s;font-family:inherit;cursor:pointer}
  .lp .btn-ghost:hover{background:rgba(255,255,255,0.15)}
  .lp .badges{display:flex;gap:20px;justify-content:center;flex-wrap:wrap;margin-top:48px;padding-top:40px;border-top:0.5px solid rgba(255,255,255,0.08)}
  .lp .badge{font-size:0.75rem;color:rgba(253,232,216,0.4);font-style:italic;display:flex;align-items:center;gap:6px}
  .lp .features-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
  .lp .fc{background:#fff;border-radius:14px;padding:28px 24px;box-shadow:0 1px 6px rgba(0,0,0,0.07);border:0.5px solid rgba(96,8,18,0.10);display:flex;gap:16px;transition:box-shadow 0.2s,transform 0.15s}
  .lp .fc:hover{box-shadow:0 4px 24px rgba(0,0,0,0.10);transform:translateY(-2px)}
  .lp .fc-icon{width:44px;height:44px;border-radius:11px;background:rgba(96,8,18,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#600812}
  .lp .fc h3{font-size:1rem;font-weight:700;color:#1a0e08;margin-bottom:5px;letter-spacing:-0.01em}
  .lp .fc p{font-size:0.85rem;color:#8a7a68;line-height:1.55;font-style:italic}
  .lp .aud-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
  .lp .ac{background:#faf9f7;border-radius:14px;padding:24px 20px;border-left:3px solid #600812}
  .lp .ac h3{font-size:1rem;font-weight:700;margin-bottom:6px;font-style:italic;color:#1a0e08}
  .lp .ac p{font-size:0.83rem;color:#8a7a68;line-height:1.5}
  .lp .price-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;align-items:start}
  .lp .pc{background:#fff;border-radius:14px;padding:32px 28px;box-shadow:0 1px 6px rgba(0,0,0,0.07);border:0.5px solid rgba(96,8,18,0.10);position:relative}
  .lp .pc.feat{background:#3d0408;border-color:transparent;box-shadow:0 4px 24px rgba(0,0,0,0.10)}
  .lp .pc-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#600812;color:#fff;font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;padding:4px 14px;border-radius:99px;white-space:nowrap}
  .lp .pc-name{font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#600812;margin-bottom:10px}
  .lp .pc.feat .pc-name{color:rgba(253,232,216,0.55)}
  .lp .pc-price{font-size:2.6rem;font-weight:800;color:#1a0e08;letter-spacing:-0.03em;line-height:1;margin-bottom:4px}
  .lp .pc.feat .pc-price{color:#fde8d8}
  .lp .pc-period{font-size:0.8rem;color:#8a7a68;font-style:italic;margin-bottom:24px}
  .lp .pc.feat .pc-period{color:rgba(253,232,216,0.45)}
  .lp .pc-div{height:0.5px;background:rgba(96,8,18,0.10);margin-bottom:20px}
  .lp .pc.feat .pc-div{background:rgba(255,255,255,0.1)}
  .lp .pc-feats{list-style:none;display:flex;flex-direction:column;gap:10px;margin-bottom:28px}
  .lp .pc-feats li{display:flex;align-items:flex-start;gap:8px;font-size:0.875rem;color:#1a0e08}
  .lp .pc.feat .pc-feats li{color:rgba(253,232,216,0.8)}
  .lp .pc-feats li svg{flex-shrink:0;margin-top:2px;color:#600812}
  .lp .pc.feat .pc-feats li svg{color:rgba(253,232,216,0.55)}
  .lp .btn-p{display:block;width:100%;text-align:center;padding:13px;border-radius:10px;font-weight:700;font-size:0.9rem;font-family:inherit;cursor:pointer;transition:opacity 0.15s;border:none}
  .lp .btn-outline{background:rgba(96,8,18,0.08);color:#600812}
  .lp .btn-outline:hover{opacity:0.75}
  .lp .btn-solid{background:#fde8d8;color:#3d0408}
  .lp .btn-solid:hover{opacity:0.88}
  .lp .contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}
  @media(max-width:680px){.lp .contact-grid{grid-template-columns:1fr}}
  .lp .cform{display:flex;flex-direction:column;gap:14px}
  .lp .fg{display:flex;flex-direction:column;gap:6px}
  .lp .flabel{font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#600812}
  .lp .finput,.lp .ftextarea{padding:12px 14px;border-radius:10px;border:1.5px solid rgba(96,8,18,0.10);background:#faf9f7;color:#1a0e08;font-size:0.95rem;font-family:inherit;transition:border-color 0.2s;outline:none;-webkit-appearance:none;width:100%}
  .lp .finput:focus,.lp .ftextarea:focus{border-color:#600812}
  .lp .ftextarea{min-height:120px;resize:vertical}
  .lp .finput::placeholder,.lp .ftextarea::placeholder{color:#8a7a68;opacity:0.6}
  .lp .btn-form{background:#600812;color:#fff;border:none;padding:14px;border-radius:10px;font-weight:700;font-size:0.95rem;font-family:inherit;cursor:pointer;transition:opacity 0.15s;width:100%}
  .lp .btn-form:hover{opacity:0.88}
  .lp .cinfo{display:flex;flex-direction:column;gap:28px}
  .lp .cblock h3{font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#600812;margin-bottom:8px}
  .lp .cblock p{font-size:0.95rem;color:#1a0e08;font-style:italic;line-height:1.6}
  .lp .cblock a{color:#600812}
  .lp .cblock a:hover{text-decoration:underline}
  .lp footer{background:#3d0408;padding:40px clamp(1.25rem,5vw,4rem)}
  .lp .foot-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
  .lp .foot-logo span{font-weight:700;color:rgba(253,232,216,0.8);font-size:0.95rem}
  .lp .foot-copy{font-size:0.8rem;color:rgba(253,232,216,0.35);font-style:italic}
  .lp .foot-links{display:flex;gap:20px;list-style:none}
  .lp .foot-links button,.lp .foot-links a{font-size:0.8rem;color:rgba(253,232,216,0.45);background:none;border:none;cursor:pointer;font-family:inherit;transition:color 0.15s;padding:0}
  .lp .foot-links button:hover,.lp .foot-links a:hover{color:rgba(253,232,216,0.85)}
  .lp .overlay{display:none;position:fixed;inset:0;z-index:200;background:rgba(26,14,8,0.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);overflow-y:auto;padding:40px 20px}
  .lp .overlay.open{display:block}
  .lp .modal{background:#fff;border-radius:20px;max-width:760px;margin:0 auto;padding:clamp(28px,5vw,52px);position:relative}
  .lp .modal-close{position:absolute;top:20px;right:20px;width:32px;height:32px;border-radius:50%;background:rgba(96,8,18,0.08);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#600812;font-size:18px;font-family:inherit}
  .lp .modal h1{font-size:1.8rem;letter-spacing:-0.02em;font-weight:800;color:#1a0e08}
  .lp .modal h1 em{color:#600812}
  .lp .lsec{margin-top:28px}
  .lp .lsec h2{font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#600812;margin-bottom:8px}
  .lp .lsec p{font-size:0.9rem;color:#1a0e08;line-height:1.7;margin-bottom:8px}
  .lp .lsec a{color:#600812}
`

const check = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [legal, setLegal] = useState<'impressum'|'datenschutz'|null>(null)
  const [formSent, setFormSent] = useState(false)
  const [formSending, setFormSending] = useState(false)
  const [content, setContent] = useState<Content>({})

  useEffect(() => {
    fetch(`${API_URL}/api/collections/landing_content/records?page=1&perPage=1`,{cache:'no-cache'})
      .then(r=>r.ok?r.json():null).then(d=>{if(d?.items?.[0])setContent(d.items[0])}).catch(()=>{})
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if(e.key==='Escape') setLegal(null) }
    window.addEventListener('keydown',h)
    return () => window.removeEventListener('keydown',h)
  }, [])

  useEffect(() => { document.body.style.overflow = legal ? 'hidden' : ''; return ()=>{document.body.style.overflow=''} }, [legal])

  const features = content.features?.length ? content.features : DEF_FEATURES
  const audience = content.audience?.length ? content.audience : DEF_AUDIENCE
  const email = content.contact_email || 'info@responda.systems'
  const heroTitle = content.hero_title || 'Das <em>digitale Rückgrat</em><br>deiner Organisation.'
  const heroSub = content.hero_subtitle || 'Einsätze, Protokolle, Lager, Ausbildungen und mehr — sicher, schnell und von überall erreichbar.'

  return (
    <div className="lp">
      <style>{CSS}</style>

      {/* NAV */}
      <nav>
        <a href="#" className="nav-logo">
          <img src={`${APP_URL}/logoklein.svg`} alt="" onError={e=>(e.currentTarget.style.display='none')}/>
          <span>Responda</span>
        </a>
        <ul className="nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#fuer-wen">Für wen</a></li>
          <li><a href="#preise">Preise</a></li>
          <li><a href="#kontakt">Kontakt</a></li>
          <li><a href={APP_URL} className="nav-cta">Zur App →</a></li>
        </ul>
        <button className="hamburger" onClick={()=>setMenuOpen(o=>!o)} aria-label="Menü">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </nav>

      <div className={`mob-menu${menuOpen?' open':''}`}>
        <a href="#features" onClick={()=>setMenuOpen(false)}>Features</a>
        <a href="#fuer-wen" onClick={()=>setMenuOpen(false)}>Für wen</a>
        <a href="#preise" onClick={()=>setMenuOpen(false)}>Preise</a>
        <a href="#kontakt" onClick={()=>setMenuOpen(false)}>Kontakt</a>
        <a href={APP_URL} className="cta">Zur App →</a>
      </div>

      {/* HERO */}
      <section className="hero">
        <div className="wrap">
          <div className="hero-eye">Digitale Einsatzverwaltung</div>
          <h1 dangerouslySetInnerHTML={{__html: heroTitle}}/>
          <p className="hero-sub">{heroSub}</p>
          <div className="hero-btns">
            <a href="#kontakt" className="btn-cream">Demo anfragen</a>
            <a href={APP_URL} className="btn-ghost">Zur App →</a>
          </div>
          <div className="badges">
            {[
              {d:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',l:'DSGVO-konform'},
              {d:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',l:'Multi-Mandanten'},
              {d:'<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',l:'Mobile-first PWA'},
              {d:'<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',l:'Echtzeit-Sync'},
            ].map(b=>(
              <span key={b.l} className="badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{__html:b.d}}/>
                {b.l}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{background:'#faf9f7'}}>
        <div className="wrap">
          <div className="eyebrow">Alles in einer Plattform</div>
          <h2>Was <em>Responda</em> kann</h2>
          <p className="sub">Von der Alarmierung bis zum archivierten Protokoll — kein Medienbruch mehr.</p>
          <div className="features-grid">
            {features.map((f,i)=>(
              <div key={i} className="fc">
                <div className="fc-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{__html:ICONS[i%ICONS.length]}}/>
                </div>
                <div><h3>{f.title}</h3><p>{f.description}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FÜR WEN */}
      <section id="fuer-wen" style={{background:'#fff'}}>
        <div className="wrap">
          <div className="eyebrow">Zielgruppen</div>
          <h2>Gemacht für <em>Einsatzorganisationen</em></h2>
          <p className="sub">Responda wurde von Einsatzkräften für Einsatzkräfte entwickelt.</p>
          <div className="aud-grid">
            {audience.map((a,i)=>(
              <div key={i} className="ac"><h3>{a.title}</h3><p>{a.description}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* PREISE */}
      <section id="preise" style={{background:'#faf9f7'}}>
        <div className="wrap">
          <div className="eyebrow">Lizenzmodelle</div>
          <h2>Klare <em>Preise,</em> keine Überraschungen</h2>
          <p className="sub">Monatlich kündbar. Keine Einrichtungsgebühr. Alle Pläne inkl. Updates und Support.</p>
          <div className="price-grid">
            <div className="pc">
              <div className="pc-name">Starter</div>
              <div className="pc-price"><sup style={{fontSize:'1.1rem',verticalAlign:'super',marginRight:2}}>€</sup>49</div>
              <div className="pc-period">pro Monat · bis 25 Nutzer</div>
              <div className="pc-div"/>
              <ul className="pc-feats">{['Einsatzverwaltung','Patientenprotokolle','Unitas Lernplattform','Team-Chat','Dateiverwaltung'].map(f=><li key={f}>{check}{f}</li>)}</ul>
              <a href="#kontakt" className="btn-p btn-outline">Jetzt anfragen</a>
            </div>
            <div className="pc feat">
              <div className="pc-badge">Empfohlen</div>
              <div className="pc-name">Team</div>
              <div className="pc-price"><sup style={{fontSize:'1.1rem',verticalAlign:'super',marginRight:2}}>€</sup>149</div>
              <div className="pc-period">pro Monat · bis 100 Nutzer</div>
              <div className="pc-div"/>
              <ul className="pc-feats">{['Alles aus Starter','Lagerverwaltung','Ausbildungsmanagement','MPG-Prüfungen','Alamos-Webhook','Prioritäts-Support'].map(f=><li key={f}>{check}{f}</li>)}</ul>
              <a href="#kontakt" className="btn-p btn-solid">Jetzt anfragen</a>
            </div>
            <div className="pc">
              <div className="pc-name">Enterprise</div>
              <div className="pc-price" style={{fontSize:'1.9rem',fontStyle:'italic'}}>Auf Anfrage</div>
              <div className="pc-period">unbegrenzte Nutzer · individuell</div>
              <div className="pc-div"/>
              <ul className="pc-feats">{['Alles aus Team','Mehrere Standorte','Individuelle Integrationen','Dedizierter Ansprechpartner','SLA-Vereinbarung'].map(f=><li key={f}>{check}{f}</li>)}</ul>
              <a href="#kontakt" className="btn-p btn-outline">Kontakt aufnehmen</a>
            </div>
          </div>
        </div>
      </section>

      {/* KONTAKT */}
      <section id="kontakt" style={{background:'#fff'}}>
        <div className="wrap">
          <div className="eyebrow">Kontakt</div>
          <h2>Bereit für <em>Responda?</em></h2>
          <p style={{fontSize:'1.05rem',color:'#8a7a68',fontStyle:'italic',marginBottom:40,maxWidth:560}}>Schreib uns — wir melden uns innerhalb von 24 Stunden und richten gerne eine kostenlose Demo ein.</p>
          <div className="contact-grid">
            <form className="cform" onSubmit={e=>{e.preventDefault();setFormSending(true);setTimeout(()=>{setFormSending(false);setFormSent(true)},900)}}>
              <div className="fg"><label className="flabel">Name</label><input className="finput" type="text" placeholder="Max Mustermann" required/></div>
              <div className="fg"><label className="flabel">Organisation</label><input className="finput" type="text" placeholder="Musterrettungsdienst GmbH"/></div>
              <div className="fg"><label className="flabel">E-Mail</label><input className="finput" type="email" placeholder="max@organisation.de" required/></div>
              <div className="fg"><label className="flabel">Nachricht</label><textarea className="ftextarea" placeholder="Erzähl uns von eurer Organisation…"/></div>
              {!formSent
                ? <button type="submit" className="btn-form" disabled={formSending}>{formSending?'Wird gesendet…':'Nachricht senden'}</button>
                : <p style={{fontSize:'0.875rem',color:'#16a34a',fontStyle:'italic',textAlign:'center',padding:'8px 0'}}>Danke — wir melden uns innerhalb von 24 Stunden.</p>}
            </form>
            <div className="cinfo">
              {[
                {t:'E-Mail', c:<a href={`mailto:${email}`}>{email}</a>},
                {t:'Reaktionszeit', c:<span>Wir antworten in der Regel innerhalb eines Werktages.</span>},
                {t:'30 Tage kostenlos testen', c:<span>Wir richten eine Demo-Instanz für euch ein — unverbindlich, ohne Kreditkarte.</span>},
                {t:'Datenschutz', c:<span>Details in unserer <button onClick={()=>setLegal('datenschutz')} style={{background:'none',border:'none',color:'#600812',cursor:'pointer',fontFamily:'inherit',fontSize:'inherit',fontStyle:'inherit',padding:0}}>Datenschutzerklärung</button>.</span>},
              ].map(b=>(
                <div key={b.t} className="cblock"><h3>{b.t}</h3><p>{b.c}</p></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="foot-inner">
          <a href="#" className="foot-logo"><span>Responda</span></a>
          <span className="foot-copy">© {new Date().getFullYear()} Responda Systems</span>
          <ul className="foot-links">
            <li><button onClick={()=>setLegal('impressum')}>Impressum</button></li>
            <li><button onClick={()=>setLegal('datenschutz')}>Datenschutz</button></li>
            <li><a href={APP_URL}>Zur App</a></li>
          </ul>
        </div>
      </footer>

      {/* IMPRESSUM */}
      <div className={`overlay${legal==='impressum'?' open':''}`} onClick={e=>{if(e.target===e.currentTarget)setLegal(null)}}>
        <div className="modal">
          <button className="modal-close" onClick={()=>setLegal(null)}>×</button>
          <div className="eyebrow">Rechtliches</div>
          <h1><em>Impressum</em></h1>
          <div className="lsec"><h2>Angaben gemäß § 5 TMG</h2><p>Responda Systems<br/>[Straße]<br/>[PLZ] [Stadt]<br/>Deutschland</p></div>
          <div className="lsec"><h2>Kontakt</h2><p>E-Mail: <a href={`mailto:${email}`}>{email}</a></p></div>
          <div className="lsec"><h2>Verantwortlich für den Inhalt</h2><p>[Name des Verantwortlichen]</p></div>
          <div className="lsec"><h2>Haftungsausschluss</h2><p>Die Inhalte dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit können wir jedoch keine Gewähr übernehmen.</p></div>
          <div className="lsec"><h2>Urheberrecht</h2><p>Die erstellten Inhalte unterliegen dem deutschen Urheberrecht. Vervielfältigung bedarf der schriftlichen Zustimmung.</p></div>
        </div>
      </div>

      {/* DATENSCHUTZ */}
      <div className={`overlay${legal==='datenschutz'?' open':''}`} onClick={e=>{if(e.target===e.currentTarget)setLegal(null)}}>
        <div className="modal">
          <button className="modal-close" onClick={()=>setLegal(null)}>×</button>
          <div className="eyebrow">Rechtliches</div>
          <h1><em>Datenschutzerklärung</em></h1>
          <div className="lsec"><h2>1. Verantwortlicher</h2><p>Responda Systems · <a href={`mailto:${email}`}>{email}</a></p></div>
          <div className="lsec"><h2>2. Erhobene Daten</h2><p>Beim Besuch erfasst der Server: anonymisierte IP, Datum, aufgerufene Seite, Browser. Löschung nach 7 Tagen.</p></div>
          <div className="lsec"><h2>3. Kontaktformular</h2><p>Angaben werden zur Bearbeitung gespeichert. Keine Weitergabe ohne Einwilligung.</p></div>
          <div className="lsec"><h2>4. Cookies</h2><p>Keine Tracking-Cookies, keine Analyse-Tools.</p></div>
          <div className="lsec"><h2>5. Google Fonts</h2><p>Für einheitliche Darstellung werden Google Fonts geladen (Google Ireland Limited). Dabei wird Ihre IP übertragen.</p></div>
          <div className="lsec"><h2>6. Ihre Rechte (DSGVO)</h2><p>Auskunft, Berichtigung, Löschung: <a href={`mailto:${email}`}>{email}</a></p></div>
          <div className="lsec"><h2>Stand</h2><p>Mai 2025</p></div>
        </div>
      </div>
    </div>
  )
}
