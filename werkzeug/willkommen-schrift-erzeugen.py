#!/usr/bin/env python3
"""Erzeugt pb_hooks/willkommen-schrift.js: Atkinson Hyperlegible zum Einbetten
in die Willkommens-E-Mail.

E-Mail-Programme haben die Schrift nicht installiert und laden keine Schriften
aus der App. Wie die anderen E-Mails von Responda (public/email-*.html) bringt
die Willkommens-E-Mail sie deshalb selbst mit — als data:-URL im <style>.

Damit die E-Mail klein bleibt (Gmail kürzt ab etwa 100 KB), enthalten die
Schnitte nur die Zeichen deutscher Texte: Latin-1, Œœ, Gedanken- und
Anführungsstriche, Aufzählungspunkt, Auslassung, Euro, Pfeil.

Aufruf (braucht fonttools und brotli):
    python3 -m venv /tmp/fv && /tmp/fv/bin/pip install fonttools brotli
    /tmp/fv/bin/python werkzeug/willkommen-schrift-erzeugen.py
"""

import base64
import io
import pathlib

from fontTools import subset
from fontTools.ttLib import TTFont

WURZEL = pathlib.Path(__file__).resolve().parent.parent
QUELLE = WURZEL / "public" / "fonts"
ZIEL = WURZEL / "pb_hooks" / "willkommen-schrift.js"

ZEICHEN = (
    list(range(0x20, 0x7F)) + list(range(0xA0, 0x100))
    + [0x152, 0x153, 0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E,
       0x2022, 0x2026, 0x20AC, 0x2192]
)

SCHNITTE = [("normal", 400, "atkinson-400.woff2"), ("normal", 700, "atkinson-700.woff2"),
            ("italic", 400, "atkinson-400-italic.woff2"), ("italic", 700, "atkinson-700-italic.woff2")]


def zuschneiden(pfad: pathlib.Path) -> bytes:
    font = TTFont(pfad)
    optionen = subset.Options()
    optionen.flavor = "woff2"
    optionen.layout_features = ["kern", "liga"]
    optionen.hinting = False
    optionen.desubroutinize = True
    s = subset.Subsetter(optionen)
    s.populate(unicodes=ZEICHEN)
    s.subset(font)
    puffer = io.BytesIO()
    font.flavor = "woff2"
    font.save(puffer)
    return puffer.getvalue()


def main() -> None:
    regeln = []
    for stil, gewicht, datei in SCHNITTE:
        b64 = base64.b64encode(zuschneiden(QUELLE / datei)).decode("ascii")
        regeln.append(
            "@font-face{font-family:'Atkinson Hyperlegible';font-style:%s;font-weight:%d;"
            "src:url(data:font/woff2;base64,%s) format('woff2');}" % (stil, gewicht, b64)
        )
    # Nur Buchstaben, Ziffern, + / = und einfache Anführungszeichen — in "…" sicher
    css = "".join(regeln)
    ZIEL.write_text(
        "// Atkinson Hyperlegible zum Einbetten in die Willkommens-E-Mail.\n"
        "// Erzeugt von werkzeug/willkommen-schrift-erzeugen.py — nicht von Hand ändern.\n"
        "// Wird von willkommen.pb.js per require() geladen (kein eigener Hook).\n"
        'module.exports = { css: "' + css + '" }\n',
        encoding="utf-8",
    )
    print(f"{ZIEL.relative_to(WURZEL)}: {len(css)} Zeichen CSS")


if __name__ == "__main__":
    main()
