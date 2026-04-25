import React from 'react'

export const inp: React.CSSProperties = {
  width: '100%', padding: '12px 14px', border: '0.5px solid var(--border-strong)',
  borderRadius: 10, background: 'var(--bg-input)', color: 'var(--text)',
  fontSize: 15, fontFamily: 'inherit', marginTop: 6,
}
export const sel: React.CSSProperties = { ...inp }
export const ta: React.CSSProperties = { ...inp, minHeight: 88, resize: 'vertical' }
export const field: React.CSSProperties = { marginBottom: '1rem' }
export const lbl: React.CSSProperties = { display: 'block', fontWeight: 600, color: 'var(--text)', fontSize: 14 }

export function PubHeader({ title, onBack, extra }: { title: string; onBack: () => void; extra?: React.ReactNode }) {
  return (
    <header style={{ position: 'sticky', top: 0, background: 'var(--bg-status-bar)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '0.5px solid var(--border)', zIndex: 10 }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 1rem', height: 54, display: 'flex', alignItems: 'center' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 16, cursor: 'pointer', padding: '8px 0', fontFamily: 'inherit', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          Zurück
        </button>
        <h1 style={{ flex: 1, textAlign: 'center', fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{title}</h1>
        {extra ?? <div style={{ width: 72 }} />}
      </div>
    </header>
  )
}

export function PubWrap({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 800, margin: '0 auto', padding: '1rem 1rem 100px' }}>{children}</div>
}

export function PubSection({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} style={{ background: 'var(--bg-card)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '0.5px solid var(--border)', borderRadius: 16, marginBottom: '.75rem', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <summary style={{ listStyle: 'none', padding: '.9rem 1rem', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '.6rem', fontSize: '1rem', color: 'var(--text)', borderBottom: '0.5px solid var(--border)' }}>{title}</summary>
      <div style={{ padding: '1rem' }}>{children}</div>
    </details>
  )
}

export function PubSendBar({ onSubmit, sending, label = 'Absenden' }: { onSubmit: () => void; sending: boolean; label?: string }) {
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'var(--bg-status-bar)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '0.5px solid var(--border)', padding: '.75rem 1rem', zIndex: 20 }}>
      <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', justifyContent: 'flex-end' }}>
        <button disabled={sending} onClick={onSubmit} style={{ background: sending ? 'var(--bg-hover)' : 'var(--accent)', border: 'none', color: sending ? 'var(--text-secondary)' : '#fff', padding: '12px 24px', borderRadius: 12, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', fontSize: '1rem', fontFamily: 'inherit', transition: 'all .2s' }}>
          {sending ? '⏳ Sende…' : `✈ ${label}`}
        </button>
      </div>
    </div>
  )
}
