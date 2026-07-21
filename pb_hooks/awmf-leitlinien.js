// Kuratierte AWMF-Leitlinien für den Lern-Assistenten (Rettungsdienst/Feuerwehr/Sanität).
// Nur Metadaten (Registernummer, Titel, Schlagwörter) — die Inhalte bleiben bei der AWMF,
// verlinkt wird auf die offizielle Detailseite: https://register.awmf.org/de/leitlinien/detail/<nr>
//
// Pflege: Einträge einfach ergänzen/anpassen. `tags` klein geschrieben — daran wird
// die Frage des Nutzers gematcht. Registernummer auf der AWMF-Seite prüfen!
//
// Wird per require() aus ki-assist.pb.js geladen (kein eigener Hook, daher .js statt .pb.js).

module.exports = {
  LEITLINIEN: [
    { nr: "187-023", titel: "S3 Polytrauma / Schwerverletzten-Behandlung", tags: ["polytrauma", "trauma", "schwerverletzt", "schockraum", "unfall", "blutung", "beckentrauma"] },
    { nr: "001-030", titel: "S1 Prähospitale Notfallnarkose beim Erwachsenen", tags: ["notfallnarkose", "narkose", "rsi", "einleitung", "analgosedierung", "ketamin"] },
    { nr: "001-028", titel: "S1 Atemwegsmanagement", tags: ["atemweg", "atemwegsmanagement", "intubation", "larynxmaske", "larynxtubus", "airway", "beatmung", "videolaryngoskopie"] },
    { nr: "008-001", titel: "Schädel-Hirn-Trauma im Erwachsenenalter", tags: ["schädel", "hirn", "sht", "kopfverletzung", "hirndruck", "gcs"] },
    { nr: "030-046", titel: "Akuttherapie des ischämischen Schlaganfalls", tags: ["schlaganfall", "apoplex", "stroke", "lyse", "thrombektomie", "fast"] },
    { nr: "061-025", titel: "Anaphylaxie — Akuttherapie und Management", tags: ["anaphylaxie", "allergie", "allergisch", "adrenalin", "epinephrin"] },
    { nr: "044-001", titel: "Behandlung thermischer Verletzungen des Erwachsenen", tags: ["verbrennung", "brandverletzung", "thermisch", "verbrühung", "inhalationstrauma"] },
    { nr: "019-013", titel: "S3 Sepsis — Prävention, Diagnose, Therapie und Nachsorge", tags: ["sepsis", "septisch", "infektion", "qsofa", "laktat"] },
    { nr: "030-079", titel: "Status epilepticus im Erwachsenenalter", tags: ["krampfanfall", "krampf", "epilepsie", "status", "epilepticus", "benzodiazepin", "midazolam"] },
    { nr: "nvl-002", titel: "Nationale VersorgungsLeitlinie Asthma", tags: ["asthma", "bronchial", "obstruktion", "giemen", "salbutamol"] },
    { nr: "nvl-003", titel: "Nationale VersorgungsLeitlinie COPD", tags: ["copd", "exazerbation", "obstruktiv", "raucherlunge"] },
    { nr: "nvl-001", titel: "Nationale VersorgungsLeitlinie Typ-2-Diabetes", tags: ["diabetes", "hypoglykämie", "hyperglykämie", "blutzucker", "insulin"] },
    { nr: "053-023", titel: "DEGAM Brustschmerz", tags: ["brustschmerz", "thoraxschmerz", "acs", "angina"] },
  ],
}
