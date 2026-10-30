import { describe, it, expect } from 'vitest'
import { ROLLEN, getRoleTemplate } from '../apps'
import {
  EIGENE_ID, SERVER_ROLLEN, eigeneRollen, freieFarbe, istEigeneRolleId, neueRollenId, nurAngehakt, pruefeRollenName,
  rolleAendern, rolleAnlegen, rolleEntfernen, rolleInfo, rolleWiederherstellen, rollenBezeichnung, rollenFarbe, rollenFuer,
  rollenKuerzel, vorlageBereinigen, type EigeneRolle,
} from '../rollen'

// Fester „Zufall“: liefert der Reihe nach die Werte, dann wieder von vorn
const folge = (...w: number[]) => { let i = 0; return () => w[i++ % w.length] }
const GF: EigeneRolle = { id: 'eigen_gruppe01', name: 'Gruppenführerin', farbe: 'senape' }
const PR: EigeneRolle = { id: 'eigen_prakt002', name: 'Praktikant', hinweis: 'Unitas, Chat, Notizen', farbe: 'salvia' }

describe('Kennung eigener Rollen', () => {
  it('nur "eigen_" und 8 Zeichen aus a–z und 0–9', () => {
    expect(istEigeneRolleId('eigen_k3m9x2qa')).toBe(true)
    for (const falsch of ['EIGEN_k3m9x2qa', 'eigen_k3m9x2q', 'eigen_k3m9x2qab', 'eigen_k3m9x2Q!', 'admin', '', undefined, 7]) {
      expect(istEigeneRolleId(falsch), String(falsch)).toBe(false)
    }
  })

  it('keine vorgegebene und keine Server-Rolle passt auf das Muster — eigene Rollen geben auf dem Server nie etwas', () => {
    for (const id of [...ROLLEN.map(r => r.id), ...SERVER_ROLLEN, 'supervisor']) expect(EIGENE_ID.test(id), id).toBe(false)
  })

  it('neue Kennungen folgen dem Muster und weichen belegten aus', () => {
    const erste = neueRollenId([], folge(0))
    expect(erste).toBe('eigen_aaaaaaaa')
    expect(istEigeneRolleId(erste)).toBe(true)
    expect(neueRollenId(['eigen_aaaaaaaa'], folge(0, 0, 0, 0, 0, 0, 0, 0, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99))).toBe('eigen_99999999')
    expect(() => neueRollenId(['eigen_aaaaaaaa'], folge(0))).toThrow()
  })
})

describe('Eigene Rollen aus der Organisation lesen', () => {
  it('fehlendes, leeres oder kaputtes Feld ergibt keine Rollen', () => {
    for (const org of [undefined, null, {}, { eigene_rollen: null }, { eigene_rollen: 'kein json' }, { eigene_rollen: { a: 1 } }]) {
      expect(eigeneRollen(org)).toEqual([])
    }
  })

  it('liest auch Text (JSON) und bereinigt Namen und Hinweise', () => {
    const org = { eigene_rollen: JSON.stringify([{ id: 'eigen_gruppe01', name: '  Gruppen­führerin ', hinweis: ' Führt   eine Gruppe ', farbe: 'senape' }]) }
    expect(eigeneRollen(org)).toEqual([{ id: 'eigen_gruppe01', name: 'Gruppen­führerin', hinweis: 'Führt eine Gruppe', farbe: 'senape' }])
  })

  it('verwirft "admin" als Kennung — sonst vergäbe ein harmloser Name die Admin-Rolle', () => {
    const org = { eigene_rollen: [{ id: 'admin', name: 'Kassenwart' }, { id: 'lager', name: 'Hilfe' }, GF] }
    expect(eigeneRollen(org).map(r => r.id)).toEqual(['eigen_gruppe01'])
  })

  it('verwirft Einträge ohne Namen, Doppelte und unbekannte Farben', () => {
    const org = { eigene_rollen: [{ id: 'eigen_ohnename', name: '   ' }, GF, { ...GF, name: 'Doppelt' }, { id: 'eigen_farbe001', name: 'X', farbe: 'neonpink' }] }
    const r = eigeneRollen(org)
    expect(r.map(x => x.name)).toEqual(['Gruppenführerin', 'X'])
    expect(r[1].farbe).toBeUndefined()
  })
})

describe('Rollen zur Auswahl', () => {
  it('ohne eigene Rollen genau die vorgegebenen, in ihrer Reihenfolge', () => {
    expect(rollenFuer({}).map(r => r.id)).toEqual(ROLLEN.map(r => r.id))
    expect(rollenFuer(undefined).every(r => !r.eigen)).toBe(true)
  })

  it('eigene Rollen nach den vorgegebenen, nach Namen sortiert, archivierte nicht', () => {
    const org = { eigene_rollen: [PR, GF, { id: 'eigen_alt00001', name: 'Alt', archiviert: true }] }
    expect(rollenFuer(org).slice(ROLLEN.length).map(r => r.name)).toEqual(['Gruppenführerin', 'Praktikant'])
  })

  it('eine archivierte Rolle bleibt wählbar, solange jemand sie hat — Speichern ändert sie nicht stillschweigend', () => {
    const org = { eigene_rollen: [{ id: 'eigen_alt00001', name: 'Alt', archiviert: true }] }
    expect(rollenFuer(org, { aktuelle: 'eigen_alt00001' }).slice(-1)[0]).toMatchObject({ id: 'eigen_alt00001', name: 'Alt', archiviert: true })
  })

  it('eine gelöschte oder unbekannte Rolle erscheint als „Unbekannte Rolle“', () => {
    const org = { eigene_rollen: [GF] }
    expect(rollenFuer(org, { aktuelle: 'eigen_weg00001' }).slice(-1)[0]).toMatchObject({ id: 'eigen_weg00001', name: 'Unbekannte Rolle' })
    expect(rollenBezeichnung('eigen_weg00001', org)).toBe('Unbekannte Rolle')
  })

  it('auch ohne geladene eigene Rollen (offline) heißt sie neutral „Unbekannte Rolle“', () => {
    expect(rollenBezeichnung('eigen_weg00001', {})).toBe('Unbekannte Rolle')
    expect(rollenBezeichnung('eigen_weg00001', undefined)).toBe('Unbekannte Rolle')
  })

  it('Bezeichnung: vorgegeben, eigen, leer, alter Wert', () => {
    const org = { eigene_rollen: [GF] }
    expect(rollenBezeichnung('lager', org)).toBe('Material & Lager')
    expect(rollenBezeichnung('eigen_gruppe01', org)).toBe('Gruppenführerin')
    expect(rollenBezeichnung(undefined, org)).toBe('Einsatzkraft')
    expect(rollenBezeichnung('mitglied', org)).toBe('mitglied')
  })

  it('Hinweis einer eigenen Rolle ohne Beschreibung', () => {
    expect(rolleInfo('eigen_gruppe01', { eigene_rollen: [GF] })?.hinweis).toBe('Eigene Rolle der Organisation.')
    expect(rolleInfo('eigen_prakt002', { eigene_rollen: [PR] })?.hinweis).toBe('Unitas, Chat, Notizen')
  })

  it('Farben und Kürzel: vorgegebene fest, eigene aus der Rolle', () => {
    const org = { eigene_rollen: [GF, PR] }
    expect(rollenFarbe('admin', org)).toBe('var(--rolle-bordeaux)')
    expect(rollenFarbe('benutzer', org)).toBe('var(--rolle-ardesia)')
    expect(rollenFarbe('eigen_gruppe01', org)).toBe('var(--rolle-senape)')
    expect(rollenFarbe('unbekannt', org)).toBe('var(--rolle-ardesia)')
    expect(rollenKuerzel('admin', org)).toBe('AD')
    expect(rollenKuerzel('ausbildung', org)).toBe('AU')
    expect(rollenKuerzel('eigen_gruppe01', org)).toBe('GR')
    expect(rollenKuerzel('eigen_x', { eigene_rollen: [{ id: 'eigen_zweiwor1', name: 'Erste Hilfe' }] })).toBe('EI')
    expect(rollenKuerzel('eigen_zweiwor1', { eigene_rollen: [{ id: 'eigen_zweiwor1', name: 'Erste Hilfe' }] })).toBe('EH')
  })
})

describe('Namen eigener Rollen prüfen', () => {
  it('leer, zu lang, reserviert, vergeben', () => {
    expect(pruefeRollenName('   ', [])).toMatchObject({ ok: false, grund: 'leer' })
    expect(pruefeRollenName('x'.repeat(41), [])).toMatchObject({ ok: false, grund: 'zu_lang' })
    expect(pruefeRollenName(' ADMIN ', [])).toMatchObject({ ok: false, grund: 'reserviert' })
    expect(pruefeRollenName('material & lager', [])).toMatchObject({ ok: false, grund: 'reserviert' })
    expect(pruefeRollenName('Führung', [])).toMatchObject({ ok: false, grund: 'reserviert' })
    expect(pruefeRollenName('Supervisor', [])).toMatchObject({ ok: false, grund: 'reserviert' })
    expect(pruefeRollenName('gruppenführerin', [GF])).toMatchObject({ ok: false, grund: 'vergeben' })
  })

  it('beim Umbenennen darf die Rolle ihren eigenen Namen behalten', () => {
    expect(pruefeRollenName('Gruppenführerin', [GF], 'eigen_gruppe01')).toEqual({ ok: true, name: 'Gruppenführerin' })
  })

  it('archivierte Rollen halten ihren Namen besetzt', () => {
    expect(pruefeRollenName('Alt', [{ id: 'eigen_alt00001', name: 'Alt', archiviert: true }])).toMatchObject({ ok: false, grund: 'vergeben' })
  })
})

describe('Eigene Rollen anlegen, ändern, entfernen', () => {
  it('anlegen vergibt Kennung und freie Farbe', () => {
    const r = rolleAnlegen([GF], { name: 'Kassenwart', hinweis: ' Finanzen ' }, folge(0.1))
    expect('fehler' in r).toBe(false)
    if ('fehler' in r) return
    expect(istEigeneRolleId(r.id)).toBe(true)
    expect(r.rollen.slice(-1)[0]).toEqual({ id: r.id, name: 'Kassenwart', hinweis: 'Finanzen', farbe: 'cognac' })
  })

  it('anlegen lehnt doppelte Namen und mehr als 30 aktive Rollen ab', () => {
    expect(rolleAnlegen([GF], { name: 'Gruppenführerin' })).toHaveProperty('fehler')
    const viele = Array.from({ length: 30 }, (_, i) => ({ id: `eigen_${String(i).padStart(8, '0')}`, name: `Rolle ${i}` }))
    expect(rolleAnlegen(viele, { name: 'Noch eine' })).toHaveProperty('fehler')
  })

  it('freie Farbe: nicht Bordeaux (Admin) oder Ardesia (Benutzer), sondern eine unbenutzte', () => {
    expect(freieFarbe([])).toBe('cognac')
    expect(freieFarbe([{ id: 'eigen_a0000001', name: 'A', farbe: 'cognac' }])).toBe('oliva')
  })

  it('umbenennen behält die Kennung', () => {
    const r = rolleAendern([GF], 'eigen_gruppe01', { name: 'Zugführerin', farbe: 'petrolio' })
    expect(r).toEqual({ rollen: [{ id: 'eigen_gruppe01', name: 'Zugführerin', farbe: 'petrolio' }] })
    expect(rolleAendern([GF], 'eigen_fehlt001', { name: 'X' })).toHaveProperty('fehler')
  })

  it('entfernen: niemand hat sie → weg samt Vorlage; jemand hat sie → nur archiviert', () => {
    const rp = { eigen_gruppe01: { einsaetze: true }, benutzer: { chat: true } }
    const weg = rolleEntfernen([GF, PR], rp, 'eigen_gruppe01', 0)
    expect(weg.art).toBe('geloescht')
    expect(weg.rollen.map(r => r.id)).toEqual(['eigen_prakt002'])
    expect(weg.rolePermissions).toEqual({ benutzer: { chat: true } })
    const arch = rolleEntfernen([GF, PR], rp, 'eigen_gruppe01', 3)
    expect(arch.art).toBe('archiviert')
    expect(arch.rollen[0]).toMatchObject({ id: 'eigen_gruppe01', archiviert: true })
    expect(arch.rolePermissions).toBe(rp)
    expect(rolleWiederherstellen(arch.rollen, 'eigen_gruppe01')[0]).toEqual(GF)
  })

  it('vorgegebene Rollen lassen sich nicht entfernen', () => {
    const rp = { admin: { unitarii: true } }
    expect(rolleEntfernen([GF], rp, 'admin', 0)).toEqual({ rollen: [GF], rolePermissions: rp, art: 'nichts' })
  })

  it('die Vorlage einer eigenen Rolle kommt aus role_permissions', () => {
    const org = { role_permissions: { eigen_gruppe01: { einsaetze: true, eks: true } } }
    expect(getRoleTemplate('eigen_gruppe01', org)).toEqual({ einsaetze: true, eks: true })
    expect(getRoleTemplate('eigen_ohne0001', org)).toEqual({})
  })
})

describe('Vorlagen und Rollenwechsel', () => {
  it('Vorlagen behalten nur bekannte Rechte mit Ja/Nein', () => {
    expect(vorlageBereinigen({ chat: true, lager: false, produktausgabe: true, hacker: true, eks: 'ja' })).toEqual({ chat: true, lager: false, produktausgabe: true })
    expect(vorlageBereinigen(null)).toEqual({})
    expect(vorlageBereinigen([true])).toEqual({})
  })

  it('nur die angehakten Einträge — ergänzt, ohne Bestehendes mit „nein“ zu überschreiben', () => {
    expect(nurAngehakt({ chat: true, lager: false })).toEqual({ chat: true })
  })
})
