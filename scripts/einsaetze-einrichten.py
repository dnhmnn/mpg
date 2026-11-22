#!/usr/bin/env python3
# Responda: Einsätze einrichten und EKS entfernen (Owner, 22.11.2026).
# Aufruf auf dem Server:  cd /opt/responda-quelle && git pull && python3 scripts/einsaetze-einrichten.py
#                         ... eks-loeschen   (zusätzlich: Sicherung, dann EKS-Daten endgültig löschen)
# Beschrieben in docs/pocketbase-regeln.md, „Einsätze aus der Dokumentation“ und „EKS entfernt“.
#
# - einsaetze: Felder organisationen und verknuepfungen (JSON), Löschen für Leitung und Recht Einsätze
# - einsatz_personen: anlegen, falls es sie nicht gibt (sonst nur zeigen)
# - cirs_reports: Feld einsatz_id (Verknüpfung, nur für CIRS-Berechtigte sichtbar)
# - eks_events: zeigt die Zahl; mit „eks-loeschen“ nach einer Sicherung und Rückfrage endgültig löschen
# Ändert sonst nichts; zweimal ausführen schadet nicht. Zeigt nie Namen, Adressen oder Inhalte.
import getpass, json, os, sys, time, urllib.error, urllib.parse, urllib.request

API = os.environ.get("RESPONDA_API", "https://api.responda.systems").rstrip("/")
TOKEN = ""

AKTIV = '@request.auth.id != "" && @request.auth.disabled != true && (@request.auth.expires_at = "" || @request.auth.expires_at > @now) && @request.auth.role != "teilnehmer"'
RECHT = '(@request.auth.supervisor = true || @request.auth.role = "admin" || @request.auth.permissions.einsaetze = true || (@request.auth.temp_permissions.einsaetze.until ~ " " && @request.auth.temp_permissions.einsaetze.until > @now))'
LOESCHEN = AKTIV + ' && organization_id = @request.auth.organization_id && ' + RECHT
PERSONEN = AKTIV + ' && einsatz_id.organization_id = @request.auth.organization_id && ' + RECHT
PERSONEN_LESEN = AKTIV + ' && einsatz_id.organization_id = @request.auth.organization_id'


def anfrage(methode, pfad, body=None):
    daten = json.dumps(body).encode() if body is not None else None
    kopf = {"Content-Type": "application/json"}
    if TOKEN: kopf["Authorization"] = TOKEN
    q = urllib.request.Request(API + pfad, data=daten, method=methode, headers=kopf)
    try:
        with urllib.request.urlopen(q, timeout=120) as r:
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


def felder_dazu(name, liste):
    c = sammlung(name)
    if not c: warn(name + " gibt es nicht"); return
    da = {f["name"] for f in c["fields"]}
    fehlt = [f for f in liste if f["name"] not in da]
    if not fehlt: ok(name + ": Felder " + ", ".join(f["name"] for f in liste) + " da"); return
    s, d = anfrage("PATCH", "/api/collections/" + name, {"fields": c["fields"] + fehlt})
    if s == 200: neu(name + ": Felder " + ", ".join(f["name"] for f in fehlt) + " angelegt")
    else: warn(name + ": Felder nicht angelegt: " + json.dumps(d, ensure_ascii=False)[:400])


def main():
    global TOKEN
    eks_weg = len(sys.argv) > 1 and sys.argv[1] == "eks-loeschen"
    mail = input("Superuser-E-Mail: ").strip()
    pw = getpass.getpass("Passwort: ")
    s, d = anfrage("POST", "/api/collections/_superusers/auth-with-password", {"identity": mail, "password": pw})
    if s != 200 or not d.get("token"):
        print("Anmeldung fehlgeschlagen (" + str(s) + "), nichts geändert."); sys.exit(1)
    TOKEN = d["token"]

    print("1. einsaetze")
    c = sammlung("einsaetze")
    if not c:
        warn("Sammlung einsaetze gibt es nicht. Nichts geändert.")
    else:
        felder_dazu("einsaetze", [{"name": "organisationen", "type": "json", "required": False, "maxSize": 0},
                                  {"name": "verknuepfungen", "type": "json", "required": False, "maxSize": 0}])
        c = sammlung("einsaetze")
        for k in ("listRule", "viewRule", "createRule", "updateRule"):
            print("           " + k + ": " + json.dumps(c.get(k), ensure_ascii=False))
        if c.get("deleteRule") == LOESCHEN:
            ok("Löschen: Leitung und Recht Einsätze")
        else:
            print("           deleteRule vorher: " + json.dumps(c.get("deleteRule"), ensure_ascii=False))
            s, d = anfrage("PATCH", "/api/collections/einsaetze", {"deleteRule": LOESCHEN})
            if s == 200: neu("Löschen: Leitung und Recht Einsätze")
            else: warn("Löschen nicht gesetzt: " + json.dumps(d, ensure_ascii=False)[:300])

    print("2. einsatz_personen")
    p = sammlung("einsatz_personen")
    if p:
        ok("gibt es schon. Felder: " + ", ".join(f["name"] for f in p["fields"] if not f.get("system")))
        ref = next((f for f in p["fields"] if f["name"] == "einsatz_id"), None)
        if ref and ref.get("type") == "relation" and not ref.get("cascadeDelete"):
            ref["cascadeDelete"] = True
            s, d = anfrage("PATCH", "/api/collections/einsatz_personen", {"fields": p["fields"]})
            if s == 200: neu("einsatz_id: Personen verschwinden mit dem Einsatz (cascadeDelete)")
            else: warn("cascadeDelete nicht gesetzt: " + json.dumps(d, ensure_ascii=False)[:300])
        for k in ("listRule", "createRule", "deleteRule"):
            print("           " + k + ": " + json.dumps(p.get(k), ensure_ascii=False))
    elif c:
        u = sammlung("users")
        felder = [
            {"name": "einsatz_id", "type": "relation", "collectionId": c["id"], "cascadeDelete": True, "maxSelect": 1, "required": True},
            {"name": "user_id", "type": "relation", "collectionId": u["id"], "cascadeDelete": True, "maxSelect": 1, "required": True},
            {"name": "rolle", "type": "text", "required": False, "max": 80},
            {"name": "created", "type": "autodate", "onCreate": True, "onUpdate": False},
            {"name": "updated", "type": "autodate", "onCreate": True, "onUpdate": True},
        ]
        s, d = anfrage("POST", "/api/collections", {"name": "einsatz_personen", "type": "base", "fields": felder,
            "listRule": PERSONEN_LESEN, "viewRule": PERSONEN_LESEN, "createRule": PERSONEN, "updateRule": PERSONEN, "deleteRule": PERSONEN})
        if s == 200: neu("angelegt (Personen eines Einsatzes, verschwinden mit dem Einsatz)")
        else: warn("nicht angelegt: " + json.dumps(d, ensure_ascii=False)[:400])

    print("3. cirs_reports")
    if sammlung("cirs_reports"):
        felder_dazu("cirs_reports", [{"name": "einsatz_id", "type": "text", "required": False, "max": 15}])
    else:
        warn("cirs_reports gibt es nicht (CIRS nicht eingerichtet), übersprungen")

    print("4. EKS (eks_events)")
    e = sammlung("eks_events")
    if not e:
        ok("eks_events gibt es nicht (mehr)")
    else:
        s, d = anfrage("GET", "/api/collections/eks_events/records?perPage=1&fields=id")
        zahl = d.get("totalItems", "?") if s == 200 else "?"
        print("           " + str(zahl) + " Einträge in eks_events")
        if not eks_weg:
            print("           Zum Löschen: python3 scripts/einsaetze-einrichten.py eks-loeschen")
        else:
            print("           Das Einsatztagebuch kann ein Nachweis sein. Gelöscht ist es nur noch in der Sicherung.")
            if input("           Zum endgültigen Löschen LÖSCHEN eintippen: ").strip() != "LÖSCHEN":
                print("           Nicht gelöscht.")
            else:
                name = "vor-eks-loeschen-" + time.strftime("%Y%m%d-%H%M%S") + ".zip"
                s, d = anfrage("POST", "/api/backups", {"name": name})
                if s not in (200, 204):
                    warn("Sicherung nicht angelegt (" + str(s) + "), nichts gelöscht: " + json.dumps(d, ensure_ascii=False)[:300]); sys.exit(1)
                da = False
                for _ in range(120):
                    s, liste = anfrage("GET", "/api/backups")
                    if s == 200 and any(b.get("key") == name for b in (liste or [])): da = True; break
                    time.sleep(2)
                if not da:
                    warn("Sicherung " + name + " nicht gefunden, nichts gelöscht."); sys.exit(1)
                neu("Sicherung " + name + " (PocketBase-Admin → Settings → Backups)")
                s, d = anfrage("DELETE", "/api/collections/eks_events")
                if s in (200, 204): neu("eks_events gelöscht")
                else: warn("eks_events nicht gelöscht (" + str(s) + "): " + json.dumps(d, ensure_ascii=False)[:300])
    print("Fertig.")


if __name__ == "__main__":
    main()
