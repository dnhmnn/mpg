// Selbsttest der GS1-Auswertung mit echten Code-Aufbauten.
// Aufrufbar per vite-node; hält die Auswertung nachweisbar korrekt.

import { GS, parseGs1, normalizeGtin, sameCode } from './gs1'

export interface TestErgebnis { name: string; ok: boolean; erwartet: string; erhalten: string }

function eq(name: string, erhalten: any, erwartet: any): TestErgebnis {
  const e = JSON.stringify(erwartet), h = JSON.stringify(erhalten)
  return { name, ok: e === h, erwartet: e, erhalten: h }
}

export function laufeGs1Selbsttest(): TestErgebnis[] {
  const r: TestErgebnis[] = []

  // (01) GTIN + (17) MHD + (10) LOT — feste Längen zuerst, LOT variabel am Ende
  let d = parseGs1('010345312000001117191125' + '10ABC1234')
  r.push(eq('GTIN aus (01)', d?.gtin, '03453120000011'))
  r.push(eq('MHD aus (17) 191125', d?.expiry, '2019-11-25'))
  r.push(eq('LOT aus (10) am Stringende', d?.lot, 'ABC1234'))

  // Variables Feld VOR weiterem Kennzeichen -> Trennzeichen nötig
  d = parseGs1('0104012345678901' + '10LOT-77' + GS + '17270331')
  r.push(eq('LOT vor Trennzeichen', d?.lot, 'LOT-77'))
  r.push(eq('MHD nach Trennzeichen', d?.expiry, '2027-03-31'))
  r.push(eq('GTIN daneben unversehrt', d?.gtin, '04012345678901'))

  // TT = 00 bedeutet Monatsende (hier: März 2027 -> 31.)
  d = parseGs1('010401234567890117270300')
  r.push(eq('TT=00 -> Monatsende März', d?.expiry, '2027-03-31'))
  d = parseGs1('010401234567890117280200')
  r.push(eq('TT=00 -> Schaltjahr Februar 2028', d?.expiry, '2028-02-29'))

  // Symbologie-Kennung und führendes Trennzeichen dürfen nicht stören
  d = parseGs1(']d2' + '0104012345678901' + '10XY9')
  r.push(eq('Symbologie-Kennung ]d2 abgeschnitten', d?.lot, 'XY9'))
  d = parseGs1(GS + '0104012345678901' + '10XY9')
  r.push(eq('führendes Trennzeichen ignoriert', d?.gtin, '04012345678901'))

  // Seriennummer (21)
  d = parseGs1('0104012345678901' + '21SN-0001' + GS + '10L5')
  r.push(eq('Seriennummer aus (21)', d?.serial, 'SN-0001'))
  r.push(eq('LOT nach Seriennummer', d?.lot, 'L5'))

  // Ein gewöhnlicher EAN-13 ist KEIN GS1-Element-String
  r.push(eq('EAN-13 wird nicht als GS1 gedeutet', parseGs1('4012345678901'), null))
  r.push(eq('Leerstring ergibt null', parseGs1(''), null))
  r.push(eq('Unsinn ergibt null', parseGs1('HALLO WELT'), null))

  // GTIN-Normalisierung und Abgleich EAN-13 <-> GTIN-14
  r.push(eq('EAN-13 auf 14 Stellen', normalizeGtin('4012345678901'), '04012345678901'))
  r.push(eq('GTIN-14 bleibt', normalizeGtin('04012345678901'), '04012345678901'))
  r.push(eq('EAN-8 auf 14 Stellen', normalizeGtin('40123456'), '0000000040123456'.slice(-14)))
  r.push(eq('Abgleich EAN-13 == GTIN-14', sameCode('4012345678901', '04012345678901'), true))
  r.push(eq('Abgleich verschiedener Produkte', sameCode('4012345678901', '4098765432109'), false))
  r.push(eq('Abgleich identischer Zeichenketten', sameCode('LAGER-XY', 'LAGER-XY'), true))
  r.push(eq('kein Fehltreffer bei Freitext', sameCode('ABC', 'XYZ'), false))

  return r
}
