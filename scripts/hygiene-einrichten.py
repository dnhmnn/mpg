#!/usr/bin/env python3
# Responda: Hygiene einrichten (Owner, 23.11.2026: Reinigung und Desinfektion von Fahrzeugen, Räumen,
# Rucksäcken, Geräten und Material nach Intervall und Checkliste; jede Durchführung ist ein Nachweis).
#
# Aufruf auf dem Server (erst den Hook kopieren und PocketBase neu starten, siehe docs/pocketbase-regeln.md,
# „Hygiene: API-Regeln“):
#   cd /opt/responda-quelle && git pull && python3 scripts/hygiene-einrichten.py     Sammlungen anlegen, Regeln nur zeigen
#   python3 scripts/hygiene-einrichten.py anwenden                                     dazu Sicherung, dann Regeln setzen
#   python3 scripts/hygiene-einrichten.py zurueck /root/hygiene-regeln-vorher-….json   alte Regeln der Hygiene zurück
#   (users bleibt dabei auf der neuen Fassung: Die alte wirkt auf 0.23.4 nicht und öffnete die Lücke wieder.
#    Nur mit `zurueck <datei> users` auch users, und nur wenn dort noch genau die neue Fassung steht.)
#
# 1. Prüft, dass der Hook läuft (pb_hooks/hygiene.pb.js: GET /api/responda/hygiene/quellen ohne Anmeldung
#    antwortet 401, ohne Hook 404). Ohne Hook setzt „anwenden“ keine Regeln.
# 2. Prüft, ob die Batch-API an ist (die App schreibt Durchführungen als Sammelbuchung, genau einmal).
# 3. Legt hygiene_objekte und hygiene_durchfuehrungen an (gesperrt, bis die Regeln gesetzt sind) oder
#    ergänzt fehlende Felder und Indizes. Felder mit anderem Typ zeigt es nur.
# 4. Regeln der beiden Sammlungen: zeigt, was es täte; mit „anwenden“ nach einer Sicherung setzen.
# 5. users: das neue Recht hygiene_verwalten in die Liste der Rechte, die Ausbildungs-Verwalter nicht
#    vergeben dürfen (Update, Create, Übergangsregel), und zwar in der Fassung, die auch auf PocketBase 0.23.4
#    wirkt (die bisherige wirkt dort nicht, siehe unten). Nur wenn die Regel genau einer bekannten Fassung in
#    docs/pocketbase-regeln.md entspricht; sonst nichts ändern und auf die Doku verweisen.
# Beliebig oft ausführbar. Zeigt nie Namen oder Daten, nur Zahlen und Regeln.
# Gesperrt heißt null (Schloss), nie "" (das hieße öffentlich).
import getpass, json, os, sys, time, urllib.error, urllib.parse, urllib.request

API = os.environ.get("RESPONDA_API", "https://api.responda.systems").rstrip("/")
SICHERUNG = os.environ.get("RESPONDA_SICHERUNG", os.path.expanduser("~"))
TOKEN = ""
REGELN = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"]

# ── Regeln (wörtlich in docs/pocketbase-regeln.md, „Hygiene: API-Regeln“) ─────────────────────────────

AKTIV = '@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && @request.auth.role != "teilnehmer"'
ORG = 'organization_id = @request.auth.organization_id'
NEU_ORG = '@request.body.organization_id = @request.auth.organization_id'
BLEIBT = '(@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id)'
ZUGANG = '(@request.auth.permissions.dashboard = true || @request.auth.supervisor = true || (@request.auth.temp_permissions.dashboard.until ~ " " && @request.auth.temp_permissions.dashboard.until > @now))'
VERWALTEN = '(@request.auth.permissions.hygiene_verwalten = true || @request.auth.role = "admin" || @request.auth.supervisor = true || (@request.auth.temp_permissions.hygiene_verwalten.until ~ " " && @request.auth.temp_permissions.hygiene_verwalten.until > @now))'

ZIEL = {
    "hygiene_objekte": {
        "listRule": f"{AKTIV} && {ORG} && {ZUGANG}",
        "viewRule": f"{AKTIV} && {ORG} && {ZUGANG}",
        "createRule": f"{AKTIV} && {NEU_ORG} && {VERWALTEN}",
        "updateRule": f"{AKTIV} && {ORG} && {BLEIBT} && {VERWALTEN}",
        "deleteRule": None,
    },
    "hygiene_durchfuehrungen": {
        "listRule": f"{AKTIV} && {ORG} && {ZUGANG}",
        "viewRule": f"{AKTIV} && {ORG} && {ZUGANG}",
        "createRule": f"{AKTIV} && {NEU_ORG} && {ZUGANG}",
        "updateRule": None,
        "deleteRule": None,
    },
}

# ── Felder (Datenmodell: src/lib/hygiene/typen.ts) ──────────────────────────────────────────────────

def text(n, pflicht=False, max_=0): return {"name": n, "type": "text", "required": pflicht, "max": max_}
def auswahl(n, werte, pflicht=False): return {"name": n, "type": "select", "required": pflicht, "maxSelect": 1, "values": werte}
def zahl_(n, max_): return {"name": n, "type": "number", "required": False, "onlyInt": True, "min": 0, "max": max_}
def datum(n, pflicht=False): return {"name": n, "type": "date", "required": pflicht}
def jsonfeld(n): return {"name": n, "type": "json", "required": False, "maxSize": 100000}
ZEITEN = [{"name": "created", "type": "autodate", "onCreate": True, "onUpdate": False},
          {"name": "updated", "type": "autodate", "onCreate": True, "onUpdate": True}]

FELDER = {
    "hygiene_objekte": [
        text("organization_id", True),
        text("name", True, 120),
        auswahl("art", ["fahrzeug", "raum", "rucksack", "geraet", "material", "sonstiges"], True),
        text("standort", False, 120),
        auswahl("intervall", ["taeglich", "woechentlich", "tage", "monatlich", "benutzung"], True),
        zahl_("intervall_tage", 365),
        jsonfeld("punkte"),
        auswahl("quelle", ["mpg_geraet", "lager_ort", "lager_satz", "lager_artikel"]),
        text("quelle_id", False, 64),
        text("quelle_name", False, 200),
        datum("archiviert"),
    ] + ZEITEN,
    "hygiene_durchfuehrungen": [
        text("organization_id", True),
        text("objekt_id", True),
        text("objekt_name", False, 200),
        auswahl("art", ["plan", "anlass"], True),
        auswahl("anlass", ["infektion", "verschmutzung", "sonstiges"]),
        text("einsatz_nummer", False, 40),
        jsonfeld("punkte"),
        zahl_("offen", 40),
        text("bemerkung", False, 1000),
        datum("zeitpunkt", True),
        text("user_id"),
        text("user_name", False, 200),
    ] + ZEITEN,
}

INDIZES = {
    "hygiene_objekte": [
        ("idx_hygiene_objekte_org", "CREATE INDEX `idx_hygiene_objekte_org` ON `hygiene_objekte` (`organization_id`)"),
    ],
    "hygiene_durchfuehrungen": [
        ("idx_hygiene_df_org_zeit", "CREATE INDEX `idx_hygiene_df_org_zeit` ON `hygiene_durchfuehrungen` (`organization_id`, `zeitpunkt`)"),
        ("idx_hygiene_df_objekt", "CREATE INDEX `idx_hygiene_df_objekt` ON `hygiene_durchfuehrungen` (`objekt_id`)"),
    ],
}

# ── users: Rechte, die Ausbildungs-Verwalter nicht vergeben ────────────────────────────────────────
# Die bisherigen Fassungen aus docs/pocketbase-regeln.md („users: Rechte vergeben nur Verantwortliche“),
# wörtlich. Nur wenn die Regel auf dem Server genau so lautet, wird sie ersetzt.
#
# Auf PocketBase 0.23.4 (Produktion) wirkt darin die Liste der Rechte nicht: Einen Pfad in das JSON der Anfrage
# (@request.body.permissions.<recht>) wertet 0.23.4 nie aus, erst neuere Versionen. Ein Ausbildungs-Verwalter
# konnte so einem Teilnehmer jedes Recht geben, auch die Benutzerverwaltung, und über dieses Konto Leitung werden.
# Die neue Fassung (Liste mit hygiene_verwalten) prüft zusätzlich, was auf 0.23.4 wirkt:
#  - Create: das Feld des neuen Datensatzes (permissions.<recht>, wie es gespeichert wird) und keine befristeten
#    Rechte (temp_permissions fehlte in diesem Zweig ganz: auch so ließ sich die Benutzerverwaltung vergeben).
#  - Update: den Text der gesendeten Rechte. Kommt ein Recht darin vor, dann nur einmal und mit false, außer die
#    Person hat es schon.
#  - beide: kein \u im gesendeten Text (sonst ließe sich der Name eines Rechts verschleiern) und kein Recht doppelt
#    (0.23.4 speichert doppelte Schlüssel; die Regeln läsen den ersten, die Hooks und die App den letzten).
# Im Update bleibt der Pfad in das JSON drin: Er wirkt auf neueren Versionen (0.40.5) und schadet auf 0.23.4 nicht.
# Beim Anlegen ersetzt ihn das Feld des neuen Datensatzes, das auf beiden Versionen wirkt.

ALT_UPDATE = '@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && ((@request.auth.supervisor = true && @request.body.supervisor:isset = false) || (organization_id = @request.auth.organization_id && (@request.auth.role = "admin" || @request.auth.permissions.unitarii = true || (@request.auth.temp_permissions.unitarii.until ~ " " && @request.auth.temp_permissions.unitarii.until > @now)) && supervisor != true && @request.body.supervisor:isset = false && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id)) || (id = @request.auth.id && @request.body.permissions:isset = false && @request.body.temp_permissions:isset = false && @request.body.role:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false && @request.body.permissions_migrated:isset = false && @request.body.zusatzrollen:isset = false) || (organization_id = @request.auth.organization_id && @request.auth.permissions.ausbildungen_manage = true && id != @request.auth.id && supervisor != true && (role = "teilnehmer" || ((role = "benutzer" || role = "") && @request.body.role = "teilnehmer")) && (@request.body.role:isset = false || @request.body.role = "teilnehmer") && @request.body.temp_permissions:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false && @request.body.permissions_migrated:isset = false && @request.body.zusatzrollen:isset = false && (@request.body.permissions.dashboard != true || permissions.dashboard = true) && (@request.body.permissions.unitarii != true || permissions.unitarii = true) && (@request.body.permissions.patienten != true || permissions.patienten = true) && (@request.body.permissions.dokumente != true || permissions.dokumente = true) && (@request.body.permissions.einsaetze != true || permissions.einsaetze = true) && (@request.body.permissions.eks != true || permissions.eks = true) && (@request.body.permissions.lager != true || permissions.lager = true) && (@request.body.permissions.lager_verwalten != true || permissions.lager_verwalten = true) && (@request.body.permissions.produktausgabe != true || permissions.produktausgabe = true) && (@request.body.permissions.dateien != true || permissions.dateien = true) && (@request.body.permissions.ausbildungen_manage != true || permissions.ausbildungen_manage = true) && (@request.body.permissions.mpg_verwalten != true || permissions.mpg_verwalten = true)))'
ALT_UEBERGANG = '@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && ((@request.auth.supervisor = true && @request.body.supervisor:isset = false) || (organization_id = @request.auth.organization_id && (@request.auth.role = "admin" || @request.auth.permissions.unitarii = true || (@request.auth.temp_permissions.unitarii.until ~ " " && @request.auth.temp_permissions.unitarii.until > @now)) && supervisor != true && @request.body.supervisor:isset = false && (@request.body.organization_id:isset = false || @request.body.organization_id = @request.auth.organization_id)) || (id = @request.auth.id && @request.body.permissions:isset = false && @request.body.temp_permissions:isset = false && @request.body.role:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false && @request.body.permissions_migrated:isset = false && @request.body.zusatzrollen:isset = false) || (organization_id = @request.auth.organization_id && @request.auth.permissions.ausbildungen_manage = true && id != @request.auth.id && supervisor != true && (role = "teilnehmer" || ((role = "benutzer" || role = "") && @request.body.role = "teilnehmer")) && (@request.body.role:isset = false || @request.body.role = "teilnehmer") && @request.body.temp_permissions:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false && @request.body.permissions_migrated:isset = false && @request.body.zusatzrollen:isset = false && (@request.body.permissions.dashboard != true || permissions.dashboard = true) && (@request.body.permissions.unitarii != true || permissions.unitarii = true) && (@request.body.permissions.patienten != true || permissions.patienten = true) && (@request.body.permissions.dokumente != true || permissions.dokumente = true) && (@request.body.permissions.einsaetze != true || permissions.einsaetze = true) && (@request.body.permissions.eks != true || permissions.eks = true) && (@request.body.permissions.lager != true || permissions.lager = true) && (@request.body.permissions.lager_verwalten != true || permissions.lager_verwalten = true) && (@request.body.permissions.produktausgabe != true || permissions.produktausgabe = true) && (@request.body.permissions.dateien != true || permissions.dateien = true) && (@request.body.permissions.ausbildungen_manage != true || permissions.ausbildungen_manage = true) && (@request.body.permissions.mpg_verwalten != true || permissions.mpg_verwalten = true)) || (id = @request.auth.id && permissions_migrated != true && @request.body.permissions_migrated = true && @request.body.temp_permissions:isset = false && @request.body.role:isset = false && @request.body.supervisor:isset = false && @request.body.organization_id:isset = false && @request.body.disabled:isset = false && @request.body.expires_at:isset = false && @request.body.zusatzrollen:isset = false))'
ALT_CREATE = '@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && ((@request.auth.supervisor = true && (@request.body.supervisor:isset = false || @request.body.supervisor = false)) || (@request.body.organization_id = @request.auth.organization_id && (@request.body.supervisor:isset = false || @request.body.supervisor = false) && ((@request.auth.role = "admin" || @request.auth.permissions.unitarii = true || (@request.auth.temp_permissions.unitarii.until ~ " " && @request.auth.temp_permissions.unitarii.until > @now)) || (@request.auth.permissions.ausbildungen_manage = true && @request.body.role = "teilnehmer" && @request.body.zusatzrollen:isset = false && @request.body.permissions.dashboard != true && @request.body.permissions.unitarii != true && @request.body.permissions.patienten != true && @request.body.permissions.dokumente != true && @request.body.permissions.einsaetze != true && @request.body.permissions.eks != true && @request.body.permissions.lager != true && @request.body.permissions.lager_verwalten != true && @request.body.permissions.produktausgabe != true && @request.body.permissions.dateien != true && @request.body.permissions.ausbildungen_manage != true && @request.body.permissions.mpg_verwalten != true))))'

RECHTE_BISHER = ["dashboard", "unitarii", "patienten", "dokumente", "einsaetze", "eks", "lager", "lager_verwalten",
                 "produktausgabe", "dateien", "ausbildungen_manage", "mpg_verwalten"]
RECHTE = RECHTE_BISHER + ["hygiene_verwalten"]


def liste_update(rechte):  # bisher: wirkt nur auf neueren Versionen
    return " && ".join(f"(@request.body.permissions.{x} != true || permissions.{x} = true)" for x in rechte)


def liste_create(rechte):
    return "".join(f" && @request.body.permissions.{x} != true" for x in rechte)


KEIN_ESCAPE = '@request.body.permissions !~ "\\\\u"'  # in der Regel: "\\u"


def einmal(x):
    return f"@request.body.permissions !~ '%\"{x}\"%\"{x}\"%'"


def wirksam_update():
    pro = " && ".join(
        f"((@request.body.permissions.{x} != true && (@request.body.permissions !~ '\"{x}\"' || "
        f"(@request.body.permissions ~ '\"{x}\":false' && {einmal(x)}))) || permissions.{x} = true)" for x in RECHTE)
    return f"(@request.body.permissions:isset = false || ({KEIN_ESCAPE} && {pro}))"


def wirksam_create():
    return ("".join(f" && permissions.{x} != true" for x in RECHTE)
            + f" && (@request.body.permissions:isset = false || ({KEIN_ESCAPE} && " + " && ".join(einmal(x) for x in RECHTE) + "))")


def ersetzt(regel, alt, neu):
    if regel.count(alt) != 1: raise SystemExit("Interner Fehler: Teil nicht genau einmal in der Regel.")
    return regel.replace(alt, neu)


# Zwischenstand (Liste nur um hygiene_verwalten ergänzt, ohne Wirkung auf 0.23.4) aus einem früheren Stand dieser Datei
ZW_UPDATE = ersetzt(ALT_UPDATE, liste_update(RECHTE_BISHER), liste_update(RECHTE))
ZW_UEBERGANG = ersetzt(ALT_UEBERGANG, liste_update(RECHTE_BISHER), liste_update(RECHTE))
ZW_CREATE = ersetzt(ALT_CREATE, liste_create(RECHTE_BISHER), liste_create(RECHTE))
# Neue Fassung (wörtlich in docs/pocketbase-regeln.md)
NEU_UPDATE = ersetzt(ALT_UPDATE, liste_update(RECHTE_BISHER), wirksam_update())
NEU_UEBERGANG = ersetzt(ALT_UEBERGANG, liste_update(RECHTE_BISHER), wirksam_update())
NEU_CREATE = ersetzt(ersetzt(ALT_CREATE, liste_create(RECHTE_BISHER), wirksam_create()),
                     '@request.body.zusatzrollen:isset = false', '@request.body.zusatzrollen:isset = false && @request.body.temp_permissions:isset = false')

# Regel → (bekannte frühere Fassungen: Name, Text, Ersatz), (neue Fassungen: Name, Text)
USERS = {
    "updateRule": ([("Update-Regel", ALT_UPDATE, NEU_UPDATE), ("Update-Regel (Zwischenstand)", ZW_UPDATE, NEU_UPDATE),
                    ("Übergangsregel", ALT_UEBERGANG, NEU_UEBERGANG), ("Übergangsregel (Zwischenstand)", ZW_UEBERGANG, NEU_UEBERGANG)],
                   [("Update-Regel", NEU_UPDATE), ("Übergangsregel", NEU_UEBERGANG)]),
    "createRule": ([("Create-Regel", ALT_CREATE, NEU_CREATE), ("Create-Regel (Zwischenstand)", ZW_CREATE, NEU_CREATE)],
                   [("Create-Regel", NEU_CREATE)]),
}
UEBERGANG = {ALT_UEBERGANG, ZW_UEBERGANG, NEU_UEBERGANG}


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
    mail = input("Superuser-E-Mail: ").strip()
    pw = getpass.getpass("Passwort: ")
    s, d = anfrage("POST", "/api/collections/_superusers/auth-with-password", {"identity": mail, "password": pw})
    if s != 200 or not d.get("token"):
        print("Anmeldung fehlgeschlagen (" + str(s) + "), nichts geändert."); sys.exit(1)
    TOKEN = d["token"]


def wie(regel):
    if regel is None: return "gesperrt (null)"
    if regel == "": return "ÖFFENTLICH (leer)"
    return "eine andere Regel"


def zurueck(datei, mit_users=False):
    """Regeln aus der Sicherung zurück, aber nur, wo seitdem nichts anderes gesetzt wurde. users nur auf
    ausdrücklichen Wunsch: Die alte Fassung wirkt auf 0.23.4 nicht (ein Ausbildungs-Verwalter käme zur Leitung),
    und die neue schadet ohne Hygiene nicht."""
    anmelden()
    try: alt = json.load(open(datei))
    except Exception as e: print("Sicherung nicht lesbar: " + str(e)); sys.exit(1)
    for name, regeln in alt.items():
        jetzt = sammlung(name) or {}
        if name == "users":
            if not mit_users:
                ok("users: nicht angefasst. Die neue Fassung bleibt; sie schließt die Lücke und schadet ohne Hygiene nicht. "
                   "Nur mit „… zurueck " + datei + " users“ auch users zurück.")
                continue
            neue = {k: {t for _, t in USERS[k][1]} for k in USERS}
            if any(jetzt.get(k) not in neue.get(k, set()) for k in regeln):
                warn("users: Die Regeln sind seit dem Setzen geändert worden, nicht angefasst.")
                continue
            warn("users: alte Fassung zurück. ACHTUNG: Auf PocketBase 0.23.4 wirkt die Liste der Rechte darin nicht "
                 "(docs/pocketbase-regeln.md, „users: Rechte vergeben nur Verantwortliche“).")
        elif name in ZIEL and any(jetzt.get(k) != ZIEL[name].get(k) for k in regeln):
            warn(name + ": Die Regeln sind seit dem Setzen geändert worden, nicht angefasst.")
            continue
        s, d = anfrage("PATCH", "/api/collections/" + name, regeln)
        (neu if s == 200 else warn)(name + (": alte Regeln zurück" if s == 200 else ": " + json.dumps(d, ensure_ascii=False)[:300]))


def einrichten(name):
    """Sammlung anlegen (gesperrt) oder fehlende Felder und Indizes ergänzen."""
    c = sammlung(name)
    if not c:
        s, d = anfrage("POST", "/api/collections", {
            "name": name, "type": "base", "fields": FELDER[name], "indexes": [sql for _, sql in INDIZES[name]],
            **{k: None for k in REGELN}})
        if s == 200: neu(name + " angelegt (alle Regeln gesperrt, bis sie gesetzt sind)")
        else: warn(name + " nicht angelegt: " + json.dumps(d, ensure_ascii=False)[:400])
        return sammlung(name)
    da = {f["name"]: f for f in c["fields"]}
    fehlt = [f for f in FELDER[name] if f["name"] not in da]
    for f in FELDER[name]:
        x = da.get(f["name"])
        if x and x.get("type") != f["type"]:
            warn(name + "." + f["name"] + " ist " + str(x.get("type")) + " statt " + f["type"] + ". Bitte von Hand ansehen.")
        elif x and f["type"] == "select" and sorted(x.get("values") or []) != sorted(f["values"]):
            warn(name + "." + f["name"] + ": andere Auswahl (" + ", ".join(x.get("values") or []) + "). Bitte von Hand ansehen.")
    indizes = list(c.get("indexes") or [])
    neue_indizes = [sql for n, sql in INDIZES[name] if not any(n in i for i in indizes)]
    if not fehlt and not neue_indizes:
        ok(name + ": alle Felder und Indizes da"); return c
    body = {}
    if fehlt: body["fields"] = c["fields"] + fehlt
    if neue_indizes: body["indexes"] = indizes + neue_indizes
    s, d = anfrage("PATCH", "/api/collections/" + name, body)
    if s == 200:
        if fehlt: neu(name + ": Felder " + ", ".join(f["name"] for f in fehlt) + " angelegt")
        if neue_indizes: neu(name + ": " + str(len(neue_indizes)) + " Index/Indizes angelegt")
    else:
        warn(name + ": nicht ergänzt: " + json.dumps(d, ensure_ascii=False)[:400])
    return sammlung(name)


def main():
    if len(sys.argv) > 2 and sys.argv[1] == "zurueck":
        zurueck(sys.argv[2], mit_users=len(sys.argv) > 3 and sys.argv[3] == "users"); return
    anwenden = len(sys.argv) > 1 and sys.argv[1] == "anwenden"
    if len(sys.argv) > 1 and not anwenden:
        print("Aufruf: hygiene-einrichten.py [anwenden | zurueck <sicherung.json> [users]]"); sys.exit(2)
    anmelden()
    print("Modus: " + ("ANWENDEN" if anwenden else "Sammlungen anlegen, Regeln nur zeigen (zum Setzen: … anwenden)"))

    print("\n1. Hook pb_hooks/hygiene.pb.js")
    s, _ = anfrage("GET", "/api/responda/hygiene/quellen", mit_token=False)
    hook = s == 401
    if hook: ok("läuft (Route quellen antwortet ohne Anmeldung 401)")
    else: warn(f"antwortet {s} statt 401 (404 heißt: Hook nicht geladen). Erst kopieren: cp /opt/responda-quelle/pb_hooks/hygiene.pb.js /opt/pb_hooks/ und PocketBase neu starten. Ohne Hook setzt dieses Skript keine Regeln (Nachweise wären änderbar, Namen nicht vom Server).")

    print("\n2. Batch-API")
    s, d = anfrage("GET", "/api/settings")
    batch = (d.get("batch") or {}) if s == 200 else {}
    if s != 200: warn("Einstellungen nicht lesbar (" + str(s) + ")")
    elif batch.get("enabled"): ok("an (höchstens " + str(batch.get("maxRequests")) + " Anfragen je Sammelbuchung)")
    else: warn("aus. Bitte einschalten: Settings → Application → Batch API (Max. Anfragen 50 oder mehr). Sonst schreibt die App Anfrage für Anfrage.")

    print("\n3. users: Felder, auf die sich die Regeln beziehen")
    u = sammlung("users")
    if not u: warn("users nicht lesbar. Nichts geändert."); sys.exit(1)
    unamen = {f["name"] for f in u["fields"]}
    fehlt = [f for f in ("organization_id", "role", "supervisor", "permissions", "temp_permissions", "disabled", "expires_at", "name") if f not in unamen]
    if fehlt: warn("users ohne " + ", ".join(fehlt) + ": Regeln greifen dann still nicht (docs/pocketbase-regeln.md, MPG „Felder prüfen“).")
    else: ok("organization_id, role, supervisor, permissions, temp_permissions, disabled, expires_at, name da")

    print("\n4. Sammlungen")
    sammlungen = {}
    for name in ZIEL:
        c = einrichten(name)
        if c: sammlungen[name] = c
    for name in sammlungen:
        n = zahl(name, 'id != ""')
        ok(name + ": " + (str(n) if n is not None else "?") + " Datensätze")

    setzen = anwenden and hook
    aenderungen = []  # (Sammlung, Regeln, Text)

    print("\n5. Regeln der Hygiene")
    for name, regeln in ZIEL.items():
        if name not in sammlungen: continue
        alt = {k: sammlungen[name].get(k) for k in REGELN}
        if alt == regeln: ok(name + ": schon so"); continue
        anders = [k for k in REGELN if alt[k] != regeln[k]]
        for k in anders:
            if alt[k] == "": warn(name + "." + k + " ist ÖFFENTLICH (leer)")
        ok(name + ": zu setzen: " + ", ".join(k + " (bisher " + wie(alt[k]) + ")" for k in anders))
        aenderungen.append((name, regeln, name + ": Regeln gesetzt (" + ", ".join(anders) + ")"))

    print("\n6. users: Rechte, die Ausbildungs-Verwalter nicht vergeben (mit „Hygiene verwalten“, wirksam auch auf 0.23.4)")
    for k, (fruehere, neue) in USERS.items():
        jetzt = u.get(k)
        schon = next((t for t, n in neue if jetzt == n), None)
        treffer = next(((t, n) for t, a, n in fruehere if jetzt == a), None)
        if schon:
            ok(k + ": " + schon + " wie in docs/pocketbase-regeln.md (Liste mit hygiene_verwalten, wirkt auch auf 0.23.4)")
        elif treffer is None:
            warn(k + ": weicht von den bekannten Fassungen in docs/pocketbase-regeln.md ab, nicht angefasst. Auf PocketBase "
                 "0.23.4 wirkt die Liste der Rechte im Zweig der Ausbildungs-Verwalter nur in der neuen Fassung: von Hand "
                 "mit dem Abschnitt „users: Rechte vergeben nur Verantwortliche“ vergleichen und ersetzen.")
        else:
            ok(k + ": " + treffer[0] + " wie in der Doku, wird durch die neue Fassung ersetzt")
            aenderungen.append(("users", {k: treffer[1]}, k + ": " + treffer[0] + " durch die neue Fassung ersetzt (Liste mit hygiene_verwalten, wirkt auch auf 0.23.4)"))
    if u.get("updateRule") in UEBERGANG:
        warn("Als Update-Regel steht die Übergangsregel: Konten ohne permissions_migrated (auch neue Teilnehmer) können "
             "sich damit beim ersten Anmelden beliebige Rechte geben. Abschnitt „users: Rechte vergeben nur Verantwortliche“, "
             "„Rechte-Übernahme beim ersten Login“.")

    print("\n7. Sicherung und Setzen")
    if not aenderungen:
        ok("nichts zu ändern")
    elif not setzen:
        ok(str(len(aenderungen)) + " Änderung(en) " + ("nicht gesetzt: erst den Hook kopieren" if anwenden else "würden nach einer Sicherung gesetzt (… anwenden)"))
    else:
        # Nie eine vorhandene Sicherung überschreiben
        stamm = os.path.join(SICHERUNG, "hygiene-regeln-vorher-" + time.strftime("%Y%m%d-%H%M%S"))
        datei, n = stamm + ".json", 1
        while os.path.exists(datei): datei, n = stamm + "-" + str(n) + ".json", n + 1
        sicherung = {n_: {k: c.get(k) for k in REGELN} for n_, c in sammlungen.items()}
        sicherung["users"] = {k: u.get(k) for k in ("updateRule", "createRule")}
        try:
            with open(datei, "x") as f: json.dump(sicherung, f, ensure_ascii=False, indent=1)
            ok("gesichert in " + datei + " (zurück: python3 scripts/hygiene-einrichten.py zurueck " + datei + ")")
        except Exception as e:
            warn("Sicherung nicht geschrieben (" + str(e) + "). Keine Regeln geändert."); sys.exit(1)
        for name, body, text_ in aenderungen:
            s, d = anfrage("PATCH", "/api/collections/" + name, body)
            if s == 200: neu(text_)
            else: warn(name + ": nicht gesetzt: " + json.dumps(d, ensure_ascii=False)[:400])

    if setzen or not aenderungen: print("\nFertig.")
    elif anwenden: print("\nFertig. Erst den Hook kopieren und PocketBase neu starten, dann: python3 scripts/hygiene-einrichten.py anwenden")
    else: print("\nFertig. Zum Setzen der Regeln: python3 scripts/hygiene-einrichten.py anwenden")


if __name__ == "__main__":
    main()
