// Startseite des MPG im Dunkelrot-Design (Owner, 22.11.2026: Startseite mit Kacheln). Im roten Kopf die
// Zahlen (bereit, Handlungsbedarf, gesperrt), darunter die Bereiche als Kacheln (Geräte, Meldungen, Fristen,
// Logbuch) und, was heute zu tun ist: begonnene Prüfung, Arbeitsliste nach Dringlichkeit, Prüfrunden je
// Standort (vorerst nach dem Standort-Text der Geräte), bald fällig, Einrichtung.

import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { STUFEN, istAusserBetrieb, type Stufe } from '../../lib/mpg/zustand'
import { ERGEBNIS_TEXT } from '../../lib/mpg/pruefung'
import { kalendertag } from '../../lib/mpg/fristen'
import { abschnittVon, fristenEintraege } from './fristenListe'
import { useMpg } from './MpgDaten'
import { GeraetKarte } from './GeraetKarte'
import { useLadestand } from './Ladestand'
import FormularEinstellungLink from '../../components/FormularEinstellungLink'
import { MpgKopf } from './kopf'
import { Abschnitt, Aktionen, Karte, Leer, ICON, knopfLeise, knopfVoll, kursivGrau, pik } from './teile'
import { OHNE_STANDORT, rundenPfad, standortSchluessel, type Device } from './typen'

export interface Runde { schluessel: string; name: string; geraete: Device[] }

/** Geräte nach Standort-Text gruppiert (Groß-/Kleinschreibung egal), sortiert nach Name */
export function rundenVon(devices: Device[]): Runde[] {
  const m = new Map<string, Runde>()
  for (const d of devices) {
    const k = standortSchluessel(d.location)
    const r = m.get(k) ?? { schluessel: k, name: d.location?.trim() || 'Ohne Standort', geraete: [] }
    r.geraete.push(d)
    m.set(k, r)
  }
  return [...m.values()].sort((a, b) => (a.schluessel === OHNE_STANDORT ? 1 : 0) - (b.schluessel === OHNE_STANDORT ? 1 : 0) || a.name.localeCompare(b.name, 'de'))
}

const rang = (s: Stufe) => STUFEN.indexOf(s)

export default function Heute() {
  const m = useMpg()
  const navigate = useNavigate()
  const { blocker, banner } = useLadestand()
  // entwurfStand: neu lesen, sobald sich der Entwurf ändert
  const entwurf = useMemo(() => m.leseEntwurf(), [m.entwurfStand, m.user?.id])
  const runden = useMemo(() => rundenVon(m.bestand), [m.bestand])

  // Zahlen im roten Kopf; solange die Geräte laden, Striche statt Nullen (der Platz bleibt, nichts springt)
  const da = m.geraeteGeladen
  const z = (n: number) => (da ? n : '–')
  const kopf = (
    <MpgKopf tiefe={0} titel="Medizinprodukte" unter={m.user?.organization_name || 'Responda'} zurueck="/hub" fest
      reiter={(
        <div className="mp-zahlen" role="group" aria-label="Zustand der Geräte">
          <button type="button" disabled={!da} onClick={() => navigate('/mpg/geraete?zustand=bereit')}>
            <small>Bereit</small><b>{z(m.stats.ok + m.stats.bald)}</b><span>{da && m.stats.bald ? `${m.stats.bald} bald fällig` : 'einsatzbereit'}</span>
          </button>
          <button type="button" disabled={!da} className={da && m.stats.handlung ? 'warn' : undefined} onClick={() => navigate('/mpg/geraete?zustand=handlung')}>
            <small>Handeln</small><b>{z(m.stats.handlung)}</b><span>zu tun</span>
          </button>
          <button type="button" disabled={!da} className={da && m.stats.gesperrt ? 'warn' : undefined} onClick={() => navigate('/mpg/geraete?zustand=gesperrt')}>
            <small>Gesperrt</small><b>{z(m.stats.gesperrt)}</b><span>nicht bereit</span>
          </button>
        </div>
      )} />
  )

  if (blocker) return <>{kopf}{blocker}</>

  const entwurfGeraet = entwurf ? m.devices.find(d => d.id === entwurf.device_id) : undefined
  // Läuft sein Speichern gerade (Seite schon verlassen), ist er nicht „unklar“, sondern unterwegs
  const speichertGerade = !!entwurf && m.laufendePruefung === entwurf.ids.pruefung
  const arbeit = m.bestand
    .filter(d => { const s = m.zustand(d).stufe; return s === 'gesperrt' || s === 'handlung' })
    .sort((a, b) => rang(m.zustand(a).stufe) - rang(m.zustand(b).stufe) || a.name.localeCompare(b.name, 'de'))
  const bald = m.bestand.filter(d => m.zustand(d).stufe === 'bald')
  const eingang = m.externalReports.filter(r => r.status === 'pending')
  const unklar = m.devices.filter(d => m.unklarerDefekt(d.id))

  // Was nicht liegen bleiben darf — auch, wenn der Bestand leer ist
  const entwurfKarte = entwurf && entwurfGeraet && (
    <Karte rand={entwurf.versucht ? '#dc2626' : 'var(--lbf-akzent)'} style={{ marginBottom: 16 }}>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: entwurf.versucht ? 'var(--lbf-fehler-text)' : 'var(--lbf-akzent)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 3 }}>
          {speichertGerade ? 'Wird gespeichert …' : entwurf.versucht ? 'Speichern unklar' : 'Begonnene Prüfung'}
        </div>
        <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 17 }}>{entwurfGeraet.name}</div>
        <div style={{ ...kursivGrau, marginTop: 2 }}>
          {speichertGerade
            ? 'Bitte einen Moment warten.'
            : entwurf.versucht
            ? `„${ERGEBNIS_TEXT[entwurf.versucht.ergebnis]}“ — ob es angekommen ist, ist offen. Bitte erneut senden.`
            : `${entwurf.results.filter(r => r.status === 'ok' || r.status === 'mangel').length} von ${entwurf.results.length} Punkten entschieden`}
        </div>
      </div>
      {!speichertGerade && (
        <Aktionen>
          {/* außer Betrieb genommen: eine nur begonnene Prüfung lässt sich nur noch verwerfen */}
          {istAusserBetrieb(entwurfGeraet) && !entwurf.versucht
            ? <button onClick={() => { if (confirm(`Begonnene Prüfung von „${entwurfGeraet.name}“ verwerfen? Das Gerät ist außer Betrieb genommen.`)) m.schreibeEntwurf(null) }} style={knopfLeise}>Verwerfen</button>
            : <Link to={`/mpg/geraete/${entwurfGeraet.id}/pruefen`} style={{ ...knopfLeise, background: 'var(--lbf-akzent-grund)', color: '#fff', textDecoration: 'none' }}>
                {entwurf.versucht ? 'Erneut senden' : 'Fortsetzen'}
              </Link>}
        </Aktionen>
      )}
    </Karte>
  )
  const unklarKarten = unklar.length > 0 && (
    <Abschnitt titel="Nicht sicher gespeichert">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {unklar.map(d => <GeraetKarte key={d.id} device={d} />)}
      </div>
    </Abschnitt>
  )
  // STK und MTK: dieselbe Einteilung wie auf der Seite „Fristen“ — gesperrt zählt Geräte
  const kEintraege = fristenEintraege(m)
  const kAbschnitt = (i: number) => kEintraege.filter(e => abschnittVon(e, m.heute) === i)
  const kGesperrt = new Set(kAbschnitt(0).map(e => e.device.id)).size
  const kTeile = [
    kGesperrt && `${kGesperrt === 1 ? '1 Gerät' : `${kGesperrt} Geräte`} gesperrt`,
    kAbschnitt(1).length && `${kAbschnitt(1).length} diesen Monat`,
    kAbschnitt(2).length && `${kAbschnitt(2).length} ohne Datum`,
    kAbschnitt(3).length && `${kAbschnitt(3).length} in den nächsten drei Monaten`,
  ].filter(Boolean)
  const offeneFaelle = m.defects.filter(d => d.status !== 'resolved').length
  const kachel = (pfad: string, icon: keyof typeof ICON, titel: string, zeile: string, wichtig = false, zahl = 0) => (
    <Link to={pfad} className="mp-kachel">
      <span className="mp-kachel-icon">{pik(ICON[icon], 22)}</span>
      {zahl > 0 && <span className="mp-zahl" aria-label={`${zahl} neu`}>{zahl}</span>}
      <span><b>{titel}</b><small className={wichtig ? 'wichtig' : undefined}>{zeile}</small></span>
    </Link>
  )
  const kacheln = (
    <div className="mp-kacheln">
      {kachel('/mpg/geraete', 'geraete', 'Geräte', m.bestand.length ? `${m.bestand.length} im Bestand` : 'Noch keine')}
      {kachel('/mpg/meldungen', 'meldungen', 'Meldungen',
        eingang.length ? `${eingang.length === 1 ? 'Eine neue' : `${eingang.length} neue`} von außen` : offeneFaelle ? `${offeneFaelle} offen` : 'Nichts offen',
        eingang.length > 0, eingang.length)}
      {kachel('/mpg/fristen', 'fristen', 'STK und MTK', kTeile.length ? String(kTeile[0]) : 'Nichts fällig', kGesperrt > 0)}
      {kachel('/mpg/logbuch', 'logbuch', 'Logbuch', 'Prüfungen und Gerätebuch')}
    </div>
  )
  const einrichtung = (
    <Abschnitt titel="Einrichtung">
      <div className="bv-flaeche">
        <Link to="/mpg/vorlagen" className="bv-z">
          <span className="mp-z-icon">{pik(ICON.vorlagen, 18)}</span>
          <span className="bv-tx"><b>Prüfvorlagen</b><small>Prüfpunkte je Gerätetyp</small></span>
          <span style={{ color: 'var(--warm-gray)' }}>{pik(ICON.weiter, 16)}</span>
        </Link>
        {m.darfVerwalten && (
          <Link to="/mpg/geraete/neu" className="bv-z">
            <span className="mp-z-icon">{pik(ICON.plus, 18)}</span>
            <span className="bv-tx"><b>Gerät anlegen</b><small>Neues Medizinprodukt in den Bestand</small></span>
            <span style={{ color: 'var(--warm-gray)' }}>{pik(ICON.weiter, 16)}</span>
          </Link>
        )}
      </div>
      {/* Ohne Modul Vorgänge der einzige Weg zur Einstellung des Formulars (Bauplan Formulare 3.4) */}
      <div style={{ marginTop: 10 }}><FormularEinstellungLink formular="defektmeldung" user={m.user} /></div>
    </Abschnitt>
  )

  if (!m.bestand.length) {
    return (
      <>
        {kopf}
        {banner}
        {entwurfKarte}
        {unklarKarten}
        {kacheln}
        <Leer>
          {m.devices.length ? 'Keine Geräte im Bestand.' : 'Noch keine Geräte angelegt.'}
          {m.darfVerwalten && <div style={{ marginTop: 14 }}><Link to="/mpg/geraete/neu" style={{ ...knopfVoll, textDecoration: 'none', display: 'inline-block' }}>{m.devices.length ? 'Gerät anlegen' : 'Erstes Gerät anlegen'}</Link></div>}
        </Leer>
        {einrichtung}
      </>
    )
  }

  return (
    <>
      {kopf}
      {banner}

      {entwurfKarte}
      {unklarKarten}

      {kacheln}

      <Abschnitt titel={`Zu tun (${arbeit.length})`}>
        {arbeit.length === 0
          ? <div style={{ ...kursivGrau, fontSize: 13 }}>Nichts offen — alle Geräte einsatzbereit.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{arbeit.map(d => <GeraetKarte key={d.id} device={d} zurueck="/mpg" />)}</div>}
      </Abschnitt>

      <Abschnitt titel="Prüfrunden je Standort">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {runden.map(r => {
            const geprueft = r.geraete.filter(d => kalendertag(d.last_inspection) === m.heute).length
            const offen = r.geraete.filter(d => { const s = m.zustand(d).stufe; return s === 'gesperrt' || s === 'handlung' }).length
            return (
              <Karte key={r.schluessel} rand={offen ? 'var(--lbf-akzent)' : '#16a34a'}>
                <Link to={rundenPfad(r.schluessel)} style={{ display: 'block', padding: '12px 14px', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 17 }}>{r.name}</div>
                  <div style={{ ...kursivGrau, marginTop: 2 }}>
                    {r.geraete.length} {r.geraete.length === 1 ? 'Gerät' : 'Geräte'} · {geprueft} heute geprüft{offen ? ` · ${offen} offen` : ''}
                  </div>
                </Link>
              </Karte>
            )
          })}
        </div>
      </Abschnitt>

      {bald.length > 0 && (
        <Abschnitt titel={`Bald fällig (${bald.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{bald.map(d => <GeraetKarte key={d.id} device={d} zurueck="/mpg" />)}</div>
        </Abschnitt>
      )}

      {einrichtung}
    </>
  )
}
