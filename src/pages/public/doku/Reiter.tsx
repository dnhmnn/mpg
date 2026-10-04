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

export default function Reiter({ staende, aktiv, onWaehlen, beschriftung, schmal, ueberlagernd }: {
  staende: ReiterStand[]
  aktiv?: string
  onWaehlen: (id: string) => void
  beschriftung?: string
  /** Die zweite Reihe: schmaler, weil dort nur Buchstaben stehen. */
  schmal?: boolean
  /**
   * Über den Inhalt ragen statt Platz zu nehmen.
   *
   * Die Leiste bekommt keine Breite im Satz; ihre Zettel ragen nach rechts
   * über die Kante des Kastens. Dadurch bleiben die Felder genauso breit wie
   * ohne die zweite Reihe. Damit nichts darunter verschwindet, liegen sie
   * leicht durchscheinend auf und sind nach links verschoben, sodass sie
   * fast nur den Rand des Kastens überdecken.
   */
  ueberlagernd?: boolean
}) {
  return (
    <nav
      aria-label={beschriftung ?? 'Blöcke des Protokolls'}
      style={{
        position: 'sticky', top: 74, alignSelf: 'flex-start',
        flexShrink: 0,
        ...(ueberlagernd
          ? {
              /*
               * Die ueberlagernde Leiste darf KEIN Scrollbehaelter sein.
               *
               * `overflow-y: auto` zusammen mit `overflow-x: visible` macht
               * CSS stillschweigend zu `auto` in beiden Richtungen — und
               * dann wird alles weggeschnitten, was ueber die null Pixel
               * Breite hinausragt. Also genau die Zettel. Sie standen im
               * Satz an der richtigen Stelle und wurden trotzdem nicht
               * gemalt; eine Messung der Rechtecke merkt davon nichts.
               *
               * Scrollen braucht sie ohnehin nicht: es sind sieben Schritte.
               */
              width: 0,
              marginRight: -10,
              paddingRight: 0,
              // Etwas tiefer anfangen, damit die runde obere Ecke des
              // Kastens frei bleibt — sonst sieht er links eckig aus.
              marginTop: 16,
              overflow: 'visible' as const,
              zIndex: 8,
            }
          : {
              maxHeight: 'calc(100vh - 90px)',
              overflowY: 'auto' as const,
              overflowX: 'hidden' as const,
              paddingRight: 2,
            }),
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
              display: 'block', width: schmal ? 20 : 46, marginBottom: 3,
              padding: schmal ? '8px 1px 7px' : '7px 4px 6px',
              /*
               * Die Lage quer zur Leiste.
               *
               * Links muss Luft zur ersten Reihe bleiben — sonst kleben die
               * beiden aneinander. Rechts darf der Zettel auf den Rand des
               * Kastens ragen, aber nicht auf die Schrift in den Feldern.
               * Die Schrift in den Feldern ist dabei die engere Grenze als
               * die Felder selbst: Eingabekästen haben einen Innenrand von
               * zehn Pixeln, die Beschriftungen darüber keinen. Wer nur auf
               * die Kästen schaut, verdeckt den ersten Buchstaben jeder
               * Beschriftung — genau das ist mir passiert.
               *
               * Mit zwanzig Pixeln Breite und -5 beginnt der Zettel sieben
               * Pixel hinter der ersten Reihe und endet genau dort, wo die
               * Beschriftungen anfangen.
               */
              ...(ueberlagernd ? { marginLeft: -5, opacity: istAktiv ? 1 : 0.9 } : {}),
              /*
               * Am Bildschirmrand: links bündig, rechts gerundet — der
               * Zettel ragt aus dem Rand heraus.
               *
               * Aufliegend: rundum gerundet, denn er ragt aus nichts heraus,
               * sondern liegt auf dem Kasten. Links eckig sähe dort aus wie
               * abgeschnitten.
               */
              borderRadius: ueberlagernd ? 9 : '0 9px 9px 0',
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
