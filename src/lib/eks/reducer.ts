// Aus dem Ereignis-Log wird der Zustand gefaltet. Reine Funktion, keine I/O —
// dieselbe Eingabe ergibt auf jedem Gerät denselben Zustand.
//
// Veränderliche Felder nutzen "letzte Änderung gewinnt" pro Feld (fieldSeq),
// damit zwei Geräte auch bei umgekehrter Eintreffreihenfolge konvergieren.

import type { AtemschutzTrupp, EksEvent, EksState, EtbEntry } from './types'
import { emptyState } from './types'

function lww(st: EksState, entity: string, field: string, seq: string): boolean {
  const cur = st.fieldSeq[entity]?.[field]
  if (cur && cur >= seq) return false
  if (!st.fieldSeq[entity]) st.fieldSeq[entity] = {}
  st.fieldSeq[entity][field] = seq
  return true
}

function applyPatch(st: EksState, target: any, entity: string, fields: Record<string, any>, seq: string) {
  for (const [k, v] of Object.entries(fields || {})) {
    if (lww(st, entity, k, seq)) target[k] = v
  }
}

function zeitVon(e: EksEvent): string {
  const off = e.client_offset_ms ?? 0
  return new Date(new Date(e.client_ts).getTime() + off).toISOString()
}

/** Automatische Einsatztagebuch-Einträge aus fachlichen Ereignissen. */
function etbTextFor(e: EksEvent, st: EksState): string | null {
  const p = e.payload || {}
  const truppName = (id: string) => st.trupps[id]?.name || 'Trupp'
  switch (e.type) {
    case 'as.trupp.anmelden': return `Atemschutztrupp „${p.name}" angemeldet (${(p.mitglieder || []).map((m: any) => `${m.name} ${m.anfangsdruck} bar`).join(', ')})`
    case 'as.trupp.einsatzbeginn': return `${truppName(p.trupp_id)} unter PA — Einsatzbeginn`
    case 'as.trupp.ziel_erreicht': return `${truppName(p.trupp_id)} hat das Einsatzziel erreicht`
    case 'as.messung': return `Druckabfrage ${truppName(p.trupp_id)}: ${(p.readings || []).map((r: any) => `${r.druck} bar`).join(' / ')}`
    case 'as.trupp.rueckzug_angeordnet': return `Rückzug angeordnet für ${truppName(p.trupp_id)}${p.grund ? ` — ${p.grund}` : ''}`
    case 'as.trupp.abgemeldet': return `${truppName(p.trupp_id)} abgemeldet`
    case 'as.mayday': return `MAYDAY — ${truppName(p.trupp_id)}: ${p.text || ''}`
    case 'as.ueberwachung.luecke': return `Überwachungslücke von ${Math.round((p.dauer_ms || 0) / 1000)} s (${p.grund || 'unbekannt'})`
    case 'kraft.status': return `${st.kraefte[p.id]?.funkrufname || 'Einsatzmittel'}: Status ${p.fms_status}`
    case 'kraft.set': return p.neu ? `Einsatzmittel ${p.funkrufname} aufgenommen` : null
    case 'abschnitt.set': return p.neu ? `Einsatzabschnitt „${p.name}" gebildet` : null
    case 'system.papier': return 'Papier-Rückfallebene aktiviert'
    case 'system.zeitkorrektur': return `Uhrzeit-Abweichung erkannt: ${Math.round((p.offset_ms || 0) / 1000)} s`
    default: return null
  }
}

function pushEtb(st: EksState, e: EksEvent, text: string, typ: string, abschnitt_id?: string) {
  st.etb.push({
    id: e.id, seq: e.seq, zeit: zeitVon(e), client_ts: e.client_ts,
    zeit_ungeprueft: e.client_offset_ms === null,
    autor: e.actor_name, device_id: e.device_id, typ, text, abschnitt_id,
  })
}

function leererTrupp(id: string): AtemschutzTrupp {
  return { id, name: '', typ: 'sonstiges', mitglieder: [], status: 'angemeldet', messungen: {}, quittiert: {} }
}

export function applyEvent(st: EksState, e: EksEvent): EksState {
  const p = e.payload || {}
  switch (e.type) {
    case 'einsatz.patch':
      applyPatch(st, st.einsatz, 'einsatz', p.fields || {}, e.seq)
      break

    case 'abschnitt.set': {
      const a = st.abschnitte[p.id] || { id: p.id, name: '' }
      applyPatch(st, a, 'abschnitt:' + p.id, { name: p.name, leiter: p.leiter, funkkanal: p.funkkanal, farbe: p.farbe }, e.seq)
      st.abschnitte[p.id] = a
      break
    }
    case 'abschnitt.remove':
      if (st.abschnitte[p.id] && lww(st, 'abschnitt:' + p.id, 'entfernt', e.seq)) st.abschnitte[p.id].entfernt = true
      break

    case 'kraft.set': {
      const k = st.kraefte[p.id] || { id: p.id, funkrufname: '', fms_status: 2 }
      applyPatch(st, k, 'kraft:' + p.id, {
        funkrufname: p.funkrufname, typ: p.typ, besatzung: p.besatzung,
        abschnitt_id: p.abschnitt_id, bemerkung: p.bemerkung,
      }, e.seq)
      st.kraefte[p.id] = k
      break
    }
    case 'kraft.status': {
      const k = st.kraefte[p.id]
      if (k && lww(st, 'kraft:' + p.id, 'fms_status', e.seq)) k.fms_status = p.fms_status
      break
    }
    case 'kraft.remove':
      if (st.kraefte[p.id] && lww(st, 'kraft:' + p.id, 'entfernt', e.seq)) st.kraefte[p.id].entfernt = true
      break

    // ── Atemschutz ──────────────────────────────────────────────────────────
    case 'as.trupp.anmelden': {
      const t = st.trupps[p.trupp_id] || leererTrupp(p.trupp_id)
      t.name = p.name; t.typ = p.typ || 'sonstiges'
      t.funkrufname = p.funkrufname; t.auftrag = p.auftrag
      t.abschnitt_id = p.abschnitt_id
      t.mitglieder = p.mitglieder || []
      t.owner_device = e.device_id
      t.status = 'angemeldet'
      for (const m of t.mitglieder) if (!t.messungen[m.person_id]) t.messungen[m.person_id] = []
      st.trupps[t.id] = t
      break
    }
    case 'as.trupp.einsatzbeginn': {
      const t = st.trupps[p.trupp_id]
      if (t) { t.t_unter_pa = p.t_unter_pa || zeitVon(e); t.status = 'unter_pa' }
      break
    }
    case 'as.trupp.ziel_erreicht': {
      const t = st.trupps[p.trupp_id]
      if (t) {
        t.t_ziel = zeitVon(e); t.status = 'am_ziel'
        t.ziel_druecke = {}
        for (const r of p.readings || []) {
          t.ziel_druecke[r.person_id] = r.druck
          ;(t.messungen[r.person_id] ||= []).push({ t: zeitVon(e), druck: r.druck })
        }
      }
      break
    }
    case 'as.messung': {
      const t = st.trupps[p.trupp_id]
      if (t) for (const r of p.readings || []) {
        ;(t.messungen[r.person_id] ||= []).push({ t: zeitVon(e), druck: r.druck, quelle: p.quelle })
      }
      break
    }
    case 'as.trupp.patch': {
      const t = st.trupps[p.trupp_id]
      if (t) applyPatch(st, t, 'trupp:' + p.trupp_id, p.fields || {}, e.seq)
      break
    }
    case 'as.trupp.rueckzug_angeordnet': {
      const t = st.trupps[p.trupp_id]
      if (t) { t.status = 'rueckweg'; t.rueckzug_grund = p.grund }
      break
    }
    case 'as.trupp.abgemeldet': {
      const t = st.trupps[p.trupp_id]
      if (t) {
        t.status = 'abgemeldet'; t.t_ende = zeitVon(e)
        for (const r of p.enddruecke || []) (t.messungen[r.person_id] ||= []).push({ t: zeitVon(e), druck: r.druck })
      }
      break
    }
    case 'as.mayday': {
      const t = st.trupps[p.trupp_id]
      if (t) t.mayday = p.text || 'MAYDAY'
      break
    }
    case 'as.alarm.quittiert': {
      const t = st.trupps[p.trupp_id]
      if (t) t.quittiert[p.alarm_key] = zeitVon(e)
      break
    }
    case 'as.config':
      Object.assign(st.config, p.fields || {})
      break

    // ── Karte ───────────────────────────────────────────────────────────────
    case 'karte.zeichen.set':
      st.zeichen[p.id] = { id: p.id, art: p.art, lat: p.lat, lng: p.lng, label: p.label, abschnitt_id: p.abschnitt_id, geometry: p.geometry }
      break
    case 'karte.zeichen.remove':
      delete st.zeichen[p.id]
      break

    // ── Einsatztagebuch ─────────────────────────────────────────────────────
    case 'etb.entry':
      pushEtb(st, e, p.text || '', 'manuell', p.abschnitt_id)
      break
    case 'etb.correct': {
      const ziel = st.etb.find(x => x.id === p.target_id)
      if (ziel) ziel.korrigiert_durch = e.id
      const neu: EtbEntry = {
        id: e.id, seq: e.seq, zeit: zeitVon(e), client_ts: e.client_ts,
        zeit_ungeprueft: e.client_offset_ms === null, autor: e.actor_name,
        device_id: e.device_id, typ: 'korrektur', text: p.text || '',
        korrektur_von: p.target_id, grund: p.grund,
      }
      st.etb.push(neu)
      break
    }
    case 'system.disclaimer':
      st.disclaimerOk = true
      break
    default:
      break
  }

  // Abgeleitete Tagebuch-Einträge (eine Schreiboperation, eine Wahrheit)
  if (e.type !== 'etb.entry' && e.type !== 'etb.correct') {
    const text = etbTextFor(e, st)
    if (text) pushEtb(st, e, text, e.type, (e.payload || {}).abschnitt_id)
  }

  if (e.seq > st.lastSeq) st.lastSeq = e.seq
  return st
}

export function fold(einsatzId: string, events: EksEvent[]): EksState {
  const st = emptyState(einsatzId)
  const sorted = [...events].sort((a, b) => (a.seq < b.seq ? -1 : a.seq > b.seq ? 1 : 0))
  for (const e of sorted) applyEvent(st, e)
  st.etb.sort((a, b) => (a.seq < b.seq ? -1 : 1))
  return st
}
