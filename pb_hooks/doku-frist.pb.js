// Protokolle, deren Änderungsfrist abgelaufen ist, selbst abschließen.
//
// Nach dem Absenden hat der Teamführer einen Tag, um nachzubessern — die
// Frist steht als `frist` im payload. Läuft sie ab, ist das Protokoll
// eingereicht, und zwar ohne dass jemand einen Knopf drückt: wer vergisst
// abzuschließen, soll kein Protokoll in der Schwebe lassen.
//
// Der Lauf prüft stündlich. Eine Minute Genauigkeit braucht niemand; eine
// Stunde nach Fristende ist früh genug, und der Lauf bleibt billig.

cronAdd("doku_frist", "0 * * * *", () => {
  const jetzt = new Date()
  let offen
  try {
    offen = $app.findRecordsByFilter("patients", "status = 'offen'", "-created", 500, 0)
  } catch (err) {
    console.log("[doku_frist] Protokolle nicht lesbar:", err)
    return
  }

  let geschlossen = 0
  for (const rec of offen) {
    let payload = rec.get("payload")
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload) } catch (err) { continue }
    }
    if (!payload || !payload.frist) continue

    const frist = new Date(payload.frist)
    if (isNaN(frist.getTime()) || frist > jetzt) continue

    rec.set("status", "freigegeben")
    try {
      $app.save(rec)
      geschlossen++
    } catch (err) {
      console.log("[doku_frist] " + rec.id + " nicht abschliessbar:", err)
    }
  }

  if (geschlossen > 0) console.log("[doku_frist] " + geschlossen + " Protokolle abgeschlossen")
})
