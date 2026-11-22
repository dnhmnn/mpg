#!/usr/bin/env python3
# Responda: „Neu in Responda“ und App-Auswahl im Konto einrichten (Owner, 22.11.2026).
# Aufruf auf dem Server:  cd /opt/responda-quelle && git pull && python3 scripts/hinweise-einrichten.py
# Beschrieben in docs/pocketbase-regeln.md, „Hub und Hinweise“, und docs/hub-und-hinweise-einfuehrung.md.
#
# Anlass: Wer einen Hinweis bestätigt hat, sah ihn nach dem nächsten Anmelden wieder. Die Bestätigung
# steht im Konto (users.hinweis_gesehen_am); fehlt das Feld oder ist es versteckt, verwirft PocketBase
# den Wert still, und nur das Gerät merkt es sich.
#
# - users: Felder hinweis_gesehen_am (Datum) und hub_apps (JSON) anlegen, falls sie fehlen;
#   versteckte (hidden) wieder sichtbar machen, sonst liest die App sie nie
# - users: Update-Regel zeigen und warnen, wenn sie eines der beiden Felder erwähnt (sperrt)
# - responda_hinweise: ob es die Sammlung gibt und wie viele Hinweise veröffentlicht sind
# - Zählt, wie viele Konten schon eine Bestätigung im Konto haben (nur Zahlen, nie Namen)
# Ändert sonst nichts; zweimal ausführen schadet nicht.
import getpass, json, os, sys, urllib.error, urllib.parse, urllib.request

API = os.environ.get("RESPONDA_API", "https://api.responda.systems").rstrip("/")
TOKEN = ""

FELDER = [
    {"name": "hinweis_gesehen_am", "type": "date", "required": False, "hidden": False},
    {"name": "hub_apps", "type": "json", "required": False, "hidden": False, "maxSize": 4000},
]


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


def ok(t): print("  ok       " + t)
def neu(t): print("  GEÄNDERT " + t)
def warn(t): print("  ACHTUNG  " + t)


def sammlung(name):
    s, d = anfrage("GET", "/api/collections/" + name)
    return d if s == 200 else None


def zahl(name, filt):
    q = "/api/collections/" + name + "/records?perPage=1&fields=id&filter=" + urllib.parse.quote(filt)
    s, d = anfrage("GET", q)
    return d.get("totalItems") if s == 200 else None


def main():
    global TOKEN
    mail = input("Superuser-E-Mail: ").strip()
    pw = getpass.getpass("Passwort: ")
    s, d = anfrage("POST", "/api/collections/_superusers/auth-with-password", {"identity": mail, "password": pw})
    if s != 200 or not d.get("token"):
        print("Anmeldung fehlgeschlagen (" + str(s) + "), nichts geändert."); sys.exit(1)
    TOKEN = d["token"]

    print("1. users: Felder")
    u = sammlung("users")
    if not u:
        warn("Sammlung users nicht lesbar. Nichts geändert."); sys.exit(1)
    felder = u["fields"]
    namen = {f["name"]: f for f in felder}
    geaendert = []
    for f in FELDER:
        da = namen.get(f["name"])
        if not da:
            felder.append(dict(f)); geaendert.append(f["name"] + " angelegt")
        elif da.get("type") != f["type"]:
            warn(f["name"] + " gibt es schon, aber als " + str(da.get("type")) + " statt " + f["type"] + ". Bitte von Hand ansehen.")
        elif da.get("hidden"):
            da["hidden"] = False; geaendert.append(f["name"] + " sichtbar gemacht (war versteckt)")
        else:
            ok(f["name"] + " da")
    if geaendert:
        s, d = anfrage("PATCH", "/api/collections/users", {"fields": felder})
        if s == 200: neu("users: " + ", ".join(geaendert))
        else: warn("users: nicht geändert: " + json.dumps(d, ensure_ascii=False)[:400])

    print("2. users: Update-Regel")
    u = sammlung("users") or {}
    regel = u.get("updateRule") or ""
    gesperrt = [f["name"] for f in FELDER if f["name"] in regel]
    if gesperrt:
        warn("Die Update-Regel erwähnt " + ", ".join(gesperrt) + ". Jeder muss diese Felder an sich selbst schreiben dürfen.")
        print("           " + json.dumps(regel, ensure_ascii=False))
    elif regel:
        ok("erwähnt die Felder nicht (eigenes Konto darf sie schreiben, wie in docs/pocketbase-regeln.md)")
    else:
        warn("Keine Update-Regel (nur Superuser darf ändern): Bestätigungen kämen nie im Konto an.")

    print("3. responda_hinweise")
    h = sammlung("responda_hinweise")
    if not h:
        warn("Sammlung fehlt. Schritte: docs/hub-und-hinweise-einfuehrung.md, Schritt 3.")
    else:
        n = zahl("responda_hinweise", "veroeffentlicht = true")
        ok("da, " + (str(n) if n is not None else "?") + " veröffentlicht")

    print("4. Bestätigungen im Konto")
    n = zahl("users", 'hinweis_gesehen_am != ""')
    alle = zahl("users", 'id != ""')
    if n is None: warn("nicht zählbar")
    else: ok(str(n) + " von " + str(alle) + " Konten haben einen Hinweis im Konto bestätigt")
    print("Fertig. Ab jetzt bleibt „Verstanden“ im Konto, auch nach dem Abmelden und auf anderen Geräten.")


if __name__ == "__main__":
    main()
