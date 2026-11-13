// Eingang eigener Formulare (src/lib/formular/eingang.ts, Bauplan Vorgänge 3.8, 6.1):
// Status, Ansichten, Zählen, Suche, Angaben nach Abschnitten, CSV über Fassungen,
// Druck escaped, Verlauf. Nur erfundene Namen.

import { describe, expect, it } from 'vitest'
import {
  ABSENDER_STATUS_TEXT, EINGANG_ANSICHTEN, EINGANG_TEXTE, STATUS_ERKLAERUNG, STATUS_NAME,
  absenderName, angabenGruppen, ansichtLabel, ansichtVon, bezeichnungen, csvDateiname, einsendungAnsicht, einsendungDruck,
  eingangCsv, eingangFehlerText, ersterWert, fassungText, felderDa, filtern, frueherGesendet, istAnsicht, leisteAktion, notizGeaendert,
  sortieren, statusVon, verlaufLesen, verlaufText, vorlagenImEingang, zaehlen, zaehlenJeVorlage, zahlenZeile, zeitKurz, zeitText,
} from '../formular/eingang'
import { einsendungLesen } from '../formular/felder'

const STRICH = /[–—]/

const VORLAGE = {
  id: 'vorlage00000001',
  organization_id: 'org1',
  title: 'Fahrzeugcheck',
  is_active: true,
  absender: 'frei',
  version: 3,
  abschnitte: [{ id: 'a_fahrzeug', titel: 'Fahrzeug' }, { id: 'a_mangel', titel: 'Mängel' }],
  schema: [
    { id: 'f_kennz', typ: 'text', label: 'Kennzeichen', pflicht: true, abschnitt: 'a_fahrzeug' },
    { id: 'f_km', typ: 'zahl', label: 'Kilometerstand', einheit: 'km', abschnitt: 'a_fahrzeug' },
    { id: 'f_datum', typ: 'datum', label: 'Datum', abschnitt: 'a_fahrzeug' },
    { id: 'f_mangel', typ: 'langtext', label: 'Mängel', abschnitt: 'a_mangel' },
    { id: 'f_ok', typ: 'janein', label: 'Fahrbereit', abschnitt: 'a_mangel' },
  ],
  fassungen: {
    '1': { schema: [{ id: 'f_kennz', typ: 'text', label: 'Kfz' }, { id: 'f_alt', typ: 'text', label: 'Funkrufname' }], abschnitte: [], am: '2026-10-01T08:00:00.000Z' },
    '2': { schema: [{ id: 'f_kennz', typ: 'text', label: 'Kfz-Kennzeichen' }, { id: 'f_alt', typ: 'text', label: 'Rufname' }, { id: 'f_wache', typ: 'auswahl', label: 'Wache', optionen: ['Nord', 'Süd'] }], abschnitte: [], am: '2026-10-15T08:00:00.000Z' },
  },
}

type Satz = Record<string, unknown>

function einsendung(id: string, x: {
  created?: string; status?: string; notiz?: string; version?: number; werte?: Record<string, unknown>;
  felder?: unknown[]; abschnitte?: unknown[]; aelter?: unknown[]; modus?: string; absender?: Record<string, unknown> | null;
  absender_status?: string; bearbeitung?: unknown; ohneFelder?: boolean
} = {}): Satz {
  const payload: Satz = {
    v: 2,
    titel: 'Fahrzeugcheck',
    version: x.version ?? 3,
    abschnitte: x.abschnitte ?? VORLAGE.abschnitte,
    felder: x.felder ?? VORLAGE.schema,
    werte: x.werte ?? { f_kennz: 'AN-RK 112' },
    aelter: x.aelter ?? [],
    absender_modus: x.modus ?? 'frei',
    abgesendet: x.created ?? '2026-11-07T10:20:05.120Z',
  }
  if (x.absender !== null) payload.absender = x.absender ?? { id: 'u_ida', name: 'Ida Imker', status: 'nicht_bestaetigt', weg: '', modus: 'frei', am: '' }
  const rec: Satz = {
    id,
    template_id: VORLAGE.id,
    organization_id: 'org1',
    org_code: 'wache1',
    created: x.created ?? '2026-11-07 10:20:05.120Z',
    payload,
  }
  if (!x.ohneFelder) {
    rec.status = x.status ?? 'neu'
    rec.notiz = x.notiz ?? ''
    rec.bearbeitung = x.bearbeitung ?? { verlauf: [] }
    rec.absender_status = x.absender_status ?? (x.absender === null ? '' : (x.absender?.status as string | undefined) ?? 'nicht_bestaetigt')
  }
  return rec
}

describe('Texte', () => {
  it('ohne Gedankenstriche', () => {
    const alle: string[] = []
    const sammeln = (o: unknown) => {
      if (typeof o === 'string') alle.push(o)
      else if (o && typeof o === 'object') for (const v of Object.values(o)) sammeln(v)
    }
    sammeln(EINGANG_TEXTE)
    sammeln(STATUS_NAME)
    sammeln(STATUS_ERKLAERUNG)
    sammeln(ABSENDER_STATUS_TEXT)
    sammeln(EINGANG_ANSICHTEN)
    for (const s of ['neu', 'in_bearbeitung', 'erledigt'] as const) alle.push(leisteAktion(s).knopf)
    alle.push(zahlenZeile({ neu: 3, in_bearbeitung: 2, erledigt: 1, gesamt: 6 }), zahlenZeile({ neu: 0, in_bearbeitung: 0, erledigt: 4, gesamt: 4 }), zahlenZeile(null))
    alle.push(verlaufText({ id: 'x', am: '', von: '', statusVorher: 'neu', status: 'erledigt', notiz: true }))
    expect(alle.length).toBeGreaterThan(60)
    for (const t of alle) expect(t, t).not.toMatch(STRICH)
  })
})

describe('Status und Ansichten', () => {
  it('fehlender oder unbekannter Status zählt als neu', () => {
    expect(statusVon({})).toBe('neu')
    expect(statusVon({ status: '' })).toBe('neu')
    expect(statusVon({ status: 'kaputt' })).toBe('neu')
    expect(statusVon({ status: 'in_bearbeitung' })).toBe('in_bearbeitung')
    expect(statusVon(null)).toBe('neu')
  })

  it('erledigt steht im Archiv', () => {
    expect(ansichtVon('neu')).toBe('neu')
    expect(ansichtVon('in_bearbeitung')).toBe('in_bearbeitung')
    expect(ansichtVon('erledigt')).toBe('archiv')
    expect(istAnsicht('archiv')).toBe(true)
    expect(istAnsicht('erledigt')).toBe(false)
  })

  it('Leiste: in Bearbeitung nehmen, erledigt ablegen, wieder öffnen', () => {
    expect(leisteAktion('neu')).toEqual({ knopf: 'In Bearbeitung nehmen', ziel: 'in_bearbeitung' })
    expect(leisteAktion('in_bearbeitung')).toEqual({ knopf: 'Als erledigt ablegen', ziel: 'erledigt' })
    expect(leisteAktion('erledigt')).toEqual({ knopf: 'Wieder öffnen', ziel: 'in_bearbeitung' })
  })

  it('Felder für Status und Notiz da: am Schlüssel des Datensatzes erkannt', () => {
    expect(felderDa(einsendung('e1'))).toBe(true)
    expect(felderDa(einsendung('e1', { ohneFelder: true }))).toBe(false)
    expect(felderDa({ status: 'neu' })).toBe(false)
    expect(felderDa(null)).toBe(false)
  })
})

describe('Zählen', () => {
  const liste = [
    einsendung('e1'), einsendung('e2', { status: 'in_bearbeitung' }), einsendung('e3', { status: 'erledigt' }),
    einsendung('e4', { ohneFelder: true }), { ...einsendung('e5'), template_id: 'andere' },
  ]

  it('je Status und gesamt; ohne Feld als neu', () => {
    expect(zaehlen(liste)).toEqual({ neu: 3, in_bearbeitung: 1, erledigt: 1, gesamt: 5 })
    expect(zaehlen(null)).toEqual({ neu: 0, in_bearbeitung: 0, erledigt: 0, gesamt: 0 })
  })

  it('je Vorlage', () => {
    const z = zaehlenJeVorlage(liste)
    expect(z[VORLAGE.id]).toEqual({ neu: 2, in_bearbeitung: 1, erledigt: 1, gesamt: 4 })
    expect(z.andere).toEqual({ neu: 1, in_bearbeitung: 0, erledigt: 0, gesamt: 1 })
  })

  it('Zeilentext und Beschriftung der Reiter', () => {
    expect(zahlenZeile({ neu: 3, in_bearbeitung: 2, erledigt: 7, gesamt: 12 })).toBe('3 neu · 2 in Bearbeitung')
    expect(zahlenZeile({ neu: 0, in_bearbeitung: 1, erledigt: 0, gesamt: 1 })).toBe('1 in Bearbeitung')
    expect(zahlenZeile({ neu: 0, in_bearbeitung: 0, erledigt: 12, gesamt: 12 })).toBe('Nichts offen · 12 im Archiv')
    expect(zahlenZeile(undefined)).toBe('Noch keine Einsendungen')
    const z = { neu: 3, in_bearbeitung: 2, erledigt: 7, gesamt: 12 }
    expect(EINGANG_ANSICHTEN.map((a) => ansichtLabel(a.wert, z))).toEqual(['Neu (3)', 'In Bearbeitung (2)', 'Archiv (7)'])
  })

  it('Formulare im Reiter: aktive und alle mit Einsendungen, nach Titel', () => {
    const vorlagen = [
      { id: 'v1', title: 'Zeltwunsch', is_active: true },
      { id: 'v2', title: 'Alt und ruhend', is_active: false },
      { id: 'v3', title: 'Ärmelabzeichen', is_active: false, archiviert: true },
      { id: 'v4', title: 'Bestellung', is_active: true, archiviert: true },
      { id: 'v5', title: 'Ohne alles', is_active: false },
    ]
    const zahlen = { v2: { neu: 0, in_bearbeitung: 0, erledigt: 2, gesamt: 2 }, v3: { neu: 1, in_bearbeitung: 0, erledigt: 0, gesamt: 1 } }
    expect(vorlagenImEingang(vorlagen, zahlen).map((v) => v.id)).toEqual(['v2', 'v3', 'v1'])
  })
})

describe('Eine Einsendung in der Liste', () => {
  it('Absender nur mit passendem absender_status; anonym nie; sonst „Ohne Namen“', () => {
    const frei = einsendungAnsicht(einsendung('e1'), VORLAGE)
    expect(frei.name).toBe('Ida Imker')
    expect(frei.absender?.status).toBe('nicht_bestaetigt')
    expect(frei.ausstehend).toBe(false)

    const gefaelscht = einsendungAnsicht(einsendung('e2', { absender_status: '' }), VORLAGE)
    expect(gefaelscht.absender).toBeNull()
    expect(gefaelscht.name).toBe('Ohne Namen')

    const anonym = einsendungAnsicht(einsendung('e3', { modus: 'anonym', absender: { id: 'u1', name: 'Ida Imker', status: 'bestaetigt' }, absender_status: 'bestaetigt' }), VORLAGE)
    expect(anonym.anonym).toBe(true)
    expect(anonym.absender).toBeNull()
    expect(anonym.name).toBe('Anonym')

    const ausstehend = einsendungAnsicht(einsendung('e4', { absender: { id: 'u_eva', name: 'Eva Eigen', status: 'ausstehend', modus: 'passwort' } }), VORLAGE)
    expect(ausstehend.ausstehend).toBe(true)
    expect(ausstehend.name).toBe('Eva Eigen')
    expect(absenderName({ absenderModus: 'frei' }, null)).toBe('Ohne Namen')
  })

  it('erster Wert in Formularfolge, einzeilig, höchstens 80 Zeichen', () => {
    const e = einsendungLesen(einsendung('e1', { werte: { f_mangel: 'Blinker\nvorne links', f_kennz: 'AN-RK 112' } }), VORLAGE)
    expect(ersterWert(e)).toBe('AN-RK 112')
    const lang = einsendungLesen(einsendung('e2', { werte: { f_mangel: 'x'.repeat(200) } }), VORLAGE)
    expect(ersterWert(lang)).toHaveLength(80)
    expect(ersterWert(lang).endsWith('…')).toBe(true)
    const umbruch = einsendungLesen(einsendung('e3', { werte: { f_mangel: 'Blinker\nvorne  links' } }), VORLAGE)
    expect(ersterWert(umbruch)).toBe('Blinker vorne links')
    const zahl = einsendungLesen(einsendung('e4', { werte: { f_km: 12345.5 } }), VORLAGE)
    expect(ersterWert(zahl)).toBe('12345,5 km')
    expect(ersterWert(einsendungLesen(einsendung('e5', { werte: {} }), VORLAGE))).toBe('')
  })

  it('Suche über Absender und Werte, alle Wörter, ohne Akzente und Groß/klein; nur die gewählte Ansicht', () => {
    const liste = [
      einsendungAnsicht(einsendung('e1', { werte: { f_kennz: 'AN-RK 112', f_mangel: 'Übergabe ohne Sauerstoff' } }), VORLAGE),
      einsendungAnsicht(einsendung('e2', { werte: { f_kennz: 'AN-RK 113' }, absender: { id: 'u2', name: 'Emil Eigen', status: 'bestaetigt', modus: 'frei' }, absender_status: 'bestaetigt' }), VORLAGE),
      einsendungAnsicht(einsendung('e3', { status: 'erledigt', werte: { f_kennz: 'AN-RK 112' } }), VORLAGE),
      einsendungAnsicht(einsendung('e4', { werte: { f_kennz: 'AN-RK 114' }, aelter: [{ id: 'f_alt', wert: 'Rotkreuz Ansbach 1/83' }] }), VORLAGE),
    ]
    expect(filtern(liste, 'neu').map((a) => a.id)).toEqual(['e1', 'e2', 'e4'])
    expect(filtern(liste, 'archiv').map((a) => a.id)).toEqual(['e3'])
    expect(filtern(liste, 'neu', 'uebergabe').map((a) => a.id)).toEqual([])
    expect(filtern(liste, 'neu', 'ubergabe sauerstoff').map((a) => a.id)).toEqual(['e1'])
    expect(filtern(liste, 'neu', 'emil').map((a) => a.id)).toEqual(['e2'])
    expect(filtern(liste, 'neu', '112').map((a) => a.id)).toEqual(['e1'])
    expect(filtern(liste, 'neu', 'ansbach').map((a) => a.id)).toEqual(['e4'])
    expect(filtern(liste, 'archiv', '112').map((a) => a.id)).toEqual(['e3'])
  })

  it('neueste zuerst', () => {
    const liste = [
      einsendungAnsicht(einsendung('e1', { created: '2026-11-06 08:00:00.000Z' }), VORLAGE),
      einsendungAnsicht(einsendung('e2', { created: '2026-11-07 09:00:00.000Z' }), VORLAGE),
      einsendungAnsicht(einsendung('e3', { created: '2026-11-07T08:00:00.000Z' }), VORLAGE),
    ]
    expect(sortieren(liste).map((a) => a.id)).toEqual(['e2', 'e3', 'e1'])
  })

  it('frühere Fassung erkannt; alte Einsendung nur, wenn das Formular seither geändert wurde', () => {
    expect(frueherGesendet(einsendungLesen(einsendung('e1', { version: 2 }), VORLAGE), VORLAGE)).toBe(true)
    expect(frueherGesendet(einsendungLesen(einsendung('e1', { version: 3 }), VORLAGE), VORLAGE)).toBe(false)
    expect(frueherGesendet(einsendungLesen(einsendung('e1', { version: 0 }), VORLAGE), VORLAGE)).toBe(true)
    expect(frueherGesendet(einsendungLesen(einsendung('e1', { version: 2 }), VORLAGE), { ...VORLAGE, version: undefined })).toBe(false)
    const alt = { id: 'alt1', template_id: VORLAGE.id, created: '2026-01-01 10:00:00.000Z', payload: { f_kennz: 'AN-X 1' } }
    expect(frueherGesendet(einsendungLesen(alt, VORLAGE), VORLAGE)).toBe(true)
    expect(frueherGesendet(einsendungLesen(alt, VORLAGE), { ...VORLAGE, version: 1 })).toBe(false)
  })

  it('Notiz geändert: getrimmt und mit vereinheitlichten Umbrüchen verglichen', () => {
    expect(notizGeaendert('Rückruf', 'Rückruf')).toBe(false)
    expect(notizGeaendert('Rückruf', ' Rückruf \n')).toBe(false)
    expect(notizGeaendert('a\r\nb', 'a\nb')).toBe(false)
    expect(notizGeaendert('Rückruf', 'Rückruf erledigt')).toBe(true)
    expect(notizGeaendert('', undefined)).toBe(false)
    expect(notizGeaendert('x', null)).toBe(true)
  })
})

describe('Zeit', () => {
  it('Eingang und Verlauf in Ortszeit', () => {
    const d = new Date(2026, 10, 7, 10, 24)
    expect(zeitKurz(d.toISOString())).toBe('07.11., 10:24')
    expect(zeitText(d.toISOString())).toBe(d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
    expect(zeitText('2026-11-07 10:20:05.120Z')).toMatch(/^07\.11\.2026, \d{2}:\d{2}$/)
    expect(zeitText('kaputt')).toBe('')
    expect(zeitKurz(42)).toBe('')
  })
})

describe('Verlauf', () => {
  it('liest den Verlauf des Hooks; Text mit Name, Status und Zeit', () => {
    const am = new Date(2026, 10, 7, 10, 24).toISOString()
    const rec = einsendung('e1', {
      bearbeitung: JSON.stringify({ verlauf: [
        { id: 'v1', am, von: { id: 'u_ina', name: 'Ina Inbox' }, status_vorher: 'neu', status: 'in_bearbeitung', notiz: false },
        { id: 'v2', am, von: { id: 'u_ina', name: 'Ina Inbox' }, status_vorher: 'in_bearbeitung', status: 'in_bearbeitung', notiz: true },
        { id: 'v3', am, von: { id: 'u_ina', name: 'Ina Inbox' }, status_vorher: 'in_bearbeitung', status: 'erledigt', notiz: true },
        'kaputt',
      ] }),
    })
    const v = verlaufLesen(rec)
    expect(v).toHaveLength(3)
    expect(verlaufText(v[0])).toBe('Ina Inbox · In Bearbeitung · 07.11., 10:24')
    expect(verlaufText(v[1])).toBe('Ina Inbox · Notiz geändert · 07.11., 10:24')
    expect(verlaufText(v[2])).toBe('Ina Inbox · Erledigt · Notiz geändert · 07.11., 10:24')
    expect(verlaufLesen({})).toEqual([])
    expect(verlaufText({ id: 'x', am: '', von: '', statusVorher: '', status: '', notiz: false })).toBe('Unbekannt')
  })
})

describe('Angaben nach Abschnitten', () => {
  it('Felder des Schnappschusses in ihren Abschnitten, leer als „leer“, frühere Fassung getrennt', () => {
    const e = einsendungLesen(einsendung('e1', {
      werte: { f_kennz: 'AN-RK 112', f_ok: false, f_datum: '2026-11-07' },
      aelter: [{ id: 'f_alt', wert: 'Rotkreuz Ansbach 1/83' }],
    }), VORLAGE)
    const g = angabenGruppen(e.angaben, { bezeichnung: bezeichnungen(VORLAGE) })
    expect(g.gruppen.map((x) => x.titel)).toEqual(['Fahrzeug', 'Mängel'])
    expect(g.gruppen[0].felder).toEqual([
      { id: 'f_kennz', label: 'Kennzeichen', text: 'AN-RK 112', leer: false },
      { id: 'f_km', label: 'Kilometerstand', text: '', leer: true },
      { id: 'f_datum', label: 'Datum', text: '07.11.2026', leer: false },
    ])
    expect(g.gruppen[1].felder.find((f) => f.id === 'f_ok')).toEqual({ id: 'f_ok', label: 'Fahrbereit', text: 'Nein', leer: false })
    expect(g.aelter).toEqual([{ id: 'f_alt', label: 'Rufname', text: 'Rotkreuz Ansbach 1/83', leer: false }])
  })

  it('nur Ausgefülltes, leere Abschnitte fallen weg', () => {
    const e = einsendungLesen(einsendung('e1', { werte: { f_kennz: 'AN-RK 112' } }), VORLAGE)
    const g = angabenGruppen(e.angaben, { nurAusgefuellt: true })
    expect(g.gruppen).toHaveLength(1)
    expect(g.gruppen[0].felder.map((f) => f.id)).toEqual(['f_kennz'])
  })

  it('ohne Abschnitte eine Gruppe ohne Titel; Werte ohne Schnappschuss mit Bezeichnung aus der Einstellung, sonst Kennung', () => {
    const g = angabenGruppen({ felder: [], werte: { e_k3j9x0a1: 'RTW 1', e_unbekan1: true } }, { bezeichnung: { e_k3j9x0a1: 'Fahrzeug' } })
    expect(g.gruppen).toEqual([{ id: '', titel: '', felder: [
      { id: 'e_k3j9x0a1', label: 'Fahrzeug', text: 'RTW 1', leer: false },
      { id: 'e_unbekan1', label: 'e_unbekan1', text: 'Ja', leer: false },
    ] }])
    expect(angabenGruppen(null)).toEqual({ gruppen: [], aelter: [] })
  })

  it('alte Einsendung (flacher payload): Felder der aktuellen Vorlage, Unbekanntes mit Kennung', () => {
    const alt = { id: 'alt1', template_id: VORLAGE.id, created: '2026-01-01 10:00:00.000Z', payload: { f_kennz: 'AN-X 1', geheim_alt: 'Wert' } }
    const a = einsendungAnsicht(alt, VORLAGE)
    expect(a.e.alt).toBe(true)
    expect(a.name).toBe('Ohne Namen')
    expect(a.status).toBe('neu')
    const g = angabenGruppen(a.e.angaben, { nurAusgefuellt: true })
    expect(g.gruppen.flatMap((x) => x.felder.map((f) => `${f.label}=${f.text}`))).toEqual(['Kennzeichen=AN-X 1', 'geheim_alt=Wert'])
  })
})

describe('Bezeichnungen über Fassungen', () => {
  it('aktuelle Vorlage zuerst, dann die neueste ältere Fassung', () => {
    const b = bezeichnungen(VORLAGE)
    expect(b.f_kennz).toBe('Kennzeichen')
    expect(b.f_alt).toBe('Rufname')
    expect(b.f_wache).toBe('Wache')
    expect(bezeichnungen({ ...VORLAGE, fassungen: JSON.stringify(VORLAGE.fassungen) }).f_alt).toBe('Rufname')
    expect(bezeichnungen(null)).toEqual({})
  })
})

describe('CSV', () => {
  const liste = [
    einsendung('aaaaaaaa11111111', { created: '2026-11-07 10:20:05.120Z', werte: { f_kennz: '=HYPERLINK("http://x")', f_km: 120000, f_ok: true }, notiz: 'Rückruf; morgen\n"dringend"' }),
    einsendung('bbbbbbbb22222222', { created: '2026-11-06 09:00:00.000Z', version: 2, status: 'erledigt',
      felder: VORLAGE.fassungen['2'].schema, abschnitte: [], werte: { f_kennz: 'AN-RK 113', f_wache: 'Süd' },
      aelter: [{ id: 'f_alt', wert: '@Rotkreuz' }], modus: 'anonym', absender: null }),
    { id: 'cccccccc33333333', template_id: VORLAGE.id, created: '2026-01-01 10:00:00.000Z', payload: { f_kennz: 'AN-X 1', geheim_alt: 'Wert' } },
  ]
  const text = eingangCsv(liste, VORLAGE)
  const zeilen = text.slice(1).split('\r\n')

  it('BOM, CRLF, Semikolon; Kopf mit Feldern der aktuellen Vorlage, dann ältere mit letzter Bezeichnung', () => {
    expect(text.charCodeAt(0)).toBe(0xfeff)
    expect(zeilen[0].split(';')).toEqual([
      'Nummer', 'Eingang', 'Status', 'Absender', 'Absender-Status', 'Fassung',
      'Kennzeichen', 'Kilometerstand', 'Datum', 'Mängel', 'Fahrbereit', 'Rufname', 'Wache', 'geheim_alt',
      'Aus früheren Fassungen', 'Interne Notiz',
    ])
    expect(zeilen).toHaveLength(1 + 3)
  })

  it('Werte, Formelschutz, Anführungszeichen, Absender und Fassung', () => {
    expect(zeilen[1]).toContain(`aaaaaaaa;`)
    expect(zeilen[1]).toContain(`;Neu;Ida Imker;nicht bestätigt;3;`)
    expect(zeilen[1]).toContain(`"'=HYPERLINK(""http://x"")"`)
    expect(zeilen[1]).toContain(';120000 km;')
    expect(zeilen[1]).toContain(';Ja;')
    expect(text).toContain('"Rückruf; morgen\n""dringend"""')
    expect(zeilen[2]).toMatch(/^bbbbbbbb;.*;Erledigt;Anonym;anonym;2;AN-RK 113;/)
    expect(zeilen[2]).toContain(';Süd;')
    expect(zeilen[2]).toContain(";Rufname: @Rotkreuz;")
    // alte Einsendung (flacher payload), Formular seither geändert: früher gesendet, also „0“ statt leer
    expect(zeilen[3]).toMatch(/^cccccccc;.*;Neu;;;0;AN-X 1;/)
    expect(zeilen[3]).toContain(';Wert;')
  })

  it('Fassung steht bei jeder früher gesendeten Einsendung, auch „0“; sonst nur, wo eine festgehalten ist', () => {
    const fassung = (rec: Satz, vorlage: unknown) => eingangCsv([rec], vorlage).slice(1).split('\r\n')[1].split(';')[5]
    const alt = { id: 'alt1', template_id: VORLAGE.id, created: '2026-01-01 10:00:00.000Z', payload: { f_kennz: 'AN-X 1' } }
    // Fassung 0 vom Server festgehalten, Formular steht bei 3: auf der Seite „früher gesendet“, in der Tabelle „0“
    expect(fassung(einsendung('e0', { version: 0 }), VORLAGE)).toBe('0')
    expect(fassung(einsendung('e2', { version: 2 }), VORLAGE)).toBe('2')
    expect(fassung(einsendung('e3', { version: 3 }), VORLAGE)).toBe('3')
    // Formular ohne Fassung: nichts ist „früher“, eine 0 bleibt leer
    expect(fassung(einsendung('e0', { version: 0 }), { ...VORLAGE, version: undefined })).toBe('')
    expect(fassung(einsendung('e2', { version: 2 }), { ...VORLAGE, version: undefined })).toBe('2')
    // alte Einsendung: „0“ nur, wenn das Formular seither geändert wurde
    expect(fassung(alt, VORLAGE)).toBe('0')
    expect(fassung(alt, { ...VORLAGE, version: 1 })).toBe('')
    // CSV, Druck und Seite hängen an derselben Frage: früher gesendet heißt immer, die Fassung steht da
    for (const [rec, v] of [
      [einsendung('e0', { version: 0 }), VORLAGE], [einsendung('e2', { version: 2 }), VORLAGE], [einsendung('e3', { version: 3 }), VORLAGE],
      [einsendung('e0', { version: 0 }), { ...VORLAGE, version: 1 }], [alt, VORLAGE], [alt, { ...VORLAGE, version: 1 }], [alt, { ...VORLAGE, version: undefined }],
    ] as [Satz, unknown][]) {
      const e = einsendungLesen(rec, v)
      if (frueherGesendet(e, v)) expect(fassungText(e, v), JSON.stringify(rec.payload)).toBe(String(e.angaben.version))
    }
  })

  it('Dateiname aus dem Titel, gekürzt, mit Tag', () => {
    expect(csvDateiname('Fahrzeugcheck', new Date(2026, 10, 7, 23, 59))).toBe('Fahrzeugcheck-Eingang-2026-11-07.csv')
    expect(csvDateiname('Wünsche / Dienstplan <2027>', new Date(2026, 0, 2))).toBe('Wünsche-Dienstplan-2027-Eingang-2026-01-02.csv')
    expect(csvDateiname('', new Date(2026, 0, 2))).toBe('Formular-Eingang-2026-01-02.csv')
    expect(csvDateiname('x'.repeat(100), new Date(2026, 0, 2))).toBe(`${'x'.repeat(60)}-Eingang-2026-01-02.csv`)
  })
})

describe('Druck', () => {
  const AM = new Date(2026, 10, 7, 11, 0)
  const rec = einsendung('dddddddd44444444', {
    werte: { f_kennz: '<script>alert(1)</script>', f_mangel: 'Tür & Klappe "lose"' },
    notiz: 'Intern: <b>Werkstatt</b>',
    absender: { id: 'u_ida', name: 'Ida <Imker>', status: 'nicht_bestaetigt', modus: 'frei' },
  })

  it('alles escaped; Organisation, Formular, Absender, Abschnitte, Gedruckt von', () => {
    const html = einsendungDruck(rec, VORLAGE, { orgName: 'Wache <Nord>', gedruckt: { von: 'Ina Inbox', am: AM } })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('Tür &amp; Klappe &quot;lose&quot;')
    expect(html).toContain('Wache &lt;Nord&gt;')
    expect(html).toContain('Ida &lt;Imker&gt; · nicht bestätigt')
    expect(html).toContain('<h3>Fahrzeug</h3>')
    expect(html).toContain('<h3>Mängel</h3>')
    expect(html).toContain('Nicht ausgefüllt')
    expect(html).toContain('Gedruckt von Ina Inbox am 07.11.2026, 11:00')
    expect(html).toContain('Fahrzeugcheck')
  })

  it('Notiz nur auf Wunsch', () => {
    expect(einsendungDruck(rec, VORLAGE, { gedruckt: { am: AM } })).not.toContain('Werkstatt')
    const mit = einsendungDruck(rec, VORLAGE, { mitNotiz: true, gedruckt: { am: AM } })
    expect(mit).toContain('Intern: &lt;b&gt;Werkstatt&lt;/b&gt;')
    expect(mit).toContain('Interne Notiz')
  })

  it('frühere Fassung: Zeile „Fassung“ (auch 0) und derselbe Hinweis wie auf der Seite; aktuelle Fassung ohne Hinweis', () => {
    const blatt = (r: Satz, vorlage: unknown = VORLAGE) => einsendungDruck(r, vorlage, { gedruckt: { am: AM } })
    const null0 = blatt(einsendung('ffffffff66666666', { version: 0 }))
    expect(null0).toContain('<dt>Fassung</dt><dd>0</dd>')
    expect(null0).toContain(`<p class="hinweis">${EINGANG_TEXTE.frueher}</p>`)
    // der Hinweis steht wie auf der Seite unter „Angaben“, vor den Angaben
    expect(null0.indexOf('<h2>Angaben</h2>')).toBeLessThan(null0.indexOf(EINGANG_TEXTE.frueher))
    expect(null0.indexOf(EINGANG_TEXTE.frueher)).toBeLessThan(null0.indexOf('class="angabe"'))
    const zwei = blatt(einsendung('ffffffff66666667', { version: 2 }))
    expect(zwei).toContain('<dt>Fassung</dt><dd>2</dd>')
    expect(zwei).toContain(EINGANG_TEXTE.frueher)
    const aktuell = blatt(einsendung('ffffffff66666668', { version: 3 }))
    expect(aktuell).toContain('<dt>Fassung</dt><dd>3</dd>')
    expect(aktuell).not.toContain(EINGANG_TEXTE.frueher)
    expect(aktuell).not.toContain('<p class="hinweis">')
    // alte Einsendung (flacher payload): Hinweis und „0“ nur, wenn das Formular seither geändert wurde
    const alt = { id: 'alt1alt1alt1alt', template_id: VORLAGE.id, created: '2026-01-01 10:00:00.000Z', payload: { f_kennz: 'AN-X 1' } }
    expect(blatt(alt)).toContain('<dt>Fassung</dt><dd>0</dd>')
    expect(blatt(alt)).toContain(EINGANG_TEXTE.frueher)
    const unveraendert = blatt(alt, { ...VORLAGE, version: 1 })
    expect(unveraendert).not.toContain('<dt>Fassung</dt>')
    expect(unveraendert).not.toContain(EINGANG_TEXTE.frueher)
    // Formular ohne Fassung und Einsendung mit 0: weder Zeile noch Hinweis
    const ohne = blatt(einsendung('ffffffff66666669', { version: 0 }), { ...VORLAGE, version: undefined })
    expect(ohne).not.toContain('<dt>Fassung</dt>')
    expect(ohne).not.toContain(EINGANG_TEXTE.frueher)
  })

  it('anonym: kein Name auf dem Blatt', () => {
    const anonym = einsendung('eeeeeeee55555555', { modus: 'anonym', absender: { id: 'u_ida', name: 'Ida Imker', status: 'bestaetigt' }, absender_status: 'bestaetigt' })
    const html = einsendungDruck(anonym, VORLAGE, { gedruckt: { am: AM } })
    expect(html).not.toContain('Ida Imker')
    expect(html).toContain('<dd>Anonym</dd>')
  })
})

describe('Fehlertexte', () => {
  it('ohne Netz, Text des Hooks, ohne Recht, sonst Ersatz', () => {
    expect(eingangFehlerText({ status: 0 }, 'x')).toBe(EINGANG_TEXTE.keinNetz)
    expect(eingangFehlerText({ status: 400, response: { message: 'Diesen Status gibt es nicht.' } }, 'x')).toBe('Diesen Status gibt es nicht.')
    expect(eingangFehlerText({ status: 403, response: { message: 'Only superusers can perform this action.' } }, 'x')).toBe(EINGANG_TEXTE.keinRecht)
    expect(eingangFehlerText({ status: 403, response: { message: 'Der Eingang ist auf dem Server noch nicht fertig eingestellt.' } }, 'x')).toBe('Der Eingang ist auf dem Server noch nicht fertig eingestellt.')
    expect(eingangFehlerText({ status: 404, response: { message: 'The requested resource wasn\'t found.' } }, 'Ersatz')).toBe('Ersatz')
    expect(eingangFehlerText(null, 'Ersatz')).toBe('Ersatz')
  })
})
