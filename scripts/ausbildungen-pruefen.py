#!/usr/bin/env python3
# Responda: Ausbildungen und Lernbar auf Mandantentrennung prüfen (Owner, 23.11.2026: „Ausbildungen ist
# vermutlich nicht multi-tenant-fähig, eine Benachrichtigung für eine Organisation wird allen angezeigt“).
# Aufruf auf dem Server:  cd /opt/responda-quelle && git pull && python3 scripts/ausbildungen-pruefen.py
#
# Ändert nichts. Zeigt für jede Sammlung ausbildungen_* und lernbar_* die Felder (Name, Typ, Ziel einer
# Relation) und die fünf API-Regeln und markiert, was nicht auf die eigene Organisation beschränkt ist:
#   OFFEN       Regel leer: jeder, auch ohne Anmeldung
#   ALLE ORGS   Regel erwähnt weder die Organisation noch die eigene Person
# Zeigt nie Datensätze, Namen oder Inhalte, nur Aufbau und Regeln.
import getpass, json, os, sys, urllib.error, urllib.request

API = os.environ.get("RESPONDA_API", "https://api.responda.systems").rstrip("/")
TOKEN = ""
REGELN = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"]
NAME = {"listRule": "List", "viewRule": "View", "createRule": "Create", "updateRule": "Update", "deleteRule": "Delete"}


def anfrage(methode, pfad, body=None):
    daten = json.dumps(body).encode() if body is not None else None
    kopf = {"Content-Type": "application/json"}
    if TOKEN: kopf["Authorization"] = TOKEN
    q = urllib.request.Request(API + pfad, data=daten, method=methode, headers=kopf)
    try:
        with urllib.request.urlopen(q, timeout=60) as r:
            t = r.read()
            return r.status, (json.loads(t) if t else {})
    except urllib.error.HTTPError as e:
        t = e.read()
        try: return e.code, json.loads(t)
        except Exception: return e.code, {"message": t[:300].decode("utf-8", "replace")}


def bewertung(regel):
    """Kurzurteil zu einer Regel (None = nur Superuser). Grob: Die Regeln stehen darunter vollständig."""
    if regel is None: return "gesperrt (nur Superuser)"
    if regel.strip() == "": return "OFFEN: jeder, auch ohne Anmeldung"
    r = regel.replace(" ", "")
    if "organization_id" in r or "organisation_id" in r:
        return "erwähnt die Organisation (genau prüfen, besonders Teile mit ||)"
    if "@request.auth.id" in r and ("=@request.auth.id" in r or "@request.auth.id=" in r.replace("@request.auth.id!=", "")):
        return "bezieht die eigene Person ein (genau prüfen)"
    return "ALLE ORGS: erwähnt die Organisation nicht"


def main():
    global TOKEN
    mail = input("Superuser-E-Mail: ").strip()
    pw = getpass.getpass("Passwort: ")
    s, d = anfrage("POST", "/api/collections/_superusers/auth-with-password", {"identity": mail, "password": pw})
    if s != 200 or not d.get("token"):
        print("Anmeldung fehlgeschlagen (" + str(s) + ")."); sys.exit(1)
    TOKEN = d["token"]

    s, d = anfrage("GET", "/api/collections?perPage=500")
    if s != 200:
        print("Sammlungen nicht lesbar (" + str(s) + ")."); sys.exit(1)
    alle = d.get("items", [])
    namen_von_id = {c["id"]: c["name"] for c in alle}
    gewaehlt = sorted([c for c in alle if c["name"].startswith("ausbildungen_") or c["name"].startswith("lernbar_")], key=lambda c: c["name"])
    auffaellig = 0
    for c in gewaehlt:
        print("\n== " + c["name"] + " (" + c.get("type", "") + ")")
        felder = []
        for f in c.get("fields", []):
            if f.get("system") or f["name"] in ("id", "created", "updated"): continue
            t = f.get("type", "")
            if t == "relation": t += "→" + namen_von_id.get(f.get("collectionId", ""), "?")
            felder.append(f["name"] + ":" + t)
        print("   Felder: " + ", ".join(felder))
        for k in REGELN:
            regel = c.get(k)
            urteil = bewertung(regel)
            if urteil.startswith("OFFEN") or urteil.startswith("ALLE"): auffaellig += 1
            zeile = "   " + NAME[k].ljust(7) + urteil
            print(zeile)
            if regel is not None and regel.strip():
                print("           " + regel)
    print("\n" + (str(auffaellig) + " Regeln auffällig. Diese Ausgabe an Claude schicken (sie enthält keine Daten)." if auffaellig else "Keine auffälligen Regeln."))


if __name__ == "__main__":
    main()
