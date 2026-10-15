// Passwörter, die niemand kennt.
//
// Wer einen Benutzer anlegt, legt kein Passwort fest: Der Benutzer setzt sein
// eigenes über den Link in der Willkommens-E-Mail ("Passwort festlegen").
// PocketBase braucht beim Anlegen trotzdem eines — dafür dieses.

const ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/** Starkes Zufallspasswort aus dem Zufallsgenerator des Browsers (nicht Math.random). */
export function zufallsPasswort(laenge = 32): string {
  const z = new Uint32Array(laenge)
  crypto.getRandomValues(z)
  return Array.from(z, (n) => ZEICHEN[n % ZEICHEN.length]).join('')
}
