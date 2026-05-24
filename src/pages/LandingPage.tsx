import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { pb } from '../lib/pocketbase'

interface LandingContent {
  hero_title: string
  hero_subtitle: string
  audience: { title: string; description: string }[]
  features: { title: string; description: string }[]
  contact_email: string
}

const DEFAULT: LandingContent = {
  hero_title: 'Das <em>digitale Rückgrat</em><br>deiner Organisation.',
  hero_subtitle: 'Einsätze, Protokolle, Lager, Ausbildungen und mehr — sicher, schnell und von überall erreichbar.',
  audience: [
    { title: 'Freiwillige Feuerwehren', description: 'Einsatzverwaltung, Alamos-Integration, Ausbildungsplanung und digitale Dokumentation für den Ehrenamt-Alltag.' },
    { title: 'Bereitschaften & Hilfsorganisationen', description: 'BRK, DRK, ASB, MHD, JUH — Responda passt sich eurer Struktur an, nicht umgekehrt.' },
    { title: 'Werkfeuerwehren & Betriebssanitäter', description: 'MPG-Prüfungen, Lagerverwaltung und digitale Protokolle für betriebliche Sicherheitsorganisationen.' },
    { title: 'Ausbildungseinrichtungen', description: 'Lernplattform, Terminverwaltung und Nachweisführung für Schulungs- und Ausbildungszentren.' },
  ],
  features: [
    { title: 'Einsatzverwaltung', description: 'Einsätze manuell anlegen oder per Alamos-Webhook automatisch empfangen.' },
    { title: 'Patientenprotokolle', description: 'Lückenlose Dokumentation mit Freigabe-Workflow zwischen Teamleader und Administration.' },
    { title: 'Lagerverwaltung', description: 'Bestände überwachen, Produktausgaben erfassen und Inventur digital abwickeln.' },
    { title: 'Lernplattform', description: 'Interne Wissensmodule, Quizze und Neuigkeiten für das gesamte Team.' },
    { title: 'Ausbildungsmanagement', description: 'Termine anlegen, Teilnehmer einladen und Nachweise digital verwalten.' },
    { title: 'MPG-Prüfungen', description: 'Medizinprodukte prüfen, Ergebnisse dokumentieren und Fristen im Blick behalten.' },
  ],
  contact_email: 'info@responda.systems',
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [content, setContent] = useState<LandingContent>(DEFAULT)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    pb.collection('landing_content').getFullList({ sort: '-created', limit: 1 })
      .then(list => {
        if (list.length > 0) {
          const r = list[0] as any
          setContent({
            hero_title: r.hero_title || DEFAULT.hero_title,
            hero_subtitle: r.hero_subtitle || DEFAULT.hero_subtitle,
            audience: r.audience?.length ? r.audience : DEFAULT.audience,
            features: r.features?.length ? r.features : DEFAULT.features,
            contact_email: r.contact_email || DEFAULT.contact_email,
          })
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--warm-bg)', fontFamily: "'Atkinson Hyperlegible', Georgia, serif" }}>
      <style>{`
        .lp-nav-link { color: var(--warm-gray); text-decoration: none; font-size: 13px; font-weight: 600; transition: color 0.15s; }
        .lp-nav-link:hover { color: #600812; }
        .lp-card { background: #fff; border-radius: 14px; box-shadow: 0 1px 6px rgba(0,0,0,0.07); border-left: 3px solid #600812; padding: 20px 22px; }
        .lp-feature { background: #fff; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); padding: 18px 20px; }
        .lp-btn-primary { display: inline-block; background: #600812; color: #fff; border: none; border-radius: 10px; padding: 14px 28px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; letter-spacing: 0.02em; text-decoration: none; transition: opacity 0.15s, transform 0.12s; }
        .lp-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .lp-btn-secondary { display: inline-block; background: rgba(96,8,18,0.07); color: #600812; border: 1px solid rgba(96,8,18,0.2); border-radius: 10px; padding: 13px 24px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; text-decoration: none; transition: background 0.15s; }
        .lp-btn-secondary:hover { background: rgba(96,8,18,0.12); }
        @media (min-width: 640px) {
          .lp-grid-2 { grid-template-columns: 1fr 1fr !important; }
          .lp-grid-3 { grid-template-columns: 1fr 1fr 1fr !important; }
        }
      `}</style>

      {/* HEADER */}
      <header style={{ background: '#fff', borderBottom: '0.5px solid rgba(96,8,18,0.12)', position: 'sticky', top: 0, zIndex: 100, paddingLeft: 'max(20px, env(safe-area-inset-left))', paddingRight: 'max(20px, env(safe-area-inset-right))' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#3d0408', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              <img src="/logoklein.svg" width="27" height="27" alt="Responda" style={{ display: 'block' }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 17, color: '#1a0e08', letterSpacing: '-0.01em' }}>Responda</span>
          </div>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <a href="#zielgruppen" className="lp-nav-link" style={{ display: window.innerWidth < 480 ? 'none' : undefined }}>Für wen</a>
            <a href="#features" className="lp-nav-link" style={{ display: window.innerWidth < 480 ? 'none' : undefined }}>Features</a>
            <a href={`mailto:${content.contact_email}`} className="lp-nav-link" style={{ display: window.innerWidth < 480 ? 'none' : undefined }}>Kontakt</a>
            <button className="lp-btn-primary" onClick={() => navigate('/login')} style={{ padding: '9px 18px', fontSize: 13 }}>Anmelden</button>
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '0 max(20px, env(safe-area-inset-left))' }}>

        {/* HERO */}
        <section style={{ padding: '80px 0 64px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 24 }}>
            Digitale Einsatzverwaltung
          </div>
          <h1
            style={{ fontSize: 'clamp(32px, 7vw, 60px)', fontWeight: 800, color: '#1a0e08', lineHeight: 1.15, letterSpacing: '-0.02em', margin: '0 0 24px', maxWidth: 700, marginInline: 'auto' }}
            dangerouslySetInnerHTML={{ __html: content.hero_title }}
          />
          <p style={{ fontSize: 'clamp(15px, 2.5vw, 19px)', color: 'var(--warm-gray)', fontStyle: 'italic', maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.6 }}>
            {content.hero_subtitle}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="lp-btn-primary" onClick={() => navigate('/login')}>Jetzt starten</button>
            <a href={`mailto:${content.contact_email}`} className="lp-btn-secondary">Kontakt aufnehmen</a>
          </div>
        </section>

        {/* TRENNLINIE */}
        <div style={{ height: '0.5px', background: 'rgba(96,8,18,0.1)', marginBottom: 64 }} />

        {/* ZIELGRUPPEN */}
        <section id="zielgruppen" style={{ marginBottom: 72 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 8 }}>
            Für wen
          </div>
          <h2 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, color: '#1a0e08', letterSpacing: '-0.01em', margin: '0 0 32px' }}>
            Gemacht für Organisationen,<br /><em style={{ fontWeight: 700, color: '#600812' }}>die es ernst meinen.</em>
          </h2>
          <div className="lp-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
            {content.audience.map((a, i) => (
              <div key={i} className="lp-card">
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1a0e08', marginBottom: 6 }}>{a.title}</div>
                <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.6, fontStyle: 'italic' }}>{a.description}</div>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" style={{ marginBottom: 72 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 8 }}>
            Features
          </div>
          <h2 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, color: '#1a0e08', letterSpacing: '-0.01em', margin: '0 0 32px' }}>
            Alles was ihr braucht,<br /><em style={{ fontWeight: 700, color: '#600812' }}>an einem Ort.</em>
          </h2>
          <div className="lp-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {content.features.map((f, i) => (
              <div key={i} className="lp-feature">
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#600812', marginBottom: 10 }} />
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1a0e08', marginBottom: 5 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.6, fontStyle: 'italic' }}>{f.description}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ background: '#3d0408', borderRadius: 20, padding: 'clamp(36px, 6vw, 56px) clamp(24px, 5vw, 48px)', marginBottom: 64, textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(253,232,216,0.6)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 16 }}>Jetzt loslegen</div>
          <h2 style={{ fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 800, color: '#fde8d8', letterSpacing: '-0.01em', margin: '0 0 12px', fontStyle: 'italic' }}>
            Bereit für die digitale Zukunft?
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(253,232,216,0.7)', margin: '0 0 32px', fontStyle: 'italic', maxWidth: 420, marginInline: 'auto' }}>
            Melde dich an oder kontaktiere uns für eine Demo.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/login')}
              style={{ background: '#fde8d8', color: '#3d0408', border: 'none', borderRadius: 10, padding: '14px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Anmelden
            </button>
            <a
              href={`mailto:${content.contact_email}`}
              style={{ background: 'rgba(253,232,216,0.12)', color: '#fde8d8', border: '1px solid rgba(253,232,216,0.25)', borderRadius: 10, padding: '13px 24px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', textDecoration: 'none' }}
            >
              {content.contact_email}
            </a>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer style={{ borderTop: '0.5px solid rgba(96,8,18,0.1)', padding: '24px max(20px, env(safe-area-inset-left))', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)' }}>© {new Date().getFullYear()} Responda Systems</span>
          <div style={{ display: 'flex', gap: 20 }}>
            <a href={`mailto:${content.contact_email}`} style={{ fontSize: 12, color: 'var(--warm-gray)', textDecoration: 'none' }}>Kontakt</a>
            <a href="/impressum" style={{ fontSize: 12, color: 'var(--warm-gray)', textDecoration: 'none' }}>Impressum</a>
            <a href="/datenschutz" style={{ fontSize: 12, color: 'var(--warm-gray)', textDecoration: 'none' }}>Datenschutz</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
