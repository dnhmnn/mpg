// Aufklärung und Einwilligung — die rechtliche Dokumentation der Maßnahmen.
//
// Im Bogen gibt es dafür keine eigene Zeile. Der Text steht, wie die
// Begründungen der Maßnahmen, unter "ÄLRD Delegationen" — und entsteht aus
// den Feldern der Maske, nicht aus einer zweiten Eingabe.

const EINWILLIGUNG: Record<string, string> = {
  alle: 'in alle Maßnahmen',
  nur_folgende: 'nur in folgende Maßnahmen',
  mutmasslich: 'mutmaßliche Einwilligung gem. § 630d; 677 BGB',
}

function text(p: Record<string, unknown>, id: string): string {
  const v = p[id]
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Die Aufklärung und die Einwilligung als Text für den Bogen.
 *
 * Jede Angabe erscheint, sobald sie da ist — auch ohne die andere. Eine
 * Uhrzeit ohne Wahl und eine Wahl ohne Uhrzeit sind beide ein Befund, den
 * der Bogen zeigen muss, statt ihn zu verschlucken.
 */
export function evmText(p: Record<string, unknown>): string {
  const teile: string[] = []
  const aufgeklaert = text(p, 'evm_aufgeklaert')
  const aufZeit = text(p, 'evm_aufklaerung_zeit')
  if (aufgeklaert || aufZeit) {
    teile.push('Aufklärung über alle Maßnahmen'
      + (aufgeklaert ? `: ${aufgeklaert}` : '')
      + (aufZeit ? `, ${aufZeit}` : ''))
  }
  const einw = text(p, 'evm_einwilligung')
  const einwZeit = text(p, 'evm_einwilligung_zeit')
  if (einw || einwZeit) {
    teile.push('Einwilligung'
      + (EINWILLIGUNG[einw] ? `: ${EINWILLIGUNG[einw]}` : '')
      + (einwZeit ? `, ${einwZeit}` : ''))
  }
  const folgende = text(p, 'evm_einwilligung_folgende')
  if (folgende) teile.push(`nur folgende Maßnahmen: ${folgende}`)
  return teile.join(' · ')
}
