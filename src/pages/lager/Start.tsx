// Startseite des Lagers im Dunkelrot-Design (Owner, 20.11.2026): statt der Leiste mit 16 Knöpfen
// sechs Kacheln für das Häufige (Bestand, Scannen, Ausgaben, Bestellen, Inventur, Checks), darunter
// alles Weitere in Gruppen. Der Standort steht im roten Kopf. Die Logik bleibt in Lager.tsx; hier nur
// das Aussehen, jede Kachel ruft eine Aktion von dort.
import React from 'react'
import { Abschnitt, Seite } from '../benutzer/bausteine'

const PFADE: Record<string, React.ReactNode> = {
  bestand: <><path d="M21 8l-9-5-9 5v8l9 5 9-5z" /><path d="M3 8l9 5 9-5" /><line x1="12" y1="13" x2="12" y2="21" /></>,
  scannen: <><path d="M3 7V5a2 2 0 012-2h2" /><path d="M17 3h2a2 2 0 012 2v2" /><path d="M21 17v2a2 2 0 01-2 2h-2" /><path d="M7 21H5a2 2 0 01-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" /></>,
  ausgaben: <><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" /><path d="M10 13l2 2 4-4" /></>,
  bestellen: <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" /></>,
  inventur: <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6m-6 4h6" /></>,
  checks: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></>,
  einbuchen: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  ausbuchen: <line x1="5" y1="12" x2="19" y2="12" />,
  mehrfach: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><line x1="17.5" y1="14" x2="17.5" y2="21" /><line x1="14" y1="17.5" x2="21" y2="17.5" /></>,
  umlagern: <><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" /></>,
  assistent: <><path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z" /><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" /></>,
  logbuch: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></>,
  rueckruf: <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  statistik: <><line x1="4" y1="20" x2="20" y2="20" /><rect x="6" y="10" width="3" height="7" rx="0.5" /><rect x="11" y="5" width="3" height="12" rx="0.5" /><rect x="16" y="13" width="3" height="4" rx="0.5" /></>,
  artikel: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
  import: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
  pdf: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><polyline points="9 15 12 18 15 15" /></>,
  einstellungen: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  standort: <><path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>,
  runter: <path d="M6 9l6 6 6-6" />,
  weiter: <path d="M9 18l6-6-6-6" />,
}

export type LgIconName = keyof typeof PFADE
export function LgIcon({ n, className }: { n: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true">{PFADE[n]}</svg>
}

/** Standort im roten Kopf. Die Auswahl des Systems liegt unsichtbar darüber. */
export function StandortWahl({ standorte, id, onChange }: { standorte: { id: string; name: string }[]; id: string | null; onChange: (id: string) => void }) {
  const aktuell = standorte.find((s) => s.id === id)
  if (!standorte.length) return null
  return (
    <label className="lg-standort">
      <LgIcon n="standort" />
      <span className="lg-standort-tx"><small>Standort</small><b>{aktuell?.name ?? 'Standort wählen'}</b></span>
      {standorte.length > 1 && <LgIcon n="runter" />}
      {standorte.length > 1 && (
        <select value={id ?? ''} onChange={(e) => onChange(e.target.value)} aria-label="Standort wählen">
          {!aktuell && <option value="" disabled>Standort wählen</option>}
          {standorte.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
    </label>
  )
}

export type LagerAktion =
  | 'bestand' | 'scannen' | 'ausgaben' | 'bestellen' | 'inventur' | 'checks'
  | 'einbuchen' | 'ausbuchen' | 'mehrfach' | 'umlagern' | 'assistent'
  | 'logbuch' | 'rueckruf' | 'statistik'
  | 'artikel' | 'import' | 'pdf' | 'einstellungen'

export type LagerZahlen = { ok: number; bald: number; abgelaufen: number; artikel: number; unterSoll: number; ausgaben: number }

const mehrzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`

function Kachel({ icon, titel, zeile, wichtig, zahl, onClick }: { icon: string; titel: string; zeile: string; wichtig?: boolean; zahl?: number; onClick: () => void }) {
  return (
    <button type="button" className="lg-kachel" onClick={onClick}>
      <span className="lg-kachel-icon"><LgIcon n={icon} /></span>
      {zahl ? <span className="lg-zahl" aria-hidden="true">{zahl}</span> : null}
      <span><b>{titel}</b><small className={wichtig ? 'wichtig' : undefined}>{zeile}</small></span>
    </button>
  )
}

function Zeile({ icon, titel, unter, onClick }: { icon: string; titel: string; unter?: string; onClick: () => void }) {
  return (
    <button type="button" className="bv-z" onClick={onClick}>
      <span className="lg-z-icon"><LgIcon n={icon} /></span>
      <span className="bv-tx"><b>{titel}</b>{unter && <small>{unter}</small>}</span>
      <LgIcon n="weiter" className="lg-weiter" />
    </button>
  )
}

export function LagerStart({ orgName, zurueck, standorte, standortId, onStandort, zahlen, offline, onAktion, onFilter }: {
  orgName: string
  zurueck: () => void
  standorte: { id: string; name: string }[]
  standortId: string | null
  onStandort: (id: string) => void
  zahlen: LagerZahlen
  offline?: { text: string; onClick: () => void } | null
  onAktion: (a: LagerAktion) => void
  onFilter: (f: 'warning' | 'expired' | 'ok') => void
}) {
  const a = (x: LagerAktion) => () => onAktion(x)
  return (
    <Seite
      titel="Lager" unter={orgName} zurueck={zurueck} zurueckLabel="Zurück zur Übersicht"
      rechts={<button type="button" className="bv-rund" aria-label="Einstellungen des Lagers" title="Einstellungen" onClick={a('einstellungen')}><LgIcon n="einstellungen" className="bv-i" /></button>}
      reiter={<StandortWahl standorte={standorte} id={standortId} onChange={onStandort} />}
    >
      {offline && <button type="button" className="lg-offline" onClick={offline.onClick}>{offline.text}</button>}

      <div className="lg-zustand" role="group" aria-label="Zustand am Standort">
        <button type="button" onClick={() => onFilter('ok')}><small className="ok">In Ordnung</small><b className="ok">{zahlen.ok}</b><span>Artikel</span></button>
        <button type="button" onClick={() => onFilter('warning')}><small className="bald">Bald fällig</small><b className="bald">{zahlen.bald}</b><span>Ablauf naht</span></button>
        <button type="button" onClick={() => onFilter('expired')}><small className="ab">Abgelaufen</small><b className="ab">{zahlen.abgelaufen}</b><span>aussortieren</span></button>
      </div>

      <Abschnitt titel="Häufig" />
      <div className="lg-kacheln">
        <Kachel icon="bestand" titel="Bestand" zeile={mehrzahl(zahlen.artikel, 'Artikel', 'Artikel') + ', ansehen und buchen'} onClick={a('bestand')} />
        <Kachel icon="scannen" titel="Scannen" zeile="Code scannen, Artikel finden" onClick={a('scannen')} />
        <Kachel icon="ausgaben" titel="Ausgaben" zeile={zahlen.ausgaben ? mehrzahl(zahlen.ausgaben, 'Ausgabe offen', 'Ausgaben offen') : 'Nichts offen'} wichtig={zahlen.ausgaben > 0} zahl={zahlen.ausgaben} onClick={a('ausgaben')} />
        <Kachel icon="bestellen" titel="Bestellen" zeile={zahlen.unterSoll ? mehrzahl(zahlen.unterSoll, 'Artikel unter Soll', 'Artikel unter Soll') : 'Alles auf Soll'} wichtig={zahlen.unterSoll > 0} onClick={a('bestellen')} />
        <Kachel icon="inventur" titel="Inventur" zeile="Zählen und abgleichen" onClick={a('inventur')} />
        <Kachel icon="checks" titel="Checks" zeile="Fahrzeug und Rucksack" onClick={a('checks')} />
      </div>

      <Abschnitt titel="Material bewegen" />
      <div className="bv-flaeche">
        <Zeile icon="einbuchen" titel="Einbuchen" unter="Mit Menge, Ablauf und Charge" onClick={a('einbuchen')} />
        <Zeile icon="ausbuchen" titel="Ausbuchen" onClick={a('ausbuchen')} />
        <Zeile icon="mehrfach" titel="Mehrere Artikel buchen" onClick={a('mehrfach')} />
        <Zeile icon="umlagern" titel="Umlagern" unter="Zwischen Standorten" onClick={a('umlagern')} />
        <Zeile icon="assistent" titel="Lager-Assistent" unter="Fragen und Buchungen in eigenen Worten" onClick={a('assistent')} />
      </div>

      <Abschnitt titel="Nachsehen" />
      <div className="bv-flaeche">
        <Zeile icon="logbuch" titel="Logbuch" unter="Wer hat wann was gebucht" onClick={a('logbuch')} />
        <Zeile icon="rueckruf" titel="Rückruf" unter="Charge suchen" onClick={a('rueckruf')} />
        <Zeile icon="statistik" titel="Statistik" onClick={a('statistik')} />
      </div>

      <Abschnitt titel="Verwalten" />
      <div className="bv-flaeche">
        <Zeile icon="artikel" titel="Artikel" unter="Stammdaten, Codes, Soll" onClick={a('artikel')} />
        <Zeile icon="import" titel="Liste importieren" unter="CSV-Datei" onClick={a('import')} />
        <Zeile icon="pdf" titel="Bestand als PDF" onClick={a('pdf')} />
        <Zeile icon="einstellungen" titel="Einstellungen" unter="Standorte, Benachrichtigungen, Inventur" onClick={a('einstellungen')} />
      </div>
    </Seite>
  )
}
