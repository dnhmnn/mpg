import type { AppIconProps } from '../types'

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.25, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const icons: Record<string, JSX.Element> = {
  siren: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M12 3L2.5 19.5h19L12 3z"/>
      <line x1="12" y1="10" x2="12" y2="14.5"/>
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/>
    </svg>
  ),
  clipboard: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
      <path d="M9 5a2 2 0 014 0"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
      <line x1="12" y1="9" x2="12" y2="15"/>
    </svg>
  ),
  file: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
      <polyline points="13 2 13 9 20 9"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="13" y2="17"/>
    </svg>
  ),
  package: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22" x2="12" y2="12"/>
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
      <path d="M9 5a2 2 0 014 0"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
    </svg>
  ),
  qrcode: (
    <svg viewBox="0 0 24 24" {...s}>
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="5" y="5" width="3" height="3" fill="currentColor" stroke="none"/>
      <rect x="16" y="5" width="3" height="3" fill="currentColor" stroke="none"/>
      <rect x="5" y="16" width="3" height="3" fill="currentColor" stroke="none"/>
      <rect x="14" y="14" width="3" height="3" rx="0.5"/>
      <rect x="18" y="14" width="3" height="3" rx="0.5"/>
      <rect x="14" y="18" width="3" height="3" rx="0.5"/>
      <rect x="18" y="18" width="3" height="3" rx="0.5"/>
    </svg>
  ),
  graduation: (
    <svg viewBox="0 0 24 24" {...s}>
      <polygon points="12 2 22 8.5 12 15 2 8.5"/>
      <path d="M6 11.5v5c0 2 2.7 3.5 6 3.5s6-1.5 6-3.5v-5"/>
      <line x1="22" y1="8.5" x2="22" y2="14"/>
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
      <line x1="9" y1="7" x2="15" y2="7"/>
      <line x1="9" y1="11" x2="13" y2="11"/>
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      <line x1="8" y1="10" x2="16" y2="10"/>
      <line x1="8" y1="14" x2="13" y2="14"/>
    </svg>
  ),
  dashboard: (
    <svg viewBox="0 0 24 24" {...s}>
      <rect x="3" y="3" width="7" height="9" rx="1"/>
      <rect x="14" y="3" width="7" height="5" rx="1"/>
      <rect x="14" y="12" width="7" height="9" rx="1"/>
      <rect x="3" y="16" width="7" height="5" rx="1"/>
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" {...s}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" {...s}>
      <circle cx="9" cy="7" r="3"/>
      <path d="M3 21v-2a5 5 0 015-5h2"/>
      <circle cx="17" cy="7" r="3"/>
      <path d="M21 21v-2a5 5 0 00-5-5h-2"/>
    </svg>
  ),
  mpg: (
    <svg viewBox="0 0 24 24" {...s}>
      <polyline points="2 12 5.5 12 8 4 10.5 20 13.5 8 16 16 18.5 12 22 12"/>
    </svg>
  ),
  cross: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M9 3h6v6h6v6h-6v6H9v-6H3v-6h6V3z"/>
    </svg>
  ),
  'file-text': (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="13" y2="17"/>
    </svg>
  ),
  note: (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M4 4h16v11l-5 5H4V4z"/>
      <polyline points="15 20 15 15 20 15"/>
      <line x1="8" y1="9" x2="16" y2="9"/>
      <line x1="8" y1="13" x2="12" y2="13"/>
    </svg>
  ),
}

export default function AppIcon({ icon }: AppIconProps) {
  return icons[icon] || icons.dashboard
}
