import React from 'react'

export const inp: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  border: '1.5px solid rgba(96,8,18,0.15)',
  borderRadius: 10, background: '#fff', color: '#1a0e08',
  fontSize: 15, fontFamily: 'inherit', marginTop: 6,
  WebkitAppearance: 'none',
}
export const sel: React.CSSProperties = { ...inp }
export const ta: React.CSSProperties = { ...inp, minHeight: 88, resize: 'vertical' }
export const field: React.CSSProperties = { marginBottom: '1rem' }
export const lbl: React.CSSProperties = {
  display: 'block', fontWeight: 700, color: '#600812',
  fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em',
}

export function PubHeader({ title, onBack, extra }: { title: string; onBack: () => void; extra?: React.ReactNode }) {
  return (
    <header style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '0.5px solid rgba(96,8,18,0.12)', zIndex: 100, paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'max(20px, env(safe-area-inset-left))', paddingRight: 'max(20px, env(safe-area-inset-right))' }}>
      <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', color: '#600812', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#600812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: '#1a0e08', textAlign: 'center' }}>{title}</div>
        {extra ?? <div style={{ width: 22 }} />}
      </div>
    </header>
  )
}

export function PubWrap({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 800, margin: '0 auto', padding: '1rem 1rem 120px' }}>{children}</div>
}

export function PubSection({ title, open, children, icon }: { title: string; open?: boolean; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <details open={open} style={{ background: '#fff', border: '0.5px solid rgba(96,8,18,0.1)', borderLeft: '3px solid #600812', borderRadius: 12, marginBottom: '.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <summary style={{ listStyle: 'none', padding: '.85rem 1rem', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '.6rem', fontSize: 10, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.12em', borderBottom: '0.5px solid rgba(96,8,18,0.08)' }}>
        {icon}{title}
      </summary>
      <div style={{ padding: '1rem' }}>{children}</div>
    </details>
  )
}

export function PubSendBar({ onSubmit, sending, label = 'Absenden', small }: { onSubmit: () => void; sending: boolean; label?: string; small?: boolean }) {
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: '0.5px solid rgba(96,8,18,0.12)', padding: '.75rem max(1rem, env(safe-area-inset-right)) calc(.75rem + env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))', zIndex: 20 }}>
      <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', justifyContent: 'flex-end' }}>
        <button disabled={sending} onClick={onSubmit} style={{ background: sending ? 'rgba(96,8,18,0.15)' : '#600812', border: 'none', color: '#fff', padding: small ? '10px 20px' : '13px 28px', borderRadius: small ? 9 : 12, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', fontSize: small ? 13 : 15, fontFamily: 'inherit', letterSpacing: '0.02em', opacity: sending ? 0.7 : 1 }}>
          {sending ? 'Sende…' : label}
        </button>
      </div>
    </div>
  )
}
