// Datenmodell des Website-Baukastens (Landing Page + Unterseiten).
// Wird von LandingRenderer (Anzeige) und WebsiteEditor (Bearbeitung) geteilt.

export const APP_URL = 'https://app.responda.systems'
export const API_URL = 'https://api.responda.systems'

export interface Btn { label: string; href: string; style: 'cream' | 'ghost' | 'primary' }
export interface Card { title: string; description: string }
export interface Tier {
  name: string; price: string; period: string; features: string[]
  featured?: boolean; badge?: string; cta?: string
}

export type SectionType = 'hero' | 'cards' | 'pricing' | 'text' | 'cta' | 'contact' | 'image'
export type Bg = 'warm' | 'white' | 'dark'

export interface Section {
  id: string
  type: SectionType
  anchor?: string          // für Navigation (#features)
  bg?: Bg
  eyebrow?: string
  heading?: string         // erlaubt <em>…</em> und <br>
  sub?: string
  // hero
  buttons?: Btn[]
  badges?: string[]
  // cards
  items?: Card[]
  variant?: 'feature' | 'audience'
  // pricing
  tiers?: Tier[]
  // text
  body?: string
  // contact
  email?: string
  // image
  image?: string           // vollständige URL
  caption?: string
}

export interface PageRec {
  id?: string
  slug: string             // '' = Startseite
  title: string
  seo_title?: string
  seo_description?: string
  sections: Section[]
  published?: boolean
  in_nav?: boolean
  sort?: number
}

export interface Design {
  primary: string; dark: string; text: string; gray: string
  bg: string; white: string; cream: string; radius: number
}

export const DEFAULT_DESIGN: Design = {
  primary: '#600812', dark: '#3d0408', text: '#1a0e08', gray: '#8a7a68',
  bg: '#faf9f7', white: '#ffffff', cream: '#fde8d8', radius: 14,
}

export interface GlobalSettings {
  id?: string
  nav_items?: { label: string; href: string }[]
  contact_email?: string
  impressum?: string
  datenschutz?: string
  design?: Partial<Design>
  footer_copy?: string
  // Altfelder (Grundlage für die automatisch erzeugte Startseite)
  hero_title?: string
  hero_subtitle?: string
  features?: Card[]
  audience?: Card[]
  pricing?: Tier[]
  show?: { features?: boolean; audience?: boolean; pricing?: boolean; contact?: boolean }
}

export function uid(): string { return Math.random().toString(36).slice(2, 9) }

export const SECTION_LABEL: Record<SectionType, string> = {
  hero: 'Hero (Kopfbereich)', cards: 'Karten-Raster', pricing: 'Preise',
  text: 'Textabschnitt', cta: 'Aufruf (CTA)', contact: 'Kontakt', image: 'Bild',
}

export function newSection(type: SectionType): Section {
  const base: Section = { id: uid(), type, bg: 'warm' }
  switch (type) {
    case 'hero': return { ...base, bg: 'dark', eyebrow: 'Digitale Einsatzverwaltung', heading: 'Neue <em>Überschrift</em>', sub: 'Kurzer Untertitel.', buttons: [{ label: 'Demo anfragen', href: '#kontakt', style: 'cream' }], badges: [] }
    case 'cards': return { ...base, heading: 'Neue <em>Sektion</em>', sub: '', variant: 'feature', items: [{ title: 'Titel', description: 'Beschreibung' }] }
    case 'pricing': return { ...base, anchor: 'preise', heading: 'Klare <em>Preise</em>', tiers: [{ name: 'Basis', price: '49', period: 'pro Monat', features: ['Punkt 1'], cta: 'Jetzt anfragen' }] }
    case 'text': return { ...base, bg: 'white', heading: 'Überschrift', body: 'Text …' }
    case 'cta': return { ...base, bg: 'dark', heading: 'Bereit?', sub: '', buttons: [{ label: 'Zur App →', href: APP_URL, style: 'cream' }] }
    case 'contact': return { ...base, bg: 'white', anchor: 'kontakt', heading: 'Bereit für <em>Responda?</em>', sub: 'Schreib uns — wir melden uns.', email: 'info@responda.systems' }
    case 'image': return { ...base, bg: 'white', image: '', caption: '' }
  }
}

// Standard-Startseite aus den (alten) Globaleinstellungen — dadurch sieht die
// Seite vor der ersten Bearbeitung exakt so aus wie bisher.
export function defaultHomeSections(g: GlobalSettings): Section[] {
  const show = { features: true, audience: true, pricing: true, contact: true, ...(g.show || {}) }
  const s: Section[] = [{
    id: 'hero', type: 'hero', bg: 'dark',
    eyebrow: 'Digitale Einsatzverwaltung',
    heading: g.hero_title || 'Das <em>digitale Rückgrat</em><br>deiner Organisation.',
    sub: g.hero_subtitle || 'Einsätze, Protokolle, Lager, Ausbildungen und mehr — sicher, schnell und von überall erreichbar.',
    buttons: [
      { label: 'Demo anfragen', href: '#kontakt', style: 'cream' },
      { label: 'Zur App →', href: APP_URL, style: 'ghost' },
    ],
    badges: ['DSGVO-konform', 'Multi-Mandanten', 'Mobile-first PWA', 'Echtzeit-Sync'],
  }]
  if (show.features) s.push({ id: 'features', type: 'cards', anchor: 'features', bg: 'warm', variant: 'feature', heading: 'Was <em>Responda</em> kann', sub: 'Alle Module in einer Anwendung — ohne Systembrüche.', items: g.features?.length ? g.features : DEF_FEATURES })
  if (show.audience) s.push({ id: 'fuer-wen', type: 'cards', anchor: 'fuer-wen', bg: 'white', variant: 'audience', heading: 'Gemacht für <em>Einsatzorganisationen</em>', sub: 'Von Ehrenamt bis Berufsorganisation.', items: g.audience?.length ? g.audience : DEF_AUDIENCE })
  if (show.pricing) s.push({ id: 'preise', type: 'pricing', anchor: 'preise', bg: 'warm', heading: 'Klare <em>Preise,</em> keine Überraschungen', sub: 'Monatlich kündbar. Keine Einrichtungsgebühr.', tiers: g.pricing?.length ? g.pricing : DEF_PRICING })
  if (show.contact) s.push({ id: 'kontakt', type: 'contact', anchor: 'kontakt', bg: 'white', heading: 'Bereit für <em>Responda?</em>', sub: 'Schreib uns — wir melden uns innerhalb eines Werktags.', email: g.contact_email || 'info@responda.systems' })
  return s
}

export const DEF_FEATURES: Card[] = [
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

export const DEF_AUDIENCE: Card[] = [
  { title: 'Freiwillige Feuerwehren', description: 'Einsatzverwaltung, Alamos-Integration, Ausbildungsplanung und digitale Dokumentation für den Ehrenamt-Alltag.' },
  { title: 'Bereitschaften & Hilfsorganisationen', description: 'BRK, DRK, ASB, MHD, JUH — Responda passt sich eurer Struktur an, nicht umgekehrt.' },
  { title: 'Werkfeuerwehren & Betriebssanitäter', description: 'MPG-Prüfungen, Lagerverwaltung und digitale Protokolle für betriebliche Sicherheitsorganisationen.' },
  { title: 'Ausbildungseinrichtungen', description: 'Lernplattform, Terminverwaltung und Nachweisführung für Schulungs- und Ausbildungszentren.' },
]

export const DEF_PRICING: Tier[] = [
  { name: 'Starter', price: '49', period: 'pro Monat · bis 25 Nutzer', features: ['Einsatzverwaltung', 'Patientenprotokolle', 'Unitas Lernplattform', 'Team-Chat', 'Dateiverwaltung'], cta: 'Jetzt anfragen' },
  { name: 'Team', price: '149', period: 'pro Monat · bis 100 Nutzer', features: ['Alles aus Starter', 'Lagerverwaltung', 'Ausbildungsmanagement', 'MPG-Prüfungen', 'Alamos-Webhook', 'Prioritäts-Support'], featured: true, badge: 'Empfohlen', cta: 'Jetzt anfragen' },
  { name: 'Enterprise', price: 'Auf Anfrage', period: 'unbegrenzte Nutzer · individuell', features: ['Alles aus Team', 'Mehrere Standorte', 'Individuelle Integrationen', 'Dedizierter Ansprechpartner', 'SLA-Vereinbarung'], cta: 'Kontakt aufnehmen' },
]

export const DEF_NAV = [
  { label: 'Features', href: '#features' },
  { label: 'Für wen', href: '#fuer-wen' },
  { label: 'Preise', href: '#preise' },
  { label: 'Kontakt', href: '#kontakt' },
]

// Erlaubt nur <em> und <br> in Überschriften — alles andere wird escaped
export function safeHtml(raw: string): string {
  return (raw || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/&lt;em&gt;/gi, '<em>').replace(/&lt;\/em&gt;/gi, '</em>')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
}

export function buildCss(d: Design): string {
  const r = d.radius
  return `
  .lp *,.lp *::before,.lp *::after{box-sizing:border-box;margin:0;padding:0}
  .lp{font-family:'Atkinson Hyperlegible',-apple-system,sans-serif;background:${d.bg};color:${d.text};-webkit-font-smoothing:antialiased;overflow-x:hidden;min-height:100dvh}
  .lp a{text-decoration:none}
  .lp nav{position:sticky;top:0;z-index:100;background:${d.bg}ed;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:0.5px solid rgba(96,8,18,0.10);padding:0 clamp(1.25rem,5vw,4rem);height:60px;display:flex;align-items:center;justify-content:space-between;gap:16px}
  .lp .nav-logo{display:flex;align-items:center;gap:10px;flex-shrink:0}
  .lp .nav-logo img{height:32px;width:auto;max-width:100px;object-fit:contain}
  .lp .nav-logo span{font-weight:700;font-size:1.05rem;color:${d.text};letter-spacing:-0.01em}
  .lp .nav-links{display:flex;align-items:center;gap:28px;list-style:none}
  .lp .nav-links a{color:${d.gray};font-size:0.875rem;font-weight:600;transition:color 0.15s}
  .lp .nav-links a:hover{color:${d.primary}}
  .lp .nav-cta{background:${d.primary}!important;color:#fff!important;padding:8px 18px!important;border-radius:99px!important;font-size:0.85rem!important;font-weight:700!important}
  .lp .nav-cta:hover{opacity:0.88}
  .lp .hamburger{display:none;background:none;border:none;cursor:pointer;padding:4px;color:${d.text}}
  .lp .mob-menu{display:none;position:fixed;inset:60px 0 0;background:${d.white};z-index:99;padding:24px;flex-direction:column;gap:4px;border-top:0.5px solid rgba(96,8,18,0.10)}
  .lp .mob-menu.open{display:flex}
  .lp .mob-menu a{color:${d.text};font-size:1.05rem;font-weight:700;padding:14px 0;border-bottom:0.5px solid rgba(96,8,18,0.10);display:block}
  .lp .mob-menu a.cta{margin-top:12px;background:${d.primary};color:#fff;text-align:center;padding:14px;border-radius:${r}px;border:none}
  @media(max-width:680px){.lp .nav-links{display:none}.lp .hamburger{display:flex}}
  .lp section{padding:clamp(4rem,8vw,7rem) clamp(1.25rem,5vw,4rem)}
  .lp .wrap{max-width:1100px;margin:0 auto}
  .lp .eyebrow{font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.16em;color:${d.primary};margin-bottom:10px}
  .lp h2{font-size:clamp(1.8rem,4vw,2.8rem);font-weight:800;margin-bottom:10px;letter-spacing:-0.02em;line-height:1.15}
  .lp h2 em{color:${d.primary};font-style:italic}
  .lp .s-dark h2{color:${d.cream}} .lp .s-dark h2 em{color:#fff} .lp .s-dark .sub{color:rgba(253,232,216,0.6)} .lp .s-dark .eyebrow{color:rgba(253,232,216,0.5)}
  .lp .sub{font-size:1.05rem;color:${d.gray};font-style:italic;margin-bottom:48px}
  .lp .hero{background:${d.dark};padding:clamp(5rem,10vw,9rem) clamp(1.25rem,5vw,4rem);text-align:center;position:relative;overflow:hidden}
  .lp .hero::before{content:'';position:absolute;top:-60px;right:-80px;width:400px;height:400px;border-radius:50%;background:rgba(255,255,255,0.03);pointer-events:none}
  .lp .hero::after{content:'';position:absolute;bottom:-80px;left:-60px;width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,0.025);pointer-events:none}
  .lp .hero .wrap{position:relative;z-index:1}
  .lp .hero-eye{font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:rgba(253,232,216,0.5);margin-bottom:18px}
  .lp .hero h1{font-size:clamp(2.4rem,6vw,4.2rem);font-weight:800;color:${d.cream};line-height:1.08;max-width:820px;margin:0 auto 14px;letter-spacing:-0.02em}
  .lp .hero h1 em{font-style:italic;color:#fff}
  .lp .hero-sub{font-size:clamp(1rem,2vw,1.2rem);color:rgba(253,232,216,0.65);font-style:italic;max-width:560px;margin:0 auto 40px;line-height:1.6}
  .lp .hero-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
  .lp .btn-cream{display:inline-block;background:${d.cream};color:${d.dark};font-weight:700;font-size:0.95rem;padding:14px 28px;border-radius:99px;transition:opacity 0.15s,transform 0.12s;font-family:inherit;border:none;cursor:pointer}
  .lp .btn-cream:hover{opacity:0.9;transform:translateY(-1px)}
  .lp .btn-ghost{display:inline-block;background:rgba(255,255,255,0.10);color:rgba(253,232,216,0.85);font-weight:700;font-size:0.95rem;padding:14px 28px;border-radius:99px;border:1px solid rgba(253,232,216,0.2);transition:background 0.15s;font-family:inherit;cursor:pointer}
  .lp .btn-ghost:hover{background:rgba(255,255,255,0.15)}
  .lp .btn-primary{display:inline-block;background:${d.primary};color:#fff;font-weight:700;font-size:0.95rem;padding:14px 28px;border-radius:99px;font-family:inherit;border:none;cursor:pointer;transition:opacity 0.15s}
  .lp .btn-primary:hover{opacity:0.88}
  .lp .badges{display:flex;gap:20px;justify-content:center;flex-wrap:wrap;margin-top:48px;padding-top:40px;border-top:0.5px solid rgba(255,255,255,0.08)}
  .lp .badge{font-size:0.75rem;color:rgba(253,232,216,0.4);font-style:italic;display:flex;align-items:center;gap:6px}
  .lp .features-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
  .lp .fc{background:${d.white};border-radius:${r}px;padding:28px 24px;box-shadow:0 1px 6px rgba(0,0,0,0.07);border:0.5px solid rgba(96,8,18,0.10);display:flex;gap:16px;transition:box-shadow 0.2s,transform 0.15s}
  .lp .fc:hover{box-shadow:0 4px 24px rgba(0,0,0,0.10);transform:translateY(-2px)}
  .lp .fc-icon{width:44px;height:44px;border-radius:${Math.round(r * 0.8)}px;background:rgba(96,8,18,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${d.primary}}
  .lp .fc h3{font-size:1rem;font-weight:700;color:${d.text};margin-bottom:5px;letter-spacing:-0.01em}
  .lp .fc p{font-size:0.85rem;color:${d.gray};line-height:1.55;font-style:italic}
  .lp .aud-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
  .lp .ac{background:${d.bg};border-radius:${r}px;padding:24px 20px;border-left:3px solid ${d.primary}}
  .lp .ac h3{font-size:1rem;font-weight:700;margin-bottom:6px;font-style:italic;color:${d.text}}
  .lp .ac p{font-size:0.83rem;color:${d.gray};line-height:1.5}
  .lp .price-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;align-items:start}
  .lp .pc{background:${d.white};border-radius:${r}px;padding:32px 28px;box-shadow:0 1px 6px rgba(0,0,0,0.07);border:0.5px solid rgba(96,8,18,0.10);position:relative}
  .lp .pc.feat{background:${d.dark};border-color:transparent;box-shadow:0 4px 24px rgba(0,0,0,0.10)}
  .lp .pc-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:${d.primary};color:#fff;font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;padding:4px 14px;border-radius:99px;white-space:nowrap}
  .lp .pc-name{font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:${d.primary};margin-bottom:10px}
  .lp .pc.feat .pc-name{color:rgba(253,232,216,0.55)}
  .lp .pc-price{font-size:2.6rem;font-weight:800;color:${d.text};letter-spacing:-0.03em;line-height:1;margin-bottom:4px}
  .lp .pc.feat .pc-price{color:${d.cream}}
  .lp .pc-period{font-size:0.8rem;color:${d.gray};font-style:italic;margin-bottom:24px}
  .lp .pc.feat .pc-period{color:rgba(253,232,216,0.45)}
  .lp .pc-div{height:0.5px;background:rgba(96,8,18,0.10);margin-bottom:20px}
  .lp .pc.feat .pc-div{background:rgba(255,255,255,0.1)}
  .lp .pc-feats{list-style:none;display:flex;flex-direction:column;gap:10px;margin-bottom:28px}
  .lp .pc-feats li{display:flex;align-items:flex-start;gap:8px;font-size:0.875rem;color:${d.text}}
  .lp .pc.feat .pc-feats li{color:rgba(253,232,216,0.8)}
  .lp .pc-feats li svg{flex-shrink:0;margin-top:2px;color:${d.primary}}
  .lp .pc.feat .pc-feats li svg{color:rgba(253,232,216,0.55)}
  .lp .btn-p{display:block;width:100%;text-align:center;padding:13px;border-radius:10px;font-weight:700;font-size:0.9rem;font-family:inherit;cursor:pointer;transition:opacity 0.15s;border:none}
  .lp .btn-outline{background:rgba(96,8,18,0.08);color:${d.primary}}
  .lp .btn-outline:hover{opacity:0.75}
  .lp .btn-solid{background:${d.cream};color:${d.dark}}
  .lp .btn-solid:hover{opacity:0.88}
  .lp .contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}
  @media(max-width:680px){.lp .contact-grid{grid-template-columns:1fr}}
  .lp .cform{display:flex;flex-direction:column;gap:14px}
  .lp .fg{display:flex;flex-direction:column;gap:6px}
  .lp .flabel{font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:${d.primary}}
  .lp .finput,.lp .ftextarea{padding:12px 14px;border-radius:10px;border:1.5px solid rgba(96,8,18,0.10);background:${d.bg};color:${d.text};font-size:0.95rem;font-family:inherit;transition:border-color 0.2s;outline:none;-webkit-appearance:none;width:100%}
  .lp .finput:focus,.lp .ftextarea:focus{border-color:${d.primary}}
  .lp .ftextarea{min-height:120px;resize:vertical}
  .lp .finput::placeholder,.lp .ftextarea::placeholder{color:${d.gray};opacity:0.6}
  .lp .btn-form{background:${d.primary};color:#fff;border:none;padding:14px;border-radius:10px;font-weight:700;font-size:0.95rem;font-family:inherit;cursor:pointer;transition:opacity 0.15s;width:100%}
  .lp .btn-form:hover{opacity:0.88}
  .lp .cinfo{display:flex;flex-direction:column;gap:28px}
  .lp .cblock h3{font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:${d.primary};margin-bottom:8px}
  .lp .cblock p{font-size:0.95rem;color:${d.text};font-style:italic;line-height:1.6}
  .lp .cblock a{color:${d.primary}}
  .lp .prose{font-size:1rem;color:${d.text};line-height:1.75;max-width:760px;white-space:pre-wrap}
  .lp .s-dark .prose{color:rgba(253,232,216,0.8)}
  .lp .sec-img{width:100%;border-radius:${r}px;display:block;box-shadow:0 4px 24px rgba(0,0,0,0.10)}
  .lp .cap{font-size:0.8rem;color:${d.gray};font-style:italic;text-align:center;margin-top:10px}
  .lp footer{background:${d.dark};padding:40px clamp(1.25rem,5vw,4rem)}
  .lp .foot-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
  .lp .foot-logo span{font-weight:700;color:rgba(253,232,216,0.8);font-size:0.95rem}
  .lp .foot-copy{font-size:0.8rem;color:rgba(253,232,216,0.35);font-style:italic}
  .lp .foot-links{display:flex;gap:20px;list-style:none}
  .lp .foot-links button,.lp .foot-links a{font-size:0.8rem;color:rgba(253,232,216,0.45);background:none;border:none;cursor:pointer;font-family:inherit;transition:color 0.15s;padding:0}
  .lp .foot-links button:hover,.lp .foot-links a:hover{color:rgba(253,232,216,0.85)}
  .lp .overlay{display:none;position:fixed;inset:0;z-index:200;background:rgba(26,14,8,0.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);overflow-y:auto;padding:40px 20px}
  .lp .overlay.open{display:block}
  .lp .modal{background:${d.white};border-radius:20px;max-width:760px;margin:0 auto;padding:clamp(28px,5vw,52px);position:relative}
  .lp .modal-close{position:absolute;top:20px;right:20px;width:32px;height:32px;border-radius:50%;background:rgba(96,8,18,0.08);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:${d.primary};font-size:18px;font-family:inherit}
  .lp .modal h1{font-size:1.8rem;letter-spacing:-0.02em;font-weight:800;color:${d.text}}
  .lp .modal h1 em{color:${d.primary}}
  .lp .lsec{margin-top:28px}
  .lp .lsec h2{font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:${d.primary};margin-bottom:8px}
  .lp .lsec p{font-size:0.9rem;color:${d.text};line-height:1.7;margin-bottom:8px}
  .lp .lsec a{color:${d.primary}}
`
}

export const ICONS = [
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
