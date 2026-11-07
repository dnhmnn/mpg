// PocketBase hook: Namen der Mitglieder eindeutig  (PocketBase v0.23+ API)
//
// Die öffentlichen Formulare erkennen Absender und Besatzung am vollen Namen
// (formular-regeln.js, normName: „Berg, Anna“ = „anna berg“, Jörg = Joerg). Gäbe es in einer
// Organisation zwei aktive Mitglieder gleichen Namens, könnte keiner von beiden ohne Passwort
// verknüpft werden, und wer sich selbst in „Anna Berg“ umbenennt, bestätigte mit seinem
// eigenen Passwort Protokolle, die „Anna Berg, bestätigt“ zeigen.
//
// Deshalb: Anlegen oder Ändern eines Kontos, das danach verknüpfbar ist (eigene Org, aktiv,
// keine Teilnehmenden, kein Supervisor), wird abgewiesen, wenn ein anderes verknüpfbares
// Mitglied derselben Org denselben Namen trägt. Geprüft wird nur, wenn der Name neu ist,
// sich geändert hat oder das Konto vorher nicht verknüpfbar war (Rolle von Teilnehmer
// geändert, entsperrt, Ablauf verlängert, Org gewechselt). So blockieren bestehende Doppelte
// keine anderen Änderungen (Passwort, Rechte). Unvollständige Namen werden nicht abgewiesen,
// nur gezählt (Vorgänge → Formulare, scripts/formular-vorpruefung.mjs).
//
// Gleich heißt nach normName: unsichtbare Zeichen (LRM, Nullbreiten) zählen nicht, Vollbreite und
// andere Kompatibilitätsformen gelten als die normalen Zeichen (NFKC), und Buchstaben anderer
// Schriften, die wie lateinische aussehen, als lateinische („Аnna Berg“ mit kyrillischem А ist
// Anna Berg). Namen, die Schriften mischen, weist der Hook ebenfalls ab: echte Namen stehen in
// einer Schrift.
//
// Superuser sind ausgenommen. Fehlt formular-regeln.js, lässt der Hook alles durch und
// schreibt es ins Log.
//
// HINWEIS (PocketBase-JSVM): Handler laufen isoliert, require() deshalb im Handler.

onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  let R = null
  try { R = require(`${__hooks}/formular-regeln.js`) } catch (err) {
    e.app.logger().warn("[mitglieder-namen] formular-regeln.js fehlt, Namen ungeprüft")
    return e.next()
  }
  const jetzt = Date.now()
  const neu = R.personAusRecord(e.record)
  neu.sammlung = "users"
  if (!R.istVerknuepfbar(neu, neu.organization_id, jetzt) || !R.normName(neu.name)) return e.next()
  if (R.schriftGemischt(neu.name)) throw new BadRequestError(R.HOOK_TEXTE.name_schrift)
  const n = R.normName(neu.name)
  const andere = R.mitgliederLaden(e.app, neu.organization_id).filter((m) => m.id !== e.record.id)
  if (andere.some((m) => R.istVerknuepfbar(m, neu.organization_id, jetzt) && R.normName(m.name) === n)) {
    throw new BadRequestError(R.HOOK_TEXTE.name_doppelt)
  }
  e.next()
}, "users")

onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next()
  let R = null
  try { R = require(`${__hooks}/formular-regeln.js`) } catch (err) {
    e.app.logger().warn("[mitglieder-namen] formular-regeln.js fehlt, Namen ungeprüft")
    return e.next()
  }
  const jetzt = Date.now()
  const neu = R.personAusRecord(e.record)
  const alt = R.personAusRecord(e.record.original())
  neu.sammlung = "users"
  alt.sammlung = "users"
  if (!R.istVerknuepfbar(neu, neu.organization_id, jetzt) || !R.normName(neu.name)) return e.next()
  const vorher = R.istVerknuepfbar(alt, alt.organization_id, jetzt) && alt.organization_id === neu.organization_id
  if (vorher && R.normName(alt.name) === R.normName(neu.name) && (alt.name === neu.name || !R.schriftGemischt(neu.name))) return e.next()
  if (R.schriftGemischt(neu.name)) throw new BadRequestError(R.HOOK_TEXTE.name_schrift)
  const n = R.normName(neu.name)
  const andere = R.mitgliederLaden(e.app, neu.organization_id).filter((m) => m.id !== e.record.id)
  if (andere.some((m) => R.istVerknuepfbar(m, neu.organization_id, jetzt) && R.normName(m.name) === n)) {
    throw new BadRequestError(R.HOOK_TEXTE.name_doppelt)
  }
  e.next()
}, "users")
