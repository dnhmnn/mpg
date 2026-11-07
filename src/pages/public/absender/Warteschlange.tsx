// Was auf dem Gerät auf das Senden wartet (Bauplan v2, 1.18, 4.3).
//
// Rendert nichts, solange die Warteschlange leer ist. Sonst eine Karte oben
// auf der Seite, im Fluss der Seite (sie liegt nicht über den Kopfleisten der
// Masken). Versendet wird nach den Regeln in src/lib/formular/versand.ts, eine
// Sendung zur Zeit: beim Einhängen, wenn das Netz zurückkommt, alle 60
// Sekunden und wenn ein neuer Eintrag dazukommt, aber nur, solange die Seite
// sichtbar ist. So zählt die Stunde bis „ohne Passwort“ erst ab der Frage, die
// jemand online gesehen hat (`gefragtAb`), nicht ab der Ablage.
//
// Im Modus Passwort fragt die Karte nach dem Passwort des Absenders. Ist er
// nicht da, geht ein Eintrag mit eindeutigem Namen auch „ohne Passwort“ raus und
// wartet dann auf seine Unterschrift in Unitas. Der Name ist hier änderbar,
// mit Prüfzeile. Gelöscht wird nur nach Erfolg oder nach ausdrücklichem
// „Verwerfen“ mit Rückfrage: bei einer abgewiesenen Änderung und bei einem
// Fehler, der sich ohne Zutun nicht gibt (Formular aus, Angaben abgewiesen).
// Die Stunde bis „ohne Passwort“ zählt nur, solange die Karte ausgeklappt ist
// („Später“ klappt sie ein; dann gilt die Frage als nicht gesehen).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { aktuelleTokenId, geraeteSpeicher, nameGefunden, type NamensErgebnis, type Speicher } from '../../../lib/formular/api'
import { useFormularStand } from '../../../lib/formular/stand'
import {
  abarbeiten, absenderNameSetzen, aenderungAbgewiesen, bleibenderFehler, bleibendHinweis, eintragAusfuehren, eintragKopf, MELDUNGEN, naechsterSchritt,
  ohnePasswortMoeglich, schrittOhnePasswort, verwerfen, verwerfenFrageText, type Ausfuehrung, type Schritt,
} from '../../../lib/formular/versand'
import { aktualisieren, ALTER_PREFIX, eintrag, eintraege, schluessel, type Warteeintrag } from '../../../lib/formular/warteschlange'
import NamensFeld from './NamensFeld'
import { PasswortFeld, Textknopf } from './AbsenderFeld'
import { ABSENDER_TEXTE as T, namePruefbar } from './texte'

const ROT = 'var(--lbf-akzent)'
const ROT_GRUND = 'var(--lbf-akzent-grund)'
const TEXT = 'var(--lbf-text)'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(var(--lbf-rot-rgb),0.1)'
const OK = '#16a34a'

/** Ereignis, mit dem eine Maske sagt: ich habe gerade abgelegt (sofort neu lesen). */
export const WARTESCHLANGE_EREIGNIS = 'formular-warteschlange'

/** Nach dem Ablegen aufrufen; die Karte liest dann sofort neu (sonst spätestens nach drei Sekunden). */
export function warteschlangeMelden(): void {
  try { window.dispatchEvent(new Event(WARTESCHLANGE_EREIGNIS)) } catch { /* ohne Fenster: nichts */ }
}

const DURCHLAUF_MS = 60_000
const BLICK_MS = 3_000
const GESENDET_ZEIGEN_MS = 8_000

function sichtbar(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden'
}
function onlineJetzt(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

function spaeterSchluessel(orgCode: string): string {
  return `formular_warteschlange_spaeter_${orgCode}`
}
function spaeterLesen(orgCode: string): boolean {
  try { return window.sessionStorage.getItem(spaeterSchluessel(orgCode)) === '1' } catch { return false }
}
function spaeterSchreiben(orgCode: string, an: boolean): void {
  try {
    if (an) window.sessionStorage.setItem(spaeterSchluessel(orgCode), '1')
    else window.sessionStorage.removeItem(spaeterSchluessel(orgCode))
  } catch { /* ohne Sitzungsspeicher: nur für diese Ansicht */ }
}

/** Roher Inhalt beider Schlüssel; ändert er sich, wird neu gelesen (ohne jedes Mal JSON zu lesen). */
function rohStand(s: Speicher | null, orgCode: string): string {
  if (!s) return ''
  try { return `${s.getItem(schluessel(orgCode)) ?? ''}\u0000${s.getItem(ALTER_PREFIX + orgCode) ?? ''}` } catch { return '' }
}

type Meldung = { text: string; art: 'info' | 'fehler' }

export default function Warteschlange({ orgCode, org, eingebettet = false }: {
  orgCode: string
  /** Die Organisation, falls schon geladen (für den Stand ohne Netz). */
  org?: unknown
  /**
   * In einer Seite mit eigenem Rand (Unitas): ohne Seitenabstand oben und an den
   * Seiten, ohne eigene Höchstbreite, mit Abstand nach unten.
   */
  eingebettet?: boolean
}) {
  const s = useMemo(() => geraeteSpeicher(), [])
  const { stand, alterServer, laedt } = useFormularStand(orgCode, { mitAnmeldung: false, org })
  const [liste, setListe] = useState<Warteeintrag[]>(() => (s && orgCode ? eintraege(s, orgCode) : []))
  const [online, setOnline] = useState(onlineJetzt)
  const [meldungen, setMeldungen] = useState<Record<string, Meldung>>({})
  const [gesendet, setGesendet] = useState<{ schluessel: string; text: string }[]>([])
  const [spaeter, setSpaeter] = useState(() => spaeterLesen(orgCode))
  const [beschaeftigt, setBeschaeftigt] = useState('')
  const [passwort, setPasswort] = useState<Record<string, string>>({})
  const [namen, setNamen] = useState<Record<string, string>>({})
  const [verwerfenFrage, setVerwerfenFrage] = useState('')
  const [laufend, setLaufend] = useState(false)

  const roh = useRef(rohStand(s, orgCode))
  const bekannt = useRef(new Set(liste.map((e) => e.id)))
  const lauf = useRef<Promise<void> | null>(null)
  const manuell = useRef(false)
  const lage = useRef({ stand, alterServer, laedt, spaeter })
  lage.current = { stand, alterServer, laedt, spaeter }

  const neuLesen = useCallback(() => {
    if (!s || !orgCode) return [] as Warteeintrag[]
    roh.current = rohStand(s, orgCode)
    const l = eintraege(s, orgCode)
    setListe(l)
    return l
  }, [s, orgCode])

  const gesendetZeigen = useCallback((text: string) => {
    const k = `${Date.now()}-${Math.random()}`
    setGesendet((g) => [...g, { schluessel: k, text }])
    setTimeout(() => setGesendet((g) => g.filter((x) => x.schluessel !== k)), GESENDET_ZEIGEN_MS)
  }, [])

  const ergebnisMerken = useCallback((id: string, r: Ausfuehrung) => {
    if (r.ergebnis === 'gesendet') {
      gesendetZeigen(r.meldung || MELDUNGEN.gesendet)
      setMeldungen((m) => { const n = { ...m }; delete n[id]; return n })
      return
    }
    if (!r.meldung) return
    setMeldungen((m) => ({ ...m, [id]: { text: r.meldung, art: r.grund && !['netz', 'drossel'].includes(r.grund) ? 'fehler' : 'info' } }))
  }, [gesendetZeigen])

  /**
   * Ein Durchgang über die ganze Schlange. Vorher werden Namen geprüft, die
   * noch nie geprüft wurden (sonst ginge „nach einer Stunde ohne Passwort“
   * nie, solange die Karte eingeklappt ist).
   */
  const durchlauf = useCallback(async () => {
    if (!s || !orgCode || manuell.current || lauf.current) return
    const { stand: st, alterServer: alt, laedt: l, spaeter: eingeklappt } = lage.current
    if (l || !sichtbar()) return
    const jetztOnline = onlineJetzt()
    const p = (async () => {
      if (jetztOnline && st && !alt) {
        for (const e of eintraege(s, orgCode)) {
          if (e.nameEindeutig !== undefined || e.ziel || e.angemeldetId) continue
          if (st.formulare[e.formular]?.modus !== 'passwort' || !namePruefbar(e.absenderName)) continue
          const r = await nameGefunden(orgCode, e.formular, e.absenderName.trim())
          if (r.ok === false) break
          absenderNameSetzen(s, orgCode, e.id, e.absenderName, r.wert)
        }
      }
      // Eingeklappt sieht niemand die Passwortfrage: dann zählt sie nicht als gestellt (gefragtAb)
      const ergebnis = await abarbeiten(s, orgCode, { online: jetztOnline, stand: st, serverAlt: alt, frageSichtbar: !eingeklappt })
      for (const [id, r] of Object.entries(ergebnis)) {
        // Warten und Korrigieren sagt die Zeile des Eintrags selbst; keine zweite Meldung darunter
        if (r.schritt === 'warten' || r.schritt === 'korrigieren') { setMeldungen((m) => { if (!m[id]) return m; const n = { ...m }; delete n[id]; return n }); continue }
        ergebnisMerken(id, r)
      }
    })()
    lauf.current = p
    setLaufend(true)
    try { await p } catch { /* ein Fehler im Durchgang lässt alles liegen */ } finally {
      lauf.current = null
      setLaufend(false)
      const l2 = neuLesen()
      bekannt.current = new Set(l2.map((e) => e.id))
    }
  }, [s, orgCode, neuLesen, ergebnisMerken])

  // Durchgang, sobald der Stand da ist (Einhängen, Netz zurück, Anmeldung geändert)
  useEffect(() => { if (!laedt) void durchlauf() }, [laedt, stand, alterServer, durchlauf])

  // Alle 60 Sekunden, und wenn die Seite wieder sichtbar wird
  useEffect(() => {
    const uhr = setInterval(() => { void durchlauf() }, DURCHLAUF_MS)
    const blick = () => { if (sichtbar()) void durchlauf() }
    document.addEventListener('visibilitychange', blick)
    return () => { clearInterval(uhr); document.removeEventListener('visibilitychange', blick) }
  }, [durchlauf])

  // Neu lesen, wenn eine Maske ablegt (Ereignis, anderer Tab, sonst ein Blick alle drei Sekunden)
  useEffect(() => {
    const pruefen = () => {
      if (rohStand(s, orgCode) === roh.current) return
      const l = neuLesen()
      const neu = l.some((e) => !bekannt.current.has(e.id))
      bekannt.current = new Set(l.map((e) => e.id))
      // Ein neuer Eintrag klappt die Karte auf: die Maske verweist gerade auf sie
      if (neu) { setSpaeter(false); spaeterSchreiben(orgCode, false); lage.current.spaeter = false; void durchlauf() }
    }
    const netz = () => setOnline(onlineJetzt())
    const uhr = setInterval(pruefen, BLICK_MS)
    window.addEventListener(WARTESCHLANGE_EREIGNIS, pruefen)
    window.addEventListener('storage', pruefen)
    window.addEventListener('online', netz)
    window.addEventListener('offline', netz)
    return () => {
      clearInterval(uhr)
      window.removeEventListener(WARTESCHLANGE_EREIGNIS, pruefen)
      window.removeEventListener('storage', pruefen)
      window.removeEventListener('online', netz)
      window.removeEventListener('offline', netz)
    }
  }, [s, orgCode, neuLesen, durchlauf])

  useEffect(() => { setSpaeter(spaeterLesen(orgCode)) }, [orgCode])

  /**
   * Eine Handlung an einem Eintrag: erst den laufenden Durchgang abwarten, dann genau diesen Schritt.
   * `erneut`: vorher den letzten Fehler und die Pause löschen („Erneut senden“).
   */
  async function handeln(id: string, schritt: (e: Warteeintrag) => Schritt, o: { passwort?: string; erneut?: boolean } = {}) {
    if (!s || beschaeftigt) return
    manuell.current = true
    setBeschaeftigt(id)
    setMeldungen((m) => { const n = { ...m }; delete n[id]; return n })
    try {
      if (lauf.current) { try { await lauf.current } catch { /* egal */ } }
      // Ein gerade getippter Name, der noch nicht geprüft und gespeichert ist
      const getippt = namen[id]
      let e = eintrag(s, orgCode, id)
      if (e && getippt !== undefined && getippt !== e.absenderName) {
        absenderNameSetzen(s, orgCode, id, getippt, null)
        e = eintrag(s, orgCode, id)
      }
      if (e && o.erneut) {
        aktualisieren(s, orgCode, id, (x) => { const n = { ...x }; delete n.letzterFehler; delete n.naechsterVersuchAb; return n })
        e = eintrag(s, orgCode, id)
      }
      if (!e) return
      const r = await eintragAusfuehren(s, e, schritt(e), { passwort: o.passwort })
      ergebnisMerken(id, r)
    } finally {
      manuell.current = false
      setBeschaeftigt('')
      const l = neuLesen()
      bekannt.current = new Set(l.map((x) => x.id))
    }
  }

  function mitPasswort(id: string) {
    const pw = passwort[id] ?? ''
    // Nach jedem Versuch ist das Feld leer; das Passwort lebt nur in diesem Aufruf
    setPasswort((p) => ({ ...p, [id]: '' }))
    if (!pw) { setMeldungen((m) => ({ ...m, [id]: { text: 'Bitte das Passwort eintragen.', art: 'fehler' } })); return }
    void handeln(id, () => ({ art: 'fragen' }), { passwort: pw })
  }

  /** „Erneut senden“: Fehler und Pause löschen, dann der Schritt, der jetzt dran ist. */
  function erneut(id: string) {
    void handeln(id, (x) => naechsterSchritt(x, { online: onlineJetzt(), stand, serverAlt: alterServer, tokenId: aktuelleTokenId(), jetzt: new Date() }), { erneut: true })
  }

  function verwerfenJetzt(e: Warteeintrag) {
    if (!s) return
    verwerfen(s, e)
    setVerwerfenFrage('')
    const l = neuLesen()
    bekannt.current = new Set(l.map((x) => x.id))
  }

  function nameGeaendert(id: string, name: string) {
    setNamen((n) => ({ ...n, [id]: name }))
  }

  function namePruefung(e: Warteeintrag, r: NamensErgebnis | null, text: string) {
    if (!s) return
    const aktuell = eintrag(s, orgCode, e.id)
    if (!aktuell) return
    // Ohne Ergebnis den gespeicherten Stand nicht überschreiben, solange der Name gleich ist
    if (!r && text === aktuell.absenderName) return
    if (r && text === aktuell.absenderName && aktuell.nameEindeutig === (r.vollstaendig && r.eindeutig)) return
    absenderNameSetzen(s, orgCode, e.id, text, r)
    const l = neuLesen()
    bekannt.current = new Set(l.map((x) => x.id))
  }

  if (!s || !orgCode) return null
  if (liste.length === 0 && gesendet.length === 0) return null

  const jetzt = new Date()
  const tokenId = aktuelleTokenId()

  return (
    <div style={eingebettet
      ? { marginBottom: 18 }
      : { padding: 'calc(env(safe-area-inset-top) + 10px) 14px 0', maxWidth: 830, margin: '0 auto', boxSizing: 'border-box' }}>
      <section
        aria-label={T.schlangeTitel}
        style={{ background: 'var(--lbf-card)', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `3px solid ${ROT}`, overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '10px 12px', borderBottom: liste.length > 0 && !spaeter ? `0.5px solid ${LINIE}` : 'none' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: ROT, textTransform: 'uppercase', letterSpacing: '0.14em' }}>{T.schlangeTitel}</div>
            {liste.length > 0 ? (
              <div style={{ fontSize: 12, fontStyle: 'italic', color: GRAU, marginTop: 2 }}>{T.warten(liste.length)}</div>
            ) : null}
          </div>
          {liste.length > 0 ? (
            <Textknopf onClick={() => { const n = !spaeter; setSpaeter(n); spaeterSchreiben(orgCode, n) }}>
              {spaeter ? T.anzeigen : T.spaeter}
            </Textknopf>
          ) : null}
        </div>

        {gesendet.length > 0 ? (
          <div style={{ padding: '8px 12px', borderBottom: liste.length > 0 && !spaeter ? `0.5px solid ${LINIE}` : 'none' }}>
            {gesendet.map((g) => (
              <div key={g.schluessel} aria-live="polite" style={{ fontSize: 12, fontStyle: 'italic', color: OK, lineHeight: 1.45 }}>{g.text}</div>
            ))}
          </div>
        ) : null}

        {!spaeter ? liste.map((e, i) => {
          const schritt = naechsterSchritt(e, { online, stand, serverAlt: alterServer, tokenId, jetzt })
          const meldung = meldungen[e.id]
          const name = namen[e.id] ?? e.absenderName
          const laeuft = beschaeftigt === e.id
          const fStand = stand?.formulare[e.formular]
          return (
            <div key={e.id} style={{ padding: '10px 12px 12px', borderTop: i > 0 ? `0.5px solid ${LINIE}` : 'none' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, lineHeight: 1.35 }}>{eintragKopf(e)}</div>
              <div style={{ fontSize: 12, fontStyle: 'italic', color: GRAU, marginTop: 2 }}>{T.absenderZeile(e.absenderName.trim())}</div>

              {e.ziel ? (
                aenderungAbgewiesen(e) ? (
                  <div style={{ marginTop: 8 }}>
                    <Hinweis art="fehler">{MELDUNGEN.aenderungAbgewiesen(e.letzterFehler?.text ?? '')}</Hinweis>
                    {verwerfenFrage === e.id ? (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 12, fontStyle: 'italic', color: TEXT, lineHeight: 1.45 }}>{MELDUNGEN.verwerfenFrage}</div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                          <Textknopf onClick={() => verwerfenJetzt(e)}>{T.verwerfen}</Textknopf>
                          <Textknopf farbe={GRAU} onClick={() => setVerwerfenFrage('')}>{T.behalten}</Textknopf>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 6 }}><Textknopf onClick={() => setVerwerfenFrage(e.id)}>{T.verwerfen}</Textknopf></div>
                    )}
                  </div>
                ) : (
                  <Zeile>{online ? T.aenderungUnterwegs : MELDUNGEN.ohneNetzWartet}</Zeile>
                )
              ) : bleibenderFehler(e) ? (
                <div style={{ marginTop: 8 }}>
                  <Hinweis art="fehler">{MELDUNGEN.nichtGesendet(e.letzterFehler?.text ?? '')}</Hinweis>
                  <Zeile>{bleibendHinweis(e)}</Zeile>
                  {verwerfenFrage === e.id ? (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12, fontStyle: 'italic', color: TEXT, lineHeight: 1.45 }}>{verwerfenFrageText(e)}</div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                        <Textknopf onClick={() => verwerfenJetzt(e)}>{T.endgueltigVerwerfen}</Textknopf>
                        <Textknopf farbe={GRAU} onClick={() => setVerwerfenFrage('')}>{T.behalten}</Textknopf>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                      <Textknopf disabled={laeuft || !!beschaeftigt || !online} onClick={() => erneut(e.id)}>{laeuft ? T.sendet : T.erneutSenden}</Textknopf>
                      <Textknopf farbe={GRAU} disabled={laeuft} onClick={() => setVerwerfenFrage(e.id)}>{T.verwerfen}</Textknopf>
                    </div>
                  )}
                </div>
              ) : schritt.art === 'korrigieren' ? (
                <div style={{ marginTop: 8 }}>
                  {e.letzterFehler ? <Hinweis art="fehler">{e.letzterFehler.text}</Hinweis> : null}
                  <NamensFeld
                    orgCode={orgCode} formular={e.formular} wert={name}
                    onWert={(n) => nameGeaendert(e.id, n)}
                    onErgebnis={(r, text) => namePruefung(e, r, text)}
                    zweck="absender" modus="frei" mitAnmeldung={false}
                    label="Absender" dicht
                  />
                  <button
                    type="button" disabled={laeuft || !!beschaeftigt || !name.trim()}
                    onClick={() => void handeln(e.id, (x) => ({ art: 'senden', absender: { name: x.absenderName }, mitAnmeldung: false }))}
                    style={sendeKnopf(laeuft || !name.trim())}
                  >
                    {laeuft ? T.sendet : T.nameKorrigieren}
                  </button>
                </div>
              ) : schritt.art === 'fragen' ? (
                <div style={{ marginTop: 8 }}>
                  {e.letzterFehler && e.letzterFehler.grund !== 'gesperrt' ? <Hinweis art="fehler">{e.letzterFehler.text}</Hinweis> : null}
                  <NamensFeld
                    orgCode={orgCode} formular={e.formular} wert={name}
                    onWert={(n) => nameGeaendert(e.id, n)}
                    onErgebnis={(r, text) => namePruefung(e, r, text)}
                    zweck="ausstehend" modus="passwort" mitAnmeldung={false}
                    label="Absender" dicht
                  />
                  <PasswortFeld
                    wert={passwort[e.id] ?? ''} onWert={(pw) => setPasswort((p) => ({ ...p, [e.id]: pw }))}
                    label={T.passwortVon(name.trim())} hinweisText={T.passwortHinweisVon(name.trim())} onEnter={() => mitPasswort(e.id)}
                  />
                  <button
                    type="button" disabled={laeuft || !!beschaeftigt || !name.trim()} onClick={() => mitPasswort(e.id)}
                    style={sendeKnopf(laeuft || !name.trim())}
                  >
                    {laeuft ? T.sendet : T.alsSenden(name.trim())}
                  </button>
                  {fStand?.ausstehend ? (
                    <div style={{ marginTop: 10 }}>
                      <Textknopf
                        disabled={laeuft || !!beschaeftigt || !ohnePasswortMoeglich({ ...e, absenderName: name }, stand) || name !== e.absenderName}
                        onClick={() => void handeln(e.id, (x) => schrittOhnePasswort(x))}
                      >
                        {T.ohnePasswortSenden}
                      </Textknopf>
                      {ohnePasswortMoeglich({ ...e, absenderName: name }, stand) && name === e.absenderName ? (
                        <>
                          <div style={{ fontSize: 12, color: TEXT, marginTop: 4, lineHeight: 1.45 }}>{T.ohnePasswortErklaerung(name.trim())}</div>
                          <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, marginTop: 2 }}>{T.ohnePasswortVonSelbst}</div>
                        </>
                      ) : (
                        <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, marginTop: 4, lineHeight: 1.4 }}>{T.ohnePasswortNurEindeutig}</div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : (
                <Zeile>
                  {laeuft || (schritt.art !== 'warten' && laufend) ? T.sendet
                    : schritt.art === 'warten'
                      ? (!online ? MELDUNGEN.ohneNetzWartet
                        : schritt.bis && e.letzterFehler?.grund === 'gesperrt' ? MELDUNGEN.gesperrtBis(schritt.bis, e.absenderName.trim())
                        : schritt.bis ? MELDUNGEN.wartetBis(schritt.bis) : T.ohneServer)
                      : e.letzterFehler ? MELDUNGEN.nichtGesendet(e.letzterFehler.text) : T.gehtRaus}
                </Zeile>
              )}

              {meldung && !(e.letzterFehler && meldung.text.endsWith(e.letzterFehler.text)) ? (
                <div style={{ marginTop: 6 }}><Hinweis art={meldung.art}>{meldung.text}</Hinweis></div>
              ) : null}
            </div>
          )
        }) : null}
      </section>
    </div>
  )
}

/** Der volle Sendeknopf der Karte (Akzent, Versalien); blass, solange er nicht geht. */
function sendeKnopf(aus: boolean): React.CSSProperties {
  return {
    width: '100%', marginTop: 10, padding: '11px 12px', border: 'none', borderRadius: 12,
    background: aus ? 'rgba(var(--lbf-rot-rgb),0.2)' : ROT_GRUND, color: '#fff',
    fontFamily: 'inherit', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
    cursor: aus ? 'default' : 'pointer',
  }
}

function Zeile({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontStyle: 'italic', color: GRAU, marginTop: 6, lineHeight: 1.45 }}>{children}</div>
}

function Hinweis({ art, children }: { art: 'info' | 'fehler'; children: React.ReactNode }) {
  const fehler = art === 'fehler'
  return (
    <div style={{
      padding: '7px 10px', marginBottom: 6, borderRadius: 8, fontSize: 12, fontStyle: 'italic', lineHeight: 1.45,
      background: fehler ? 'var(--lbf-warn-grund)' : 'rgba(var(--lbf-rot-rgb),0.04)',
      border: fehler ? '0.5px solid #fde047' : `0.5px solid ${LINIE}`,
      color: fehler ? 'var(--lbf-warn-text)' : TEXT,
    }}>
      {children}
    </div>
  )
}
