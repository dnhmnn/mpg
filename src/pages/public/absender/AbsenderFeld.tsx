// Wer ein Formular abgibt (Bauplan v2, 4.2, 4.3).
//
// Drei Lagen:
// - angemeldet erkannt (eigenes Telefon): „Du sendest angemeldet als Anna Berg.“
//   und der Textknopf „Anderer Absender“. Kein Passwort, das Token zählt.
// - Modus Passwort, nicht angemeldet: Name mit Prüfzeile und das Passwort
//   direkt darüber, wo gesendet wird. Das Passwortfeld steht nie in einem
//   <form>, hat kein verstecktes Benutzerfeld und `autoComplete="one-time-code"`:
//   auf einem geteilten Tablet soll der Browser es weder anbieten zu speichern
//   noch später für den Nächsten einsetzen.
// - Modus frei: nur der Name.
// - Eigenes Formular mit Vorlage „anonym“: kein Name, kein Passwort, keine Anmeldung;
//   nur der Satz, dass ohne Namen gesendet wird (Plan Vorgänge F6).
//
// Eigene Formulare (`formular="eigen"`) geben `vorlage` und `modus` der Vorlage mit;
// der Modus hat Vorrang vor dem Stand.
//
// Das Passwort lebt nur im Zustand der Maske und im Body des einen Aufrufs.

import { useMemo, useState } from 'react'
import { pb } from '../../../lib/pocketbase'
import { aktuelleTokenId } from '../../../lib/formular/api'
import type { FormularArt, VorlageModus } from '../../../lib/formular/absender'
import type { NamensErgebnis, Stand } from '../../../lib/formular/api'
import NamensFeld from './NamensFeld'
import { ABSENDER_TEXTE as T, andererNameHinweis, istAnonymModus, modusAusStand, nameVergleichsform, sendetAngemeldet } from './texte'

export { absenderAngabe, sendeKnopfText, vorDemSenden } from './texte'

const ROT = 'var(--lbf-akzent)'
const TEXT = 'var(--lbf-text)'
const GRAU = 'var(--warm-gray)'
const LINIE = 'rgba(var(--lbf-rot-rgb),0.14)'

/** Ein Textknopf im LBF-Stil (kursiv, Akzent, ohne Rahmen). */
export function Textknopf({ children, onClick, disabled, farbe }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; farbe?: string }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      style={{
        background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
        color: disabled ? 'rgba(var(--lbf-rot-rgb),0.35)' : (farbe ?? ROT), cursor: disabled ? 'default' : 'pointer', textAlign: 'left',
      }}
    >
      {children}
    </button>
  )
}

/**
 * Das Passwortfeld (4.2): nie in einem <form>, nie gespeichert, `name` zufällig je Einhängen.
 * `hinweisText`: der Satz darunter (Vorgabe „Das Passwort bestätigt, dass du abgibst …“).
 */
export function PasswortFeld({ wert, onWert, label, hinweis = true, hinweisText, onEnter }: { wert: string; onWert: (pw: string) => void; label: string; hinweis?: boolean; hinweisText?: string; onEnter?: () => void }) {
  const name = useMemo(() => `bestaetigung-${Math.random().toString(36).slice(2, 10)}`, [])
  return (
    <div style={{ marginTop: 10 }}>
      <label htmlFor={name} style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: GRAU, marginBottom: 4 }}>
        {label}
      </label>
      <input
        id={name} name={name} type="password" value={wert}
        onChange={(e) => onWert(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter?.() } }}
        autoComplete="one-time-code" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        style={{ width: '100%', padding: '9px 10px', background: 'var(--lbf-input-bg)', border: `0.5px solid ${LINIE}`, borderRadius: 8, fontFamily: 'inherit', fontSize: 16, color: TEXT, boxSizing: 'border-box' }}
      />
      {hinweis ? (
        <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, marginTop: 4, lineHeight: 1.4 }}>{hinweisText ?? T.passwortHinweis}</div>
      ) : null}
    </div>
  )
}

/**
 * „Abmelden“ nach dem Senden auf einer öffentlichen Seite (4.2, Befund 23): wer auf
 * einem fremden Gerät angemeldet gesendet hat, meldet sich hier wieder ab. Entfernt
 * nur die Anmeldung. Nicht `useAuth().logout`: das leitet nach /login um und leert
 * den ganzen Speicher samt Warteschlange, in der gerade abgelegte Formulare
 * anderer warten können. Erscheint nur mit gültiger Sitzung oder direkt danach.
 */
export function AbmeldenNachSenden({ abstand = 14 }: { abstand?: number }) {
  const [abgemeldet, setAbgemeldet] = useState(false)
  if (!abgemeldet && !aktuelleTokenId()) return null
  return (
    <div style={{ marginTop: abstand, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
      {abgemeldet ? (
        <div style={{ fontSize: 12, fontStyle: 'italic', color: GRAU, lineHeight: 1.45 }}>{T.abgemeldet}</div>
      ) : (
        <>
          <div style={{ fontSize: 12, fontStyle: 'italic', color: GRAU, lineHeight: 1.45, marginBottom: 4 }}>{T.abmeldenHinweis}</div>
          <Textknopf onClick={() => { try { pb.authStore.clear() } catch { /* schon abgemeldet */ } setAbgemeldet(true) }}>{T.abmelden}</Textknopf>
        </>
      )}
    </div>
  )
}

/**
 * Steht im Feld der Name der Person, die auf diesem Gerät angemeldet ist? Dann gibt ihn
 * „Anderer Absender“ nicht ab (Befund Client-Abläufe 9). Gibt den Namen zurück, sonst ''.
 */
function kontoNameImFeld(name: string): string {
  const feld = String(name ?? '').trim()
  if (!feld) return ''
  let konto = ''
  try {
    const r = (pb.authStore.isValid ? (pb.authStore.record ?? pb.authStore.model) : null) as { name?: unknown } | null
    konto = typeof r?.name === 'string' ? r.name.trim() : ''
  } catch { /* keine Sitzung */ }
  return konto && nameVergleichsform(konto) === nameVergleichsform(feld) ? feld : ''
}

export default function AbsenderFeld(p: {
  orgCode: string
  formular: FormularArt
  /** Nur eigene Formulare: Kennung der Vorlage (für die Namensprüfung am Server). */
  vorlage?: string
  /** Nur eigene Formulare: Absender der Vorlage; Vorrang vor dem Stand. */
  modus?: VorlageModus
  stand: Stand | null
  alterServer: boolean
  name: string
  /** Fehlt: Name nur Anzeige (Doku: aus dem Feld Unterschrift). */
  onName?: (n: string) => void
  passwort: string
  onPasswort: (pw: string) => void
  anderer: boolean
  onAnderer: (v: boolean) => void
  /** Beschriftung des Namensfelds (Vorgabe „Dein Name“). */
  nameLabel?: string
  /** Woher der Name kommt, wenn `onName` fehlt (Vorgabe „Unterschrift“). */
  nameHerkunft?: string
  /** Ergebnis der Namensprüfung (für die Maske). */
  onNamensErgebnis?: (r: NamensErgebnis | null) => void
  /** Enter im Passwortfeld sendet. */
  onSenden?: () => void
  /**
   * Modus Passwort ohne Anmeldung: „Kein Passwort zur Hand? Auf dem Gerät ablegen“ (Befund
   * Client-Abläufe 5). Die Maske prüft ihre Angaben und legt ohne Passwort ab; die Karte der
   * Warteschlange fragt weiter und bietet bei eindeutigem Namen „Ohne Passwort senden“.
   */
  onAblegen?: () => void
  /** Doku: zum Feld, aus dem der Name kommt (Feld Unterschrift), etwa nach „Anderer Absender“. */
  onZumNamen?: () => void
}) {
  const { stand, anderer } = p
  const anonym = istAnonymModus(p.formular, p.modus)
  const angemeldet = sendetAngemeldet(stand, anderer, p.modus)
  const modus = modusAusStand(stand, p.formular, p.modus)
  const zeigePasswort = !angemeldet && !p.alterServer && modus === 'passwort'
  // „Doch angemeldet senden“ nur, wenn dieses Gerät eine gültige Sitzung hat
  const hatSitzung = anderer && aktuelleTokenId() !== ''
  // Öffentlicher Link aus (hidden_forms): ohne Anmeldung nimmt der Server nichts an
  const nurAngemeldet = stand?.formulare?.[p.formular]?.oeffentlich === false
  // Doku: der Name kommt aus dem Feld Unterschrift; steht dort ein anderer als der Kontoname, sagen wir es
  const andererName = !p.onName ? andererNameHinweis({ stand, anderer, name: p.name, herkunft: p.nameHerkunft ?? 'Unterschrift' }) : ''
  // „Anderer Absender“ in der Doku, aber im Feld steht noch der Name der angemeldeten Person
  const nochKontoName = !p.onName && anderer ? kontoNameImFeld(p.name) : ''

  if (anonym) {
    return (
      <div style={{ marginTop: 4, marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: ROT, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>
          {T.abschnitt}
        </div>
        <div style={{ fontSize: 13, color: GRAU, lineHeight: 1.45 }}>{T.anonymHinweis}</div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 4, marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: ROT, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>
        {T.abschnitt}
      </div>

      {angemeldet ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 12px' }}>
          <div style={{ fontSize: 13, fontStyle: 'italic', color: GRAU, lineHeight: 1.45 }}>
            {T.angemeldetVor}{' '}
            <span style={{ fontStyle: 'italic', fontWeight: 700, color: TEXT }}>{stand!.angemeldet!.name || 'deinem Konto'}</span>.
          </div>
          {!nurAngemeldet ? (
            <Textknopf onClick={() => { p.onPasswort(''); p.onAnderer(true) }}>{T.andererAbsender}</Textknopf>
          ) : null}
          {andererName ? (
            <div role="status" style={{ flexBasis: '100%', marginTop: 4, padding: '8px 11px', background: 'var(--lbf-warn-grund)', border: '0.5px solid #fde047', borderRadius: 8, fontSize: 12, fontStyle: 'italic', color: 'var(--lbf-warn-text)', lineHeight: 1.45 }}>
              {andererName}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {p.onName ? (
            <NamensFeld
              orgCode={p.orgCode} formular={p.formular} vorlage={p.vorlage} wert={p.name} onWert={p.onName}
              zweck="absender" modus={modus} mitAnmeldung={false}
              label={p.nameLabel ?? 'Dein Name'} platzhalter="Vor- und Nachname, wie in Responda"
              onErgebnis={(r) => p.onNamensErgebnis?.(r)} dicht
            />
          ) : (
            <div>
              <div style={{ fontSize: 13, fontStyle: 'italic', color: GRAU, lineHeight: 1.45 }}>
                Absender:{' '}
                <span style={{ fontWeight: p.name.trim() ? 700 : 400, color: p.name.trim() ? TEXT : GRAU }}>
                  {T.ausFeld(p.name.trim(), p.nameHerkunft ?? 'Unterschrift')}
                </span>
              </div>
              {nochKontoName ? (
                <div role="status" style={{ marginTop: 6, padding: '8px 11px', background: 'var(--lbf-warn-grund)', border: '0.5px solid #fde047', borderRadius: 8, fontSize: 12, fontStyle: 'italic', color: 'var(--lbf-warn-text)', lineHeight: 1.45 }}>
                  {T.nochKontoName(nochKontoName, p.nameHerkunft ?? 'Unterschrift')}
                </div>
              ) : null}
              {p.onZumNamen && (!p.name.trim() || nochKontoName) ? (
                <div style={{ marginTop: 6 }}>
                  <Textknopf onClick={p.onZumNamen}>{T.zumFeld(p.nameHerkunft ?? 'Unterschrift')}</Textknopf>
                </div>
              ) : null}
              {p.name.trim() ? (
                <NamensFeld
                  orgCode={p.orgCode} formular={p.formular} vorlage={p.vorlage} wert={p.name} onWert={() => {}}
                  zweck="absender" modus={modus} mitAnmeldung={false} label="" nurLesen nurZeile dicht
                  onErgebnis={(r) => p.onNamensErgebnis?.(r)}
                />
              ) : null}
            </div>
          )}
          {p.alterServer ? (
            <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, marginTop: 6, lineHeight: 1.4 }}>{T.alterServer}</div>
          ) : null}
          {zeigePasswort ? (
            <PasswortFeld wert={p.passwort} onWert={p.onPasswort} label={T.passwortLabel} onEnter={p.onSenden} />
          ) : null}
          {zeigePasswort && p.onAblegen ? (
            <div style={{ marginTop: 8 }}>
              <Textknopf onClick={() => { p.onPasswort(''); p.onAblegen!() }}>{T.ablegenOhnePasswort}</Textknopf>
              <div style={{ fontSize: 11, fontStyle: 'italic', color: GRAU, marginTop: 3, lineHeight: 1.4 }}>{T.ohnePasswortAusweg}</div>
            </div>
          ) : null}
          {hatSitzung ? (
            <div style={{ marginTop: 8 }}>
              <Textknopf onClick={() => { p.onPasswort(''); p.onAnderer(false) }}>{T.dochAngemeldet}</Textknopf>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
