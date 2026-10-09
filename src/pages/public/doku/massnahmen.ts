// Maßnahmen als Verlauf: Uhrzeit, Art, Ausführung.
//
// Auf dem Bogen sind Maßnahmen Kreuze in acht Kästen — ohne Zeit. Getan werden
// sie aber nacheinander, und im Nachhinein ist die Reihenfolge oft genau die
// Frage. Erfasst wird deshalb ein Eintrag je Handlung, mit Uhrzeit.
//
// Jeder Eintrag setzt dabei auch das Feld des Bogens, zu dem er gehört: das
// Kreuz bei "12-Kanal EKG", die Schreiblinie bei Zugang und Lagerung. Der
// Ausdruck bleibt damit der amtliche Vordruck; der Verlauf liegt daneben.
//
// Was der Vordruck nicht führt, ist eine Zeitspalte für die Kreuz-Kategorien.
// Dort steht die Uhrzeit also nur in der Erfassung und im Datensatz, nicht
// auf dem Papier.
//
// Die rechtliche Begründung hat dagegen eine Stelle auf dem Bogen: das Feld
// "ÄLRD Delegationen" im Abschluss. Dorthin schreibt sich jede Maßnahme, die
// keine Basismaßnahme ist — mit Uhrzeit und Grund. Von Hand getippter Text
// bleibt dabei stehen, nur die eigenen Zeilen werden nachgezogen.

import { aelrdFeld } from '../../../katalog/aelrd'
import {
  KANUELENGROESSEN, anlageorte, artText, brauchtAnlage, massnahmeKategorie, rechtsgrund,
} from '../../../katalog/massnahmenArten'
import { POSTEN, besatzungLesen } from './besatzung'
import type { Werte } from './DokuFeld'

export type Massnahme = {
  /** Eigene Kennung, damit ein Eintrag gestrichen werden kann. */
  id: string
  /** HH:MM */
  zeit: string
  /** Kennung der Kategorie — zugleich das Feld des Bogens. */
  kategorie: string
  /** Der Wert der Art; bei Schreiblinien der getippte Text. */
  art: string
  /**
   * Die rechtliche Begründung — Basismaßnahme, delegiert, Notstand, § 2a.
   *
   * Sie kann fehlen: ein Eintrag soll nicht am Rechtsweg scheitern, während
   * der Patient versorgt wird. Die Liste zeigt dann, dass sie nachzutragen
   * ist, und lässt sie dort setzen.
   */
  grund?: string
  /**
   * Wer sie durchgeführt hat — der Schlüssel des Postens (tf, m1, m2, m3).
   *
   * Nur dort gefragt, wo es keine Basismaßnahme ist: wer delegiert, im
   * Notstand oder nach § 2a handelt, tut das persönlich, und das Protokoll
   * soll sagen, wer.
   */
  durch?: string
  /**
   * Beim peripheren Zugang: die Kanülengröße, z. B. "18 G".
   *
   * Der Eintrag entsteht nur mit ihr — siehe `massnahmeEintragen`.
   */
  groesse?: string
  /** Beim peripheren Zugang: der Anlageort, als Wert der Norm (z. B. "ellenbeuge_l"). */
  ort?: string
}

/** Trennzeichen der Schreiblinie auf dem Bogen. */
const TRENNER = ' · '

export function jetztZeit(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function massnahmenLesen(werte: Werte): Massnahme[] {
  const m = werte.massnahmen
  if (!Array.isArray(m)) return []
  return m.filter((e): e is Massnahme =>
    Boolean(e) && typeof e === 'object'
    && typeof (e as Massnahme).id === 'string'
    && typeof (e as Massnahme).kategorie === 'string'
    && typeof (e as Massnahme).art === 'string',
  )
}

/** Wie ein Eintrag auf der Schreiblinie des Bogens steht. */
export function zeile(m: Massnahme): string {
  const text = massnahmeKategorie(m.kategorie)?.frei ? m.art : artText(m.kategorie, m.art)
  // Art / Ort / Größe — so, wie die Norm den Zugang führt.
  const ort = m.ort ? anlageorte().find((o) => o.wert === m.ort)?.text ?? m.ort : ''
  const details = brauchtAnlage(m.kategorie, m.art) && m.groesse && ort
    ? `${text} / ${ort} / ${m.groesse}`
    : text
  return [m.zeit, details].filter(Boolean).join(' ').trim()
}

/**
 * Wie ein Eintrag mit seiner Begründung dasteht.
 *
 * Die Basismaßnahme bleibt unbenannt: sie ist der Regelfall und stünde
 * hundertmal da, ohne etwas zu sagen.
 */
export function zeileMitGrund(m: Massnahme, name = ''): string {
  const grund = m.grund && m.grund !== 'basis' ? rechtsgrund(m.grund)?.kurz : ''
  const klammer = [grund, name.trim()].filter(Boolean).join(', ')
  return klammer ? `${zeile(m)} (${klammer})` : zeile(m)
}

/** Der Name dessen, der die Maßnahme durchgeführt hat. */
export function durchName(werte: Werte, m: Massnahme): string {
  if (!m.durch) return ''
  return besatzungLesen(werte)[m.durch]?.name ?? ''
}

/** Die Posten, die besetzt sind — zur Auswahl, wer gehandelt hat. */
export function besetztePosten(werte: Werte): { pos: string; name: string }[] {
  const besetzt = besatzungLesen(werte)
  return POSTEN
    .map((p) => ({ pos: p.pos as string, name: besetzt[p.pos]?.name ?? '' }))
    .filter((p) => p.name !== '')
}

/**
 * Das Feld des Bogens aus den Einträgen einer Kategorie nachziehen.
 *
 * Bei Kreuzen wird nur die eine Option angefasst: ein Kreuz, das aus einem
 * älteren Protokoll oder aus dem alten Formular stammt, hat hier keinen
 * Eintrag und darf trotzdem nicht verschwinden.
 */
function nachziehen(werte: Werte, kategorie: string, eintraege: Massnahme[], entfernt?: Massnahme): Werte {
  const kat = massnahmeKategorie(kategorie)
  if (!kat) return werte
  const eigene = eintraege.filter((e) => e.kategorie === kategorie)

  if (kat.frei) {
    const alt = typeof werte[kategorie] === 'string' ? (werte[kategorie] as string) : ''
    const teile = alt.split(TRENNER).map((t) => t.trim()).filter(Boolean)
    if (entfernt) {
      const weg = teile.indexOf(zeile(entfernt))
      if (weg >= 0) teile.splice(weg, 1)
      return { ...werte, [kategorie]: teile.join(TRENNER) }
    }
    const neu = eigene[eigene.length - 1]
    if (!neu) return werte
    return { ...werte, [kategorie]: [...teile, zeile(neu)].join(TRENNER) }
  }

  const typ = aelrdFeld(kategorie)?.typ
  if (typ === 'mehrfach') {
    const gesetzt = Array.isArray(werte[kategorie]) ? (werte[kategorie] as unknown[]).map(String) : []
    if (entfernt) {
      // Nur streichen, wenn kein anderer Eintrag dieselbe Art noch führt.
      if (eigene.some((e) => e.art === entfernt.art)) return werte
      return { ...werte, [kategorie]: gesetzt.filter((w) => w !== entfernt.art) }
    }
    const neu = eigene[eigene.length - 1]
    if (!neu || gesetzt.includes(neu.art)) return werte
    return { ...werte, [kategorie]: [...gesetzt, neu.art] }
  }

  // Einfachauswahl: es kann nur eine Angabe stehen.
  if (entfernt) {
    if (String(werte[kategorie] ?? '') !== entfernt.art) return werte
    const rest = eigene[eigene.length - 1]
    return { ...werte, [kategorie]: rest ? rest.art : '' }
  }
  const neu = eigene[eigene.length - 1]
  if (!neu) return werte
  return { ...werte, [kategorie]: neu.art }
}

/** Das Feld des Bogens, das die Begründungen aufnimmt. */
const DELEGATIONEN = 'aelrd_delegationen'

/**
 * Die Zeilen der ÄLRD-Delegationen nachziehen.
 *
 * Gelöscht wird nur, was zu einem bekannten Eintrag gehört — erkannt an
 * Uhrzeit und Maßnahme, unabhängig von der Begründung, damit eine geänderte
 * Begründung ihre alte Zeile ersetzt und nicht neben ihr steht. Alles andere
 * hat jemand getippt und bleibt.
 */
function delegationenNachziehen(werte: Werte, eintraege: Massnahme[], entfernt?: Massnahme): Werte {
  const mitNamen = (m: Massnahme) => zeileMitGrund(m, durchName(werte, m))
  const bekannt = entfernt ? [...eintraege, entfernt] : eintraege
  const alt = typeof werte[DELEGATIONEN] === 'string' ? (werte[DELEGATIONEN] as string) : ''
  const fremd = alt
    .split(TRENNER)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((teil) => !bekannt.some((m) => teil === mitNamen(m) || teil.startsWith(zeile(m))))
  // Die Basismaßnahme ist keine Delegation und gehört nicht in das Feld.
  const eigene = eintraege
    .filter((m) => m.grund && m.grund !== 'basis')
    .map((m) => mitNamen(m))
  const neu = [...fremd, ...eigene].join(TRENNER)
  if (neu === alt) return werte
  return { ...werte, [DELEGATIONEN]: neu }
}

/** Fortlaufende Kennung, die auch ohne crypto.randomUUID eindeutig bleibt. */
function kennung(vorhanden: Massnahme[]): string {
  let n = vorhanden.length + 1
  const belegt = new Set(vorhanden.map((e) => e.id))
  while (belegt.has(`m${n}`)) n += 1
  return `m${n}`
}

/** Eine Maßnahme eintragen — in den Verlauf und in das Feld des Bogens. */
export function massnahmeEintragen(
  werte: Werte,
  eingabe: {
    zeit: string; kategorie: string; art: string; grund?: string; durch?: string
    groesse?: string; ort?: string
  },
): Werte {
  const kat = massnahmeKategorie(eingabe.kategorie)
  const art = eingabe.art.trim()
  if (!kat || !art) return werte
  /*
   * Ein peripherer Zugang ohne Größe oder ohne Ort wird nicht eingetragen —
   * auch nicht von einer anderen Stelle aus. Sonst stünde auf dem Bogen ein
   * Zugang, dessen Angaben fehlen, und die Liste könnte es nicht mehr sagen.
   */
  const brauchtDetails = brauchtAnlage(eingabe.kategorie, art)
  if (brauchtDetails && (!KANUELENGROESSEN.includes(eingabe.groesse ?? '')
      || !anlageorte().some((o) => o.wert === eingabe.ort))) return werte
  const vorhanden = massnahmenLesen(werte)
  const neu: Massnahme = {
    id: kennung(vorhanden), zeit: eingabe.zeit, kategorie: eingabe.kategorie, art,
    ...(eingabe.grund && rechtsgrund(eingabe.grund) ? { grund: eingabe.grund } : {}),
    ...(eingabe.durch && POSTEN.some((p) => p.pos === eingabe.durch) ? { durch: eingabe.durch } : {}),
    ...(brauchtDetails ? { groesse: eingabe.groesse, ort: eingabe.ort } : {}),
  }
  const eintraege = [...vorhanden, neu]
  return delegationenNachziehen(
    nachziehen({ ...werte, massnahmen: eintraege }, eingabe.kategorie, eintraege),
    eintraege,
  )
}

/** Einen Eintrag streichen — und das Feld des Bogens mit ihm. */
export function massnahmeStreichen(werte: Werte, id: string): Werte {
  const vorhanden = massnahmenLesen(werte)
  const weg = vorhanden.find((e) => e.id === id)
  if (!weg) return werte
  const eintraege = vorhanden.filter((e) => e.id !== id)
  return delegationenNachziehen(
    nachziehen({ ...werte, massnahmen: eintraege }, weg.kategorie, eintraege, weg),
    eintraege,
    weg,
  )
}

/** Die Begründung eines Eintrags nachtragen oder richtigstellen. */
export function massnahmeGrundSetzen(werte: Werte, id: string, grund: string): Werte {
  if (grund && !rechtsgrund(grund)) return werte
  const vorhanden = massnahmenLesen(werte)
  if (!vorhanden.some((e) => e.id === id)) return werte
  const eintraege = vorhanden.map((e) => {
    if (e.id !== id) return e
    const ohne = { ...e }
    delete ohne.grund
    return grund ? { ...ohne, grund } : ohne
  })
  return delegationenNachziehen({ ...werte, massnahmen: eintraege }, eintraege)
}

/** Einträge, deren rechtliche Begründung noch fehlt. */
export function ohneGrund(werte: Werte): Massnahme[] {
  return massnahmenLesen(werte).filter((m) => !m.grund)
}

/** Die Einträge, neueste zuerst — so wird eine Liste gelesen. */
export function massnahmenAbsteigend(werte: Werte): Massnahme[] {
  return [...massnahmenLesen(werte)].reverse()
}
