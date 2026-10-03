import { describe, it, expect } from 'vitest'
import { AELRD_FELDER } from '../../katalog/aelrd'
import { AELRD_SPIEGELUNGEN } from '../../katalog/aelrdSpiegel'
import {
  AELRD_NAEP,
  aelrdNaepUmfang,
  anhangZiele,
  umbauFelder,
  type NaepZiel,
} from '../../katalog/aelrdNaep'
import {
  naepAbschnitteFlach,
  naepAlleEingaben,
  type NaepEingabe,
  type NaepLeer,
} from '../../katalog/naep'
import { naepStruktur } from '../../katalog/naepStrukturen'

// ── Nachschlagewerke aus dem Katalog der Norm ───────────────────────────────

const eingaben = new Map<string, NaepEingabe>()
/** Auswahl-Code → seine Optionscodes. Enthält auch die Arme einer Gruppe. */
const optionenJeAuswahl = new Map<string, Set<string>>()
/** Abschnitt- oder Auswahl-Code → seine leer-Codes. */
const leerJeZiel = new Map<string, Set<string>>()
/** Auswahl-Code → Code ihrer Sonstiges-Angabe. */
const sonstigesJeAuswahl = new Map<string, string>()

function merkeLeer(ziel: string, leer: NaepLeer[] | undefined) {
  if (!leer?.length) return
  leerJeZiel.set(ziel, new Set(leer.map((l) => l.code)))
}

for (const e of naepAlleEingaben()) {
  eingaben.set(e.code, e)
  if (e.art === 'auswahl') {
    optionenJeAuswahl.set(e.code, new Set(e.optionen.map((o) => o.code)))
    merkeLeer(e.code, e.leer)
    if (e.sonstiges) sonstigesJeAuswahl.set(e.code, e.sonstiges.code)
  }
  if (e.art === 'auswahlgruppe') {
    const codes = new Set(e.optionen.map((o) => o.code))
    // Jeder Arm der Gruppe trägt dieselbe Optionsliste.
    for (const a of e.auswahlen) optionenJeAuswahl.set(a.code, codes)
    merkeLeer(e.code, e.leer)
  }
  if (e.art === 'oder') merkeLeer(e.code, e.leer)
}
for (const a of naepAbschnitteFlach()) {
  merkeLeer(a.code, a.leer)
  if (a.verlauf) merkeLeer(a.verlauf.code, a.verlauf.leer)
}

/**
 * Alle Codes, die es in der Norm überhaupt gibt: Eingaben, Abschnitte, die
 * Arme einer Gruppe und die Optionen. Ein Umbau-Ziel darf auf jeden davon
 * zeigen — der Freitext "Intubation" des Bogens wird zur Option J6N samt
 * ihrer Unterangaben, nicht zu einem Feld.
 */
const alleCodes = new Set<string>([
  ...eingaben.keys(),
  ...optionenJeAuswahl.keys(),
  ...naepAbschnitteFlach().map((a) => a.code),
  ...[...optionenJeAuswahl.values()].flatMap((s) => [...s]),
])

/** Warum ein Ziel nicht in die Norm passt — leer heißt: es passt. */
function pruefen(ziel: NaepZiel): string | null {
  if (ziel.art === 'anhang') return null

  if (ziel.art === 'wert') {
    const e = eingaben.get(ziel.code)
    if (!e) return `${ziel.code} gibt es in der Norm nicht`
    if (e.art !== 'feld' && e.art !== 'freitext') return `${ziel.code} ist ${e.art}, kein Feld`
    return null
  }

  if (ziel.art === 'struktur') {
    const e = eingaben.get(ziel.code)
    if (!e) return `${ziel.code} gibt es in der Norm nicht`
    if (e.art !== 'struktur') return `${ziel.code} ist ${e.art}, kein strukturierter Block`
    const def = naepStruktur(e.typ)
    if (!def) return `zu ${ziel.code} fehlt die Strukturbeschreibung`
    const pfade = new Set([...def.felder.map((f) => f.pfad), def.liste?.pfad].filter(Boolean))
    if (!pfade.has(ziel.pfad)) return `${ziel.pfad} gibt es in ${e.typ} nicht`
    return null
  }

  if (ziel.art === 'option') {
    const codes = optionenJeAuswahl.get(ziel.auswahl)
    if (!codes) return `${ziel.auswahl} ist keine Auswahl der Norm`
    if (!codes.has(ziel.option)) return `${ziel.option} gehört nicht zu ${ziel.auswahl}`
    return null
  }

  if (ziel.art === 'leer') {
    const codes = leerJeZiel.get(ziel.ziel)
    if (!codes) return `${ziel.ziel} hat in der Norm keine leer-Angabe`
    if (!codes.has(ziel.code)) return `${ziel.code} ist keine leer-Angabe von ${ziel.ziel}`
    return null
  }

  if (ziel.art === 'frage') {
    const e = eingaben.get(ziel.code)
    if (!e) return `${ziel.code} gibt es in der Norm nicht`
    if (e.art !== 'frage') return `${ziel.code} ist ${e.art}, keine Frage`
    return null
  }

  if (ziel.art === 'sonstiges') {
    const code = sonstigesJeAuswahl.get(ziel.auswahl)
    if (!code) return `${ziel.auswahl} hat keine Sonstiges-Angabe`
    if (code !== ziel.code) return `die Sonstiges-Angabe von ${ziel.auswahl} ist ${code}, nicht ${ziel.code}`
    return null
  }

  if (ziel.art === 'geteilt') {
    const fehler = ziel.ziele.map(pruefen).filter(Boolean)
    return fehler.length > 0 ? fehler.join('; ') : null
  }

  if (ziel.art === 'spiegel') {
    // Ein Spiegel hat kein eigenes Ziel in der Norm. Er muss aber auf eine
    // Angabe zeigen, die es gibt, und als Spiegelung erklärt sein.
    const [id, option] = ziel.quelle.split('.')
    const z = AELRD_NAEP[id]
    if (!z) return `die Quelle ${id} gibt es nicht`
    if (option ? !z.optionen?.[option] : !z.feld) return `${ziel.quelle} ist keine Angabe des Bogens`
    const erklaert = AELRD_SPIEGELUNGEN.some(
      (s) => (s.option ? `${s.quelle}.${s.option}` : s.quelle) === ziel.quelle,
    )
    if (!erklaert) return `die Spiegelung auf ${ziel.quelle} steht nicht in aelrdSpiegel.ts`
    return null
  }

  // umbau
  if (!alleCodes.has(ziel.code)) return `${ziel.code} gibt es in der Norm nicht`
  return null
}

// ── Vollständigkeit ─────────────────────────────────────────────────────────

describe('Zuordnung Bogen → Norm: nichts bleibt liegen', () => {
  it('ordnet jedes Feld des Bogens zu', () => {
    // Es gibt keinen dritten Zustand neben "hat ein Ziel in der Norm" und
    // "gehört in den Anhang". Wer ein Feld ergänzt, muss sich entscheiden.
    const ohne = AELRD_FELDER.filter((f) => {
      const z = AELRD_NAEP[f.id]
      if (!z) return true
      const hatOptionen = (f.optionen?.length ?? 0) > 0
      return hatOptionen ? !z.optionen : !z.feld
    }).map((f) => `${f.id} (${f.label})`)
    expect(ohne).toEqual([])
  })

  it('ordnet jede einzelne Option zu', () => {
    // Der Fehler, der aus "blass UND kaltschweißig" ein "blass" gemacht hat,
    // war ein Optionsproblem, kein Feldproblem.
    const ohne: string[] = []
    for (const f of AELRD_FELDER) {
      const z = AELRD_NAEP[f.id]
      for (const o of f.optionen ?? []) {
        if (!z?.optionen?.[o.wert]) ohne.push(`${f.id}.${o.wert} ("${o.text}")`)
      }
    }
    expect(ohne).toEqual([])
  })

  it('führt keine Zuordnung zu einem Feld, das es nicht mehr gibt', () => {
    const bekannt = new Set(AELRD_FELDER.map((f) => f.id))
    expect(Object.keys(AELRD_NAEP).filter((id) => !bekannt.has(id))).toEqual([])
  })

  it('führt keine Option, die der Bogen nicht hat', () => {
    const uebrig: string[] = []
    for (const f of AELRD_FELDER) {
      const z = AELRD_NAEP[f.id]
      if (!z?.optionen) continue
      const bekannt = new Set((f.optionen ?? []).map((o) => o.wert))
      for (const k of Object.keys(z.optionen)) if (!bekannt.has(k)) uebrig.push(`${f.id}.${k}`)
    }
    expect(uebrig).toEqual([])
  })
})

// ── Richtigkeit ─────────────────────────────────────────────────────────────

describe('Zuordnung Bogen → Norm: jeder Code stimmt', () => {
  it('verweist nur auf Codes, die es in der Norm wirklich gibt', () => {
    // Ein Tippfehler im Code wäre sonst erst beim Export aufgefallen — und
    // dort als stilles Weglassen, nicht als Fehler.
    const fehler: string[] = []
    for (const [id, z] of Object.entries(AELRD_NAEP)) {
      const f = z.feld ? pruefen(z.feld) : null
      if (f) fehler.push(`${id}: ${f}`)
      for (const [k, ziel] of Object.entries(z.optionen ?? {})) {
        const o = pruefen(ziel)
        if (o) fehler.push(`${id}.${k}: ${o}`)
      }
    }
    expect(fehler).toEqual([])
  })

  it('nennt für jeden Anhang-Eintrag einen Grund', () => {
    expect(anhangZiele().filter((z) => !z.grund.trim())).toEqual([])
  })

  it('nennt für jeden Umbau, was sich ändern muss', () => {
    expect(umbauFelder().filter((f) => !f.umbau.trim())).toEqual([])
  })
})

// ── Nichts wird zweimal erfasst ─────────────────────────────────────────────

describe('Keine doppelte Erfassung', () => {
  /** Jedes Ziel als Zeichenkette, damit sich Doppelungen zählen lassen. */
  function schluessel(z: NaepZiel): string[] {
    if (z.art === 'wert') return [z.code]
    if (z.art === 'struktur') return [`${z.code}:${z.pfad}`]
    if (z.art === 'option') return [`${z.auswahl}/${z.option}`]
    if (z.art === 'leer') return [`leer ${z.ziel}/${z.code}`]
    if (z.art === 'frage') return [`frage ${z.code}`]
    if (z.art === 'sonstiges') return [`sonst ${z.auswahl}/${z.code}`]
    if (z.art === 'geteilt') return z.ziele.flatMap(schluessel)
    if (z.art === 'umbau') return [`umbau ${z.code}`]
    return [] // spiegel und anhang haben kein Ziel in der Norm
  }

  /**
   * Ziele, die mehr als eine Angabe des Bogens tragen dürfen — jede mit dem
   * Grund, warum das keine Doppelerfassung ist. Steht ein Ziel nicht hier
   * und wird trotzdem zweimal belegt, fragt der Bogen dasselbe zweimal, und
   * eine der beiden Stellen gehört nach aelrdSpiegel.ts.
   */
  const ERLAUBT: Record<string, string> = {
    BBP: 'Die vier Zeilen der Besatzung gehen in das eine Teamfeld der Norm',
    A26: 'Der Alterswert und seine Einheit gehören zusammen',
    BFZ: 'Die Norm hat für den Zeitpunkt des Übergabebefunds kein eigenes Feld',
    'DM7/DME': 'Der Bogen trennt Stridor insp. und exsp., die Norm nicht',
    'L8L/L8S': 'Der Bogen trennt Stridor insp. und exsp., die Norm nicht',
    'DLM/DM0': 'Der Bogen trennt Belastungs- und Ruhedyspnoe, die Norm nicht',
    'L80/L8E': 'Der Bogen trennt Belastungs- und Ruhedyspnoe, die Norm nicht',
    'JH5/JHJ': 'Der Bogen trennt passiven und aktiven Wärmeerhalt, die Norm nicht',
    'J2Y/J3C': 'Der Bogen trennt "unmöglich" und "Verfahrenswechsel", die Norm fasst zusammen',
    'JJV/JK2': 'Der Bogen trennt selbst geschriebenes und fremdes 12-Kanal-EKG, die Norm nicht',
    'umbau D5H': 'Arme und Beine sind verschiedene Gliedmaßen derselben Gruppe',
    'umbau G07': 'Führende und weitere Diagnosen werden Einträge derselben Liste',
  }

  it('belegt kein Ziel der Norm zweimal, außer wo der Bogen feiner ist', () => {
    const wer = new Map<string, string[]>()
    for (const [id, z] of Object.entries(AELRD_NAEP)) {
      const eintraege: [string, NaepZiel][] = []
      if (z.feld) eintraege.push([id, z.feld])
      for (const [k, ziel] of Object.entries(z.optionen ?? {})) eintraege.push([`${id}.${k}`, ziel])
      for (const [name, ziel] of eintraege) {
        for (const s of schluessel(ziel)) wer.set(s, [...(wer.get(s) ?? []), name])
      }
    }
    const doppelt = [...wer].filter(([, v]) => v.length > 1)
    const unerklaert = doppelt
      .filter(([ziel]) => !ERLAUBT[ziel])
      .map(([ziel, v]) => `${ziel} ← ${v.join(', ')}`)
    expect(unerklaert).toEqual([])
  })

  it('führt keine Erlaubnis für ein Ziel, das gar nicht doppelt ist', () => {
    // Sonst bliebe eine Erlaubnis stehen, nachdem die Doppelung weg ist, und
    // deckte beim nächsten Mal eine echte zu.
    const zaehler = new Map<string, number>()
    for (const z of Object.values(AELRD_NAEP)) {
      for (const ziel of [z.feld, ...Object.values(z.optionen ?? {})].filter(Boolean) as NaepZiel[]) {
        for (const s of schluessel(ziel)) zaehler.set(s, (zaehler.get(s) ?? 0) + 1)
      }
    }
    expect(Object.keys(ERLAUBT).filter((z) => (zaehler.get(z) ?? 0) < 2)).toEqual([])
  })

  it('erklärt jede Spiegelung und zeigt auf eine Angabe, die es gibt', () => {
    const fehler: string[] = []
    for (const s of AELRD_SPIEGELUNGEN) {
      if (!s.grund.trim()) fehler.push(`${s.spiegel}: ohne Grund`)
      const quelle = AELRD_NAEP[s.quelle]
      const spiegelZiel = s.option
        ? AELRD_NAEP[s.spiegel]?.optionen?.[s.option]
        : AELRD_NAEP[s.spiegel]?.feld
      if (!quelle) fehler.push(`${s.quelle}: gibt es nicht`)
      if (spiegelZiel?.art !== 'spiegel') {
        fehler.push(`${s.spiegel}${s.option ? '.' + s.option : ''}: in der Zuordnung nicht als Spiegel geführt`)
      }
    }
    expect(fehler).toEqual([])
  })
})

// ── Was die Zuordnung über den Bogen sagt ───────────────────────────────────

describe('Umfang', () => {
  it('hat für jede Angabe des Bogens genau ein Ziel', () => {
    const { norm, anhang, umbau, spiegel } = aelrdNaepUmfang()
    // Kein Sollwert aus der Luft, sondern die Zahl, die der Bogen selbst
    // vorgibt: ein Ziel je Feld ohne Optionen, eines je Option — auch die
    // gespiegelten Kästchen zählen mit, sie haben nur kein eigenes Ziel.
    const erwartet =
      AELRD_FELDER.filter((f) => (f.optionen?.length ?? 0) === 0).length +
      AELRD_FELDER.reduce((n, f) => n + (f.optionen?.length ?? 0), 0)
    expect(norm + anhang + umbau + spiegel).toBe(erwartet)

    // Ein Riegel gegen Abdriften: der Anhang darf nicht größer werden als
    // das, was in der Norm ankommt.
    expect(anhang).toBeLessThan(norm)
  })
})
