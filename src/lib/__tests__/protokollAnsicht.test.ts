import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import DokuProtokollView from '../../components/DokuProtokollView'
import { AELRD_ABSCHNITTE, aelrdFeld } from '../../katalog/aelrd'
import { istSpiegelFeld } from '../../katalog/aelrdSpiegel'
import { zettelMitFeldern } from '../../pages/public/doku/zettel'

/**
 * Die Ansicht geht die Zettel durch. Dieser Prüffall hält fest, dass dabei
 * nichts liegen bleibt — denn genau das ist der Grund, warum sie existiert:
 * ein Feld, das die Maske erhebt und die Ansicht nicht zeigt, wäre erfasst
 * und unsichtbar.
 */
describe('Die Ansicht in der Gliederung der Maske', () => {
  const zettel = zettelMitFeldern()
  const gezeigt = new Set(zettel.flatMap((z) => z.felder).map((f) => f.id))

  it('zeigt jedes Feld des Bogens', () => {
    const imBogen = AELRD_ABSCHNITTE
      .flatMap((a) => a.felder)
      .filter((id) => !istSpiegelFeld(id))
      .filter((id) => aelrdFeld(id))
    const fehlt = imBogen.filter((id) => !gezeigt.has(id))
    expect(fehlt).toEqual([])
  })

  it('zeigt sie in der Reihenfolge der Maske, nicht des Papiers', () => {
    // Darum geht es: wer die Maske kennt, findet hier dasselbe an derselben
    // Stelle. Der Erstbefund steht deshalb nach xABCDE.
    const befund = zettel.find((z) => z.id === 'befund')!
    expect(befund.teile.map((t) => t.kennung || t.kurz)).toEqual(['Z', 'x', 'A', 'B', 'C', 'D', 'E'])
  })

  it('führt dieselben elf Zettel wie die Maske', () => {
    expect(zettel.map((z) => z.kurz)).toEqual([
      'PAT', 'EINS', 'ZEIT', 'ANAM', 'BEF', 'VITAL', 'DIAG', 'MASS', 'VERL', 'ÜBER', 'ENDE',
    ])
  })

  it('führt kein Feld zweimal', () => {
    // Doppelt gezeigt hieße: zweimal geändert, und beim zweiten Mal gewinnt
    // der Zufall.
    const alle = zettel.flatMap((z) => z.felder).map((f) => f.id)
    expect(alle.filter((id, i) => alle.indexOf(id) !== i)).toEqual([])
  })
})

describe('Was die Ansicht aus einem Protokoll macht', () => {
  const payload = {
    name: 'Mustermann', vorname: 'Erika', einsatz_nr: '2026-0815',
    einsatz_art: 'Primäreinsatz', zeit_alarm: '13:02',
    mannschaft_tf: 'A. Berger', mannschaft: { tf: { id: 'u1', name: 'A. Berger' } },
    notfallgeschehen: 'Thoraxschmerz seit 40 Minuten.',
    atemwege: 'frei', radialispuls: 'ja', rekap_zeit: 'unter_2_s',
    gcs_summe: '15', af: '16', spo2: '96', hf: '88',
    tracerdiagnose: 'STEMI', fuehrende_diagnose: 'Herz-Kreislauf',
    medizintechnik: ['spritzenpumpe_n'],
    massnahmen: [{ id: 'm1', zeit: '13:20', kategorie: 'medizintechnik', art: 'spritzenpumpe_n', grund: 'notsang_2a', durch: 'tf' }],
    verlauf: [{ id: 'v1', zeit: '13:30', werte: { spo2: '96', hf: '88' } }],
    unterschrift: 'A. Berger',
    irgendwas_altes: 'Wert aus einem alten Formular',
  }

  const html = () => renderToStaticMarkup(React.createElement(DokuProtokollView, { payload }))

  it('zeigt alle elf Zettel mit ihren Überschriften', () => {
    const h = html()
    for (const titel of zettelMitFeldern().map((z) => z.titel)) {
      expect(h, `${titel} fehlt`).toContain(titel)
    }
  })

  it('zeigt die Schritte des xABCDE', () => {
    const h = html()
    expect(h).toContain('Kritische Blutung')
    expect(h).toContain('Entkleiden, Schmerz, Verletzungen')
  })

  it('zeigt die eingetragenen Werte', () => {
    const h = html()
    for (const wert of ['Mustermann', 'Erika', '2026-0815', 'STEMI', 'A. Berger', '13:02']) {
      expect(h, `${wert} fehlt`).toContain(wert)
    }
  })

  it('zeigt Auswahlen im Wortlaut, nicht als Schlüssel', () => {
    const h = html()
    expect(h).toContain('Spritzenpumpe(n)')
    expect(h).not.toContain('spritzenpumpe_n')
    expect(h).toContain('&lt; 2 s')
    expect(h).not.toContain('unter_2_s')
  })

  it('zeigt die Maßnahmen mit Grund und wer sie gemacht hat', () => {
    const h = html()
    expect(h).toContain('13:20')
    expect(h).toContain('NotSanG § 2a')
    expect(h).toContain('durch A. Berger')
  })

  it('zeigt die Messungen des Verlaufs', () => {
    expect(html()).toContain('SpO₂ 96')
  })

  it('verschweigt nichts — Unbekanntes steht unter "Weitere Angaben"', () => {
    // Das ist der Grund für den Abschnitt: ein Schlüssel aus einem älteren
    // Formular soll sichtbar sein, nicht verschluckt.
    const h = html()
    expect(h).toContain('Weitere Angaben')
    expect(h).toContain('irgendwas_altes')
    expect(h).toContain('Wert aus einem alten Formular')
  })

  it('schweigt über das, was an eigener Stelle steht', () => {
    // Die Besatzung steht als Zeile da, nicht roh unter "Weitere Angaben".
    const h = renderToStaticMarkup(React.createElement(DokuProtokollView, {
      payload: { mannschaft: { tf: { id: 'u1', name: 'A. Berger' } }, frist: '2026-10-07T13:00:00Z' },
    }))
    expect(h).not.toContain('Weitere Angaben')
  })
})
