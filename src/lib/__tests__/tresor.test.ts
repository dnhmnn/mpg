// Prüffälle des Tresors (Plan Vorgänge, 5.1, 5.2, 6.1): Warteschlange und Entwürfe
// verschlüsselt auf dem Gerät. WebCrypto kommt von Node, die Ablage liegt im Speicher
// (statt IndexedDB) und kann an jeder Stelle Fehler werfen. Nur erfundene Namen.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TresorKern, _tresorNeu, ablageSchluessel, beimVerlassen, eintragSchluessel, entschluesseln, erledigtVomHintergrund, istTresorSchluessel,
  leerenOhneWarteschlange, schluesselErzeugen, tresorEntwuerfe, tresorEntwuerfeLoeschen, tresorGeschrieben, tresorKlartextGrund, tresorOeffnen,
  tresorProbleme, tresorWartend, tresorWeiche, tresorZustand, UNLESBAR, verlassenErlauben, verschluesseln, zusammenfuehren,
  ENTWURF_FRIST_MS, ENTWURF_FRUEHER, entwuerfeAufraeumen, entwurfNachruecken, tresorBereit, tresorOeffnetNoch,
  type TresorAblage, type TresorKanal,
} from '../tresor'
import { ablegen, eintraege, entfernen, SCHLUESSEL_PREFIX, type NeuerEintrag } from '../formular/warteschlange'
import { entwurfFinden, entwurfLesen, entwurfSchreiben, entwurfSchluessel } from '../../pages/public/doku/entwurf'

// ── Werkzeuge ───────────────────────────────────────────────────────────────

/** Ein Speicher wie localStorage, mit wählbaren Fehlern. */
function klarSpeicher(start: Record<string, string> = {}) {
  const d = new Map(Object.entries(start))
  const f = { setItem: false, removeItem: false, getItem: false }
  return {
    d, f,
    get length() { return d.size },
    key: (i: number) => [...d.keys()][i] ?? null,
    getItem: (k: string) => { if (f.getItem) throw new Error('gesperrt'); return d.has(k) ? d.get(k)! : null },
    setItem: (k: string, v: string) => { if (f.setItem) throw new Error('voll'); d.set(k, String(v)) },
    removeItem: (k: string) => { if (f.removeItem) throw new Error('gesperrt'); d.delete(k) },
    clear: () => { d.clear() },
  }
}
type Klar = ReturnType<typeof klarSpeicher>

/** Eine Ablage wie IndexedDB im Speicher; Werte werden wie dort geklont. */
function speicherAblage(o: { daten?: Map<string, unknown>; key?: { k: CryptoKey | null } } = {}) {
  const daten = o.daten ?? new Map<string, unknown>()
  const erledigt = new Map<string, unknown>()
  const meta = new Map<string, unknown>()
  const key = o.key ?? { k: null as CryptoKey | null }
  const fehler = {
    schreiben: (_k: string) => false,
    lesen: () => false,
    loeschen: (_k: string) => false,
    schluessel: () => false,
  }
  let langsam = 0
  const warte = () => (langsam ? new Promise((r) => setTimeout(r, langsam)) : Promise.resolve())
  const ablage: TresorAblage = {
    async lesen() {
      await warte()
      if (fehler.lesen()) throw new Error('lesen')
      return Object.fromEntries([...daten].map(([k, v]) => [k, structuredClone(v)]))
    },
    async schreiben(k, v) {
      await warte()
      if (fehler.schreiben(k)) throw new Error('schreiben')
      daten.set(k, structuredClone(v))
    },
    async loeschen(k) {
      await warte()
      if (fehler.loeschen(k)) throw new Error('loeschen')
      daten.delete(k)
    },
    async schluessel() {
      await warte()
      if (fehler.schluessel()) throw new Error('schluessel')
      return key.k
    },
    async schluesselSetzen(c) { if (!key.k) key.k = c },
    async metaSetzen(k, v) { meta.set(k, v) },
    async erledigtLesen() { return Object.fromEntries(erledigt) },
    async erledigtLoeschen(ids) { for (const id of ids) erledigt.delete(id) },
  }
  return { daten, erledigt, meta, key, fehler, ablage, setLangsam: (ms: number) => { langsam = ms } }
}

/** Zwei Kanäle wie BroadcastChannel zwischen zwei Fenstern (asynchron, geklont). */
function kanalPaar(): [TresorKanal, TresorKanal] {
  const a: TresorKanal = { onmessage: null, postMessage: (m) => { setTimeout(() => b.onmessage?.({ data: structuredClone(m) }), 0) } }
  const b: TresorKanal = { onmessage: null, postMessage: (m) => { setTimeout(() => a.onmessage?.({ data: structuredClone(m) }), 0) } }
  return [a, b]
}

/** Wartet, bis ein Kern eine Nachricht verarbeitet hat. */
function neuGeladen(k: TresorKern): Promise<string[]> {
  return new Promise((r) => { k.onNeuGeladen = (s) => { k.onNeuGeladen = null; r(s) } })
}

/** Alle Bytes der Ablage als Text (latin1): darf nie Klartext enthalten. */
function rohText(daten: Map<string, unknown>): string {
  const teile: string[] = []
  const sammeln = (x: unknown) => {
    if (x instanceof Uint8Array) teile.push(Buffer.from(x).toString('latin1'))
    else if (x instanceof ArrayBuffer) teile.push(Buffer.from(new Uint8Array(x)).toString('latin1'))
    else if (x && typeof x === 'object') for (const v of Object.values(x)) sammeln(v)
    else teile.push(String(x))
  }
  for (const [k, v] of daten) { teile.push(k); sammeln(v) }
  return teile.join('\n')
}

const Q = SCHLUESSEL_PREFIX + 'wache1'
const neu = (id: string, x: Partial<NeuerEintrag> = {}): NeuerEintrag => ({
  id, formular: 'patienten', maske: 'doku', orgCode: 'wache1', orgId: 'org1',
  absenderName: 'Ida Imker', angemeldetId: '', daten: { title: 'Patientendoku: Max Muster', payload: { name: 'Muster', vorname: 'Max', einsatz_nr: '2026-117' } },
  ...x,
})
const eintragJson = (id: string, name = 'Max Muster') => ({ v: 2, id, formular: 'patienten', maske: 'doku', orgCode: 'wache1', orgId: 'org1', angelegt: '2026-11-07T10:00:00.000Z', absenderName: 'Ida Imker', angemeldetId: '', versuche: 0, daten: { title: `Patientendoku: ${name}`, payload: { name } } })
const ID1 = 'aaaaaaaaaaaaaa1', ID2 = 'aaaaaaaaaaaaaa2', ID3 = 'aaaaaaaaaaaaaa3'

let ls: Klar
beforeEach(() => {
  ls = klarSpeicher()
  vi.stubGlobal('localStorage', ls)
  _tresorNeu()
})
afterEach(() => { vi.unstubAllGlobals(); _tresorNeu() })

async function offenerKern(a = speicherAblage(), klar: Klar | null = ls, kanal: TresorKanal | null = null) {
  const k = new TresorKern()
  await k.oeffnen(a.ablage, klar, { kanal })
  return k
}

// ── Verschlüsseln ───────────────────────────────────────────────────────────

describe('Tresor: Verschlüsseln', () => {
  it('AES-GCM mit neuem IV je Schreiben; zurück nur am eigenen Ort', async () => {
    const key = await schluesselErzeugen()
    expect(key.extractable).toBe(false)
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 })
    const ak = ablageSchluessel(Q, ID1)
    const a = await verschluesseln(key, ak, '{"name":"Max Muster"}')
    const b = await verschluesseln(key, ak, '{"name":"Max Muster"}')
    expect(a.iv.byteLength).toBe(12)
    expect(Buffer.from(a.iv).equals(Buffer.from(b.iv))).toBe(false)
    const rec = { v: 1, iv: a.iv, ct: a.ct, art: 'liste', schluessel: Q, eintrag: ID1, geaendert: '' }
    expect(await entschluesseln(key, rec, ak)).toBe('{"name":"Max Muster"}')
  })

  it('vertauschte Datensätze scheitern (zusätzliche Daten = Ablageschlüssel)', async () => {
    const key = await schluesselErzeugen()
    const a = await verschluesseln(key, ablageSchluessel(Q, ID1), 'eins')
    // Ein Angreifer legt den Datensatz von ID1 unter ID2 ab und passt die Angaben an
    const vertauscht = { v: 1, iv: a.iv, ct: a.ct, art: 'liste', schluessel: Q, eintrag: ID2, geaendert: '' }
    await expect(entschluesseln(key, vertauscht, ablageSchluessel(Q, ID2))).rejects.toThrow()
    // Angaben passen nicht zum Ort
    const falsch = { v: 1, iv: a.iv, ct: a.ct, art: 'liste', schluessel: Q, eintrag: ID1, geaendert: '' }
    await expect(entschluesseln(key, falsch, ablageSchluessel(Q, ID2))).rejects.toThrow('falscher Ort')
    // Anderer Schlüssel
    await expect(entschluesseln(await schluesselErzeugen(), falsch, ablageSchluessel(Q, ID1))).rejects.toThrow()
  })

  it('kennt nur die Tresor-Schlüssel', () => {
    for (const k of [Q, 'offline_queue_wache1', 'doku_entwurf_wache1', 'doku_entwurf_wache1_u_abc', 'patientendoku_wache1']) expect(istTresorSchluessel(k)).toBe(true)
    for (const k of ['formular_stand_wache1', 'formular_server_wache1', 'org_cache_wache1', 'eks_pending_count', `${Q}\u0000${ID1}`, `${Q}${UNLESBAR}1`]) expect(istTresorSchluessel(k)).toBe(false)
  })
})

// ── Listen je Eintrag ───────────────────────────────────────────────────────

describe('Tresor: Listen je Eintrag', () => {
  it('ein Datensatz je Warteeintrag, nur Chiffrat, gleicher Text zurück', async () => {
    const a = speicherAblage()
    const k = await offenerKern(a)
    const liste = [eintragJson(ID1), eintragJson(ID2, 'Erika Beispiel')]
    k.setItem(Q, JSON.stringify(liste))
    expect(await k.geschrieben()).toBe(true)
    expect([...a.daten.keys()].sort()).toEqual([ablageSchluessel(Q, ID1), ablageSchluessel(Q, ID2)])
    expect(rohText(a.daten)).not.toMatch(/Max Muster|Erika Beispiel|Ida Imker/)
    expect(k.getItem(Q)).toBe(JSON.stringify(liste))
    // In einem frischen Fenster liest es sich gleich
    const k2 = await offenerKern(a, klarSpeicher())
    expect(k2.getItem(Q)).toBe(JSON.stringify(liste))
  })

  it('schreibt nur Geändertes, löscht Entferntes, behält die Reihenfolge', async () => {
    const a = speicherAblage()
    const k = await offenerKern(a)
    k.setItem(Q, JSON.stringify([eintragJson(ID1), eintragJson(ID2)]))
    await k.geschrieben()
    const vorher = a.daten.get(ablageSchluessel(Q, ID1)) as { iv: Uint8Array }
    const geschrieben: string[] = []
    a.fehler.schreiben = (x) => { geschrieben.push(x); return false }
    const zwei = { ...eintragJson(ID2), versuche: 1 }
    k.setItem(Q, JSON.stringify([eintragJson(ID1), zwei, eintragJson(ID3)]))
    await k.geschrieben()
    expect(geschrieben.sort()).toEqual([ablageSchluessel(Q, ID2), ablageSchluessel(Q, ID3)])
    expect(Buffer.from((a.daten.get(ablageSchluessel(Q, ID1)) as { iv: Uint8Array }).iv).equals(Buffer.from(vorher.iv))).toBe(true)
    // ID1 weg, ID3 vor ID2
    k.setItem(Q, JSON.stringify([eintragJson(ID3), zwei]))
    await k.geschrieben()
    expect(a.daten.has(ablageSchluessel(Q, ID1))).toBe(false)
    const k2 = await offenerKern(a, klarSpeicher())
    expect(JSON.parse(k2.getItem(Q)!).map((e: { id: string }) => e.id)).toEqual([ID3, ID2])
    // Leer: alles weg
    k.removeItem(Q)
    await k.geschrieben()
    expect(a.daten.size).toBe(0)
    expect(k.getItem(Q)).toBeNull()
  })

  it('Einträge ohne Kennung und doppelte bekommen eigene Schlüssel', () => {
    const s = eintragSchluessel([{ id: ID1 }, { id: ID1 }, { x: 1 }, { x: 1 }, 'text', { id: 'a\u0000b' }])
    expect(new Set(s).size).toBe(6)
    expect(s[0]).toBe(ID1)
    expect(s[1]).toBe(`${ID1}~2`)
    expect(s[2].startsWith('~')).toBe(true)
  })

  it('kein Array unter dem Listenschlüssel: als Ganzes abgelegt, nichts geht verloren', async () => {
    const a = speicherAblage()
    const k = await offenerKern(a)
    k.setItem(Q, 'kaputt{')
    await k.geschrieben()
    expect([...a.daten.keys()]).toEqual([Q])
    const k2 = await offenerKern(a, klarSpeicher())
    expect(k2.getItem(Q)).toBe('kaputt{')
    k2.setItem(Q, JSON.stringify([eintragJson(ID1)]))
    await k2.geschrieben()
    expect([...a.daten.keys()]).toEqual([ablageSchluessel(Q, ID1)])
  })
})

// ── Zwei Fenster ────────────────────────────────────────────────────────────

describe('Tresor: zwei Fenster', () => {
  it('überschreiben sich nicht, solange sie verschiedene Einträge ändern', async () => {
    const a = speicherAblage()
    const [ka, kb] = kanalPaar()
    const A = await offenerKern(a, klarSpeicher(), ka)
    const B = await offenerKern(a, klarSpeicher(), kb)
    A.setItem(Q, JSON.stringify([eintragJson(ID1)]))
    const bHat = neuGeladen(B)
    await A.geschrieben()
    await bHat
    expect(JSON.parse(B.getItem(Q)!).map((e: { id: string }) => e.id)).toEqual([ID1])

    // Gleichzeitig: A legt ID2 dazu, B legt ID3 dazu (jeder kennt nur ID1)
    A.setItem(Q, JSON.stringify([eintragJson(ID1), eintragJson(ID2)]))
    B.setItem(Q, JSON.stringify([eintragJson(ID1), eintragJson(ID3)]))
    const aHat = neuGeladen(A), bHat2 = neuGeladen(B)
    await Promise.all([A.geschrieben(), B.geschrieben()])
    await Promise.all([aHat, bHat2])
    expect([...a.daten.keys()].sort()).toEqual([ID1, ID2, ID3].map((i) => ablageSchluessel(Q, i)))
    // Jedes Fenster lädt nach jeder Nachricht des anderen neu. Das erste Neuladen kann vor dem Schreiben
    // des anderen liegen, deshalb warten, bis beide alle drei zeigen (bleibt einer zurück, schlägt es fehl)
    await vi.waitFor(() => {
      for (const K of [A, B]) expect(JSON.parse(K.getItem(Q)!).map((e: { id: string }) => e.id).sort()).toEqual([ID1, ID2, ID3])
    }, { timeout: 3000, interval: 10 })

    // Entfernen in einem Fenster kommt im anderen an
    const bHat3 = neuGeladen(B)
    A.setItem(Q, JSON.stringify([eintragJson(ID2), eintragJson(ID3)]))
    await A.geschrieben()
    await bHat3
    expect(JSON.parse(B.getItem(Q)!).map((e: { id: string }) => e.id).sort()).toEqual([ID2, ID3])
  })

  it('Entwürfe: das andere Fenster lädt nur den geänderten Schlüssel neu', async () => {
    const a = speicherAblage()
    const [ka, kb] = kanalPaar()
    const A = await offenerKern(a, klarSpeicher(), ka)
    const B = await offenerKern(a, klarSpeicher(), kb)
    const bHat = neuGeladen(B)
    A.setItem('doku_entwurf_wache1', '{"stand":"2026-11-07T10:00:00.000Z","werte":{"name":"Muster"}}')
    await A.geschrieben()
    expect(await bHat).toEqual(['doku_entwurf_wache1'])
    expect(B.getItem('doku_entwurf_wache1')).toContain('Muster')
  })
})

// ── Umzug ──────────────────────────────────────────────────────────────────

describe('Tresor: Umzug aus localStorage (5.2)', () => {
  const klarStart = () => ({
    [Q]: JSON.stringify([eintragJson(ID1), eintragJson(ID2, 'Erika Beispiel')]),
    'offline_queue_wache2': JSON.stringify([{ type: 'full', title: 'Patientendoku: Otto Normal', organization_id: 'org2', payload: { name: 'Normal' } }]),
    [entwurfSchluessel('wache1')]: JSON.stringify({ stand: '2026-11-07T10:00:00.000Z', werte: { name: 'Muster' } }),
    'patientendoku_wache1': JSON.stringify({ name: 'Muster', vorname: 'Max' }),
    'formular_stand_wache1': '{"v":1}',
  })

  it('verschlüsselt, prüft und löscht erst dann den Klartext; Fremdes bleibt', async () => {
    const klar = klarSpeicher(klarStart())
    const a = speicherAblage()
    const k = await offenerKern(a, klar)
    expect([...klar.d.keys()]).toEqual(['formular_stand_wache1'])
    expect(rohText(a.daten)).not.toMatch(/Muster|Beispiel|Normal|Ida Imker/)
    const start = klarStart()
    for (const key of [Q, 'offline_queue_wache2', entwurfSchluessel('wache1'), 'patientendoku_wache1']) expect(k.getItem(key)).toBe(start[key])
    expect(k.klarKopien()).toEqual([])
  })

  it('Fehler beim Ablegen: Klartext bleibt, Inhalt da, nächster Start zieht um', async () => {
    const klar = klarSpeicher(klarStart())
    const a = speicherAblage()
    a.fehler.schreiben = () => true
    const k = await offenerKern(a, klar)
    expect(klar.d.size).toBe(5)
    expect(k.getItem(Q)).toBe(klarStart()[Q])
    expect(new Set(k.klarKopien())).toEqual(new Set([Q, 'offline_queue_wache2', entwurfSchluessel('wache1'), 'patientendoku_wache1']))
    // Nächster Start mit funktionierender Ablage
    a.fehler.schreiben = () => false
    const k2 = await offenerKern(a, klar)
    expect([...klar.d.keys()]).toEqual(['formular_stand_wache1'])
    expect(k2.getItem(Q)).toBe(klarStart()[Q])
  })

  it('Fehler nur bei einem Eintrag: die ganze Liste bleibt als Klartext', async () => {
    const klar = klarSpeicher(klarStart())
    const a = speicherAblage()
    a.fehler.schreiben = (x) => x === ablageSchluessel(Q, ID2)
    await offenerKern(a, klar)
    expect(klar.d.get(Q)).toBe(klarStart()[Q])
    expect(klar.d.has(entwurfSchluessel('wache1'))).toBe(false)
  })

  it('Fehler beim Zurücklesen: Klartext bleibt', async () => {
    const klar = klarSpeicher(klarStart())
    const a = speicherAblage()
    let n = 0
    // Laden gelingt, das Zurücklesen zum Vergleich nicht
    a.fehler.lesen = () => ++n > 1
    const k = await offenerKern(a, klar)
    expect(klar.d.size).toBe(5)
    expect(k.getItem(entwurfSchluessel('wache1'))).toBe(klarStart()[entwurfSchluessel('wache1')])
  })

  it('Zurückgelesen passt nicht (Datensatz verändert): Klartext bleibt', async () => {
    const klar = klarSpeicher(klarStart())
    const a = speicherAblage()
    const echt = a.ablage.schreiben
    // Die Ablage verliert still einen Teil: der Datensatz ist danach nicht mehr lesbar
    a.ablage.schreiben = async (k2, v) => { const r = v as { ct: ArrayBuffer }; await echt(k2, { ...r, ct: r.ct.slice(0, 5) }) }
    await offenerKern(a, klar)
    expect(klar.d.size).toBe(5)
  })

  it('Klartext lässt sich nicht löschen: bleibt, wird beim nächsten Schreiben aufgeräumt', async () => {
    const klar = klarSpeicher(klarStart())
    klar.f.removeItem = true
    const a = speicherAblage()
    const k = await offenerKern(a, klar)
    expect(klar.d.size).toBe(5)
    klar.f.removeItem = false
    k.setItem(entwurfSchluessel('wache1'), JSON.stringify({ stand: '2026-11-07T11:00:00.000Z', werte: { name: 'Muster' } }))
    await k.geschrieben()
    expect(klar.d.has(entwurfSchluessel('wache1'))).toBe(false)
  })

  it('Schlüssel nicht lesbar: Öffnen scheitert, Klartext unberührt, Tresor bleibt Klartext', async () => {
    const klar = klarSpeicher(klarStart())
    vi.stubGlobal('localStorage', klar)
    const a = speicherAblage()
    a.fehler.schluessel = () => true
    expect(await tresorOeffnen({ ablage: a.ablage, kanal: null, zeitMs: 2000 })).toBe('klartext')
    expect(tresorZustand()).toBe('klartext')
    expect(tresorKlartextGrund()).toBe('fehler')
    expect(klar.d.size).toBe(5)
    // Die Weiche schreibt wie bisher in localStorage
    expect(tresorWeiche()!.getItem(Q)).toBe(klarStart()[Q])
  })

  it('Klartext ändert sich während des Umzugs (anderes Fenster, alte Fassung): zusammengeführt, nicht gelöscht', async () => {
    const klar = klarSpeicher(klarStart())
    const a = speicherAblage()
    const echt = a.ablage.schreiben
    let einmal = false
    a.ablage.schreiben = async (k2, v) => {
      if (!einmal) {
        einmal = true
        klar.d.set(Q, JSON.stringify([eintragJson(ID1), eintragJson(ID2, 'Erika Beispiel'), eintragJson(ID3, 'Paul Probe')]))
      }
      await echt(k2, v)
    }
    const k = await offenerKern(a, klar)
    expect(JSON.parse(k.getItem(Q)!).map((e: { id: string }) => e.id)).toEqual([ID1, ID2, ID3])
    // Der geänderte Klartext bleibt, bis er sicher liegt; dann räumt das Fenster ihn selbst auf
    expect(klar.d.has(Q)).toBe(true)
    await k.geschrieben()
    expect(klar.d.has(Q)).toBe(false)
    const k2 = await offenerKern(a, klar)
    expect(JSON.parse(k2.getItem(Q)!).map((e: { id: string }) => e.id)).toEqual([ID1, ID2, ID3])
    expect(klar.d.has(Q)).toBe(false)
  })

  it('Klartext, der erst während des Umzugs entsteht (neue Schlüssel), kommt noch in den Tresor und wird danach aufgeräumt', async () => {
    const klar = klarSpeicher(klarStart())
    const a = speicherAblage()
    const echt = a.ablage.schreiben
    const Q2 = SCHLUESSEL_PREFIX + 'wache3', E2 = entwurfSchluessel('wache3')
    let einmal = false
    a.ablage.schreiben = async (k2, v) => {
      if (!einmal) {
        // Die Schlüssel sind schon gelesen: neue Klartexte (Seite nach der Zeitgrenze, alte Fassung im anderen Tab)
        einmal = true
        klar.d.set(Q2, JSON.stringify([{ ...eintragJson(ID3, 'Paul Probe'), orgCode: 'wache3' }]))
        klar.d.set(E2, JSON.stringify({ stand: new Date().toISOString(), werte: { name: 'Muster', vorname: 'Erika' } }))
      }
      await echt(k2, v)
    }
    const k = await offenerKern(a, klar)
    expect(eintraege(k, 'wache3').map((e) => e.id)).toEqual([ID3])
    expect(k.getItem(E2)).toContain('Erika')
    await k.geschrieben()
    expect(klar.d.has(Q2)).toBe(false)
    expect(klar.d.has(E2)).toBe(false)
    expect(rohText(a.daten)).not.toMatch(/Paul Probe|Erika/)
    const k2 = await offenerKern(a, klarSpeicher())
    expect(eintraege(k2, 'wache3').map((e) => e.id)).toEqual([ID3])
    expect(k2.getItem(E2)).toContain('Erika')
  })

  it('schon verschlüsselt und noch Klartext: Listen nach Kennung vereinigt, der Tresor gewinnt', async () => {
    const a = speicherAblage()
    const k = await offenerKern(a, klarSpeicher())
    k.setItem(Q, JSON.stringify([{ ...eintragJson(ID1), versuche: 3 }]))
    await k.geschrieben()
    const klar = klarSpeicher({ [Q]: JSON.stringify([eintragJson(ID1), eintragJson(ID2)]) })
    const k2 = await offenerKern(a, klar)
    const l = JSON.parse(k2.getItem(Q)!)
    expect(l.map((e: { id: string }) => e.id)).toEqual([ID1, ID2])
    expect(l[0].versuche).toBe(3)
    expect(klar.d.size).toBe(0)
  })
})

describe('Tresor: zusammenführen', () => {
  it('Listen nach Kennung, Tresor gewinnt; kaputt verliert nichts', () => {
    const t = JSON.stringify([{ id: ID1, x: 't' }])
    const c = JSON.stringify([{ id: ID1, x: 'c' }, { id: ID2 }])
    expect(JSON.parse(zusammenfuehren(Q, t, c)!)).toEqual([{ id: ID1, x: 't' }, { id: ID2 }])
    expect(zusammenfuehren(Q, null, c)).toBe(c)
    expect(zusammenfuehren(Q, t, null)).toBe(t)
    expect(zusammenfuehren(Q, 'kaputt', c)).toBe(c)
    expect(zusammenfuehren(Q, t, 'kaputt')).toBe(t)
  })

  it('alte Schlange nach Inhalt', () => {
    const a = { type: 'full', title: 'A', organization_id: 'o' }, b = { type: 'full', title: 'B', organization_id: 'o' }
    expect(JSON.parse(zusammenfuehren('offline_queue_w', JSON.stringify([a]), JSON.stringify([b, a]))!)).toEqual([a, b])
  })

  it('Entwurf: der neuere', () => {
    const alt = JSON.stringify({ stand: '2026-11-07T10:00:00.000Z', werte: { a: 1 } })
    const neuer = JSON.stringify({ stand: '2026-11-07T11:00:00.000Z', werte: { a: 2 } })
    expect(zusammenfuehren('doku_entwurf_w', alt, neuer)).toBe(neuer)
    expect(zusammenfuehren('doku_entwurf_w', neuer, alt)).toBe(neuer)
    // Ohne Stand (alte Maske): der Klartext, er ist später geschrieben
    expect(zusammenfuehren('patientendoku_w', '{"a":1}', '{"a":2}')).toBe('{"a":2}')
  })
})

// ── Unlesbar ───────────────────────────────────────────────────────────────

describe('Tresor: unlesbare Datensätze', () => {
  it('werden umbenannt und gezählt, nie gelöscht oder überschrieben', async () => {
    const a = speicherAblage()
    const k = await offenerKern(a, klarSpeicher())
    k.setItem('doku_entwurf_wache1', '{"stand":"2026-11-07T10:00:00.000Z","werte":{"a":1}}')
    k.setItem(Q, JSON.stringify([eintragJson(ID1)]))
    await k.geschrieben()
    // Der Schlüssel geht verloren (etwa nach einem Teil-Löschen der Website-Daten)
    a.key.k = null
    const k2 = await offenerKern(a, klarSpeicher())
    expect(k2.probleme).toBe(2)
    expect(k2.getItem('doku_entwurf_wache1')).toBeNull()
    const umbenannt = [...a.daten.keys()].filter((x) => x.includes(UNLESBAR))
    expect(umbenannt).toHaveLength(2)
    // Neues Schreiben an derselben Stelle lässt die umbenannten in Ruhe
    k2.setItem('doku_entwurf_wache1', '{"stand":"2026-11-07T12:00:00.000Z","werte":{"b":2}}')
    await k2.geschrieben()
    expect([...a.daten.keys()].filter((x) => x.includes(UNLESBAR))).toEqual(umbenannt)
    // Beim nächsten Öffnen weiter gezählt
    const k3 = await offenerKern(a, klarSpeicher())
    expect(k3.probleme).toBe(2)
    expect(k3.getItem('doku_entwurf_wache1')).toContain('"b":2')
  })

  it('lässt sich ein unlesbarer nicht umbenennen, wird seine Stelle nie beschrieben (Rückfall Klartext)', async () => {
    const a = speicherAblage()
    const k = await offenerKern(a, klarSpeicher())
    k.setItem('doku_entwurf_wache1', '{"stand":"2026-11-07T10:00:00.000Z","werte":{"a":1}}')
    await k.geschrieben()
    const vorher = a.daten.get('doku_entwurf_wache1')
    a.key.k = null
    a.fehler.schreiben = (x) => x.includes(UNLESBAR)
    const klar = klarSpeicher()
    const k2 = await offenerKern(a, klar)
    expect(k2.probleme).toBe(1)
    k2.setItem('doku_entwurf_wache1', '{"stand":"2026-11-07T12:00:00.000Z","werte":{"b":2}}')
    expect(await k2.geschrieben()).toBe(true)
    expect(a.daten.get('doku_entwurf_wache1')).toEqual(vorher)
    expect(klar.d.get('doku_entwurf_wache1')).toContain('"b":2')
  })
})

// ── Die Weiche der App ─────────────────────────────────────────────────────

describe('Tresor in der App: Weiche, Warteschlange, Entwürfe', () => {
  it('nicht geöffnet: wie bisher localStorage (Prüffälle der Warteschlange unverändert)', () => {
    expect(tresorZustand()).toBe('zu')
    expect(tresorWeiche()).toBe(ls)
  })

  it('Warteschlange und Entwurf über die Weiche: verschlüsselt, Rest in localStorage', async () => {
    const a = speicherAblage()
    expect(await tresorOeffnen({ ablage: a.ablage, kanal: null, api: 'https://api.test' })).toBe('verschluesselt')
    expect(a.meta.get('api')).toBe('https://api.test')
    const s = tresorWeiche()!
    expect(ablegen(s, neu(ID1))).toBe(true)
    expect(ablegen(s, neu(ID2, { daten: { title: 'Patientendoku: Erika Beispiel', payload: {} } }))).toBe(true)
    expect(entwurfSchreiben(s, 'wache1', { name: 'Muster' })).toBe(true)
    s.setItem('formular_stand_wache1', '{"v":1}')
    expect(await tresorGeschrieben()).toBe(true)
    expect([...ls.d.keys()]).toEqual(['formular_stand_wache1'])
    expect(rohText(a.daten)).not.toMatch(/Muster|Beispiel|Ida Imker/)
    expect(eintraege(s, 'wache1').map((e) => e.id)).toEqual([ID1, ID2])
    expect(entwurfLesen(s, 'wache1', new Date())?.werte).toEqual({ name: 'Muster' })
    expect(tresorWartend()).toBe(2)
    expect(tresorEntwuerfe()).toBe(1)
    expect(entfernen(s, 'wache1', ID1)).toBe(true)
    await tresorGeschrieben()
    expect(tresorWartend()).toBe(1)
    expect([...a.daten.keys()].filter((x) => x.startsWith(Q))).toEqual([ablageSchluessel(Q, ID2)])
  })

  it('alte Schlange im Tresor wird beim Lesen übernommen', async () => {
    ls.d.set('offline_queue_wache1', JSON.stringify([{ type: 'full', title: 'Patientendoku: Otto Normal', organization_id: 'org1', payload: { name: 'Normal' } }]))
    const a = speicherAblage()
    await tresorOeffnen({ ablage: a.ablage, kanal: null })
    expect(ls.d.size).toBe(0)
    expect(tresorWartend()).toBe(1)
    const s = tresorWeiche()!
    const l = eintraege(s, 'wache1')
    expect(l).toHaveLength(1)
    expect(l[0].uebernommen).toBe(true)
    await tresorGeschrieben()
    expect([...a.daten.keys()].some((x) => x.startsWith('offline_queue_'))).toBe(false)
    expect(tresorWartend()).toBe(1)
  })

  it('Abmelden: Entwürfe weg, Warteschlange bleibt (auch Klartext im Rückfall)', async () => {
    const a = speicherAblage()
    await tresorOeffnen({ ablage: a.ablage, kanal: null })
    const s = tresorWeiche()!
    ablegen(s, neu(ID1))
    entwurfSchreiben(s, 'wache1', { name: 'Muster' })
    entwurfSchreiben(s, 'wache1_u_abc', { name: 'Muster' })
    s.setItem('patientendoku_wache1', '{"name":"Muster"}')
    ls.d.set('offline_queue_wache9', '[]')
    ls.d.set('doku_entwurf_alt', '{"x":1}')
    await tresorGeschrieben()
    expect(tresorEntwuerfe()).toBe(4)
    await tresorEntwuerfeLoeschen()
    expect(tresorEntwuerfe()).toBe(0)
    expect([...a.daten.keys()]).toEqual([ablageSchluessel(Q, ID1)])
    leerenOhneWarteschlange(() => ls.clear())
    expect([...ls.d.keys()]).toEqual(['offline_queue_wache9'])
    expect(tresorWartend()).toBe(1)
  })

  it('Rückfall ohne WebCrypto oder IndexedDB: Klartext wie bisher, mit Grund', async () => {
    const echt = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: echt.getRandomValues.bind(echt) })
    expect(await tresorOeffnen({ kanal: null })).toBe('klartext')
    expect(tresorKlartextGrund()).toBe('nicht_moeglich')
    vi.stubGlobal('crypto', echt)
    const s = tresorWeiche()!
    ablegen(s, neu(ID1))
    expect(ls.d.get(Q)).toContain('Max Muster')
    expect(tresorWartend()).toBe(1)
  })

  it('Zeitgrenze: erst Klartext, nach dem Öffnen umgezogen, nichts verloren', async () => {
    const a = speicherAblage()
    a.setLangsam(30)
    expect(await tresorOeffnen({ ablage: a.ablage, kanal: null, zeitMs: 5 })).toBe('klartext')
    expect(tresorKlartextGrund()).toBe('zeit')
    // Die Seite arbeitet derweil im Klartext weiter
    ablegen(tresorWeiche()!, neu(ID1))
    expect(ls.d.has(Q)).toBe(true)
    await vi.waitFor(() => expect(tresorZustand()).toBe('verschluesselt'), { timeout: 3000, interval: 20 })
    await tresorGeschrieben()
    expect(eintraege(tresorWeiche()!, 'wache1').map((e) => e.id)).toEqual([ID1])
    // Spätestens der nächste Start räumt den Klartext (hier schon dieser, wenn er vor dem Abschluss kam)
    const k2 = await offenerKern(a, ls)
    expect(JSON.parse(k2.getItem(Q)!).map((e: { id: string }) => e.id)).toEqual([ID1])
    expect(ls.d.has(Q)).toBe(false)
  })

  it('Ablage scheitert dauerhaft: Inhalt als Klartext, nie verloren; ohne beides „nicht gesichert“', async () => {
    const a = speicherAblage()
    await tresorOeffnen({ ablage: a.ablage, kanal: null })
    a.fehler.schreiben = () => true
    const s = tresorWeiche()!
    ablegen(s, neu(ID1))
    expect(await tresorGeschrieben()).toBe(true)
    expect(ls.d.get(Q)).toContain(ID1)
    ls.f.setItem = true
    ablegen(s, neu(ID2))
    expect(await tresorGeschrieben()).toBe(false)
    // Im Arbeitsspeicher bleibt es, die Karte kann es senden, solange die Seite offen ist
    expect(eintraege(s, 'wache1').map((e) => e.id)).toEqual([ID1, ID2])
    // Geht es wieder, liegt alles verschlüsselt und der Klartext ist weg
    ls.f.setItem = false
    a.fehler.schreiben = () => false
    ablegen(s, neu(ID3))
    expect(await tresorGeschrieben()).toBe(true)
    expect(ls.d.has(Q)).toBe(false)
    expect([...a.daten.keys()].filter((x) => x.startsWith(Q)).length).toBe(3)
  })

  it('vom Hintergrund Gesendetes taucht nicht wieder auf', async () => {
    const a = speicherAblage()
    const k = await offenerKern(a, klarSpeicher())
    k.setItem(Q, JSON.stringify([eintragJson(ID1), eintragJson(ID2)]))
    await k.geschrieben()
    a.erledigt.set(ID1, { am: new Date().toISOString() })
    a.erledigt.set('zzzzzzzzzzzzzzz', { am: '2020-01-01T00:00:00.000Z' })
    await tresorOeffnen({ ablage: a.ablage, kanal: null })
    expect(eintraege(tresorWeiche()!, 'wache1').map((e) => e.id)).toEqual([ID2])
    expect(erledigtVomHintergrund().has(ID1)).toBe(true)
    await tresorGeschrieben()
    expect(a.daten.has(ablageSchluessel(Q, ID1))).toBe(false)
    // Alte Vermerke werden aufgeräumt
    expect(a.erledigt.has('zzzzzzzzzzzzzzz')).toBe(false)
    // Ein Fenster, das den Eintrag noch kennt, legt ihn nicht wieder an
    k.erledigt.add(ID1)
    k.setItem(Q, JSON.stringify([eintragJson(ID1), eintragJson(ID2)]))
    await k.geschrieben()
    expect(a.daten.has(ablageSchluessel(Q, ID1))).toBe(false)
  })

  it('zählt unlesbare Einträge für die Karte', async () => {
    const a = speicherAblage()
    a.daten.set(`${Q}\u0000${ID1}${UNLESBAR}1`, { v: 1 })
    await tresorOeffnen({ ablage: a.ablage, kanal: null })
    expect(tresorProbleme()).toBe(1)
  })
})

describe('Warnung beim Verlassen (5.5)', () => {
  it('nur, solange etwas wartet; nach verlassenErlauben nie', async () => {
    const a = speicherAblage()
    await tresorOeffnen({ ablage: a.ablage, kanal: null })
    const ev = () => ({ preventDefault: vi.fn(), returnValue: undefined as unknown })
    const leer = ev()
    beimVerlassen(leer)
    expect(leer.preventDefault).not.toHaveBeenCalled()
    ablegen(tresorWeiche()!, neu(ID1))
    const voll = ev()
    beimVerlassen(voll)
    expect(voll.preventDefault).toHaveBeenCalled()
    expect(voll.returnValue).toBe('')
    verlassenErlauben()
    const danach = ev()
    beimVerlassen(danach)
    expect(danach.preventDefault).not.toHaveBeenCalled()
  })
})

// ── Entwürfe: Zeitgrenze, Verfall (Review F5, F6) ───────────────────────────

describe('Entwürfe: nichts geht beim späten Öffnen verloren, verfallene gehen beim Start (Review F5, F6)', () => {
  const E = entwurfSchluessel('wache1')
  const entwurf = (stand: string, werte: Record<string, unknown>) => JSON.stringify({ stand, werte })

  it('Zeitgrenze: die Seite schreibt einen neuen Entwurf in den Klartext, der ältere im Tresor bleibt unter ~frueher-', async () => {
    const a = speicherAblage()
    const k = await offenerKern(a, klarSpeicher())
    k.setItem(E, entwurf('2026-11-07T10:00:00.000Z', { name: 'Muster' }))
    await k.geschrieben()
    // Nach der Zeitgrenze tippt jemand ein neues Protokoll (im Klartext, neuerer Stand)
    const klar = klarSpeicher({ [E]: entwurf('2026-11-07T11:00:00.000Z', { name: 'Beispiel' }) })
    const k2 = await offenerKern(a, klar)
    expect(k2.getItem(E)).toContain('Beispiel')
    const frueher = k2.schluessel().filter((x) => x.startsWith(E + ENTWURF_FRUEHER))
    expect(frueher).toEqual([`${E}${ENTWURF_FRUEHER}${Date.parse('2026-11-07T10:00:00.000Z')}`])
    expect(k2.getItem(frueher[0])).toContain('Muster')
    await k2.geschrieben()
    expect(klar.d.size).toBe(0)
    expect(rohText(a.daten)).not.toMatch(/Muster|Beispiel/)
    // Gleicher Inhalt oder leerer Verlierer: nichts aufgehoben
    const k3 = await offenerKern(a, klarSpeicher({ [E]: entwurf('2026-11-07T12:00:00.000Z', { name: 'Beispiel' }) }))
    expect(k3.schluessel().filter((x) => x.startsWith(E + ENTWURF_FRUEHER))).toHaveLength(1)
    const k4 = await offenerKern(a, klarSpeicher({ [E]: entwurf('2026-11-07T09:00:00.000Z', { name: '' }) }))
    expect(k4.schluessel().filter((x) => x.startsWith(E + ENTWURF_FRUEHER))).toHaveLength(1)
  })

  it('der aufgehobene rückt nach, sobald unter dem Schlüssel nichts mehr liegt', async () => {
    const a = speicherAblage()
    await tresorOeffnen({ ablage: a.ablage, kanal: null })
    const s = tresorWeiche()!
    const jetzt = new Date()
    s.setItem(E, entwurf(jetzt.toISOString(), { name: 'Beispiel' }))
    s.setItem(`${E}${ENTWURF_FRUEHER}1`, entwurf(new Date(jetzt.getTime() - 60_000).toISOString(), { name: 'Muster' }))
    expect(entwurfNachruecken(E)).toBe(false)
    expect(entwurfFinden(s, 'wache1')?.werte).toEqual({ name: 'Beispiel' })
    s.removeItem(E)
    expect(entwurfFinden(s, 'wache1')?.werte).toEqual({ name: 'Muster' })
    expect(s.getItem(`${E}${ENTWURF_FRUEHER}1`)).toBeNull()
    expect(entwurfNachruecken(E)).toBe(false)
  })

  it('beim Start: verfallene weg (auch Zukunft und Klartext), frische bleiben, alte Maske bekommt einen Zeitpunkt', async () => {
    const a = speicherAblage()
    await tresorOeffnen({ ablage: a.ablage, kanal: null })
    const s = tresorWeiche()!
    const jetzt = Date.parse('2026-11-08T12:00:00.000Z')
    const iso = (ms: number) => new Date(ms).toISOString()
    s.setItem(E, entwurf(iso(jetzt - 60_000), { name: 'Frisch' }))
    s.setItem(entwurfSchluessel('wache2'), entwurf(iso(jetzt - ENTWURF_FRIST_MS - 1000), { name: 'Alt' }))
    s.setItem(entwurfSchluessel('wache3'), entwurf(iso(jetzt + ENTWURF_FRIST_MS + 1000), { name: 'Zukunft' }))
    s.setItem(`${E}${ENTWURF_FRUEHER}5`, entwurf(iso(jetzt - ENTWURF_FRIST_MS - 1), { name: 'Aufgehoben' }))
    s.setItem('patientendoku_wache1', JSON.stringify({ name: 'Ohne Zeitpunkt' }))
    s.setItem('patientendoku_wache2', JSON.stringify({ entwurf: 1, stand: iso(jetzt - ENTWURF_FRIST_MS - 5), werte: { name: 'Alt' } }))
    ls.d.set('doku_entwurf_wache4', entwurf(iso(jetzt - ENTWURF_FRIST_MS * 3), { name: 'Klartext alt' }))
    ls.d.set('doku_entwurf_wache5', 'kaputt')
    // Die Warteschlange und anderes bleibt unberührt
    ablegen(s, neu(ID1))
    expect(entwuerfeAufraeumen(jetzt)).toBe(6)
    expect(s.getItem(E)).toContain('Frisch')
    for (const k of [entwurfSchluessel('wache2'), entwurfSchluessel('wache3'), `${E}${ENTWURF_FRUEHER}5`, 'patientendoku_wache2']) expect(s.getItem(k), k).toBeNull()
    expect([...ls.d.keys()]).toEqual([])
    const alt = JSON.parse(s.getItem('patientendoku_wache1')!)
    expect(alt).toEqual({ entwurf: 1, stand: iso(jetzt), werte: { name: 'Ohne Zeitpunkt' } })
    expect(eintraege(s, 'wache1').map((e) => e.id)).toEqual([ID1])
    // einen Tag später ist auch er weg
    expect(entwuerfeAufraeumen(jetzt + ENTWURF_FRIST_MS + 1)).toBe(2)
    expect(s.getItem('patientendoku_wache1')).toBeNull()
  })

  it('ein Entwurf mit Zeitpunkt in der Zukunft (Uhr verstellt) wird innerhalb der Frist angeboten, danach nicht', () => {
    const s = klarSpeicher()
    const jetzt = new Date('2026-11-08T12:00:00.000Z')
    s.setItem(E, entwurf('2026-11-08T13:00:00.000Z', { name: 'Muster' }))
    expect(entwurfLesen(s, 'wache1', jetzt)?.werte).toEqual({ name: 'Muster' })
    s.setItem(E, entwurf(new Date(jetzt.getTime() + ENTWURF_FRIST_MS + 1000).toISOString(), { name: 'Muster' }))
    expect(entwurfLesen(s, 'wache1', jetzt)).toBeNull()
    expect(s.getItem(E)).toBeNull()
  })

  it('tresorBereit wartet auf das Öffnen nach der Zeitgrenze', async () => {
    const a = speicherAblage()
    a.setLangsam(30)
    expect(await tresorOeffnen({ ablage: a.ablage, kanal: null, zeitMs: 5 })).toBe('klartext')
    expect(tresorOeffnetNoch()).toBe(true)
    expect(await tresorBereit(5000)).toBe('verschluesselt')
    expect(tresorOeffnetNoch()).toBe(false)
    // schon offen: sofort
    expect(await tresorBereit(1)).toBe('verschluesselt')
  })
})
