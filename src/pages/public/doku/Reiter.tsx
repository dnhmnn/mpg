// Die Reiter am linken Rand — wie Zettel, die seitlich aus einer Mappe ragen.
//
// Sie tun zweierlei zugleich. Erstens springt man mit einem Tipp in den Block,
// statt durch zehn Bildschirmhöhen zu scrollen. Zweitens — und das ist der
// eigentliche Zweck — sieht man an der Farbe, wo noch etwas fehlt, ohne
// hinzugehen.
//
// VIER ZUSTÄNDE, und sie sagen verschiedene Dinge:
//
//   rot      in diesem Block ist ein Pflichtfeld offen
//   grün     alle Pflichtfelder dieses Blocks sind ausgefüllt
//   gefüllt  keine Pflichtfelder, aber es wurde etwas eingetragen
//   leer     keine Pflichtfelder, nichts eingetragen
//
// Die Unterscheidung ist nötig, weil nur sieben der einundzwanzig Blöcke
// überhaupt Pflichtfelder führen. Alles grün zu färben, was keine hat, würde
// eine Vollständigkeit behaupten, die niemand geprüft hat.

export type ReiterStand = {
  id: string
  kurz: string
  titel: string
  /** Pflichtfelder des Blocks, die noch leer sind. */
  pflichtOffen: number
  /** Pflichtfelder insgesamt. */
  pflichtGesamt: number
  /** Ausgefüllte Felder insgesamt. */
  gefuellt: number
}

const ROT = '#600812'
const TEXT = '#1a0e08'
const GRAU = 'var(--warm-gray)'
const GRUEN = '#16a34a'
const WARN = '#dc2626'

export type Ampel = 'offen' | 'fertig' | 'angefasst' | 'leer'

export function ampel(r: ReiterStand): Ampel {
  if (r.pflichtGesamt > 0) return r.pflichtOffen > 0 ? 'offen' : 'fertig'
  return r.gefuellt > 0 ? 'angefasst' : 'leer'
}

const FARBE: Record<Ampel, { rand: string; grund: string; schrift: string }> = {
  offen: { rand: WARN, grund: '#fef2f2', schrift: TEXT },
  fertig: { rand: GRUEN, grund: '#f0fdf4', schrift: TEXT },
  angefasst: { rand: 'rgba(96,8,18,0.45)', grund: '#fff', schrift: TEXT },
  leer: { rand: 'rgba(96,8,18,0.12)', grund: '#fff', schrift: GRAU },
}

export default function Reiter({ staende, aktiv, onWaehlen, beschriftung, schmal }: {
  staende: ReiterStand[]
  aktiv?: string
  onWaehlen: (id: string) => void
  beschriftung?: string
  /** Die zweite Reihe: schmaler, weil dort nur Buchstaben stehen. */
  schmal?: boolean
}) {
  return (
    <nav
      aria-label={beschriftung ?? 'Blöcke des Protokolls'}
      style={{
        position: 'sticky', top: 74, alignSelf: 'flex-start',
        maxHeight: 'calc(100vh - 90px)', overflowY: 'auto', overflowX: 'hidden',
        flexShrink: 0, paddingRight: 2,
      }}
    >
      {staende.map((r) => {
        const a = ampel(r)
        const f = FARBE[a]
        const istAktiv = aktiv === r.id
        return (
          <button
            key={r.id} type="button" onClick={() => onWaehlen(r.id)}
            title={`${r.titel}${r.pflichtGesamt > 0 ? ` — ${r.pflichtOffen} von ${r.pflichtGesamt} Pflichtfeldern offen` : ''}`}
            style={{
              display: 'block', width: schmal ? 28 : 46, marginBottom: 3,
              padding: schmal ? '8px 3px 7px' : '7px 4px 6px',
              // Links bündig, rechts gerundet: der Zettel ragt aus dem Rand.
              borderRadius: '0 9px 9px 0',
              background: istAktiv ? ROT : f.grund,
              color: istAktiv ? '#fff' : f.schrift,
              border: `0.5px solid ${istAktiv ? ROT : 'rgba(96,8,18,0.12)'}`,
              borderLeft: `4px solid ${istAktiv ? '#fff' : f.rand}`,
              boxShadow: istAktiv ? 'none' : '1px 1px 3px rgba(0,0,0,0.06)',
              fontFamily: 'inherit', fontSize: schmal ? 11 : 8.5, fontWeight: 700,
              letterSpacing: schmal ? 0 : '0.02em', cursor: 'pointer',
              textAlign: schmal ? 'center' : 'left', lineHeight: 1.15,
            }}
          >
            {r.kurz}
            {/* In der schmalen Reihe traegt die Farbe die Aussage; eine
                Zahl daneben passte nicht und waere ohnehin kaum zu lesen. */}
            {schmal ? null : <span style={{
              display: 'block', marginTop: 2, fontSize: 8, fontWeight: 400, fontStyle: 'italic',
              color: istAktiv ? 'rgba(255,255,255,0.8)' : GRAU,
            }}>
              {r.pflichtGesamt > 0
                ? (r.pflichtOffen > 0 ? `${r.pflichtOffen} offen` : 'fertig')
                : (r.gefuellt > 0 ? `${r.gefuellt}` : '–')}
            </span>}
          </button>
        )
      })}
    </nav>
  )
}
