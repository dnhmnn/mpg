// Farbe oben für Seiten mit dunkelrotem Kopf (useStatusleiste): Browser und App vom Homebildschirm.
import { describe, expect, it } from 'vitest'
import { statusleistenFarben } from '../../hooks/useStatusleiste'

describe('statusleistenFarben', () => {
  it('statische Seite im Browser: theme-color rot, html und body hell', () => {
    expect(statusleistenFarben({ statisch: true, oben: true, homebildschirm: false })).toEqual({ leiste: 'kopf', grund: 'blatt' })
    expect(statusleistenFarben({ statisch: true, oben: false, homebildschirm: false })).toEqual({ leiste: 'kopf', grund: 'blatt' })
  })

  it('statische Seite als App vom Homebildschirm: html und body rot (iOS 26 färbt den Rand danach)', () => {
    expect(statusleistenFarben({ statisch: true, oben: true, homebildschirm: true })).toEqual({ leiste: 'kopf', grund: 'kopf' })
    expect(statusleistenFarben({ statisch: true, oben: false, homebildschirm: true })).toEqual({ leiste: 'kopf', grund: 'kopf' })
  })

  it('rollende Seite: rot, solange der Kopf zu sehen ist, danach hell, im Browser wie als App', () => {
    for (const homebildschirm of [false, true]) {
      expect(statusleistenFarben({ statisch: false, oben: true, homebildschirm })).toEqual({ leiste: 'kopf', grund: 'kopf' })
      expect(statusleistenFarben({ statisch: false, oben: false, homebildschirm })).toEqual({ leiste: 'blatt', grund: 'blatt' })
    }
  })
})
