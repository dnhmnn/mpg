// HEUTE: Was ist zu tun? Begonnene Prüfung, Arbeitsliste nach Dringlichkeit, Prüfrunden
// je Standort (vorerst nach dem Standort-Text der Geräte).

import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { STUFEN, istAusserBetrieb, type Stufe } from '../../lib/mpg/zustand'
import { ERGEBNIS_TEXT } from '../../lib/mpg/pruefung'
import { kalendertag } from '../../lib/mpg/fristen'
import { abschnittVon, fristenEintraege } from './fristenListe'
import { useMpg } from './MpgDaten'
import { GeraetKarte } from './GeraetKarte'
import { useLadestand } from './Ladestand'
import { Abschnitt, Aktionen, Karte, Leer, StatKarte, ICON, knopfLeise, knopfVoll, kursivGrau, pik } from './teile'
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

  if (blocker) return blocker

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
  const fristenKarte = kTeile.length > 0 && (
    <Karte rand={kGesperrt ? '#dc2626' : 'var(--lbf-akzent)'} style={{ marginBottom: 24 }}>
      <Link to="/mpg/fristen" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', textDecoration: 'none', color: 'inherit' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>STK und MTK <span style={{ fontWeight: 400, fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)' }}>· sicherheits- und messtechnische Kontrollen</span></div>
          <div style={kursivGrau}>{kTeile.join(' · ')}</div>
        </div>
        <span style={{ color: 'var(--lbf-akzent)' }}>{pik(ICON.weiter)}</span>
      </Link>
    </Karte>
  )
  const eingangKarte = eingang.length > 0 && (
    <Karte rand="var(--lbf-akzent)" style={{ marginBottom: 24 }} >
      <Link to="/mpg/meldungen" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', textDecoration: 'none', color: 'inherit' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{eingang.length === 1 ? 'Eine neue Meldung' : `${eingang.length} neue Meldungen`} von außen</div>
          <div style={kursivGrau}>{eingang.slice(0, 3).map(r => m.geraeteName(r.device_id, r.device_name)).join(', ')}{eingang.length > 3 ? ' …' : ''}</div>
        </div>
        <span style={{ color: 'var(--lbf-akzent)' }}>{pik(ICON.weiter)}</span>
      </Link>
    </Karte>
  )

  if (!m.bestand.length) {
    return (
      <>
        {banner}
        {entwurfKarte}
        {unklarKarten}
        {eingangKarte}
        <Leer>
          {m.devices.length ? 'Keine Geräte im Bestand.' : 'Noch keine Geräte angelegt.'}
          {m.darfVerwalten && <div style={{ marginTop: 14 }}><Link to="/mpg/geraete/neu" style={{ ...knopfVoll, textDecoration: 'none', display: 'inline-block' }}>{m.devices.length ? 'Gerät anlegen' : 'Erstes Gerät anlegen'}</Link></div>}
        </Leer>
      </>
    )
  }

  return (
    <>
      {banner}

      {entwurfKarte}
      {unklarKarten}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 24 }}>
        <StatKarte label="Bereit" zahl={m.stats.ok + m.stats.bald} text={m.stats.bald ? `davon ${m.stats.bald} bald fällig` : 'einsatzbereit'} onClick={() => navigate('/mpg/geraete?zustand=bereit')} />
        <StatKarte label="Handeln" zahl={m.stats.handlung} text="Handlungsbedarf" onClick={() => navigate('/mpg/geraete?zustand=handlung')} />
        <StatKarte label="Gesperrt" zahl={m.stats.gesperrt} text="nicht einsatzbereit" onClick={() => navigate('/mpg/geraete?zustand=gesperrt')} />
      </div>

      {eingangKarte}
      {fristenKarte}

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
    </>
  )
}
