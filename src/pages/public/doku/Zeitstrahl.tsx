// Der Einsatz-Zeitstrahl, wie ihn das alte Formular führte: Standort,
// Einsatzort, Route — und daraus die Kette der Statuszeiten.
//
// Die Karte wird erst geladen, wenn jemand eine Route berechnet, und sie
// kommt von außen. Ohne Netz bleibt sie weg; gerechnet wird dann mit der
// Fahrzeit, die von Hand dasteht. Im Fahrzeug ist das der Normalfall, nicht
// die Ausnahme.

import { useEffect, useRef, useState } from 'react'
import {
  OhneNetz, NOMINATIM_PAUSE_MS, adresseSuchen, dauerText, fahrminuten, fahrstrecke,
  streckeText, type Koordinate,
} from '../../../lib/osrm'
import { aelrdFeld } from '../../../katalog/aelrd'
import type { Werte } from './DokuFeld'
import { kette, offeneUebernahme, zeitenUebernehmen, type Zeitstrahl as Strahl } from './zeitstrahl'

const ROT = '#600812'
const TEXT = '#1a0e08'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(96,8,18,0.14)'

const eingabe: React.CSSProperties = {
  width: '100%', padding: '9px 10px', background: '#fff',
  border: `0.5px solid ${LINIE}`, borderRadius: 8,
  fontFamily: 'inherit', fontSize: 16, color: TEXT, boxSizing: 'border-box',
}

function Feld({ titel, hinweis, children }: { titel: string; hinweis?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 8 }}>
      <span style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
        {titel}
        {hinweis ? <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', marginLeft: 5 }}>{hinweis}</span> : null}
      </span>
      {children}
    </label>
  )
}

export default function Zeitstrahl({ werte, setWerte, setzen }: {
  werte: Werte
  setWerte: (f: (v: Werte) => Werte) => void
  setzen: (id: string, wert: unknown) => void
}) {
  const karte = useRef<HTMLDivElement>(null)
  const leaflet = useRef<any>(null)
  const ebene = useRef<any>(null)

  const [standort, setStandort] = useState('')
  const [einsatzort, setEinsatzort] = useState('')
  const [ausruecken, setAusruecken] = useState(3)
  const [versorgung, setVersorgung] = useState(15)
  const [fahrt, setFahrt] = useState<number | null>(null)
  const [strecke, setStrecke] = useState<number | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState('')
  /** Was gezeichnet werden soll, sobald der Kasten seine Höhe hat. */
  const [zuZeichnen, setZuZeichnen] = useState<
    { von: Koordinate; nach: Koordinate; verlauf: unknown } | null
  >(null)

  const alarm = String(werte.zeit_alarm ?? '')
  const strahl: Strahl = { alarm, ausruecken, fahrt, versorgung }
  const halte = kette(strahl)
  const offen = offeneUebernahme(werte, strahl)

  useEffect(() => () => { leaflet.current?.remove?.(); leaflet.current = null }, [])

  /*
   * Gezeichnet wird erst, nachdem der Kasten gerendert ist.
   *
   * Leaflet misst seinen Behälter beim Anlegen. Entstand die Karte im noch
   * null Pixel hohen Kasten, blieb sie leer — und der Knopf sah aus, als
   * täte er nichts. Deshalb erst die Höhe, dann die Karte, und am Ende ein
   * invalidateSize(), damit Leaflet neu misst.
   */
  useEffect(() => {
    if (!zuZeichnen) return
    let abgebrochen = false
    void (async () => {
      let L: any
      try {
        L = await karteLaden()
      } catch {
        setMeldung((m) => m || 'Die Karte ließ sich nicht laden — die Fahrzeit steht trotzdem.')
        return
      }
      if (abgebrochen || !karte.current) return
      const { von, nach, verlauf } = zuZeichnen
      if (!leaflet.current) {
        leaflet.current = L.map(karte.current, { scrollWheelZoom: false })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap', maxZoom: 19,
        }).addTo(leaflet.current)
      }
      const map = leaflet.current
      if (ebene.current) map.removeLayer(ebene.current)
      const gruppe = L.layerGroup()
      L.geoJSON(verlauf, { style: { color: ROT, weight: 4, opacity: 0.85 } }).addTo(gruppe)
      const punkt = (farbe: string) => L.divIcon({
        html: `<div style="width:12px;height:12px;background:${farbe};border-radius:50%;border:2.5px solid #fff"></div>`,
        className: '', iconSize: [12, 12], iconAnchor: [6, 6],
      })
      L.marker([von.breite, von.laenge], { icon: punkt(ROT) }).addTo(gruppe)
      L.marker([nach.breite, nach.laenge], { icon: punkt('#16a34a') }).addTo(gruppe)
      gruppe.addTo(map)
      ebene.current = gruppe
      map.invalidateSize()
      const rand = 0.015
      map.fitBounds([
        [Math.min(von.breite, nach.breite) - rand, Math.min(von.laenge, nach.laenge) - rand],
        [Math.max(von.breite, nach.breite) + rand, Math.max(von.laenge, nach.laenge) + rand],
      ], { padding: [20, 20] })
    })()
    return () => { abgebrochen = true }
  }, [zuZeichnen])

  /** Leaflet erst holen, wenn es gebraucht wird — und nur einmal. */
  async function karteLaden(): Promise<any> {
    const vorhanden = (window as any).L
    if (vorhanden) return vorhanden
    await new Promise<void>((fertig, scheitern) => {
      const css = document.createElement('link')
      css.rel = 'stylesheet'
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(css)
      const js = document.createElement('script')
      js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      js.onload = () => fertig()
      js.onerror = () => scheitern(new Error('Karte nicht erreichbar'))
      document.head.appendChild(js)
    })
    return (window as any).L
  }

  async function routeBerechnen() {
    if (!standort.trim() || !einsatzort.trim()) {
      setMeldung('Standort und Einsatzort eintragen, dann rechnet die Route.')
      return
    }
    setLaeuft(true)
    setMeldung('')
    try {
      const von = await adresseSuchen(standort)
      if (!von) { setMeldung(`Standort nicht gefunden: „${standort.trim()}“`); return }
      // Der Dienst erlaubt eine Anfrage je Sekunde.
      await new Promise((r) => setTimeout(r, NOMINATIM_PAUSE_MS))
      const nach = await adresseSuchen(einsatzort)
      if (!nach) { setMeldung(`Einsatzort nicht gefunden: „${einsatzort.trim()}“`); return }
      const s = await fahrstrecke(von, nach)
      if (!s) { setMeldung('Dorthin ließ sich keine Route rechnen.'); return }
      const minutenFahrt = fahrminuten(s.sekunden)
      setFahrt(minutenFahrt)
      setStrecke(s.meter)
      setZuZeichnen({ von, nach, verlauf: s.verlauf })
      // Gerechnet heißt eingetragen: ein zweiter Knopf dahinter wäre ein
      // Griff, den im Fahrzeug niemand macht. Was schon dasteht, bleibt.
      setWerte((v) => zeitenUebernehmen(v, { ...strahl, fahrt: minutenFahrt }))
    } catch (e) {
      setMeldung(e instanceof OhneNetz
        ? 'Kein Netz — die Fahrzeit lässt sich von Hand eintragen.'
        : 'Die Route ließ sich nicht berechnen.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: ROT, marginBottom: 6 }}>
        Einsatz-Zeitstrahl
        <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', marginLeft: 5, color: GRAU }}>
          gerechnet, nicht gemessen
        </span>
      </div>

      <Feld titel="Standort" hinweis="Wache, Abfahrt">
        <input type="text" name="zeitstrahl_standort" value={standort}
          onChange={(e) => setStandort(e.target.value)}
          placeholder="Straße, PLZ Ort" style={eingabe} />
      </Feld>
      <Feld titel="Einsatzort" hinweis="Ziel">
        <input type="text" name="zeitstrahl_einsatzort" value={einsatzort}
          onChange={(e) => setEinsatzort(e.target.value)}
          placeholder="Straße, PLZ Ort" style={eingabe} />
      </Feld>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        <Feld titel="Ausrücken">
          <input type="number" name="zeitstrahl_ausruecken" inputMode="numeric" min={0} value={ausruecken}
            onChange={(e) => setAusruecken(Math.max(0, Number(e.target.value) || 0))}
            style={{ ...eingabe, fontSize: 19, fontWeight: 600 }} />
        </Feld>
        <Feld titel="Fahrzeit">
          <input type="number" name="zeitstrahl_fahrt" inputMode="numeric" min={0}
            value={fahrt ?? ''} placeholder="–"
            onChange={(e) => setFahrt(e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0))}
            style={{ ...eingabe, fontSize: 19, fontWeight: 600 }} />
        </Feld>
        <Feld titel="Versorgung">
          <input type="number" name="zeitstrahl_versorgung" inputMode="numeric" min={0} value={versorgung}
            onChange={(e) => setVersorgung(Math.max(0, Number(e.target.value) || 0))}
            style={{ ...eingabe, fontSize: 19, fontWeight: 600 }} />
        </Feld>
      </div>

      <button
        type="button" onClick={routeBerechnen} disabled={laeuft}
        style={{
          width: '100%', padding: '10px 12px', marginBottom: 8,
          background: laeuft ? 'rgba(96,8,18,0.2)' : 'rgba(96,8,18,0.05)',
          border: `0.5px solid ${LINIE}`, borderRadius: 8, color: ROT,
          fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: laeuft ? 'default' : 'pointer',
        }}
      >
        {laeuft ? 'Rechnet …' : 'Route berechnen'}
      </button>

      {strecke !== null && fahrt !== null ? (
        <div style={{ fontSize: 12, fontStyle: 'italic', color: ROT, marginBottom: 8 }}>
          {streckeText(strecke)} · {dauerText(fahrt)} Fahrt
        </div>
      ) : null}
      {meldung ? (
        <div style={{ padding: '8px 10px', marginBottom: 8, background: '#fffbeb', border: '0.5px solid #fde047', borderRadius: 8, fontSize: 12, fontStyle: 'italic', color: '#854d0e', lineHeight: 1.45 }}>
          {meldung}
        </div>
      ) : null}

      {/* Die Karte entsteht erst mit der ersten Route. */}
      {strecke !== null ? (
        <div
          ref={karte}
          style={{
            height: 180, marginBottom: 10, borderRadius: 10, overflow: 'hidden',
            border: `0.5px solid ${LINIE}`,
            /*
             * Leaflet stapelt seine Ebenen auf z-index 400 und die
             * Bedienknöpfe auf 800. Ohne eigenen Stapelraum zählen die gegen
             * die ganze Seite — die Karte lag damit über dem Kopf des
             * Protokolls. `isolation` macht diesen Kasten zum Stapelraum;
             * drinnen darf Leaflet zählen, wie es will.
             */
            position: 'relative', zIndex: 0, isolation: 'isolate',
          }}
        />
      ) : null}

      {/* Die Kette — und zugleich die Zeiten des Protokolls. Was hier steht,
          steht im Bogen; was leer ist, zeigt blass, was die Rechnung sagt. */}
      <div style={{ border: `0.5px solid ${LINIE}`, borderRadius: 10, overflow: 'hidden' }}>
        {halte.map((h, i) => {
          const steht = String(werte[h.feld] ?? '')
          // Der Bogen verlangt Alarm, Ankunft und Übergabe; die Alarmzeit
          // trägt obendrein die ganze Kette.
          const pflicht = Boolean(aelrdFeld(h.feld)?.pflicht)
          const fehlt = pflicht && !steht
          return (
            <div key={h.id} style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '6px 10px',
              borderBottom: i < halte.length - 1 ? '0.5px solid rgba(96,8,18,0.06)' : 'none',
              background: fehlt ? '#fef2f2' : steht ? '#fff' : 'rgba(250,249,247,0.7)',
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, flexShrink: 0, borderRadius: 11,
                background: steht ? ROT : 'transparent',
                border: steht ? 'none' : `1px solid ${LINIE}`,
                color: steht ? '#fff' : GRAU, fontSize: 11, fontWeight: 800,
              }}>
                {h.marke}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: TEXT }}>
                  {h.titel}
                  {pflicht ? (
                    <span style={{ color: fehlt ? '#b91c1c' : GRAU, fontWeight: 700, marginLeft: 4 }}>*</span>
                  ) : null}
                </span>
                <span style={{ display: 'block', fontSize: 11, fontStyle: 'italic', color: fehlt ? '#b91c1c' : GRAU }}>
                  {h.id === 'alarm' && fehlt ? 'Pflicht — ohne sie rechnet die Kette nicht' : fehlt ? 'Pflichtangabe' : h.unter}
                </span>
                {/*
                 * Die gerechnete Zeit bleibt sichtbar, auch wenn schon eine
                 * steht — sonst sähe man nie, wie weit die Rechnung daneben
                 * lag. Angetippt setzt sie die Zeile; was man selbst getippt
                 * hat, verschwindet nur auf diesen Griff hin.
                 */}
                {h.zeit && h.zeit !== steht ? (
                  <button
                    type="button" onClick={() => setzen(h.feld, h.zeit)}
                    style={{
                      display: 'block', marginTop: 1, padding: 0, background: 'none', border: 'none',
                      fontFamily: 'inherit', fontSize: 11, fontStyle: 'italic', color: ROT,
                      textAlign: 'left', cursor: 'pointer',
                    }}
                  >
                    gerechnet {h.zeit}{steht ? ' übernehmen' : ''}
                  </button>
                ) : null}
              </span>
              <input
                type="time" name={h.feld} value={steht}
                onChange={(e) => setzen(h.feld, e.target.value)}
                style={{
                  width: 96, flexShrink: 0, padding: '6px 8px', background: '#fff',
                  border: `1px solid ${fehlt ? '#b91c1c' : steht ? ROT : LINIE}`, borderRadius: 8,
                  fontFamily: 'inherit', fontSize: 16, fontWeight: 700,
                  color: steht ? ROT : GRAU, boxSizing: 'border-box',
                }}
              />
            </div>
          )
        })}
      </div>

      <button
        type="button" disabled={offen === 0}
        onClick={() => setWerte((v) => zeitenUebernehmen(v, strahl))}
        style={{
          width: '100%', padding: '11px 12px', marginTop: 8,
          background: offen > 0 ? ROT : 'rgba(96,8,18,0.15)', border: 'none', borderRadius: 10,
          color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.06em', cursor: offen > 0 ? 'pointer' : 'default',
        }}
      >
        {offen > 0 ? `${offen} gerechnete Zeiten eintragen` : 'Alle Zeiten eingetragen'}
      </button>
      <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, marginTop: 4, lineHeight: 1.45 }}>
        Eingetragen wird nur, wo noch nichts steht — eine eingetragene Zeit ist
        gemessen, eine gerechnete geschätzt. Jede lässt sich überschreiben.
      </div>
    </div>
  )
}
