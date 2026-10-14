// Die Checkliste "Organisation einrichten": was eine neue Organisation tun
// sollte, mit Erkennung, was schon erledigt ist, und Abhaken von Hand.
//
// Welche Punkte es gibt und wie sie zählen, steht in lib/einfuehrung.ts.

import { useEffect, useState } from 'react'
import type React from 'react'
import { pb } from '../lib/pocketbase'
import { CHECKLISTE, checklistenStand, abhaken, type Befunde } from '../lib/einfuehrung'
import { hatRecht } from '../lib/apps'
import type { User } from '../types'
import { useEinfuehrungStand } from './Einfuehrung'

export default function OrgCheckliste({ user, kompakt = false, onGehe }: { user: User; kompakt?: boolean; onGehe: (pfad: string) => void }) {
  const { stand, standRef, speichern } = useEinfuehrungStand(user)
  const [befunde, setBefunde] = useState<Befunde>({})

  useEffect(() => {
    let weg = false
    setBefunde({})
    if (user.organization_id) {
      const o = user.organization_id
      // Die Mitglieder einmal laden und im Gerät zählen — ohne Filter auf JSON-Felder.
      // Ausbildungs-Teilnehmer zählen nicht als Mitglieder (sie haben oft keinen eigenen Login).
      pb.collection('users').getFullList<{ id: string; role?: string; permissions?: Record<string, boolean> }>({
        filter: pb.filter('organization_id = {:o}', { o }), fields: 'id,role,permissions', requestKey: null,
      })
        .then((liste) => {
          if (weg) return
          const mitglieder = liste.filter((u) => u.role !== 'teilnehmer')
          setBefunde((x) => ({
            ...x,
            benutzer: mitglieder.length > 1,
            // EKS steckt in keiner Rollen-Vorlage: erledigt, sobald jemand das Recht hat
            eks: mitglieder.some((u) => u.permissions?.eks === true),
            // CIRS: außer dir darf noch jemand Meldungen bearbeiten
            cirs: mitglieder.some((u) => u.id !== user.id && u.permissions?.dokumente === true),
          }))
        })
        .catch(() => { /* ohne Recht oder offline: bleibt zum Abhaken */ })
      pb.collection('form_templates').getList(1, 1, { filter: pb.filter('organization_id = {:o}', { o }), fields: 'id', requestKey: null })
        .then((r) => { if (!weg && r.totalItems > 0) setBefunde((x) => ({ ...x, formulare: true })) })
        .catch(() => { /* keine eigenen Vorlagen oder keine Sammlung */ })
      pb.collection('organizations').getOne(o, { fields: 'id,role_permissions,form_config', requestKey: null })
        .then((o: Record<string, unknown>) => {
          if (weg) return
          const rp = o.role_permissions
          const fc = o.form_config
          setBefunde((x) => ({
            ...x,
            rechte: !!rp && typeof rp === 'object' && Object.keys(rp as object).length > 0,
            formulare: x.formulare || (!!fc && typeof fc === 'object' && Object.keys(fc as object).length > 0),
          }))
        })
        .catch(() => { /* bleibt offen */ })
    }
    return () => { weg = true }
  }, [user.organization_id])

  const code = (user.organization as { org_code?: string } | undefined)?.org_code
  const punkte = checklistenStand(
    CHECKLISTE
      .filter((p) => !p.recht || hatRecht(user, p.recht))
      // Die Seite der Organisation braucht ihren Code; ohne ihn kein Link
      .map((p) => (p.pfad?.includes(':org') ? { ...p, pfad: code ? p.pfad.replace(':org', code) : undefined } : p)),
    befunde, stand)
  const fertig = punkte.filter((p) => p.erledigt).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(var(--lbf-rot-rgb),0.1)', overflow: 'hidden' }}>
          <div style={{ width: `${punkte.length ? (fertig / punkte.length) * 100 : 0}%`, height: '100%', background: fertig === punkte.length ? '#16a34a' : 'var(--lbf-akzent)', transition: 'width .3s' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--lbf-text)' }}>{fertig} von {punkte.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: kompakt ? 6 : 8 }}>
        {punkte.map((p) => (
          <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: kompakt ? '8px 10px' : '11px 12px', borderRadius: 10, background: 'var(--warm-bg)', border: '0.5px solid var(--lbf-border-light)' }}>
            <button
              onClick={() => { if (p.quelle !== 'erkannt') speichern(abhaken(standRef.current, p.id, !p.erledigt, new Date())) }}
              disabled={p.quelle === 'erkannt'}
              aria-pressed={p.erledigt}
              aria-label={`${p.titel}: ${p.erledigt ? 'erledigt' : 'offen'}${p.quelle === 'erkannt' ? ' (erkannt)' : ''}`}
              title={p.quelle === 'erkannt' ? 'Erkannt — ist erledigt' : p.erledigt ? 'Wieder offen' : 'Als erledigt abhaken'}
              style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1, cursor: p.quelle === 'erkannt' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: p.erledigt ? 'none' : '1.5px solid rgba(var(--lbf-rot-rgb),0.3)', background: p.erledigt ? '#16a34a' : 'var(--lbf-card)', color: '#fff' }}>
              {p.erledigt && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
            </button>
            <div style={{ flex: 1, minWidth: 0, hyphens: 'auto', WebkitHyphens: 'auto', overflowWrap: 'break-word' } as React.CSSProperties}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--lbf-text)' }}>{p.titel}</div>
              {!kompakt && <div style={{ fontSize: 12.5, color: 'var(--warm-gray)', marginTop: 2, lineHeight: 1.45 }}>{p.text}</div>}
              {p.quelle === 'erkannt' && <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--lbf-ok-text)', marginTop: 2 }}>erledigt</div>}
            </div>
            {p.pfad && (
              <button onClick={() => onGehe(p.pfad!)} aria-label={`${p.titel}: öffnen`} style={{ flexShrink: 0, background: 'none', border: '1px solid rgba(var(--lbf-rot-rgb),0.2)', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 700, color: 'var(--lbf-akzent)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Öffnen
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
