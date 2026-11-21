#!/usr/bin/env python3
# Responda: Anmelden mit Benutzername einrichten (Feld users.username, eindeutig, als Anmeldefeld).
# Aufruf auf dem Server: cd /opt/responda-quelle && git pull && python3 scripts/benutzername-einrichten.py
# Beschrieben in docs/pocketbase-regeln.md, „users: Benutzername“.
# Ändert nur, was fehlt; zweimal ausführen schadet nicht. Zeigt nie Namen oder Adressen, nur Zahlen.
import getpass, json, os, re, sys, urllib.error, urllib.parse, urllib.request

API = os.environ.get("RESPONDA_API", "https://api.responda.systems").rstrip("/")
TOKEN = ""
MUSTER = "^[a-z0-9_.-]{3,32}$"   # Zwilling von MUSTER in src/lib/benutzername.ts
INDEX = "CREATE UNIQUE INDEX `idx_users_username` ON `users` (`username`) WHERE `username` != ''"

def anfrage(methode, pfad, body=None):
    daten = json.dumps(body).encode() if body is not None else None
    kopf = {"Content-Type": "application/json"}
    if TOKEN: kopf["Authorization"] = TOKEN
    q = urllib.request.Request(API + pfad, data=daten, method=methode, headers=kopf)
    try:
        with urllib.request.urlopen(q, timeout=30) as r:
            t = r.read()
            return r.status, (json.loads(t) if t else {})
    except urllib.error.HTTPError as e:
        t = e.read()
        try: return e.code, json.loads(t)
        except Exception: return e.code, {"message": t[:300].decode("utf-8", "replace")}

def eindeutig(indexe):
    for i in indexe:
        m = re.match(r'\s*CREATE\s+UNIQUE\s+INDEX\s+.*?\bON\s+`?users`?\s*\(\s*`?username`?(\s+COLLATE\s+\w+)?\s*\)', i, re.I | re.S)
        if m: return i
    return None

def main():
    global TOKEN
    mail = input("Superuser-E-Mail: ").strip()
    pw = getpass.getpass("Passwort: ")
    s, d = anfrage("POST", "/api/collections/_superusers/auth-with-password", {"identity": mail, "password": pw})
    if s != 200 or not d.get("token"):
        print("Anmeldung fehlgeschlagen (" + str(s) + "), nichts geändert."); sys.exit(1)
    TOKEN = d["token"]
    s, c = anfrage("GET", "/api/collections/users")
    if s != 200: print("users nicht lesbar (" + str(s) + "), nichts geändert."); sys.exit(1)
    felder = c["fields"]; indexe = list(c.get("indexes") or [])
    feld = next((f for f in felder if f["name"] == "username"), None)
    aenderung = {}
    if feld is None:
        felder = felder + [{"name": "username", "type": "text", "required": False, "min": 0, "max": 32, "pattern": MUSTER}]
        aenderung["fields"] = felder
        print("  NEU      Feld username (Text, 3 bis 32 Zeichen: a-z 0-9 . _ -)")
    else:
        print("  ok       Feld username gibt es schon (Typ " + feld["type"] + ", Pflicht " + ("ja" if feld.get("required") else "nein")
              + ", Muster " + json.dumps(feld.get("pattern") or "") + ", automatisch " + json.dumps(feld.get("autogeneratePattern") or "") + ")")
        if feld["type"] != "text":
            print("  ACHTUNG  username ist kein Textfeld. Nichts geändert, bitte Ausgabe schicken."); sys.exit(1)
    if eindeutig(indexe):
        print("  ok       eindeutiger Index auf username vorhanden")
    else:
        indexe.append(INDEX); aenderung["indexes"] = indexe
        print("  NEU      eindeutiger Index auf username (leere Namen zählen nicht)")
    pa = dict(c.get("passwordAuth") or {})
    ids = list(pa.get("identityFields") or [])
    if "username" in ids:
        print("  ok       Anmelden mit Benutzername ist eingeschaltet (" + ", ".join(ids) + ")")
    else:
        pa["identityFields"] = ids + ["username"]; aenderung["passwordAuth"] = pa
        print("  NEU      Anmelden mit Benutzername (" + ", ".join(pa["identityFields"]) + ")")
    if aenderung:
        s, d = anfrage("PATCH", "/api/collections/users", aenderung)
        if s != 200:
            print("  ACHTUNG  nicht gespeichert: " + json.dumps(d, ensure_ascii=False)[:600]); sys.exit(1)
        print("  GESPEICHERT")
    # Nur Zahlen, nie Namen
    s, d = anfrage("GET", "/api/collections/users/records?perPage=1&fields=id&filter=" + urllib.parse.quote("username != ''"))
    s2, d2 = anfrage("GET", "/api/collections/users/records?perPage=1&fields=id")
    if s == 200 and s2 == 200:
        print("  Konten mit Benutzername: " + str(d.get("totalItems")) + " von " + str(d2.get("totalItems")))
    print("Fertig.")

if __name__ == "__main__":
    main()
