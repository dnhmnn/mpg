#!/usr/bin/env python3
"""Erzeugt src/katalog/naep.ts aus dem DIVI-Metamodell.

Der Katalog wird nicht von Hand gepflegt: Das Metamodell ist die Quelle,
alles andere leitet sich daraus ab. Wer eine neue Protokollfassung bekommt,
legt sie nach referenz/naep/ und ruft dieses Werkzeug auf.

    python3 werkzeug/naep-katalog-erzeugen.py
"""
import json
import xml.etree.ElementTree as ET
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
QUELLE = WURZEL / 'referenz/naep/naep-metamodell-6.0-1.00-NoVar-01012021.xml'
ZIEL = WURZEL / 'src/katalog/naep.ts'
M = '{http://naep.divi.de/meta}'


def kurz(e):
    return e.tag.replace(M, '')


def text(e):
    return ' '.join((e.text or '').split()) if e is not None else ''


def eingaben(eltern):
    """Die Eingabeelemente eines Knotens, in Dokumentreihenfolge."""
    aus = []
    for k in eltern:
        t = kurz(k)
        if t == 'Feld':
            aus.append(feld(k))
        elif t == 'Auswahl':
            aus.append(auswahl(k))
        elif t == 'Auswahlgruppe':
            aus.append(auswahlgruppe(k))
        elif t == 'Frage':
            aus.append(frage(k))
        elif t == 'Freitext':
            aus.append({'art': 'freitext', 'code': k.get('code')})
        elif t == 'Struktur':
            aus.append(struktur(k))
        elif t == 'Gruppe':
            aus.append({'art': 'gruppe', 'code': k.get('code'), 'term': k.get('term') or '',
                        'kinder': eingaben(k)})
        elif t == 'oder':
            aus.append({'art': 'oder', 'code': k.get('code'), 'term': k.get('term') or '',
                        'leer': leer_liste(k), 'kinder': eingaben(k)})
    return aus


def leer_liste(e):
    """Die leer-Angaben eines Knotens — in der Norm kein Auswahlpunkt."""
    return [{'code': l.get('code'), 'term': l.get('term') or ''}
            for l in e.findall(f'{M}leer')]


def zusatz(e):
    z = e.find(f'{M}Zusatz')
    if z is None:
        return None
    return {'mehrfach': z.get('typ') == 'mehrfach', 'kinder': eingaben(z)}


def feld(e):
    d = {'art': 'feld', 'code': e.get('code'), 'term': e.get('term') or '',
         'typ': e.get('typ') or 'Text'}
    for a in ('einheit', 'min', 'max'):
        if e.get(a) is not None:
            d[a] = e.get(a)
    hinweis = text(e.find(f'{M}Hinweis'))
    if hinweis:
        d['hinweis'] = hinweis
    z = zusatz(e)
    if z:
        d['zusatz'] = z
    return d


def option(e):
    d = {'code': e.get('code'), 'term': e.get('term') or ''}
    if e.get('numerisch') is not None:
        d['numerisch'] = int(e.get('numerisch'))
    z = zusatz(e)
    if z:
        d['zusatz'] = z
    return d


def auswahl(e):
    d = {'art': 'auswahl', 'code': e.get('code'), 'term': e.get('term') or '',
         'mehrfach': e.get('typ') == 'mehrfach',
         'leer': leer_liste(e),
         'optionen': [option(o) for o in e.findall(f'{M}Option')]}
    s = e.find(f'{M}Sonstiges')
    if s is not None:
        d['sonstiges'] = {'code': s.get('code'), 'term': s.get('term') or 'Sonstige'}
    z = zusatz(e)
    if z:
        d['zusatz'] = z
    return d


def auswahlgruppe(e):
    """Mehrere Auswahlen, die sich dieselbe Optionsliste teilen."""
    opt = e.find(f'{M}Optionen')
    d = {'art': 'auswahlgruppe', 'code': e.get('code'), 'term': e.get('term') or '',
         'auswahlen': [{'code': a.get('code'), 'term': a.get('term') or ''}
                       for a in e.findall(f'{M}Auswahl')],
         'leer': leer_liste(opt) if opt is not None else [],
         'optionen': [option(o) for o in opt.findall(f'{M}Option')] if opt is not None else []}
    z = zusatz(opt) if opt is not None else None
    if z:
        d['zusatz'] = z
    return d


def frage(e):
    d = {'art': 'frage', 'code': e.get('code'), 'term': e.get('term') or '',
         'typ': e.get('typ') or 'j_opt'}
    w = e.find(f'{M}wenn-ja')
    if w is not None:
        d['wennJa'] = eingaben(w)
    return d


def struktur(e):
    x = e.find(f'{M}xsi')
    d = {'art': 'struktur', 'code': e.get('code'), 'term': e.get('term') or '',
         'typ': x.get('type') if x is not None else ''}
    z = zusatz(e)
    if z:
        d['zusatz'] = z
    return d


def abschnitt(e):
    d = {'code': e.get('code'), 'titel': text(e.find(f'{M}Titel'))}
    hinweis = text(e.find(f'{M}Hinweis'))
    if hinweis:
        d['hinweis'] = hinweis
    f = e.find(f'{M}Formular')
    if f is not None:
        d['leer'] = leer_liste(f)
        d['formular'] = eingaben(f)
    v = e.find(f'{M}Verlauf')
    if v is not None:
        reihe = v.find(f'{M}Reihe')
        d['verlauf'] = {'code': v.get('code'), 'leer': leer_liste(v),
                        'spalten': eingaben(reihe) if reihe is not None else []}
    kinder = [abschnitt(k) for k in e.findall(f'{M}Abschnitt')]
    if kinder:
        d['kinder'] = kinder
    return d


def fragetypen(r):
    """Welche Antworten ein Fragetyp zulaesst."""
    aus = {}
    defs = r.find(f'{M}Definitionen/{M}Fragen')
    begriffe = {a.get('code'): a.get('term') for a in defs.findall(f'{M}Antwort')}
    for t in defs.findall(f'{M}Typ'):
        aus[t.get('name')] = {
            'optional': t.get('optional') == 'ja',
            'antworten': [{'code': a.get('code'), 'term': begriffe.get(a.get('code'), a.get('code'))}
                          for a in t.findall(f'{M}Antwort')],
        }
    return aus


KOPF = '''// Der DIVI-Notarzteinsatzprotokoll-Datensatz, erzeugt aus dem Metamodell.
//
// NICHT VON HAND BEARBEITEN. Quelle ist
//   referenz/naep/naep-metamodell-6.0-1.00-NoVar-01012021.xml
// Neu erzeugen mit
//   python3 werkzeug/naep-katalog-erzeugen.py
//
// Warum erzeugt statt abgeschrieben: Der Datensatz hat ueber vierhundert
// Optionen und eine Verschachtelung, die sich von Hand nicht fehlerfrei
// nachbilden laesst. Jeder Code hier stammt aus der Norm; ein Export traegt
// damit genau die Schluessel, die die DIVI erwartet.

export const NAEP_VERSION = %(version)s
export const NAEP_METAMODELL = '1.0'

/** Eine Angabe im Protokoll. */
export type NaepEingabe =
  | NaepFeld
  | NaepAuswahl
  | NaepAuswahlgruppe
  | NaepFrage
  | NaepFreitext
  | NaepStruktur
  | NaepGruppe
  | NaepOder

/** Was unter einer gewaehlten Option oder einem Feld zusaetzlich erhoben wird. */
export type NaepZusatz = { mehrfach: boolean; kinder: NaepEingabe[] }

/** Eine Angabe, die ausdruecklich nichts aussagt — "keine", "nicht untersucht". */
export type NaepLeer = { code: string; term: string }

export type NaepOption = {
  code: string
  term: string
  /** Punktwert, etwa bei der Glasgow Coma Scale. */
  numerisch?: number
  zusatz?: NaepZusatz
}

export type NaepFeld = {
  art: 'feld'
  code: string
  term: string
  /** Zahl, Text, Zeit oder Datum. */
  typ: string
  einheit?: string
  min?: string
  max?: string
  hinweis?: string
  zusatz?: NaepZusatz
}

export type NaepAuswahl = {
  art: 'auswahl'
  code: string
  term: string
  mehrfach: boolean
  leer: NaepLeer[]
  optionen: NaepOption[]
  sonstiges?: NaepLeer
  zusatz?: NaepZusatz
}

/** Mehrere Auswahlen, die sich eine Optionsliste teilen — etwa Arm links und rechts. */
export type NaepAuswahlgruppe = {
  art: 'auswahlgruppe'
  code: string
  term: string
  auswahlen: NaepLeer[]
  leer: NaepLeer[]
  optionen: NaepOption[]
  zusatz?: NaepZusatz
}

export type NaepFrage = {
  art: 'frage'
  code: string
  term: string
  /** j_opt, j-n, j-n_opt oder j-n-ub. */
  typ: string
  wennJa?: NaepEingabe[]
}

export type NaepFreitext = { art: 'freitext'; code: string }

/** Ein Block mit eigenem Schema: Stammdaten, Einsatzort, Medikation, Erstdiagnosen. */
export type NaepStruktur = {
  art: 'struktur'
  code: string
  term: string
  typ: string
  zusatz?: NaepZusatz
}

export type NaepGruppe = { art: 'gruppe'; code: string; term: string; kinder: NaepEingabe[] }

/** Eine Entweder-oder-Angabe: Alter in Jahren ODER in Tagen. */
export type NaepOder = {
  art: 'oder'
  code: string
  term: string
  leer: NaepLeer[]
  kinder: NaepEingabe[]
}

export type NaepVerlauf = { code: string; leer: NaepLeer[]; spalten: NaepEingabe[] }

export type NaepAbschnitt = {
  code: string
  titel: string
  hinweis?: string
  leer?: NaepLeer[]
  formular?: NaepEingabe[]
  verlauf?: NaepVerlauf
  kinder?: NaepAbschnitt[]
}

/** Welche Antworten ein Fragetyp zulaesst. */
export const NAEP_FRAGETYPEN: Record<string, { optional: boolean; antworten: NaepLeer[] }> =
%(typen)s

export const NAEP_ABSCHNITTE: NaepAbschnitt[] =
%(abschnitte)s
'''

HILFEN = '''

// ── Suchen ───────────────────────────────────────────────────────────────

/** Alle Abschnitte, flach — auch die verschachtelten. */
export function naepAbschnitteFlach(
  abschnitte: NaepAbschnitt[] = NAEP_ABSCHNITTE,
): NaepAbschnitt[] {
  return abschnitte.flatMap((a) => [a, ...naepAbschnitteFlach(a.kinder ?? [])])
}

/** Alle Eingaben einer Liste, flach — auch die aus Zusaetzen, Gruppen und Fragen. */
export function naepEingabenFlach(eingaben: NaepEingabe[]): NaepEingabe[] {
  const aus: NaepEingabe[] = []
  for (const e of eingaben) {
    aus.push(e)
    if ('zusatz' in e && e.zusatz) aus.push(...naepEingabenFlach(e.zusatz.kinder))
    if (e.art === 'gruppe' || e.art === 'oder') aus.push(...naepEingabenFlach(e.kinder))
    if (e.art === 'frage' && e.wennJa) aus.push(...naepEingabenFlach(e.wennJa))
    if (e.art === 'auswahl' || e.art === 'auswahlgruppe') {
      for (const o of e.optionen) if (o.zusatz) aus.push(...naepEingabenFlach(o.zusatz.kinder))
    }
  }
  return aus
}

/** Jede Eingabe des ganzen Protokolls. */
export function naepAlleEingaben(): NaepEingabe[] {
  return naepAbschnitteFlach().flatMap((a) => [
    ...naepEingabenFlach(a.formular ?? []),
    ...naepEingabenFlach(a.verlauf?.spalten ?? []),
  ])
}

/** Eine Eingabe anhand ihres Codes. */
export function naepEingabe(code: string): NaepEingabe | undefined {
  return naepAlleEingaben().find((e) => e.code === code)
}

/** Ein Abschnitt anhand seines Codes. */
export function naepAbschnitt(code: string): NaepAbschnitt | undefined {
  return naepAbschnitteFlach().find((a) => a.code === code)
}

/** Jede Option des Protokolls, mit dem Code der Auswahl, zu der sie gehoert. */
export function naepAlleOptionen(): { auswahl: string; option: NaepOption }[] {
  const aus: { auswahl: string; option: NaepOption }[] = []
  for (const e of naepAlleEingaben()) {
    if (e.art === 'auswahl') for (const o of e.optionen) aus.push({ auswahl: e.code, option: o })
    if (e.art === 'auswahlgruppe') {
      for (const a of e.auswahlen) for (const o of e.optionen) aus.push({ auswahl: a.code, option: o })
    }
  }
  return aus
}
'''


def main():
    r = ET.parse(QUELLE).getroot()
    version = r.find(f'{M}Protokoll').get('version')
    abschnitte = [abschnitt(a) for a in r.find(f'{M}Abschnitte')]
    typen = fragetypen(r)
    ZIEL.parent.mkdir(parents=True, exist_ok=True)
    ZIEL.write_text(
        KOPF % {
            'version': json.dumps(version),
            'typen': json.dumps(typen, ensure_ascii=False, indent=2),
            'abschnitte': json.dumps(abschnitte, ensure_ascii=False, indent=2),
        } + HILFEN,
        encoding='utf-8',
    )
    anzahl = sum(1 for _ in ZIEL.read_text(encoding='utf-8').splitlines())
    print(f'{ZIEL.relative_to(WURZEL)} erzeugt · Protokoll {version} · {anzahl} Zeilen')


if __name__ == '__main__':
    main()
