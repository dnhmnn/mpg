import React from 'react'

export const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: '.88rem', fontWeight: 700, color: 'var(--text-secondary)' }
export const inp: React.CSSProperties = { width: '100%', padding: '.55rem .6rem', border: '1px solid #e2e8f0', borderRadius: '.5rem', background: '#fff', fontSize: 16, marginTop: 4 }
export const sel: React.CSSProperties = { ...inp }
export const ta: React.CSSProperties = { ...inp, minHeight: 88, resize: 'vertical' }
export const field: React.CSSProperties = { marginBottom: '.75rem' }

export function PubHeader({ title, onBack, extra }: { title: string; onBack: () => void; extra?: React.ReactNode }) {
  return (
    <header style={{ position: 'sticky', top: 0, background: '#667eea', color: '#fff', zIndex: 10 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '.75rem 1rem', display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 800 }}>{title}</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {extra}
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', padding: '7px 12px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '.9rem' }}>← Zurück</button>
        </div>
      </div>
    </header>
  )
}

export function PubWrap({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1rem 1rem 100px' }}>{children}</div>
}

export function PubSection({ title, open, children, icon }: { title: string; open?: boolean; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <details open={open} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '.75rem', marginBottom: '.8rem', overflow: 'hidden' }}>
      <summary style={{ listStyle: 'none', padding: '.9rem 1rem', cursor: 'pointer', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '.6rem', fontSize: '1rem' }}>{icon}{title}</summary>
      <div style={{ padding: '1rem' }}>{children}</div>
    </details>
  )
}

export function PubSendBar({ onSubmit, sending, label = 'Absenden' }: { onSubmit: () => void; sending: boolean; label?: string }) {
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#667eea', borderTop: '1px solid rgba(0,0,0,.2)', padding: '.6rem 1rem', zIndex: 20 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'flex-end' }}>
        <button disabled={sending} onClick={onSubmit} style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.4)', color: '#fff', padding: '.55rem .9rem', borderRadius: '.55rem', fontWeight: 800, cursor: sending ? 'not-allowed' : 'pointer', fontSize: '1rem', opacity: sending ? .6 : 1 }}>
          {sending ? '⏳ Sende…' : `✈ ${label}`}
        </button>
      </div>
    </div>
  )
}
