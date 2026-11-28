#!/usr/bin/env python3
# Responda: MPG am Server einrichten (Owner, 27.11.2026: „außerdem fehlen dort noch die Collections, schick mir den
# Befehl für den Server“). Bisher stand das nur als Schritte zum Klicken in docs/pocketbase-regeln.md, „MPG: API-Regeln“.
#
# Aufruf auf dem Server (erst den Hook kopieren und PocketBase neu starten):
#   cd /opt/responda-quelle && git pull
#   cp pb_hooks/mpg.pb.js pb_hooks/push-fristen.js pb_hooks/push-versand.js /opt/pb_hooks/ && systemctl restart pocketbase
#   python3 scripts/mpg-einrichten.py                                   Sammlungen und Felder anlegen, Regeln nur zeigen
#   python3 scripts/mpg-einrichten.py anwenden                          dazu Sicherung, dann Regeln setzen
#   python3 scripts/mpg-einrichten.py zurueck /root/mpg-regeln-vorher-….json   alte Regeln zurück
#
# 1. Prüft, dass der Hook in Fassung 3 läuft (GET /api/responda/mpg/fassung als Superuser; ohne Hook oder im alten
#    Stand 404 oder kleiner). Sonst setzt „anwenden“ keine Regeln und legt interval_days, geloescht und „days“ nicht
#    an (ohne den Hook dürfte sie unter der bisherigen Regel ² jeder mit MPG-Zugang ändern).
# 2. Prüft die Batch-API (die App schreibt Gerät und Gerätebuch in einer Sammelbuchung).
# 3. users: Felder, auf die sich die Regeln beziehen (disabled, expires_at als Datum, nicht Autodate).
# 4. Legt fehlende Sammlungen an (mpg_ereignisse, sonst jede fehlende) und ergänzt fehlende Felder:
#    mpg_devices: Außerbetriebnahme, Inbetriebnahme, Prüfintervall „alle N Tage“ (interval_days, Auswahl „days“),
#    gelöscht (geloescht); user_id, reported_by_id, resolved_by_id. Felder mit anderem Typ zeigt es nur.
#    mpg_devices mit weiteren Feldern: nur zeigen (jedes weitere könnte jeder mit MPG-Zugang ändern).
# 5. Regeln aller MPG-Sammlungen (wörtlich wie in der Doku): zeigt, was es täte; mit „anwenden“ nach einer Sicherung
#    setzen, zuerst mpg_ereignisse. List/View der Geräte erst auf „R“, wenn die Route der Defektmeldung da ist
#    (formular.pb.js), sonst bleiben sie, wie sie sind.
# Beliebig oft ausführbar. Zeigt nie Namen oder Daten, nur Zahlen und Regeln. Gesperrt heißt null (Schloss), nie "".
import getpass, json, os, sys, time, urllib.error, urllib.parse, urllib.request

API = os.environ.get("RESPONDA_API", "https://api.responda.systems").rstrip("/")
SICHERUNG = os.environ.get("RESPONDA_SICHERUNG", os.path.expanduser("~"))
TOKEN = ""
REGELN = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"]

# ── Regeln (wörtlich in docs/pocketbase-regeln.md, „MPG: API-Regeln“) ───────────────────────────────────

AKTIV = '@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now)'
ZUGANG = '(@request.auth.permissions.dashboard = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.dashboard.until ~ " " && @request.auth.temp_permissions.dashboard.until > @now))'
VERWALTEN = '(@request.auth.permissions.mpg_verwalten = true || @request.auth.role = "admin" || @request.auth.role = "mpg" || @request.auth.supervisor = true || (@request.auth.temp_permissions.mpg_verwalten.until ~ " " && @request.auth.temp_permissions.mpg_verwalten.until > @now))'
BLEIBT = '(@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id)'

R = f'{AKTIV} && organization_id = @request.auth.organization_id && {ZUGANG}'
A = f'{AKTIV} && @request.body.organization_id = @request.auth.organization_id && {ZUGANG}'
AV = f'{A} && {VERWALTEN}'
V = f'{R} && {VERWALTEN} && {BLEIBT}'

# ² Geräte — Update: ohne „MPG verwalten“ nur Prüfstand und Sperren. Seit 27.11.2026 auch interval_days und geloescht.
STAMM_BISHER = ["name", "type", "serial_number", "location", "interval", "has_stk", "last_stk", "stk_interval_months", "has_mtk",
                "last_mtk", "mtk_interval_months", "ausser_betrieb", "ausser_betrieb_grund", "verbleib", "inbetriebnahme", "organization_id"]
STAMM = ["name", "type", "serial_number", "location", "interval", "interval_days", "has_stk", "last_stk", "stk_interval_months", "has_mtk",
         "last_mtk", "mtk_interval_months", "ausser_betrieb", "ausser_betrieb_grund", "verbleib", "inbetriebnahme", "geloescht", "organization_id"]


def geraet_update(felder):
    ohne = " && ".join(f"@request.body.{f}:isset = false" for f in felder)
    return f'{R} && {BLEIBT} && ({VERWALTEN} || ({ohne} && (@request.body.operational:isset = false || @request.body.operational = false)))'


GERAET_UPDATE_BISHER = geraet_update(STAMM_BISHER)
GERAET_UPDATE = geraet_update(STAMM)
# ³ Defekte — Update
DEFEKT_UPDATE = (f'{R} && {BLEIBT} && ({VERWALTEN} || (severity != "high" && severity != "critical" && @request.body.severity:isset = false '
                 '&& @request.body.device_id:isset = false && @request.body.description:isset = false && @request.body.reported_by:isset = false '
                 '&& @request.body.device_name:isset = false))')
# ⁴ Meldungen von außen — List/View: die Organisation mit MPG-Zugang und wer selbst gemeldet hat
MELDUNG_LESEN = f'{AKTIV} && organization_id = @request.auth.organization_id && ({ZUGANG} || reporter_user_id = @request.auth.id)'
# ⁵ Meldungen von außen — Create (das Meldeformular, vorerst ohne Anmeldung)
MELDUNG_CREATE = '@request.body.organization_id != "" && @request.body.status = "pending"'
# ⁶ Gerätebuch — Create: Sperren und Vermerke jeder mit Zugang, alles andere „MPG verwalten“
BUCH_CREATE = f'{A} && ({VERWALTEN} || @request.body.art = "gesperrt" || @request.body.art = "vermerk")'


def ziel(geraete_lesen):
    """Die Regeln je Sammlung; geraete_lesen None heißt: List/View der Geräte nicht anfassen."""
    z = {
        "mpg_ereignisse": {"listRule": R, "viewRule": R, "createRule": BUCH_CREATE, "updateRule": None, "deleteRule": None},
        "mpg_devices": {"createRule": AV, "updateRule": GERAET_UPDATE, "deleteRule": V},
        "mpg_inspections": {"listRule": R, "viewRule": R, "createRule": A, "updateRule": None, "deleteRule": None},
        "mpg_defects": {"listRule": R, "viewRule": R, "createRule": A, "updateRule": DEFEKT_UPDATE, "deleteRule": None},
        "mpg_defect_reports": {"listRule": MELDUNG_LESEN, "viewRule": MELDUNG_LESEN, "createRule": MELDUNG_CREATE, "updateRule": V, "deleteRule": None},
        "mpg_checklists": {"listRule": R, "viewRule": R, "createRule": AV, "updateRule": V, "deleteRule": V},
    }
    if geraete_lesen is not None:
        z["mpg_devices"] = {"listRule": geraete_lesen, "viewRule": geraete_lesen, **z["mpg_devices"]}
    return z


# ── Felder (src/pages/mpg/typen.ts) ─────────────────────────────────────────────────────────────────

def text(n, pflicht=False): return {"name": n, "type": "text", "required": pflicht}
def auswahl(n, werte): return {"name": n, "type": "select", "required": False, "maxSelect": 1, "values": werte}
def zahl_(n, max_=0): return {"name": n, "type": "number", "required": False, "onlyInt": True, "min": 0, **({"max": max_} if max_ else {})}
def ja(n): return {"name": n, "type": "bool", "required": False}
def datum(n): return {"name": n, "type": "date", "required": False}
def jsonfeld(n): return {"name": n, "type": "json", "required": False, "maxSize": 200000}
ZEITEN = [{"name": "created", "type": "autodate", "onCreate": True, "onUpdate": False},
          {"name": "updated", "type": "autodate", "onCreate": True, "onUpdate": True}]
SCHWERE = ["low", "medium", "high", "critical"]
INTERVALLE = ["daily", "weekly", "days", "monthly", "yearly"]

FELDER = {
    "mpg_ereignisse": [text("organization_id"), text("device_id"), text("device_name"), text("art"), text("text"), text("bezug"),
                       text("user_name"), text("user_id"), jsonfeld("aenderungen"), jsonfeld("angaben")] + ZEITEN,
    "mpg_devices": [text("organization_id", True), text("name", True), text("type"), text("serial_number"), text("location"),
                    auswahl("interval", INTERVALLE), zahl_("interval_days", 365), datum("last_inspection"), ja("last_inspection_passed"),
                    datum("next_inspection_due"), ja("operational"), ja("has_stk"), datum("last_stk"), zahl_("stk_interval_months"),
                    ja("has_mtk"), datum("last_mtk"), zahl_("mtk_interval_months"), datum("inbetriebnahme"), datum("ausser_betrieb"),
                    text("ausser_betrieb_grund"), text("verbleib"), datum("geloescht")] + ZEITEN,
    "mpg_inspections": [text("organization_id", True), text("device_id"), text("device_name"), text("device_type"), text("user_name"),
                        text("user_id"), datum("inspection_date"), ja("passed"), text("notes"), jsonfeld("checklist_results")] + ZEITEN,
    "mpg_defects": [text("organization_id", True), text("device_id"), text("device_name"), text("reported_by"), text("reported_by_id"),
                    text("description"), auswahl("severity", SCHWERE), auswahl("status", ["open", "in_progress", "resolved"]),
                    text("resolved_by"), text("resolved_by_id"), text("resolved_notes")] + ZEITEN,
    "mpg_defect_reports": [text("organization_id", True), text("device_id"), text("device_name"), text("reporter_name"),
                           text("reporter_user_id"), text("reporter_status"), text("description"), auswahl("severity", SCHWERE),
                           auswahl("status", ["pending", "confirmed", "rejected"]), text("rejected_reason"), jsonfeld("eigene")] + ZEITEN,
    "mpg_checklists": [text("organization_id", True), text("device_type"), jsonfeld("items")] + ZEITEN,
}
# Ergänzt werden an bestehenden Sammlungen nur diese (die übrigen gibt es dort seit Beginn; fehlt eines, nur zeigen)
ERGAENZEN = {
    "mpg_ereignisse": [f["name"] for f in FELDER["mpg_ereignisse"]],
    "mpg_devices": ["interval_days", "inbetriebnahme", "ausser_betrieb", "ausser_betrieb_grund", "verbleib", "geloescht"],
    "mpg_inspections": ["user_id"],
    "mpg_defects": ["reported_by_id", "resolved_by_id"],
    "mpg_defect_reports": ["reporter_status", "eigene"],
    "mpg_checklists": [],
}
# Ohne diese Felder lehnt PocketBase die Regeln ab oder sie greifen nicht
NOETIG = {"mpg_defects": ["severity", "device_id", "description", "reported_by", "device_name"],
          "mpg_defect_reports": ["reporter_user_id", "status"], "mpg_ereignisse": ["art"]}
# mpg_devices darf nur diese Felder haben (Regel ² zählt die Stammdaten einzeln auf)
GERAET_ERLAUBT = set(STAMM) | {"id", "created", "updated", "last_inspection", "last_inspection_passed", "next_inspection_due", "operational"}
INDIZES = {
    "mpg_ereignisse": [("idx_mpg_ereignisse_org", "CREATE INDEX `idx_mpg_ereignisse_org` ON `mpg_ereignisse` (`organization_id`, `created`)"),
                       ("idx_mpg_ereignisse_geraet", "CREATE INDEX `idx_mpg_ereignisse_geraet` ON `mpg_ereignisse` (`device_id`, `created`)")],
}
REIHENFOLGE = ["mpg_ereignisse", "mpg_devices", "mpg_inspections", "mpg_defects", "mpg_defect_reports", "mpg_checklists"]


def anfrage(methode, pfad, body=None, mit_token=True):
    daten = json.dumps(body).encode() if body is not None else None
    kopf = {"Content-Type": "application/json"}
    if TOKEN and mit_token: kopf["Authorization"] = TOKEN
    q = urllib.request.Request(API + pfad, data=daten, method=methode, headers=kopf)
    try:
        with urllib.request.urlopen(q, timeout=60) as r:
            t = r.read()
            return r.status, (json.loads(t) if t else {})
    except urllib.error.HTTPError as e:
        t = e.read()
        try: return e.code, json.loads(t)
        except Exception: return e.code, {"message": t[:300].decode("utf-8", "replace")}


def ok(t): print("  ok       " + t)
def neu(t): print("  GEÄNDERT " + t)
def warn(t): print("  ACHTUNG  " + t)


def sammlung(name):
    s, d = anfrage("GET", "/api/collections/" + name)
    return d if s == 200 else None


def zahl(name, filt):
    s, d = anfrage("GET", "/api/collections/" + name + "/records?perPage=1&fields=id&filter=" + urllib.parse.quote(filt))
    return d.get("totalItems") if s == 200 else None


def anmelden():
    global TOKEN
    mail = os.environ.get("RESPONDA_SUPERUSER") or input("Superuser-E-Mail: ").strip()
    pw = os.environ.get("RESPONDA_SUPERUSER_PASSWORT") or getpass.getpass("Passwort: ")
    s, d = anfrage("POST", "/api/collections/_superusers/auth-with-password", {"identity": mail, "password": pw})
    if s != 200 or not d.get("token"):
        print("Anmeldung fehlgeschlagen (" + str(s) + "), nichts geändert."); sys.exit(1)
    TOKEN = d["token"]


def wie(regel):
    if regel is None: return "gesperrt (null)"
    if regel == "": return "ÖFFENTLICH (leer)"
    return "eine andere Regel"


def zurueck(datei):
    """Regeln aus der Sicherung zurück, aber nur, wo seitdem nichts anderes gesetzt wurde."""
    anmelden()
    try: alt = json.load(open(datei))
    except Exception as e: print("Sicherung nicht lesbar: " + str(e)); sys.exit(1)
    gesetzt = alt.pop("_gesetzt", {})
    for name, regeln in alt.items():
        jetzt = sammlung(name) or {}
        erwartet = gesetzt.get(name, {})
        if any(k in erwartet and jetzt.get(k) != erwartet[k] for k in regeln):
            warn(name + ": Die Regeln sind seit dem Setzen geändert worden, nicht angefasst.")
            continue
        s, d = anfrage("PATCH", "/api/collections/" + name, regeln)
        (neu if s == 200 else warn)(name + (": alte Regeln zurück" if s == 200 else ": " + json.dumps(d, ensure_ascii=False)[:300]))


# Neu seit 27.11.2026, nur mit dem Hook in Fassung 3 (er verlangt dafür „MPG verwalten“, auch unter der alten Regel ²)
NUR_MIT_HOOK = {"interval_days", "geloescht"}


def einrichten(name, hook=True):
    """Sammlung anlegen (gesperrt) oder fehlende Felder und Indizes ergänzen."""
    c = sammlung(name)
    if not c:
        s, d = anfrage("POST", "/api/collections", {
            "name": name, "type": "base", "fields": FELDER[name], "indexes": [sql for _, sql in INDIZES.get(name, [])],
            **{k: None for k in REGELN}})
        if s == 200: neu(name + " angelegt (alle Regeln gesperrt, bis sie gesetzt sind)")
        else: warn(name + " nicht angelegt: " + json.dumps(d, ensure_ascii=False)[:400])
        return sammlung(name)
    da = {f["name"]: f for f in c["fields"]}
    soll = {f["name"]: f for f in FELDER[name]}
    fehlt = [soll[n] for n in ERGAENZEN[name] if n not in da]
    if name == "mpg_devices" and not hook:
        warten = [f["name"] for f in fehlt if f["name"] in NUR_MIT_HOOK]
        if warten: warn("mpg_devices: " + ", ".join(warten) + " und die Auswahl „days“ erst mit dem Hook (Fassung 3) anlegen. Hook kopieren, dann erneut.")
        fehlt = [f for f in fehlt if f["name"] not in NUR_MIT_HOOK]
    for n, f in soll.items():
        x = da.get(n)
        if not x:
            if n not in ERGAENZEN[name] and n not in ("created", "updated"): warn(name + "." + n + " fehlt. Bitte von Hand ansehen (die App erwartet es).")
            continue
        if n == "interval" and x.get("type") == "text": continue  # Text geht auch (die App liest beides)
        if x.get("type") != f["type"]:
            warn(name + "." + n + " ist " + str(x.get("type")) + " statt " + f["type"] + ". Bitte von Hand ansehen.")
    felder = list(c["fields"]) + fehlt
    # Prüfintervall „alle N Tage“: Ist interval eine Auswahl, braucht sie den Wert days
    geaendert_auswahl = False
    if name == "mpg_devices" and hook:
        for f in felder:
            if f["name"] == "interval" and f.get("type") == "select" and "days" not in (f.get("values") or []):
                f["values"] = list(f.get("values") or []) + ["days"]
                geaendert_auswahl = True
        extra = sorted(n for n in da if n not in GERAET_ERLAUBT)
        if extra:
            warn("mpg_devices hat weitere Felder (" + ", ".join(extra) + "): Die könnte jeder mit MPG-Zugang ändern. Vor dem Setzen "
                 "der Regeln in die Update-Regel ² aufnehmen (@request.body.<feld>:isset = false) oder entfernen.")
    indizes = list(c.get("indexes") or [])
    neue_indizes = [sql for n, sql in INDIZES.get(name, []) if not any(n in i for i in indizes)]
    if not fehlt and not neue_indizes and not geaendert_auswahl:
        ok(name + ": alle nötigen Felder da"); return c
    body = {}
    if fehlt or geaendert_auswahl: body["fields"] = felder
    if neue_indizes: body["indexes"] = indizes + neue_indizes
    s, d = anfrage("PATCH", "/api/collections/" + name, body)
    if s == 200:
        if fehlt: neu(name + ": Felder " + ", ".join(f["name"] for f in fehlt) + " angelegt")
        if geaendert_auswahl: neu(name + ".interval: Auswahl um „days“ (alle N Tage) ergänzt")
        if neue_indizes: neu(name + ": " + str(len(neue_indizes)) + " Index/Indizes angelegt")
    else:
        warn(name + ": nicht ergänzt: " + json.dumps(d, ensure_ascii=False)[:400])
    return sammlung(name)


def main():
    if len(sys.argv) > 2 and sys.argv[1] == "zurueck":
        zurueck(sys.argv[2]); return
    anwenden = len(sys.argv) > 1 and sys.argv[1] == "anwenden"
    if len(sys.argv) > 1 and not anwenden:
        print("Aufruf: mpg-einrichten.py [anwenden | zurueck <sicherung.json>]"); sys.exit(2)
    anmelden()
    print("Modus: " + ("ANWENDEN" if anwenden else "Sammlungen und Felder anlegen, Regeln nur zeigen (zum Setzen: … anwenden)"))

    print("\n1. Hook pb_hooks/mpg.pb.js")
    s, d = anfrage("GET", "/api/responda/mpg/fassung")
    fassung = d.get("fassung") if s == 200 and isinstance(d, dict) else None
    hook = isinstance(fassung, int) and not isinstance(fassung, bool) and fassung >= 3
    if hook: ok("läuft (Fassung " + str(fassung) + ": Löschen mit Aufbewahrung ab dem Löschen, Prüfintervall „alle N Tage“)")
    else: warn(f"antwortet {s} (404 heißt: nicht geladen oder alter Stand). Erst kopieren: cp /opt/responda-quelle/pb_hooks/mpg.pb.js "
               "/opt/pb_hooks/ und PocketBase neu starten. Bis dahin setzt dieses Skript keine Regeln.")

    print("\n2. Batch-API")
    s, d = anfrage("GET", "/api/settings")
    batch = (d.get("batch") or {}) if s == 200 else {}
    if s != 200: warn("Einstellungen nicht lesbar (" + str(s) + ")")
    elif batch.get("enabled"): ok("an (höchstens " + str(batch.get("maxRequests")) + " Anfragen je Sammelbuchung)")
    else: warn("aus. Bitte einschalten: Settings → Application → Batch API (Max. Anfragen 50 oder mehr).")

    print("\n3. users: Felder, auf die sich die Regeln beziehen")
    u = sammlung("users")
    if not u: warn("users nicht lesbar. Nichts geändert."); sys.exit(1)
    ufelder = {f["name"]: f for f in u["fields"]}
    users_ok = True
    for n, typ in (("disabled", "bool"), ("expires_at", "date")):
        f = ufelder.get(n)
        if not f: warn("users." + n + " fehlt (" + typ + ", nicht Pflicht). Vor den Regeln anlegen, sonst greifen Sperre und Ablauf still nicht."); users_ok = False
        elif f.get("type") != typ: warn("users." + n + " ist " + str(f.get("type")) + " statt " + typ + (" — Autodate macht jede neue Person sofort abgelaufen (docs, MPG „Felder prüfen“)" if f.get("type") == "autodate" else "") + "."); users_ok = False
    fehlt = [n for n in ("organization_id", "role", "supervisor", "permissions", "temp_permissions") if n not in ufelder]
    if fehlt: warn("users ohne " + ", ".join(fehlt) + ": Regeln greifen dann still nicht."); users_ok = False
    if users_ok: ok("disabled (Ja/Nein), expires_at (Datum), organization_id, role, supervisor, permissions, temp_permissions da")
    if "@request.auth.disabled != true" not in (u.get("updateRule") or ""):
        warn("Die users-Regeln prüfen noch kein gesperrtes Konto. Abschnitt „users: Rechte vergeben nur Verantwortliche“ "
             "(oder scripts/hygiene-einrichten.py anwenden, das die Fassung für 0.23.4 setzt).")

    print("\n4. Sammlungen und Felder")
    sammlungen = {}
    for name in REIHENFOLGE:
        c = einrichten(name, hook)
        if c: sammlungen[name] = c
    for name in sammlungen:
        n = zahl(name, 'id != ""')
        ok(name + ": " + (str(n) if n is not None else "?") + " Datensätze")
    fehlen_noetig = []
    for name, felder in NOETIG.items():
        da = {f["name"] for f in (sammlungen.get(name) or {}).get("fields", [])}
        fehlen_noetig += [name + "." + f for f in felder if f not in da]
    if fehlen_noetig: warn("Ohne " + ", ".join(fehlen_noetig) + " lehnt PocketBase die Regeln ab. Bitte zuerst anlegen.")

    print("\n5. Route der Defektmeldung (formular.pb.js)")
    s, d = anfrage("GET", "/api/responda/formular/zz-probe-unbekannt/geraete", mit_token=False)
    route = isinstance(d, dict) and d.get("grund") == "organisation"
    if route: ok("da: List und View von mpg_devices kommen auf „R“ (nur die eigene Organisation mit MPG-Zugang)")
    else: warn(f"nicht da (antwortet {s}): List und View von mpg_devices bleiben, wie sie sind. Erst formular.pb.js kopieren.")

    setzen = anwenden and hook and users_ok and not fehlen_noetig
    aenderungen = []
    print("\n6. Regeln des MPG")
    for name, regeln in ziel(R if route else None).items():
        if name not in sammlungen: continue
        alt = {k: sammlungen[name].get(k) for k in regeln}
        anders = [k for k in regeln if alt[k] != regeln[k]]
        if not anders: ok(name + ": schon so"); continue
        for k in anders:
            if alt[k] == "": warn(name + "." + k + " ist ÖFFENTLICH (leer)")
        if name == "mpg_devices" and alt.get("updateRule") == GERAET_UPDATE_BISHER:
            ok("mpg_devices.updateRule: bisherige Fassung, bekommt interval_days und geloescht dazu")
        ok(name + ": zu setzen: " + ", ".join(k + " (bisher " + wie(alt[k]) + ")" for k in anders))
        aenderungen.append((name, {k: regeln[k] for k in anders}, name + ": Regeln gesetzt (" + ", ".join(anders) + ")"))

    print("\n7. Sicherung und Setzen")
    if not aenderungen:
        ok("nichts zu ändern")
    elif not setzen:
        grund = "erst den Hook kopieren" if not hook else "erst die Felder oben anlegen" if (not users_ok or fehlen_noetig) else ""
        ok(str(len(aenderungen)) + " Änderung(en) " + (("nicht gesetzt: " + grund) if anwenden else "würden nach einer Sicherung gesetzt (… anwenden)"))
    else:
        stamm = os.path.join(SICHERUNG, "mpg-regeln-vorher-" + time.strftime("%Y%m%d-%H%M%S"))
        datei, n = stamm + ".json", 1
        while os.path.exists(datei): datei, n = stamm + "-" + str(n) + ".json", n + 1
        sicherung = {n_: {k: sammlungen[n_].get(k) for k in body} for n_, body, _ in aenderungen}
        sicherung["_gesetzt"] = {n_: body for n_, body, _ in aenderungen}
        try:
            with open(datei, "x") as f: json.dump(sicherung, f, ensure_ascii=False, indent=1)
            ok("gesichert in " + datei + " (zurück: python3 scripts/mpg-einrichten.py zurueck " + datei + ")")
        except Exception as e:
            warn("Sicherung nicht geschrieben (" + str(e) + "). Keine Regeln geändert."); sys.exit(1)
        for name, body, text_ in aenderungen:
            s, d = anfrage("PATCH", "/api/collections/" + name, body)
            if s == 200: neu(text_)
            else: warn(name + ": nicht gesetzt: " + json.dumps(d, ensure_ascii=False)[:400])

    print("\nNicht vergessen: „MPG verwalten“ an Gerätewarte und Wachleitung vergeben (Benutzerverwaltung → Rechte), sonst gibt"
          "\naußer Leitung und MPG-Beauftragten niemand ein gesperrtes Gerät frei.")
    if setzen or not aenderungen: print("\nFertig.")
    elif anwenden: print("\nFertig. Erst die Punkte oben erledigen, dann: python3 scripts/mpg-einrichten.py anwenden")
    else: print("\nFertig. Zum Setzen der Regeln: python3 scripts/mpg-einrichten.py anwenden")


if __name__ == "__main__":
    main()
