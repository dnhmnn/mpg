// Protokolle, deren Änderungsfrist abgelaufen ist, selbst abschließen.
//
// Nach dem Absenden hat der Teamführer einen Tag, um nachzubessern. Die Frist steht als
// `frist` im payload (seit den öffentlichen Formularen setzt sie der Server). Läuft sie ab,
// ist das Protokoll eingereicht, und zwar ohne dass jemand einen Knopf drückt: wer vergisst
// abzuschließen, soll kein Protokoll in der Schwebe lassen.
//
// Protokolle, die auf die Unterschrift des Absenders warten („Unterschrift ausstehend“),
// bleiben offen: Ihre Frist beginnt erst mit dem Unterschreiben. Erkannt am Feld
// absender_status (nur der Server setzt es; ein payload.absender aus der Zeit ohne Hooks hält
// so nichts auf). Ohne das Feld über wartetAufUnterschrift aus formular-regeln.js; fehlt die
// Datei (Rücknahme), gilt der eingebaute Rückfall payload.absender.status === "ausstehend".
//
// Der Lauf prüft stündlich, seitenweise über alle offenen Protokolle (die ältesten zuerst),
// damit nie schließbare Sätze am Anfang die neueren nicht verdrängen. Bis Oktober 2026 las
// er den payload falsch (rec.get liefert Bytes) und schloss nie etwas ab; der erste Lauf
// nach der Reparatur schließt deshalb den ganzen Rückstau auf einmal (Anzahl im Log).
//
// Zum Prüfen: POST /api/crons/doku_frist (Superuser).

cronAdd("doku_frist", "0 * * * *", () => {
  let wartet = (p) => !!(p && p.absender && typeof p.absender === "object" && p.absender.status === "ausstehend")
  try {
    const R = require(`${__hooks}/formular-regeln.js`)
    if (R && typeof R.wartetAufUnterschrift === "function") wartet = R.wartetAufUnterschrift
  } catch (err) { /* Rückfall oben */ }

  const lesen = (rec) => {
    try {
      let p = JSON.parse(rec.getString("payload") || "null")
      if (typeof p === "string") p = JSON.parse(p)
      return p && typeof p === "object" && !Array.isArray(p) ? p : null
    } catch (err) {
      return null
    }
  }

  let hatFeld = false
  try { hatFeld = !!$app.findCollectionByNameOrId("patients").fields.getByName("absender_status") } catch (err) { hatFeld = false }

  const jetzt = Date.now()
  const faellig = []
  const SEITE = 200
  for (let offset = 0; ; offset += SEITE) {
    let seite
    try {
      seite = $app.findRecordsByFilter("patients", "status = 'offen'", "created", SEITE, offset)
    } catch (err) {
      console.log("[doku_frist] Protokolle nicht lesbar:", err)
      return
    }
    for (const rec of seite) {
      const payload = lesen(rec)
      if (!payload || !payload.frist) continue
      if (hatFeld ? rec.getString("absender_status") === "ausstehend" : wartet(payload)) continue
      const frist = Date.parse(String(payload.frist))
      if (!Number.isFinite(frist) || frist > jetzt) continue
      faellig.push(rec.id)
    }
    if (seite.length < SEITE) break
  }

  let geschlossen = 0
  for (const id of faellig) {
    try {
      const rec = $app.findRecordById("patients", id)
      if (rec.getString("status") !== "offen") continue
      rec.set("status", "freigegeben")
      $app.save(rec)
      geschlossen++
    } catch (err) {
      console.log("[doku_frist] " + id + " nicht abschliessbar:", err)
    }
  }

  if (geschlossen > 0) console.log("[doku_frist] " + geschlossen + " Protokolle abgeschlossen")
})
