// Was der gedruckte Bogen zweimal fragt.
//
// Der ÄLRD-Bogen ist ein amtlicher Vordruck; seine Kästchen lassen sich nicht
// entfernen. Drei Angaben stehen auf dem Papier an zwei Stellen — wer ihn von
// Hand ausfüllt, schreibt denselben Wert zweimal hin. In der App ist das
// unnötig und fehleranfällig: zwei Felder für dieselbe Sache gehen irgendwann
// auseinander, und dann steht im Protokoll zweimal etwas Verschiedenes.
//
// Deshalb wird jede dieser Angaben genau einmal erfasst. Beim Drucken werden
// beide Kästchen des Bogens aus derselben Quelle gefüllt — das Papier sieht
// aus wie immer, die Daten gibt es nur einmal.
//
// WELCHE SEITE DIE QUELLE IST, entscheidet die Norm: sie führt für jede der
// drei Angaben genau ein Feld, und das Formular erhebt sie dort, wo die Norm
// sie einordnet. Nur beim ROSC-Zeitpunkt weicht das ab — dazu unten.

export type Spiegelung = {
  /** Wo die Angabe erfasst wird. */
  quelle: string
  /** Das zweite Kästchen des Bogens, das dasselbe zeigt. */
  spiegel: string
  /** Bei einer Option: ihr Speicherwert. Fehlt bei ganzen Feldern. */
  option?: string
  grund: string
}

export const AELRD_SPIEGELUNGEN: Spiegelung[] = [
  {
    quelle: 'rosc_zeit',
    spiegel: 'rosc_1',
    grund:
      'Der Bogen fragt den ROSC-Zeitpunkt im Reanimationsblock ("Zeitpunkt ROSC") ' +
      'und noch einmal bei den Defibrillationszeiten ("1. ROSC"). Die Norm hat ' +
      'dafür ein Feld (JDN). Erfasst wird im Reanimationsblock, wo die Besatzung ' +
      'den Kreislaufstillstand dokumentiert.',
  },
  {
    quelle: 'sonstige_massnahme',
    option: 'entlastungspunktion',
    spiegel: 'atemweg_massnahme',
    grund:
      'Die Entlastungspunktion steht auf dem Bogen unter "Atemweg" und unter ' +
      '"Sonstige". Die Norm führt sie einmal, als Nadeldekompression unter den ' +
      'sonstigen Maßnahmen (JJV/JMG).',
  },
  {
    quelle: 'rea_massnahme',
    option: 'mechanische_thoraxkompression',
    spiegel: 'medizintechnik',
    grund:
      'Die mechanische Thoraxkompression steht auf dem Bogen unter "Reanimation" ' +
      'und unter "Medizintechnik". Die Norm führt sie einmal, unter der ' +
      'Herzdruckmassage (JF0/JFE).',
  },
]

const feldSpiegel = new Map<string, Spiegelung>()
const optionSpiegel = new Map<string, Spiegelung>()
for (const s of AELRD_SPIEGELUNGEN) {
  if (s.option) optionSpiegel.set(`${s.spiegel}.${s.option}`, s)
  else feldSpiegel.set(s.spiegel, s)
}

/** Zeigt dieses Feld nur, was anderswo erfasst wird? */
export function istSpiegelFeld(id: string): Spiegelung | undefined {
  return feldSpiegel.get(id)
}

/** Zeigt diese Option nur, was anderswo erfasst wird? */
export function istSpiegelOption(feldId: string, wert: string): Spiegelung | undefined {
  return optionSpiegel.get(`${feldId}.${wert}`)
}

function alsListe(wert: unknown): string[] {
  if (Array.isArray(wert)) return wert.map(String)
  if (wert === undefined || wert === null || wert === '') return []
  return [String(wert)]
}

/**
 * Die gespiegelten Kästchen für den Ausdruck füllen.
 *
 * Nur für den Druck: in den gespeicherten Daten bleibt jede Angabe einmal.
 * Ein bereits gesetzter Wert wird nicht überschrieben — alte Protokolle, die
 * beide Felder getrennt führen, drucken weiter so, wie sie erfasst wurden.
 */
export function spiegelAnwenden(payload: Record<string, unknown>): Record<string, unknown> {
  const aus: Record<string, unknown> = { ...payload }
  for (const s of AELRD_SPIEGELUNGEN) {
    if (s.option) {
      if (!alsListe(aus[s.quelle]).includes(s.option)) continue
      const vorhanden = alsListe(aus[s.spiegel])
      if (!vorhanden.includes(s.option)) aus[s.spiegel] = [...vorhanden, s.option]
    } else {
      const wert = aus[s.quelle]
      const leer = aus[s.spiegel] === undefined || aus[s.spiegel] === null || aus[s.spiegel] === ''
      if (leer && wert !== undefined && wert !== null && wert !== '') aus[s.spiegel] = wert
    }
  }
  return aus
}
