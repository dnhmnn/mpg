/*
 * Responda: Push-Benachrichtigungen im Service Worker (Bauplan Push, 6.4; Owner 12.4).
 *
 * Der Service Worker der App entsteht mit vite-plugin-pwa (generateSW, vite.config.ts) und lädt
 * diese Datei über `workbox.importScripts`. Reines JavaScript ohne Imports.
 *
 * - push: JEDE Push-Nachricht zeigt eine Benachrichtigung, auch bei Fehlern und spätestens nach
 *   1,5 s (IndexedDB kann bei einem Versionswechsel hängen). iOS wertet eine Push ohne angezeigte
 *   Benachrichtigung als „still“ und entzieht nach wenigen das Abo. Deshalb darf auch keine
 *   App-Fassung diese Datei aus importScripts nehmen, solange der Server sendet (Prüffall in
 *   src/lib/__tests__/pushSw.test.ts).
 * - Einzelheiten (Titel, Text, Ziel) nur, wenn die auf dem Gerät gemerkte Person (IndexedDB
 *   `responda-push`, Speicher `meta`, Schlüssel `stand`, geschrieben von src/lib/push/geraet.ts)
 *   die Person der Nachricht ist (`fuer`) UND ihre Anmeldung auf dem Gerät noch gilt (`ablauf`
 *   in der Zukunft, Owner 12.4). Sonst nur „Es gibt Neues in Responda.“
 * - notificationclick: Fenster der App nach vorn holen und dorthin führen (postMessage an die App,
 *   sonst navigate), ohne Fenster ein neues öffnen. Nur Pfade der App (urlSicher).
 * - pushsubscriptionchange: mit dem gemerkten Schlüssel neu abonnieren (falls möglich) und
 *   `abo_geaendert` merken; die App meldet das neue Abo beim nächsten Öffnen an.
 * - Abzeichen mit EINER Bedeutung: Zahl der Benachrichtigungen von Responda, die gerade im
 *   Mitteilungszentrum stehen (nach jedem Anzeigen und nach jedem Tippen). Die Zahl der Glocke im
 *   Hub ist etwas anderes und kommt nicht aufs Abzeichen. Beim Öffnen der App setzt
 *   src/lib/push/abgleich.ts es auf 0.
 *
 * Die reinen Teile stehen unter `self.RespondaPush` für die Prüffälle.
 */
;(function (self) {
  'use strict'

  var NEUTRAL = { titel: 'Responda', text: 'Es gibt Neues in Responda.', url: '/hub', tag: 'responda' }
  var MERKER_ZEIT_MS = 1500
  var DB = 'responda-push'
  var SPEICHER = 'meta'
  var SCHLUESSEL = 'stand'
  var GRENZEN = { titel: 80, text: 300, tag: 64, zeilen: 5 }
  var SYMBOL = '/push-symbol-192.png'
  var ABZEICHEN = '/push-abzeichen-96.png'

  // ── Reine Teile ───────────────────────────────────────────────────────────

  function istObjekt(x) { return !!x && typeof x === 'object' && !Array.isArray(x) }

  /** Höchstens max Zeichen, nie ein Ersatzpaar getrennt, „…“ am Ende. */
  function kuerzen(s, max) {
    var t = String(s)
    if (t.length <= max) return t
    var n = max - 1
    var c = t.charCodeAt(n - 1)
    if (c >= 0xd800 && c <= 0xdbff) n--
    return t.slice(0, n) + '…'
  }

  /**
   * Nur Pfade der App: "/" + [A-Za-z0-9/_-?=&.%:]*, nicht "//", kein "\"; sonst "/hub".
   * Gleiche Fassung in pb_hooks/push-regeln.js und src/lib/push/geraet.ts (Dreiwege-Prüfung).
   */
  function urlSicher(url) {
    if (typeof url !== 'string') return '/hub'
    if (!/^\/[A-Za-z0-9\/_\-?=&.%:]*$/.test(url)) return '/hub'
    if (url.indexOf('//') === 0 || url.indexOf('\\') >= 0) return '/hub'
    return url
  }

  /**
   * Payload lesen (1.3): v 1, Texte als Text, Längen begrenzt; das Füllfeld f und Unbekanntes
   * werden übergangen. Unlesbar → null.
   */
  function payloadLesen(text) {
    var p
    try { p = JSON.parse(String(text)) } catch (e) { return null }
    if (!istObjekt(p) || p.v !== 1) return null
    if (typeof p.titel !== 'string' || !p.titel || typeof p.fuer !== 'string' || !p.fuer) return null
    var zeilen = (typeof p.text === 'string' ? p.text : '').replace(/\r\n?/g, '\n').split('\n').slice(0, GRENZEN.zeilen).join('\n')
    var tag = typeof p.tag === 'string' && p.tag ? kuerzen(p.tag, GRENZEN.tag) : NEUTRAL.tag
    var zeit = Date.parse(typeof p.zeit === 'string' ? p.zeit : '')
    return {
      titel: kuerzen(p.titel, GRENZEN.titel),
      text: kuerzen(zeilen, GRENZEN.text),
      url: urlSicher(p.url),
      tag: tag,
      anlass: typeof p.anlass === 'string' ? kuerzen(p.anlass, 40) : '',
      fuer: p.fuer,
      zeit: isFinite(zeit) ? zeit : null,
    }
  }

  /** Einzelheiten nur für die gemerkte Person mit gültiger Anmeldung (Owner 12.4). */
  function einzelheiten(payload, merker, jetztMs) {
    return !!payload && istObjekt(merker) && typeof merker.person === 'string' && merker.person !== '' &&
      merker.person === payload.fuer && typeof merker.ablauf === 'number' && merker.ablauf > jetztMs
  }

  /** Was angezeigt wird: { titel, optionen } für showNotification. */
  function anzeige(payload, merker, jetztMs) {
    var jetzt = typeof jetztMs === 'number' ? jetztMs : Date.now()
    var voll = einzelheiten(payload, merker, jetzt)
    var titel = voll ? payload.titel : NEUTRAL.titel
    var optionen = {
      body: voll ? payload.text : NEUTRAL.text,
      tag: voll ? payload.tag : NEUTRAL.tag,
      renotify: true,
      data: { url: voll ? urlSicher(payload.url) : NEUTRAL.url },
      icon: SYMBOL,
      badge: ABZEICHEN,
      lang: 'de',
      timestamp: voll && typeof payload.zeit === 'number' ? payload.zeit : jetzt,
    }
    return { titel: titel, optionen: optionen }
  }

  function warte(ms) {
    return new Promise(function (ok) { setTimeout(ok, ms) })
  }

  // ── IndexedDB (Merker der App) ────────────────────────────────────────────

  function dbOeffnen() {
    return new Promise(function (ok, nein) {
      if (!self.indexedDB) { nein(new Error('ohne IndexedDB')); return }
      var r = self.indexedDB.open(DB, 1)
      r.onupgradeneeded = function () {
        var d = r.result
        if (!d.objectStoreNames.contains(SPEICHER)) d.createObjectStore(SPEICHER)
      }
      r.onsuccess = function () { ok(r.result) }
      r.onerror = function () { nein(r.error) }
      r.onblocked = function () { nein(new Error('blockiert')) }
    })
  }

  function anfrage(art, f) {
    return dbOeffnen().then(function (db) {
      return new Promise(function (ok, nein) {
        var tx = db.transaction(SPEICHER, art)
        var ergebnis
        var req = f(tx.objectStore(SPEICHER))
        if (req) req.onsuccess = function () { ergebnis = req.result }
        tx.oncomplete = function () { try { db.close() } catch (e) { /* zu */ } ok(ergebnis) }
        tx.onerror = function () { try { db.close() } catch (e) { /* zu */ } nein(tx.error) }
        tx.onabort = function () { try { db.close() } catch (e) { /* zu */ } nein(tx.error || new Error('abgebrochen')) }
      })
    })
  }

  function merkerLesen() {
    return anfrage('readonly', function (s) { return s.get(SCHLUESSEL) }).then(function (m) { return istObjekt(m) ? m : null })
  }

  function merkerSchreiben(m) {
    return anfrage('readwrite', function (s) { return s.put(m, SCHLUESSEL) })
  }

  // ── Anzeigen, Abzeichen, Öffnen ───────────────────────────────────────────

  /** Abzeichen = Zahl der Benachrichtigungen von Responda im Mitteilungszentrum; Fehler egal. */
  function abzeichenAusAnzeigen() {
    try {
      var nav = self.navigator
      if (!nav || typeof nav.setAppBadge !== 'function') return Promise.resolve()
      return self.registration.getNotifications().then(function (liste) {
        var n = liste && liste.length ? liste.length : 0
        if (n > 0) return nav.setAppBadge(n)
        if (typeof nav.clearAppBadge === 'function') return nav.clearAppBadge()
        return nav.setAppBadge(0)
      }).catch(function () { /* egal */ })
    } catch (e) {
      return Promise.resolve()
    }
  }

  function zeigen(payload, merker) {
    var a = anzeige(payload, merker, Date.now())
    return self.registration.showNotification(a.titel, a.optionen)
  }

  /** Immer etwas zeigen: Einzelheiten oder neutral; scheitert das, neutral; zuletzt ganz schlicht. */
  function beiPush(payload) {
    var R = self.RespondaPush
    var merker
    try {
      merker = Promise.race([Promise.resolve().then(function () { return R.merkerLesen() }), warte(MERKER_ZEIT_MS).then(function () { return null })])
    } catch (e) {
      merker = Promise.resolve(null)
    }
    return merker
      .catch(function () { return null })
      .then(function (m) { return zeigen(payload, m) })
      .catch(function () { return zeigen(null, null) })
      .catch(function () { return self.registration.showNotification(NEUTRAL.titel, { body: NEUTRAL.text, tag: NEUTRAL.tag }) })
      .catch(function () { /* nichts mehr zu machen */ })
      .then(abzeichenAusAnzeigen)
  }

  function gleicherUrsprung(client) {
    try {
      var o = self.location && self.location.origin
      return !o || (typeof client.url === 'string' && client.url.indexOf(o + '/') === 0) || client.url === o
    } catch (e) {
      return true
    }
  }

  /** Fenster der App nach vorn und dorthin führen; ohne Fenster ein neues öffnen. */
  function oeffnen(url) {
    var ziel = urlSicher(url)
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (liste) {
      var fenster = (liste || []).filter(gleicherUrsprung)
      if (!fenster.length) return self.clients.openWindow(ziel)
      // Ein sichtbares Fenster bevorzugen
      var c = fenster.filter(function (f) { return f.visibilityState === 'visible' || f.focused })[0] || fenster[0]
      var gesendet = false
      try { c.postMessage({ art: 'push-oeffnen', url: ziel }); gesendet = true } catch (e) { gesendet = false }
      var vorn = typeof c.focus === 'function' ? Promise.resolve().then(function () { return c.focus() }).catch(function () { return c }) : Promise.resolve(c)
      return vorn.then(function () {
        if (!gesendet && typeof c.navigate === 'function') return c.navigate(ziel)
      })
    })
  }

  function beiKlick(event) {
    try { event.notification.close() } catch (e) { /* schon zu */ }
    var daten = event.notification && event.notification.data
    var url = urlSicher(daten && daten.url)
    return self.RespondaPush.oeffnen(url).catch(function () { /* egal */ }).then(abzeichenAusAnzeigen)
  }

  function schluesselBytes(b64) {
    var s = String(b64 || '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
    while (s.length % 4) s += '='
    var bin = self.atob(s)
    var aus = new Uint8Array(bin.length)
    for (var i = 0; i < bin.length; i++) aus[i] = bin.charCodeAt(i)
    return aus
  }

  /** Neues Abo nach einem Wechsel durch den Browser; die App meldet es beim nächsten Öffnen an. */
  function beiAboWechsel(event) {
    var R = self.RespondaPush
    return R.merkerLesen().then(function (m) {
      if (!istObjekt(m) || typeof m.endpoint !== 'string') return
      var neu = event && event.newSubscription
      var weiter = neu ? Promise.resolve(neu) : (typeof m.schluessel === 'string' && m.schluessel
        ? self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: schluesselBytes(m.schluessel) }).catch(function () { return null })
        : Promise.resolve(null))
      return weiter.then(function () {
        var n = {}
        for (var k in m) if (Object.prototype.hasOwnProperty.call(m, k)) n[k] = m[k]
        n.abo_geaendert = true
        return R.merkerSchreiben(n)
      })
    }).catch(function () { /* beim nächsten Öffnen gleicht die App ab */ })
  }

  self.RespondaPush = {
    NEUTRAL: NEUTRAL, MERKER_ZEIT_MS: MERKER_ZEIT_MS,
    payloadLesen: payloadLesen, urlSicher: urlSicher, anzeige: anzeige, oeffnen: oeffnen,
    merkerLesen: merkerLesen, merkerSchreiben: merkerSchreiben, abzeichenAusAnzeigen: abzeichenAusAnzeigen,
  }

  if (typeof self.addEventListener === 'function') {
    self.addEventListener('push', function (event) {
      var payload = null
      try { payload = event && event.data ? payloadLesen(event.data.text()) : null } catch (e) { payload = null }
      var p = beiPush(payload)
      try { event.waitUntil(p) } catch (e) { /* ohne waitUntil */ }
    })
    self.addEventListener('notificationclick', function (event) {
      var p
      try { p = beiKlick(event) } catch (e) { p = Promise.resolve() }
      try { event.waitUntil(p) } catch (e) { /* ohne waitUntil */ }
    })
    self.addEventListener('pushsubscriptionchange', function (event) {
      var p = beiAboWechsel(event)
      try { event.waitUntil(p) } catch (e) { /* ohne waitUntil */ }
    })
  }
})(self)
