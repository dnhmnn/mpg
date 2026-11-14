/**
 * Supervisor → Hinweise: kurze Info nach einem Update („Neu in Responda“) anlegen, ändern,
 * veröffentlichen, zurückziehen und (nur unveröffentlicht) löschen. Jeder Benutzer aller
 * Organisationen sieht den neuesten veröffentlichten einmal (src/components/NeuInResponda.tsx).
 * Logik: src/lib/hinweise.ts. Regeln: docs/pocketbase-regeln.md, „Hub und Hinweise“.
 *
 * Veröffentlichen in zwei Schritten: erst speichern (Inhalt, bei „Veröffentlichen“ in der Liste
 * ohne Änderung), dann mit veroeffentlicht_am nach der Serverzeit veröffentlichen. Die Serverzeit
 * kommt aus `updated` der ersten Antwort (uhrVersatz). So bestimmt nie die Uhr dieses Geräts, welcher
 * Hinweis der neueste ist; geht sie mehr als 2 Minuten falsch, steht das in der Liste.
 *
 * erstellt_von: nur der Name (sonst „Supervisor“), nie die E-Mail. Das Feld ist bei veröffentlichten
 * Hinweisen für jeden angemeldeten Benutzer lesbar (Regeln), auch wenn die App es nur hier zeigt.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { pb } from '../../lib/pocketbase'
import { pbFehlerText } from '../../lib/pbFehler'
import type { User } from '../../types'
import { HinweisInhalt } from '../../components/NeuInResponda'
import {
  HINWEISE_SAMMLUNG, HINWEIS_TEXT_MAX, HINWEIS_TITEL_MAX, datumText, hinweisPruefen, hinweisStand, neuesterVeroeffentlicht,
  standText, uhrVersatz, uhrWarnung, veroeffentlichenAenderung, zeichen, zeitpunkt, zurueckziehenAenderung, type Hinweis,
} from '../../lib/hinweise'

const FELDER = { titel: 'Titel', text: 'Text', veroeffentlicht: 'Veröffentlicht', veroeffentlicht_am: 'Veröffentlicht am', erstellt_von: 'Erstellt von' }

const karte: CSSProperties = { background: 'var(--lbf-card)', borderRadius: 12, boxShadow: 'var(--lbf-shadow)', overflow: 'hidden' }
const abschnitt: CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }
const feldLabel: CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6, display: 'flex', justifyContent: 'space-between', gap: 8 }
const eingabe: CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: 10, border: '0.5px solid rgba(var(--lbf-rot-rgb),0.15)', background: 'var(--lbf-card)', fontSize: 14, fontFamily: 'inherit', color: 'var(--lbf-text)', boxSizing: 'border-box', outline: 'none' }
const knopfHaupt: CSSProperties = { background: 'var(--lbf-akzent-grund)', color: '#fff', border: 'none', borderRadius: 10, padding: '0 18px', minHeight: 44, fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }
const knopfZweit: CSSProperties = { background: 'transparent', color: 'var(--lbf-akzent)', border: '1px solid rgba(var(--lbf-rot-rgb),0.25)', borderRadius: 10, padding: '0 16px', minHeight: 44, fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }
const aktion: CSSProperties = { background: 'none', border: 'none', padding: '0 4px', minHeight: 44, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--lbf-akzent)', cursor: 'pointer' }

const STATUS_RAND: Record<string, string> = {
  entwurf: 'var(--lbf-akzent)', gezeigt: '#16a34a', alt: 'rgba(139,113,90,0.4)', zurueckgezogen: 'rgba(139,113,90,0.4)',
}

interface Entwurf { id?: string; titel: string; text: string; veroeffentlicht?: boolean; veroeffentlicht_am?: string }

const sortieren = (l: Hinweis[]) => [...l].sort((a, b) =>
  (zeitpunkt(b.created) || zeitpunkt(b.veroeffentlicht_am)) - (zeitpunkt(a.created) || zeitpunkt(a.veroeffentlicht_am)) || (a.id < b.id ? 1 : -1))

const istFehlt = (e: unknown) => (e as { status?: number })?.status === 404

/** Wer den Hinweis angelegt hat: nur der Name, nie die E-Mail (für alle Angemeldeten lesbar) */
const erstellerName = (u: User) => [...(u.name ?? '').trim()].slice(0, 120).join('') || 'Supervisor'

export default function HinweiseVerwaltung({ user }: { user: User }) {
  const [liste, setListe] = useState<Hinweis[]>([])
  const [laedt, setLaedt] = useState(true)
  const [fehlt, setFehlt] = useState(false)
  const [fehler, setFehler] = useState('')
  const [meldung, setMeldung] = useState('')
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null)
  const [beschaeftigt, setBeschaeftigt] = useState(false)
  const [geprueft, setGeprueft] = useState(false)
  // Geräte-Uhr geht falsch (beim letzten Veröffentlichen gemessen): bleibt stehen, bis neu gemessen
  const [uhrHinweis, setUhrHinweis] = useState('')

  const laden = useCallback(async () => {
    setLaedt(true)
    try {
      const l = await pb.collection(HINWEISE_SAMMLUNG).getFullList<Hinweis>({ requestKey: null })
      setListe(sortieren(l))
      setFehlt(false)
      setFehler('')
    } catch (e) {
      if (istFehlt(e)) { setFehlt(true); setListe([]); setFehler('') }
      else setFehler(`Hinweise lassen sich nicht laden: ${pbFehlerText(e, FELDER)}`)
    } finally { setLaedt(false) }
  }, [])
  useEffect(() => { laden() }, [laden])

  const gezeigt = useMemo(() => neuesterVeroeffentlicht(liste), [liste])

  const fertig = (text: string) => { setMeldung(text); window.setTimeout(() => setMeldung((m) => (m === text ? '' : m)), 4000) }

  async function schreiben(id: string | undefined, daten: Record<string, unknown>): Promise<boolean> {
    setBeschaeftigt(true)
    setFehler('')
    try {
      if (id) await pb.collection(HINWEISE_SAMMLUNG).update(id, daten, { requestKey: null })
      else await pb.collection(HINWEISE_SAMMLUNG).create({ veroeffentlicht: false, erstellt_von: erstellerName(user), ...daten }, { requestKey: null })
      await laden()
      return true
    } catch (e) {
      if (istFehlt(e) && !id) setFehlt(true)
      setFehler(pbFehlerText(e, FELDER))
      return false
    } finally { setBeschaeftigt(false) }
  }

  /**
   * Speichern (oder anlegen) und dann mit Serverzeit veröffentlichen. Schritt 1 liefert in `updated`
   * die Serverzeit; Schritt 2 setzt veroeffentlicht_am danach (das erste Datum bleibt, falls schon da).
   * Geht Schritt 2 schief, ist der Inhalt gespeichert (neu: als Entwurf) und das sagt die Meldung.
   */
  async function mitServerzeitVeroeffentlichen(id: string | undefined, inhalt: Record<string, unknown>, bisher: { veroeffentlicht_am?: string }): Promise<boolean> {
    setBeschaeftigt(true)
    setFehler('')
    let gespeichert: string | undefined
    try {
      const sammlung = pb.collection(HINWEISE_SAMMLUNG)
      const r = id
        ? await sammlung.update<Hinweis>(id, inhalt, { requestKey: null })
        : await sammlung.create<Hinweis>({ veroeffentlicht: false, erstellt_von: erstellerName(user), ...inhalt }, { requestKey: null })
      gespeichert = r.id
      const versatz = uhrVersatz(r.updated, Date.now())
      await sammlung.update(r.id, veroeffentlichenAenderung(bisher, Date.now() + (versatz ?? 0)), { requestKey: null })
      setUhrHinweis(uhrWarnung(versatz))
      await laden()
      return true
    } catch (e) {
      if (istFehlt(e) && !gespeichert && !id) setFehlt(true)
      const text = pbFehlerText(e, FELDER)
      if (gespeichert) {
        // Neu angelegt: weiter mit diesem Datensatz, damit ein zweiter Versuch keinen doppelten anlegt
        if (!id) setEntwurf((alt) => (alt ? { ...alt, id: gespeichert } : alt))
        setFehler(`${id ? 'Gespeichert' : 'Als Entwurf gespeichert'}, aber nicht veröffentlicht: ${text}`)
        await laden().catch(() => { /* Liste bleibt */ })
      } else setFehler(text)
      return false
    } finally { setBeschaeftigt(false) }
  }

  async function entwurfSpeichern(veroeffentlichen: boolean) {
    if (!entwurf) return
    setGeprueft(true)
    const f = hinweisPruefen(entwurf)
    if (f.titel || f.text) return
    const daten: Record<string, unknown> = { titel: entwurf.titel.trim(), text: entwurf.text.trim() }
    if (veroeffentlichen && !window.confirm('Alle Benutzer sehen ihn beim nächsten Öffnen des Hubs einmal. Veröffentlichen?')) return
    const ok = veroeffentlichen
      ? await mitServerzeitVeroeffentlichen(entwurf.id, daten, entwurf)
      : await schreiben(entwurf.id, daten)
    if (ok) {
      setEntwurf(null)
      setGeprueft(false)
      fertig(veroeffentlichen ? 'Veröffentlicht.' : entwurf.veroeffentlicht ? 'Gespeichert.' : 'Als Entwurf gespeichert.')
    }
  }

  async function veroeffentlichen(h: Hinweis) {
    const wieder = hinweisStand(h) === 'zurueckgezogen'
    const frage = wieder
      ? `„${h.titel}“ wieder veröffentlichen? Wer ihn schon bestätigt hat, sieht ihn nicht noch einmal.`
      : 'Alle Benutzer sehen ihn beim nächsten Öffnen des Hubs einmal. Veröffentlichen?'
    if (!window.confirm(frage)) return
    if (await mitServerzeitVeroeffentlichen(h.id, {}, h)) fertig('Veröffentlicht.')
  }

  async function zurueckziehen(h: Hinweis) {
    if (!window.confirm(`„${h.titel}“ zurückziehen? Wer ihn noch nicht gesehen hat, bekommt ihn dann nicht mehr.`)) return
    if (await schreiben(h.id, zurueckziehenAenderung())) fertig('Zurückgezogen.')
  }

  async function loeschen(h: Hinweis) {
    if (h.veroeffentlicht) return
    if (!window.confirm(`Hinweis „${h.titel}“ löschen? Das lässt sich nicht rückgängig machen.`)) return
    setBeschaeftigt(true)
    setFehler('')
    try {
      await pb.collection(HINWEISE_SAMMLUNG).delete(h.id, { requestKey: null })
      await laden()
      fertig('Gelöscht.')
    } catch (e) { setFehler(pbFehlerText(e, FELDER)) } finally { setBeschaeftigt(false) }
  }

  const huelle: CSSProperties = { padding: '20px max(20px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 40px)', maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }

  // ── Bearbeiten ──
  if (entwurf) {
    const f = geprueft ? hinweisPruefen(entwurf) : {}
    const titelZ = zeichen(entwurf.titel.trim())
    const textZ = zeichen(entwurf.text.trim())
    const neu = !entwurf.id
    const istVeroeffentlicht = entwurf.veroeffentlicht === true
    return (
      <div style={huelle} data-probe="hinweise-verwaltung">
        <div style={{ ...karte, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }} data-probe="hinweis-bearbeiten">
          <div style={abschnitt}>{neu ? 'Neuer Hinweis' : 'Hinweis bearbeiten'}</div>
          {istVeroeffentlicht && (
            <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
              Dieser Hinweis ist veröffentlicht. Wer ihn schon bestätigt hat, sieht die Änderung nicht mehr.
            </div>
          )}
          <div>
            <label htmlFor="hinweis-titel" style={feldLabel}><span>Titel</span><span style={{ color: titelZ > HINWEIS_TITEL_MAX ? 'var(--lbf-fehler-text-2)' : 'var(--warm-gray)', fontWeight: 400, letterSpacing: 0 }}>{titelZ} / {HINWEIS_TITEL_MAX}</span></label>
            <input id="hinweis-titel" value={entwurf.titel} onChange={(e) => setEntwurf({ ...entwurf, titel: e.target.value })} style={eingabe}
              placeholder="z. B. Der Hub im neuen Gewand" aria-invalid={!!f.titel} />
            {f.titel && <div role="alert" style={{ fontSize: 13, color: 'var(--lbf-fehler-text-2)', marginTop: 6 }}>{f.titel}</div>}
          </div>
          <div>
            <label htmlFor="hinweis-text" style={feldLabel}><span>Text</span><span style={{ color: textZ > HINWEIS_TEXT_MAX ? 'var(--lbf-fehler-text-2)' : 'var(--warm-gray)', fontWeight: 400, letterSpacing: 0 }}>{textZ} / {HINWEIS_TEXT_MAX}</span></label>
            <textarea id="hinweis-text" value={entwurf.text} onChange={(e) => setEntwurf({ ...entwurf, text: e.target.value })} rows={10}
              style={{ ...eingabe, resize: 'vertical', lineHeight: 1.5 }} aria-invalid={!!f.text} aria-describedby="hinweis-format" />
            <div id="hinweis-format" style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 6, lineHeight: 1.5 }}>
              Absätze mit einer Leerzeile, Aufzählung mit „- “ am Zeilenanfang. Kein HTML.
            </div>
            {f.text && <div role="alert" style={{ fontSize: 13, color: 'var(--lbf-fehler-text-2)', marginTop: 6 }}>{f.text}</div>}
          </div>
          <div>
            <div style={abschnitt}>So erscheint er nach dem Anmelden</div>
            <div style={{ background: 'var(--warm-bg)', borderRadius: 16, padding: 12, border: '0.5px solid var(--lbf-border)' }} data-probe="hinweis-vorschau" data-vorschau="">
              <div className="nr-blatt nr-statisch">
                <HinweisInhalt titel={entwurf.titel.trim() || 'Titel des Hinweises'} text={entwurf.text}
                  datum={datumText(entwurf.veroeffentlicht_am) || datumText(new Date().toISOString())} />
                <div className="nr-knopf" aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}>Verstanden</div>
                <div className="nr-fuss">Diesen Hinweis siehst du nur einmal.</div>
              </div>
            </div>
          </div>
          {fehler && <div role="alert" style={{ fontSize: 13, color: 'var(--lbf-fehler-text-2)', lineHeight: 1.5 }}>{fehler}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {istVeroeffentlicht ? (
              <button type="button" style={{ ...knopfHaupt, opacity: beschaeftigt ? 0.7 : 1 }} disabled={beschaeftigt} onClick={() => entwurfSpeichern(false)}>Änderungen speichern</button>
            ) : (
              <>
                <button type="button" style={{ ...knopfHaupt, opacity: beschaeftigt ? 0.7 : 1 }} disabled={beschaeftigt} onClick={() => entwurfSpeichern(true)}>Veröffentlichen</button>
                <button type="button" style={knopfZweit} disabled={beschaeftigt} onClick={() => entwurfSpeichern(false)}>Als Entwurf speichern</button>
              </>
            )}
            <button type="button" style={{ ...knopfZweit, border: 'none' }} disabled={beschaeftigt} onClick={() => { setEntwurf(null); setGeprueft(false); setFehler('') }}>Abbrechen</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Liste ──
  return (
    <div style={huelle} data-probe="hinweise-verwaltung">
      <div style={{ ...karte, padding: '16px 20px' }}>
        <div style={abschnitt}>Neu in Responda</div>
        <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
          Kurze Info nach einem Update. Jeder Benutzer aller Organisationen sieht den neuesten veröffentlichten Hinweis einmal, wenn er den Hub öffnet. Wer nach der Veröffentlichung angelegt wird, sieht ihn nicht.
        </div>
        <button type="button" style={{ ...knopfHaupt, marginTop: 14, opacity: fehlt || laedt ? 0.5 : 1, cursor: fehlt || laedt ? 'not-allowed' : 'pointer' }}
          disabled={fehlt || laedt} onClick={() => { setMeldung(''); setFehler(''); setGeprueft(false); setEntwurf({ titel: '', text: '' }) }}>
          Neuer Hinweis
        </button>
      </div>

      {fehlt && (
        <div style={{ ...karte, padding: '16px 20px' }} data-probe="hinweise-fehlt">
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lbf-text)' }}>Die Sammlung responda_hinweise fehlt noch.</div>
          <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.5, marginTop: 6 }}>
            Schritte: docs/hub-und-hinweise-einfuehrung.md. Bis dahin erscheinen keine Hinweise; sonst funktioniert alles wie gewohnt.
          </div>
        </div>
      )}
      {fehler && <div role="alert" style={{ fontSize: 13, color: 'var(--lbf-fehler-text-2)', lineHeight: 1.5 }}>{fehler}</div>}
      {meldung && <div role="status" style={{ fontSize: 13, color: '#16a34a' }}>{meldung}</div>}
      {uhrHinweis && <div role="status" style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.5 }} data-probe="hinweise-uhr">{uhrHinweis}</div>}

      {laedt && !liste.length ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--warm-gray)', fontSize: 14 }}>Laden…</div>
      ) : !fehlt && !liste.length ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--warm-gray)', fontSize: 14 }}>Noch keine Hinweise.</div>
      ) : liste.length > 0 && (
        <div>
          <div style={abschnitt}>Hinweise</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {liste.map((h) => {
              const st = hinweisStand(h)
              const rand = st === 'entwurf' ? STATUS_RAND.entwurf : st === 'zurueckgezogen' ? STATUS_RAND.zurueckgezogen : gezeigt?.id === h.id ? STATUS_RAND.gezeigt : STATUS_RAND.alt
              const vorschau = (h.text || '').replace(/\s+/g, ' ').trim()
              return (
                <div key={h.id} style={{ ...karte, borderLeft: `3px solid ${rand}` }} data-probe="hinweis-karte" data-id={h.id} data-stand={st}>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lbf-text)', overflowWrap: 'anywhere' }}>{h.titel}</div>
                    <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--warm-gray)', marginTop: 3 }} data-probe="hinweis-stand">
                      {standText(h, gezeigt?.id)}{h.erstellt_von ? ` · ${h.erstellt_von}` : ''}
                    </div>
                    {vorschau && (
                      <div style={{ fontSize: 13, color: 'var(--lbf-text)', marginTop: 8, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{vorschau}</div>
                    )}
                  </div>
                  <div style={{ borderTop: '0.5px solid var(--lbf-border-light)', background: 'var(--lbf-fuss)', padding: '0 12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                    <button type="button" style={aktion} disabled={beschaeftigt}
                      onClick={() => { setMeldung(''); setFehler(''); setGeprueft(false); setEntwurf({ id: h.id, titel: h.titel, text: h.text || '', veroeffentlicht: h.veroeffentlicht, veroeffentlicht_am: h.veroeffentlicht_am }) }}>Bearbeiten</button>
                    <span aria-hidden="true" style={{ color: 'var(--warm-gray)' }}>·</span>
                    {h.veroeffentlicht
                      ? <button type="button" style={aktion} disabled={beschaeftigt} onClick={() => zurueckziehen(h)}>Zurückziehen</button>
                      : <button type="button" style={aktion} disabled={beschaeftigt} onClick={() => veroeffentlichen(h)}>Veröffentlichen</button>}
                    {!h.veroeffentlicht && (
                      <>
                        <span aria-hidden="true" style={{ color: 'var(--warm-gray)' }}>·</span>
                        <button type="button" style={{ ...aktion, color: 'var(--lbf-fehler-text-2)' }} disabled={beschaeftigt} onClick={() => loeschen(h)}>Löschen</button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
