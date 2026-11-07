// Alter Ausdruck der Patientenverwaltung (DetailsModal): Texte HTML-sicher, Unterschriften nur
// als eingebettete Bilder. Befund: Gegenzeichnung admin_unterschrift landete roh in <img src="…">.
import { describe, expect, it } from 'vitest'
import { bildQuelle, druckSicher } from '../../pages/patienten/DetailsModal'

describe('Ausdruck DetailsModal', () => {
  it('druckSicher entschärft jeden Text, rekursiv, Zahlen und Wahrheitswerte bleiben', () => {
    const roh = { admin_name: '<b>Lisa</b>', bemerkungen: `x" onerror="alert(1)' &`, gcs_e: 4, ok: true, meds: [{ name: '<script>' }], leer: null }
    const s = druckSicher(roh)
    expect(s.admin_name).toBe('&lt;b&gt;Lisa&lt;/b&gt;')
    expect(s.bemerkungen).toBe('x&quot; onerror=&quot;alert(1)&#39; &amp;')
    expect(s.gcs_e).toBe(4)
    expect(s.ok).toBe(true)
    expect(s.meds[0].name).toBe('&lt;script&gt;')
    expect(s.leer).toBeNull()
    // Ohne Sonderzeichen unverändert (Schlüssel wie in _changed_fields, Datumsangaben)
    expect(druckSicher(['uebergabe_ziel', '2026-11-06T10:00:00.000Z'])).toEqual(['uebergabe_ziel', '2026-11-06T10:00:00.000Z'])
  })
  it('bildQuelle: nur data:image/…;base64', () => {
    expect(bildQuelle('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=')
    for (const x of ['x" onerror="alert(1)', 'javascript:alert(1)', 'https://example.com/a.png', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/png;base64,AA"><script>', 42, null]) {
      expect([x, bildQuelle(x)]).toEqual([x, ''])
    }
  })
})
