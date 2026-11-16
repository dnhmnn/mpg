// Protokoll als JSON-Zeilen nach stdout (journald).
//
// Nur erlaubte Felder, und Texte nur aus einem engen Zeichenvorrat: So kommt weder eine Payload
// noch ein Endpoint-Pfad noch ein Schlüssel ins Protokoll, auch nicht aus Versehen. Erlaubt sind
// Auftrag, Anzahlen, Status-Codes, Host des Push-Dienstes und die Abo-`id` (Bauplan 5, Härtung).

const FELDER = new Set([
  'ereignis', 'auftrag', 'anzahl', 'angenommen', 'doppelt', 'abgelehnt', 'gruende',
  'id', 'host', 'status', 'code', 'versuch', 'folge', 'wartezeit_s',
  'gesendet', 'weg', 'fehler', 'zurueckgehalten', 'wartend', 'laufend',
  'port', 'adresse', 'gleichzeitig', 'warteschlange_max', 'betrieb', 'testhosts',
  'warnung', 'antworten', 'auth', 'signal', 'node', 'grund', 'verloren',
])

// Texte: Buchstaben, Ziffern und wenige Zeichen, die in Hosts, Kennungen und Codes vorkommen.
// Kein "/", kein Leerzeichen, kein "@": Pfade, Sätze und Adressen fallen damit heraus. Höchstens
// 63 Zeichen: Das Geheimnis (64) und öffentliche Schlüssel (87) passen auch so nicht hinein.
const TEXT_RE = /^[A-Za-z0-9._:,=-]{0,63}$/

function wertSauber(wert) {
  if (wert === null || typeof wert === 'boolean') return wert
  if (typeof wert === 'number') return Number.isFinite(wert) ? wert : null
  if (typeof wert === 'string') return TEXT_RE.test(wert) ? wert : '?'
  return '?'
}

export function protokollErzeugen({ schreiben = (zeile) => process.stdout.write(zeile), jetzt = Date.now } = {}) {
  return function protokoll(ereignis, felder = {}) {
    const zeile = { zeit: new Date(jetzt()).toISOString(), ereignis: wertSauber(String(ereignis)) }
    for (const [k, v] of Object.entries(felder)) {
      if (k === 'ereignis' || !FELDER.has(k)) continue
      zeile[k] = wertSauber(v)
    }
    try {
      schreiben(JSON.stringify(zeile) + '\n')
    } catch {
      // Protokoll darf den Dienst nie anhalten.
    }
  }
}

/** Kein Protokoll (für Prüfungen, die nur das Verhalten ansehen). */
export function protokollStumm() {}
