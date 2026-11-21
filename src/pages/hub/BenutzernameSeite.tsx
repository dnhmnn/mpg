// Benutzername (/hub?seite=benutzername, aus Profil im Hub): Jede Person legt selbst einen Benutzernamen
// fest und meldet sich damit statt mit der E-Mail-Adresse an (Owner, 21.11.2026). Prüfen und Fehlertexte
// in src/lib/benutzername.ts; auf dem Server Feld users.username, siehe docs/pocketbase-regeln.md.
import { useEffect, useState } from 'react'
import { pb } from '../../lib/pocketbase'
import { isPlaceholderEmail } from '../../lib/apps'
import { automatisch, pruefen, speicherFehler, uebernommen, MAX } from '../../lib/benutzername'
import { Feld, Hinweis, Leiste, Seite } from '../benutzer/bausteine'
import type { User } from '../../types'

type Stand = { art: 'ok' | 'fehler'; text: string } | null

export default function BenutzernameSeite({ user, orgName, schliessen, aktualisieren }: {
  user: User | null
  orgName: string
  schliessen: () => void
  /** Liest das Konto neu (useAuth().refresh), damit Hub und Profil den neuen Namen kennen. */
  aktualisieren: () => Promise<void> | void
}) {
  const bisher = typeof user?.username === 'string' ? user.username : ''
  const [eingabe, setEingabe] = useState(bisher)
  const [gespeichert, setGespeichert] = useState(bisher)
  const [laeuft, setLaeuft] = useState(false)
  const [stand, setStand] = useState<Stand>(null)
  // Neu gelesenes Konto: übernehmen, ohne eine angefangene Eingabe zu überschreiben
  useEffect(() => {
    setEingabe((e) => (e === gespeichert ? bisher : e))
    setGespeichert(bisher)
  }, [bisher]) // eslint-disable-line react-hooks/exhaustive-deps
  // Ohne echte E-Mail-Adresse ist der Benutzername der einzige Weg zur Anmeldung: nicht entfernen
  const ohneEmail = isPlaceholderEmail(user?.email)

  const p = pruefen(eingabe)
  // Ein alter Name mit Großbuchstaben („MaxMuster“) gilt erst als geändert, wenn die Person etwas tippt
  const geaendert = p.wert !== gespeichert && eingabe.trim() !== gespeichert
  const entfernenGesperrt = ohneEmail && !p.wert && !!gespeichert

  async function speichern() {
    if (!user || laeuft || p.fehler || !geaendert || entfernenGesperrt) return
    setLaeuft(true)
    setStand(null)
    try {
      const antwort = await pb.collection('users').update(user.id, { username: p.wert }) as unknown as Record<string, unknown>
      const ok = uebernommen(antwort, p.wert)
      if (ok === 'nicht_eingerichtet') {
        setStand({ art: 'fehler', text: 'Auf dem Server sind Benutzernamen noch nicht eingerichtet. Bitte der Leitung deiner Organisation Bescheid geben.' })
      } else {
        const jetzt = typeof antwort.username === 'string' ? antwort.username : ''
        setGespeichert(jetzt)
        setEingabe(jetzt)
        setStand({ art: 'ok', text: jetzt ? `Gespeichert. Du kannst dich jetzt mit „${jetzt}“ und deinem Passwort anmelden.` : 'Benutzername entfernt. Du meldest dich mit deiner E-Mail-Adresse an.' })
        await aktualisieren()
      }
    } catch (err) {
      setStand({ art: 'fehler', text: speicherFehler(err) })
    } finally {
      setLaeuft(false)
    }
  }

  const unten = p.fehler ? 'Bitte zuerst den Namen anpassen'
    : entfernenGesperrt ? 'Ohne E-Mail-Adresse brauchst du ihn zum Anmelden'
    : !geaendert ? (gespeichert ? `Angemeldet werden kann mit „${gespeichert}“` : 'Noch kein Benutzername')
    : p.wert ? `Neu: ${p.wert}` : 'Benutzername entfernen'

  return (
    <Seite titel="Benutzername" unter={orgName} zurueck={schliessen} zurueckLabel="Zurück zum Hub"
      leiste={<Leiste titel={unten} knopf={p.wert || !gespeichert ? 'Speichern' : 'Entfernen'} onClick={speichern} laeuft={laeuft} disabled={!!p.fehler || !geaendert || entfernenGesperrt} />}>
      <div data-probe="hub-benutzername">
        <Hinweis oben>{ohneEmail
          ? 'Mit dem Benutzernamen und deinem Passwort meldest du dich an. Eine E-Mail-Adresse hat dein Zugang nicht.'
          : 'Mit einem Benutzernamen meldest du dich statt mit der E-Mail-Adresse an. Das Passwort bleibt dasselbe, die E-Mail-Adresse auch.'}</Hinweis>
        <Feld label="Benutzername" zusatz={`3 bis ${MAX} Zeichen`} fehler={eingabe.trim() ? p.fehler : undefined}
          hinweis="Kleinbuchstaben a bis z, Ziffern und . _ - zum Beispiel lena.berger">
          <input className="bv-eingabe" type="text" inputMode="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            maxLength={MAX + 8} value={eingabe} placeholder="z. B. lena.berger" readOnly={laeuft}
            onChange={(e) => { setEingabe(e.target.value); setStand(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') void speichern() }} />
        </Feld>
        {p.wert && p.wert !== eingabe.trim() && !p.fehler && <Hinweis>Wird gespeichert als „{p.wert}“.</Hinweis>}
        {automatisch(gespeichert) && !geaendert && <Hinweis>Diesen Namen hat das System einmal vergeben. Du kannst ihn durch einen eigenen ersetzen.</Hinweis>}
        {stand && (
          <div className={`bv-notiz${stand.art === 'fehler' ? ' fehler' : ''}`} role={stand.art === 'fehler' ? 'alert' : 'status'} data-probe="hub-benutzername-stand">
            <p>{stand.text}</p>
          </div>
        )}
      </div>
    </Seite>
  )
}
