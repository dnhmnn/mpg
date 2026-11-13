/*
 * Responda: Hintergrundversand der Formulare (Background Sync), Plan Vorgänge 5.6.
 *
 * Der Service Worker der App entsteht mit vite-plugin-pwa (generateSW, vite.config.ts)
 * und lädt diese Datei über `workbox.importScripts`. Seine Regeln (NetworkOnly für
 * /api/responda/ usw.) bleiben davon unberührt: diese Datei hängt nur einen `sync`-
 * Handler an. Reines JavaScript ohne Imports.
 *
 * Was ohne Netz abgelegt wurde, liegt verschlüsselt im Tresor (IndexedDB
 * `responda-tresor`, src/lib/tresor.ts): je Warteeintrag ein Datensatz, AES-GCM mit
 * dem nicht exportierbaren Schlüssel derselben Datenbank. Nach dem Schließen der Seite
 * meldet Chrome (Android, Desktop) den Sync `responda-formulare`, sobald Netz da ist.
 * Dann sendet diese Datei, was ohne Mensch gehen darf (F12):
 *   - nie mit Token, nie mit Passwort (es liegt ohnehin nie im Tresor);
 *   - Modus „Name frei“: mit dem eingetragenen Namen;
 *   - Modus „Passwort“: nur als „Unterschrift ausstehend“, wenn der Server das kennt und
 *     der Name genau zu einem Mitglied passt (dieselben Regeln wie nach 60 Minuten in der
 *     Karte, aber ohne Wartezeit: nach dem Schließen tippt niemand mehr ein Passwort);
 *   - eigenes Formular „anonym“: ohne Absender;
 *   - sonst bleibt der Eintrag liegen, bis die Seite wieder offen ist.
 * Offene Fenster (Review F3, Nachprüfung): Ein Fenster der App meldet die Organisationen
 * seiner Karten „Wartet auf dem Gerät“ und ob es sichtbar ist. Nur Fenster MIT der Karte
 * einer Organisation halten deren Einträge zurück; ein Fenster ohne Karte (EKS, Hub) hält
 * nichts auf.
 *   - Sichtbares Fenster mit Karte: dort ist jemand, die Karte arbeitet ab; hier nichts.
 *   - Verdecktes Fenster mit Karte, oder ein Fenster antwortet nicht (eingefroren): Einträge
 *     warten bis zur Stundenmarke der Karte (60 Minuten ab der ersten Passwortfrage, sonst
 *     ab dem Ablegen), damit jemand, der nur kurz die App gewechselt hat, das Passwort noch
 *     eintippen kann. Danach sendet diese Datei sie nach denselben Regeln wie die Karte; der
 *     Body ist derselbe, der Server erkennt einen doppelten Versand an Kennung und Inhalt.
 *     Was ein angemeldetes Mitglied abgelegt hat, bleibt bei einem verdeckten Fenster
 *     liegen: das Fenster sendet es mit Anmeldung, sobald es wieder läuft.
 * Wartet etwas, bittet sie Chrome, es später erneut zu versuchen.
 * Nach Erfolg löscht sie nur den Datensatz dieses Eintrags und vermerkt seine Kennung
 * (ohne Inhalt) unter `erledigt`; bei einem Fehler schreibt sie nur den Fehler an diesen
 * Eintrag (neu verschlüsselt). Danach meldet sie die Änderung den Fenstern.
 *
 * iOS und Firefox kennen Background Sync nicht; dort sagt die App nach dem Ablegen, dass
 * die Seite später mit Netz wieder geöffnet werden muss.
 *
 * Die reinen Teile stehen unter `self.RespondaHintergrund` für die Prüffälle
 * (src/lib/__tests__/hintergrund.test.ts vergleicht sie mit src/lib/formular/versand.ts).
 */
;(function (self) {
  'use strict'

  var TAG = 'responda-formulare'
  var DB = 'responda-tresor'
  var SPEICHER = ['schluessel', 'daten', 'meta', 'erledigt']
  var SCHLUESSEL_ID = 'aes-gcm-1'
  var LISTE = 'formular_warteschlange_'
  var KANAL = 'responda-tresor'
  var FRAGE = 'formulare-senden'
  var ANTWORT = 'formulare-karten'
  var FENSTER_MS = 1500
  var FEHLER_PAUSE_MS = 5 * 60 * 1000
  /** Stundenmarke der Karte (OHNE_PASSWORT_NACH_MS in src/lib/formular/warteschlange.ts). */
  var OHNE_PASSWORT_NACH_MS = 60 * 60 * 1000
  var SPERRE_MS = 15 * 60 * 1000
  var FORMULARE = ['patienten', 'produktausgabe', 'defektmeldung', 'eigen']
  var GRUENDE = [
    'netz', 'alter_server', 'organisation', 'formular_aus', 'daten', 'name', 'name_unbekannt',
    'passwort_noetig', 'passwort_falsch', 'gesperrt', 'drossel', 'kennung', 'aenderung_alt',
    'nicht_angemeldet', 'nicht_berechtigt', 'nicht_gefunden', 'fremd', 'schon_bestaetigt', 'server',
  ]
  /** Wie BLEIBENDE_GRUENDE in versand.ts. */
  var BLEIBENDE = ['formular_aus', 'organisation', 'daten', 'nicht_berechtigt', 'nicht_gefunden', 'fremd', 'schon_bestaetigt', 'nicht_angemeldet']
  var TEXT_NETZ = 'Keine Verbindung zum Server.'
  var TEXT_SERVER = 'Das hat gerade nicht geklappt. Bitte erneut versuchen.'
  var TEXT_DATEN = 'Die Angaben sind unvollständig. Bitte prüfen und erneut senden.'
  var TEXT_DROSSEL = 'Gerade kommen sehr viele Anfragen. Bitte in einer Minute erneut versuchen.'

  // ── Reine Teile ───────────────────────────────────────────────────────────

  function istObjekt(x) { return !!x && typeof x === 'object' && !Array.isArray(x) }
  function str(x) { return typeof x === 'string' ? x : '' }
  function zeitpunkt(iso) {
    var t = Date.parse(typeof iso === 'string' ? iso : '')
    return isFinite(t) ? t : NaN
  }
  function enthaelt(liste, x) { return liste.indexOf(x) >= 0 }
  function kopie(x) { return JSON.parse(JSON.stringify(x)) }

  /** Wie eintragGueltig in warteschlange.ts (das Nötige). */
  function eintragGueltig(e) {
    if (!istObjekt(e)) return false
    var kennung = /^[a-z0-9]{15}$/
    return e.v === 2 && typeof e.id === 'string' && kennung.test(e.id)
      && enthaelt(FORMULARE, e.formular)
      && (e.formular !== 'eigen' || (typeof e.vorlage === 'string' && kennung.test(e.vorlage)))
      && typeof e.orgCode === 'string' && e.orgCode !== ''
      && typeof e.absenderName === 'string' && istObjekt(e.daten) && typeof e.versuche === 'number'
  }

  /** Wie nameFalsch in versand.ts. */
  function nameFalsch(e) {
    var f = e.letzterFehler
    return !!f && (f.grund === 'name' || f.grund === 'name_unbekannt' || (f.grund === 'daten' && f.feld === 'absender'))
  }
  /** Wie bleibenderFehler in versand.ts. */
  function bleibenderFehler(e) {
    return !e.ziel && !!e.letzterFehler && enthaelt(BLEIBENDE, e.letzterFehler.grund) && !nameFalsch(e)
  }
  function istAnonym(e) { return e.formular === 'eigen' && e.modus === 'anonym' }

  /** Modus und „ausstehend“ wie formularStandVon in versand.ts. */
  function formularStand(e, stand) {
    if (!stand || !istObjekt(stand.formulare)) return null
    if (e.formular === 'eigen') {
      var eg = stand.formulare.eigen
      return { modus: e.modus || 'frei', ausstehend: !!eg && eg.ausstehend === true }
    }
    var f = stand.formulare[e.formular]
    return istObjekt(f) ? { modus: f.modus, ausstehend: f.ausstehend === true } : null
  }

  /**
   * Was der Hintergrund mit einem Eintrag tut (Tabelle 5.6). `lage`: { stand, jetzt (ms),
   * erledigt (Kennungen), eindeutig (Ergebnis von /name, sonst undefined), fensterOffen
   * (ein Fenster der App ist offen, auch verdeckt) }.
   * Ergebnis: { art: 'ueberspringen', fenster? } | { art: 'name_pruefen' } | { art: 'senden', absender }.
   * `fenster: true`: wartet nur, weil ein Fenster offen ist (später erneut versuchen).
   * Nie ein Token, nie ein Passwort.
   */
  function schritt(e, lage) {
    var weg = { art: 'ueberspringen' }
    if (!eintragGueltig(e)) return weg
    if (lage.erledigt && enthaelt(lage.erledigt, e.id)) return weg
    if (e.ziel) return weg
    var spaeter = zeitpunkt(e.naechsterVersuchAb)
    if (isFinite(spaeter) && spaeter > lage.jetzt) return weg
    if (bleibenderFehler(e)) return weg
    if (istAnonym(e)) return { art: 'senden', absender: null }
    // Angemeldet abgelegt: im Fenster ginge es mit Anmeldung raus, also nur ohne offenes Fenster
    if (lage.fensterOffen && typeof e.angemeldetId === 'string' && e.angemeldetId) return { art: 'ueberspringen', fenster: true }
    var f = formularStand(e, lage.stand)
    if (!f) return weg
    if (f.modus === 'frei') return nameFalsch(e) ? weg : { art: 'senden', absender: { name: e.absenderName } }
    // Passwort: solange ein Fenster offen ist, fragt dort die Karte (F12, Review F3)
    if (f.modus === 'passwort' && lage.fensterOffen) return { art: 'ueberspringen', fenster: true }
    if (f.modus !== 'passwort' || !f.ausstehend || !e.absenderName.trim()) return weg
    if (lage.eindeutig === undefined) return { art: 'name_pruefen' }
    return lage.eindeutig === true ? { art: 'senden', absender: { name: e.absenderName, ausstehend: true } } : weg
  }

  /** Body von /absenden wie absendeBody in api.ts (ohne Passwort, das es hier nie gibt). */
  function body(e, absender) {
    var a = null
    if (absender) {
      a = { name: absender.name }
      if (absender.ausstehend === true) a.ausstehend = true
    }
    var b = { formular: e.formular, id: e.id, absender: a, daten: e.daten }
    if (e.formular === 'patienten' && e.maske) b.maske = e.maske
    if (e.formular === 'eigen') b.vorlage = e.vorlage || ''
    if (e.uebernommen === true) b.uebernommen = true
    return b
  }

  /**
   * Eine Antwort lesen wie route() in api.ts: { ok: true, wert } oder { ok: false, grund, text,
   * status, sekunden?, feld?, ziel? }. `roh`: { netz, status, body } (body schon als JSON).
   */
  function antwortLesen(roh) {
    if (roh.netz) return { ok: false, grund: 'netz', text: TEXT_NETZ, status: 0 }
    var b = istObjekt(roh.body) ? roh.body : null
    if (roh.status >= 200 && roh.status < 300) return b ? { ok: true, wert: b } : { ok: false, grund: 'server', text: TEXT_SERVER, status: roh.status }
    if (!b) return { ok: false, grund: roh.status === 429 ? 'drossel' : 'server', text: roh.status === 429 ? TEXT_DROSSEL : TEXT_SERVER, status: roh.status, sekunden: roh.status === 429 ? 60 : undefined }
    var grund = typeof b.grund === 'string' && enthaelt(GRUENDE, b.grund) ? b.grund : null
    if (grund) {
      var f = { ok: false, grund: grund, text: typeof b.message === 'string' && b.message ? b.message : TEXT_SERVER, status: roh.status }
      if (typeof b.sekunden === 'number' && isFinite(b.sekunden)) f.sekunden = b.sekunden
      if (typeof b.feld === 'string') f.feld = b.feld
      if (typeof b.ziel === 'string') f.ziel = b.ziel
      return f
    }
    // 404 ohne grund: ein Server ohne Formular-Routen. Der Hintergrund tut dann nichts.
    if (roh.status === 404) return { ok: false, grund: 'alter_server', text: '', status: 404 }
    if (roh.status === 429) return { ok: false, grund: 'drossel', text: TEXT_DROSSEL, status: 429, sekunden: 60 }
    if (roh.status === 400) return { ok: false, grund: 'daten', text: TEXT_DATEN, status: 400 }
    return { ok: false, grund: 'server', text: TEXT_SERVER, status: roh.status }
  }

  /** Stand aus /stand, nur was der Hintergrund braucht. */
  function standLesen(b) {
    if (!istObjekt(b) || !istObjekt(b.formulare)) return null
    var aus = {}
    var f = b.formulare
    for (var i = 0; i < FORMULARE.length; i++) {
      var k = FORMULARE[i]
      if (!istObjekt(f[k])) continue
      var m = f[k].modus
      aus[k] = { modus: m === 'passwort' || m === 'frei' || m === 'anonym' ? m : (k === 'patienten' ? 'passwort' : 'frei'), ausstehend: f[k].ausstehend === true }
    }
    return { formulare: aus }
  }

  /** Neue Kennung, 15 × [a-z0-9]. */
  function neueKennung(zufall) {
    var z = 'abcdefghijklmnopqrstuvwxyz0123456789'
    var b = zufall(new Uint8Array(15))
    var s = ''
    for (var i = 0; i < 15; i++) s += z[b[i] % 36]
    return s
  }

  /** Wie fehlerAnwenden in versand.ts: einen fehlgeschlagenen Versuch am Eintrag festhalten. */
  function fehlerAnwenden(x, f, o) {
    var jetzt = o.jetzt
    var n = kopie(x)
    n.versuche = (typeof x.versuche === 'number' ? x.versuche : 0) + 1
    if (o.id && o.id !== x.id) n.id = o.id
    if (f.grund === 'netz') return n
    if (f.grund === 'drossel') {
      n.naechsterVersuchAb = new Date(jetzt + Math.max(1, typeof f.sekunden === 'number' ? f.sekunden : 60) * 1000).toISOString()
      return n
    }
    if (f.grund === 'kennung') n.id = o.neueId()
    if (f.grund === 'name' || f.grund === 'name_unbekannt') n.nameEindeutig = false
    if (n.formular === 'eigen' && f.grund === 'passwort_noetig') n.modus = 'passwort'
    if (istAnonym(n) && (f.grund === 'name' || f.grund === 'name_unbekannt' || (f.grund === 'daten' && f.feld === 'absender'))) n.modus = 'frei'
    n.letzterFehler = { grund: f.grund, text: f.text, am: new Date(jetzt).toISOString() }
    if (f.feld) n.letzterFehler.feld = f.feld
    if (o.aendern || enthaelt(BLEIBENDE, f.grund)) n.naechsterVersuchAb = new Date(jetzt + FEHLER_PAUSE_MS).toISOString()
    if (f.grund === 'gesperrt') {
      var ms = typeof f.sekunden === 'number' && isFinite(f.sekunden) && f.sekunden > 0 ? f.sekunden * 1000 : SPERRE_MS
      n.naechsterVersuchAb = new Date(jetzt + ms).toISOString()
    }
    return n
  }

  // ── Verschlüsseln (wie src/lib/tresor.ts) ─────────────────────────────────

  function ablageSchluessel(schluessel, eintrag) { return eintrag === undefined ? schluessel : schluessel + '\u0000' + eintrag }
  function bytes(x) {
    if (!x) return null
    if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength)
    if (Object.prototype.toString.call(x) === '[object ArrayBuffer]') return new Uint8Array(x)
    return null
  }

  function entschluesseln(c, key, rec, ak) {
    if (!istObjekt(rec) || rec.v !== 1 || typeof rec.schluessel !== 'string') return Promise.reject(new Error('kein Datensatz'))
    var soll = ablageSchluessel(rec.schluessel, typeof rec.eintrag === 'string' ? rec.eintrag : undefined)
    if (soll !== ak) return Promise.reject(new Error('falscher Ort'))
    var iv = bytes(rec.iv), ct = bytes(rec.ct)
    if (!iv || iv.byteLength !== 12 || !ct) return Promise.reject(new Error('unvollständig'))
    return c.subtle.decrypt({ name: 'AES-GCM', iv: iv, additionalData: new TextEncoder().encode(soll) }, key, ct)
      .then(function (klar) { return new TextDecoder().decode(klar) })
  }

  function datensatzBauen(c, key, schluessel, eintrag, reihe, text) {
    var ak = ablageSchluessel(schluessel, eintrag)
    var iv = c.getRandomValues(new Uint8Array(12))
    return c.subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: new TextEncoder().encode(ak) }, key, new TextEncoder().encode(text))
      .then(function (ct) {
        var d = { v: 1, iv: iv, ct: ct, art: 'liste', schluessel: schluessel, eintrag: eintrag, geaendert: new Date().toISOString() }
        if (typeof reihe === 'number' && isFinite(reihe)) d.reihe = reihe
        return { ak: ak, d: d }
      })
  }

  // ── Ein Durchgang ─────────────────────────────────────────────────────────

  /**
   * Ein Durchgang über alle Warteschlangen. `u` (Umgebung): { ablage, holen(url, init), crypto,
   * fenster(): Promise<{ alle: boolean, orgs: string[] (verdeckte Fenster), sichtbar?: string[] }>, melden(schluessel[]), jetzt(): ms }.
   * Ergebnis: { gesendet, nochmal, uebersprungen, imFenster } (nochmal: wegen Netz, Drossel oder Störung
   * liegen geblieben, ein Fenster antwortete nicht oder hielt noch Einträge, die es selbst abarbeitet).
   */
  function lauf(u) {
    var ergebnis = { gesendet: 0, nochmal: false, uebersprungen: 0, imFenster: 0 }
    var geaendert = {}
    var key = null
    var api = ''
    var erledigt = []

    function anfrage(methode, pfad, b) {
      var init = { method: methode, headers: { Accept: 'application/json' }, cache: 'no-store', credentials: 'omit' }
      if (b !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(b) }
      return Promise.resolve().then(function () { return u.holen(api + pfad, init) }).then(function (res) {
        return res.text().then(function (t) {
          var j = null
          try { j = t ? JSON.parse(t) : null } catch (err) { j = null }
          return { netz: false, status: res.status, body: j }
        }, function () { return { netz: false, status: res.status, body: null } })
      }, function () { return { netz: true, status: 0, body: null } }).then(antwortLesen)
    }

    function schreiben(alt, n) {
      return datensatzBauen(u.crypto, key, alt.schluessel, n.id, alt.reihe, JSON.stringify(n)).then(function (neu) {
        return u.ablage.schreiben(neu.ak, neu.d).then(function () {
          geaendert[alt.schluessel] = true
          if (neu.ak !== alt.ak) return u.ablage.loeschen(alt.ak)
        })
      })
    }

    function eintragSenden(item, stand, fensterOffen) {
      var e = item.e
      var lage = { stand: stand, jetzt: u.jetzt(), erledigt: erledigt, fensterOffen: fensterOffen }
      var s = schritt(e, lage)
      var vorher = Promise.resolve(s)
      if (s.art === 'name_pruefen') {
        var nb = { formular: e.formular, name: e.absenderName.trim() }
        if (e.formular === 'eigen') nb.vorlage = e.vorlage || ''
        vorher = anfrage('POST', '/api/responda/formular/' + encodeURIComponent(e.orgCode) + '/name', nb).then(function (r) {
          if (!r.ok) { if (r.grund === 'netz' || r.grund === 'drossel' || r.grund === 'server') ergebnis.nochmal = true; return { art: 'ueberspringen', halt: r.grund === 'netz' } }
          lage.eindeutig = r.wert.vollstaendig === true && r.wert.eindeutig === true
          return schritt(e, lage)
        })
      }
      return vorher.then(function (s2) {
        if (s2.art !== 'senden') {
          ergebnis.uebersprungen++
          // Wartet nur auf das Schließen des Fensters: später erneut
          if (s2.fenster) { ergebnis.nochmal = true; ergebnis.imFenster++ }
          return { halt: !!s2.halt }
        }
        return anfrage('POST', '/api/responda/formular/' + encodeURIComponent(e.orgCode) + '/absenden', body(e, s2.absender)).then(function (r) {
          var jetzt = u.jetzt()
          if (r.ok) {
            ergebnis.gesendet++
            return u.ablage.loeschen(item.ak).then(function () {
              geaendert[item.schluessel] = true
              return u.ablage.erledigtSetzen(e.id, { am: new Date(jetzt).toISOString() })
            }).then(function () { return { halt: false } })
          }
          if (r.grund === 'alter_server') return { halt: true }
          if (r.grund === 'aenderung_alt' && r.ziel) {
            var z = kopie(e)
            z.ziel = r.ziel
            z.versuche = (e.versuche || 0) + 1
            delete z.letzterFehler
            return schreiben(item, z).then(function () { return { halt: false } })
          }
          var n = fehlerAnwenden(e, r, { jetzt: jetzt, neueId: function () { return neueKennung(function (a) { return u.crypto.getRandomValues(a) }) } })
          if (r.grund === 'netz' || r.grund === 'drossel' || r.grund === 'server') ergebnis.nochmal = true
          return schreiben(item, n).then(function () { return { halt: r.grund === 'netz' || r.grund === 'drossel' } })
        })
      })
    }

    function orgSenden(org, items, fensterOffen) {
      return anfrage('GET', '/api/responda/formular/' + encodeURIComponent(org) + '/stand').then(function (r) {
        if (!r.ok) {
          if (r.grund === 'netz' || r.grund === 'drossel' || r.grund === 'server') ergebnis.nochmal = true
          return
        }
        var stand = standLesen(r.wert)
        if (!stand) return
        var i = 0
        function weiter() {
          if (i >= items.length) return
          var item = items[i++]
          return eintragSenden(item, stand, fensterOffen).then(function (x) { if (!x.halt) return weiter() })
        }
        return weiter()
      })
    }

    return Promise.all([u.ablage.schluessel(), u.ablage.api(), u.ablage.erledigtLesen ? u.ablage.erledigtLesen() : []]).then(function (r) {
      key = r[0]
      api = String(r[1] || '').replace(/\/+$/, '')
      erledigt = r[2] || []
      if (!key || !api) return null
      return u.fenster()
    }).then(function (fenster) {
      if (!fenster) return null
      // Ein Fenster antwortet nicht (eingefroren): als verdecktes Fenster mit Karte jeder
      // Organisation behandeln, also bis zur Stundenmarke warten
      var unbekannt = fenster.alle === true
      var sichtbar = Array.isArray(fenster.sichtbar) ? fenster.sichtbar : []
      var verdeckt = Array.isArray(fenster.orgs) ? fenster.orgs : []
      var jetztMs = u.jetzt()
      function stundeVorbei(e) {
        if (typeof e.angemeldetId === 'string' && e.angemeldetId) return false
        var ab = zeitpunkt(e.gefragtAb)
        if (!isFinite(ab)) ab = zeitpunkt(e.angelegt)
        return isFinite(ab) && jetztMs - ab >= OHNE_PASSWORT_NACH_MS
      }
      return u.ablage.eintraege().then(function (paare) {
        // Entschlüsseln, je Organisation in der Reihenfolge der Ablage
        var je = {}
        var arbeit = paare.map(function (p) {
          var ak = p[0], rec = p[1]
          if (!istObjekt(rec) || rec.art !== 'liste' || typeof rec.schluessel !== 'string' || rec.schluessel.indexOf(LISTE) !== 0) return null
          if (ak.indexOf('#unlesbar-') >= 0) return null
          return entschluesseln(u.crypto, key, rec, ak).then(function (text) {
            var e
            try { e = JSON.parse(text) } catch (err) { return }
            if (!eintragGueltig(e)) return
            var org = rec.schluessel.slice(LISTE.length)
            // Ein sichtbares Fenster hat die Karte dieser Organisation: dort arbeitet sie jemand ab.
            // Ein verdecktes (oder stummes) Fenster mit Karte: bis zur Stundenmarke warten. In beiden
            // Fällen „später erneut“, falls das Fenster vorher geschlossen wird
            var halten = enthaelt(sichtbar, org) || ((unbekannt || enthaelt(verdeckt, org)) && !stundeVorbei(e))
            if (halten) { if (!enthaelt(erledigt, e.id)) { ergebnis.nochmal = true; ergebnis.imFenster++ } return }
            ;(je[org] = je[org] || []).push({ ak: ak, schluessel: rec.schluessel, reihe: typeof rec.reihe === 'number' ? rec.reihe : 0, e: e })
          }, function () { /* unlesbar: die App benennt ihn beim nächsten Öffnen um */ })
        })
        return Promise.all(arbeit).then(function () {
          var orgs = Object.keys(je)
          var k = 0
          function naechste() {
            if (k >= orgs.length) return
            var org = orgs[k++]
            var items = je[org].sort(function (a, b) { return a.reihe - b.reihe })
            // Wer hier ankommt, wird von keinem Fenster mehr gehalten: senden wie ohne Fenster
            return orgSenden(org, items, false).then(naechste)
          }
          return naechste()
        })
      })
    }).then(function () {
      var schl = Object.keys(geaendert)
      if (schl.length) { try { u.melden(schl) } catch (err) { /* Kanal zu */ } }
      return ergebnis
    })
  }

  // ── IndexedDB und Fenster (nur im Service Worker) ─────────────────────────

  function dbOeffnen() {
    return new Promise(function (ok, nein) {
      var r = self.indexedDB.open(DB, 1)
      r.onupgradeneeded = function () {
        var d = r.result
        for (var i = 0; i < SPEICHER.length; i++) if (!d.objectStoreNames.contains(SPEICHER[i])) d.createObjectStore(SPEICHER[i])
      }
      r.onsuccess = function () { ok(r.result) }
      r.onerror = function () { nein(r.error) }
      r.onblocked = function () { nein(new Error('blockiert')) }
    })
  }

  function anfrageIdb(db, speicher, art, f) {
    return new Promise(function (ok, nein) {
      var tx = db.transaction(speicher, art)
      var st = tx.objectStore(speicher)
      var ergebnis
      var req = f(st)
      if (req) req.onsuccess = function () { ergebnis = req.result }
      tx.oncomplete = function () { ok(ergebnis) }
      tx.onerror = function () { nein(tx.error) }
      tx.onabort = function () { nein(tx.error || new Error('abgebrochen')) }
    })
  }

  function idbAblage(db) {
    return {
      schluessel: function () { return anfrageIdb(db, 'schluessel', 'readonly', function (s) { return s.get(SCHLUESSEL_ID) }) },
      api: function () { return anfrageIdb(db, 'meta', 'readonly', function (s) { return s.get('api') }) },
      erledigtLesen: function () { return anfrageIdb(db, 'erledigt', 'readonly', function (s) { return s.getAllKeys() }).then(function (k) { return k || [] }) },
      eintraege: function () {
        return Promise.all([
          anfrageIdb(db, 'daten', 'readonly', function (s) { return s.getAllKeys() }),
          anfrageIdb(db, 'daten', 'readonly', function (s) { return s.getAll() }),
        ]).then(function (r) {
          var k = r[0] || [], w = r[1] || []
          var aus = []
          for (var i = 0; i < k.length && i < w.length; i++) if (typeof k[i] === 'string') aus.push([k[i], w[i]])
          return aus
        })
      },
      schreiben: function (ak, d) { return anfrageIdb(db, 'daten', 'readwrite', function (s) { return s.put(d, ak) }) },
      loeschen: function (ak) { return anfrageIdb(db, 'daten', 'readwrite', function (s) { return s.delete(ak) }) },
      erledigtSetzen: function (id, w) { return anfrageIdb(db, 'erledigt', 'readwrite', function (s) { return s.put(w, id) }) },
    }
  }

  /** Ein Fenster fragen, welche Organisationen es selbst abarbeitet (Antwort über einen MessageChannel). */
  function fensterFragen(client) {
    return new Promise(function (ok) {
      var fertig = false
      var kanal = new MessageChannel()
      var uhr = setTimeout(function () { if (!fertig) { fertig = true; ok(null) } }, FENSTER_MS)
      kanal.port1.onmessage = function (ev) {
        if (fertig) return
        fertig = true
        clearTimeout(uhr)
        ok(ev.data && ev.data.art === ANTWORT ? ev.data : null)
      }
      try { client.postMessage({ art: FRAGE }, [kanal.port2]) } catch (err) { fertig = true; clearTimeout(uhr); ok(null) }
    })
  }

  /**
   * Offene Fenster: { offen, alle, orgs }. `offen`: mindestens ein Fenster der App ist offen
   * (sichtbar oder verdeckt); `orgs`: Organisationen ihrer Karten; `alle: true` heißt, eines
   * antwortet nicht, dann sendet der Hintergrund nichts.
   */
  function fenster() {
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (liste) {
      if (!liste || liste.length === 0) return { offen: false, alle: false, orgs: [], sichtbar: [] }
      return Promise.all(liste.map(fensterFragen)).then(function (antworten) {
        var orgs = [], sichtbar = [], alle = false
        for (var i = 0; i < antworten.length; i++) {
          var a = antworten[i]
          if (!a) { alle = true; continue }
          // Verdeckte Fenster behalten ihre Karten (Review F3), aber nur bis zur Stundenmarke
          var ziel = a.sichtbar === true ? sichtbar : orgs
          if (Array.isArray(a.orgs)) for (var j = 0; j < a.orgs.length; j++) if (typeof a.orgs[j] === 'string') ziel.push(a.orgs[j])
        }
        return { offen: true, alle: alle, orgs: orgs, sichtbar: sichtbar }
      })
    })
  }

  function melden(schluessel) {
    if (typeof BroadcastChannel !== 'function') return
    var k = new BroadcastChannel(KANAL)
    k.postMessage({ art: 'geaendert', schluessel: schluessel })
    k.close()
  }

  function hintergrund() {
    return dbOeffnen().then(function (db) {
      return lauf({
        ablage: idbAblage(db),
        holen: function (url, init) { return self.fetch(url, init) },
        crypto: self.crypto,
        fenster: fenster,
        melden: melden,
        jetzt: function () { return Date.now() },
      }).then(function (r) { try { db.close() } catch (err) { /* zu */ } return r }, function (err) { try { db.close() } catch (e2) { /* zu */ } throw err })
    })
  }

  self.RespondaHintergrund = {
    TAG: TAG, FRAGE: FRAGE, ANTWORT: ANTWORT, OHNE_PASSWORT_NACH_MS: OHNE_PASSWORT_NACH_MS,
    schritt: schritt, body: body, antwortLesen: antwortLesen, standLesen: standLesen, fehlerAnwenden: fehlerAnwenden,
    eintragGueltig: eintragGueltig, lauf: lauf, neueKennung: neueKennung, ablageSchluessel: ablageSchluessel,
  }

  if (typeof self.addEventListener === 'function') {
    self.addEventListener('sync', function (event) {
      if (!event || event.tag !== TAG) return
      event.waitUntil(hintergrund().then(function (r) {
        // Liegt etwas wegen Netz oder Störung noch da, versucht Chrome es später noch einmal
        if (r && r.nochmal && !event.lastChance) throw new Error('später erneut')
      }))
    })
  }
})(self)
