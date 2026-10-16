// Gemeinsame Lager-Regeln für die Server-Hooks — dieselben wie in der App
// (src/lib/lagerRechnung.ts), damit Warn-Mail und App dasselbe sagen:
// - Soll je Standort: das eigene Standort-Soll, sonst das Standard-Soll (min_stock).
// - Ein leeres Fach zählt nur, wo der Artikel geführt wird: eigenes Soll, im
//   letzten Jahr dort gebucht, oder es gibt nur einen Standort. Sonst stünde jeder
//   Lagerartikel mit Standard-Soll auf jedem Fahrzeug als fehlend.
// - MHD in Kalendertagen (deutsche Zeit): MHD heute ist noch verwendbar.
//
// Kein *.pb.js — wird von lager-alerts.pb.js per require() geladen.

/** Mitternacht (als UTC-Zeitstempel) des heutigen Kalendertags in Deutschland. */
function heuteBerlin(jetztMs) {
  const d = new Date(jetztMs)
  const y = d.getUTCFullYear()
  // Sommerzeit: letzter Sonntag im März bis letzter Sonntag im Oktober, jeweils 01:00 UTC
  const letzterSonntag = (monat) => {
    const ende = new Date(Date.UTC(y, monat + 1, 0))
    return Date.UTC(y, monat, ende.getUTCDate() - ende.getUTCDay(), 1)
  }
  const sommer = jetztMs >= letzterSonntag(2) && jetztMs < letzterSonntag(9)
  const lokal = new Date(jetztMs + (sommer ? 2 : 1) * 3600000)
  return Date.UTC(lokal.getUTCFullYear(), lokal.getUTCMonth(), lokal.getUTCDate())
}

/** Tage bis zum MHD (0 = heute, negativ = abgelaufen), null ohne lesbares MHD. */
function tageBisMhd(mhd, heute) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(mhd || ""))
  if (!m) return null
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - heute) / 86400000)
}

/**
 * JSON-Feld eines Datensatzes als Objekt. record.get() liefert bei JSON-Feldern
 * Rohbytes, kein Objekt — deshalb über getString(). (So blieben vorher die
 * Standort-Sollwerte und die Benachrichtigungs-Einstellungen unsichtbar.)
 */
function jsonFeld(record, feld) {
  try {
    const t = record.getString(feld)
    return t ? JSON.parse(t) : null
  } catch (e) { return null }
}

/**
 * Warnungen einer Organisation als Textzeilen: { low, expired, expiring }.
 * leadDays: ab wie vielen Tagen vor dem MHD „läuft bald ab“.
 */
function lagerWarnungen(app, orgId, leadDays, jetztMs) {
  const items = app.findRecordsByFilter("inventory_items", "organization_id = {:o}", "name", 5000, 0, { o: orgId })
  const stock = app.findRecordsByFilter("inventory_stock", "organization_id = {:o}", "", 20000, 0, { o: orgId })
  const locs = app.findRecordsByFilter("inventory_locations", "organization_id = {:o}", "created", 500, 0, { o: orgId })
  const heute = heuteBerlin(jetztMs)
  const name = {}
  for (const l of locs) name[l.id] = l.get("name") || l.id

  // Wo wird ein Artikel geführt? Im letzten Jahr dort gebucht.
  const gefuehrt = {}
  if (locs.length > 1) {
    const seit = new Date(heute - 365 * 86400000).toISOString().slice(0, 10) + " 00:00:00"
    const tx = app.findRecordsByFilter("inventory_transactions", "organization_id = {:o} && created >= {:s}", "", 100000, 0, { o: orgId, s: seit })
    // Zurückgenommene Fehlbuchungen zählen nicht: geführt nur, wenn eine Buchung übrig bleibt
    const zaehler = {}
    for (const t of tx) {
      const k = t.get("item_id") + "|" + t.get("location_id")
      let storno = ""
      try { storno = t.getString("storno_von") } catch (e) { /* Feld fehlt */ }
      const ruecknahme = !!storno || t.getString("note").indexOf("Rückgängig") === 0
      zaehler[k] = (zaehler[k] || 0) + (ruecknahme ? -1 : 1)
    }
    for (const k of Object.keys(zaehler)) if (zaehler[k] > 0) gefuehrt[k] = true
  }

  const menge = {}, frueh = {}
  for (const s of stock) {
    const q = s.get("quantity") || 0
    if (q <= 0) continue
    const iid = s.get("item_id")
    const k = iid + "|" + s.get("location_id")
    menge[k] = (menge[k] || 0) + q
    const tage = tageBisMhd(s.get("expiry_date"), heute)
    if (tage !== null && (frueh[iid] === undefined || tage < frueh[iid].tage)) {
      frueh[iid] = { tage: tage, datum: String(s.get("expiry_date")).slice(0, 10) }
    }
  }

  const low = [], expired = [], expiring = []
  for (const it of items) {
    const eigen = jsonFeld(it, "location_min_stocks") || {}
    const standard = it.get("min_stock") || 0
    for (const l of locs) {
      const hatEigenes = eigen[l.id] !== undefined && eigen[l.id] !== null
      const soll = hatEigenes ? (eigen[l.id] || 0) : standard
      if (soll <= 0) continue
      const k = it.id + "|" + l.id
      const have = menge[k] || 0
      const wirdGefuehrt = locs.length <= 1 || hatEigenes || have > 0 || gefuehrt[k] === true
      if (have < soll && wirdGefuehrt) {
        low.push(it.get("name") + (locs.length > 1 ? " — " + name[l.id] : "") + " (" + have + "/" + soll + ")")
      }
    }
    const f = frueh[it.id]
    if (f) {
      if (f.tage < 0) expired.push(it.get("name") + " (" + f.datum + ")")
      else if (f.tage < leadDays) expiring.push(it.get("name") + " (" + f.datum + ")")
    }
  }
  return { low: low, expired: expired, expiring: expiring }
}

module.exports = { lagerWarnungen, jsonFeld, tageBisMhd, heuteBerlin }
