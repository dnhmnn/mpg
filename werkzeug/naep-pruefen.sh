#!/usr/bin/env bash
# Prüft einen erzeugten NAEP-Export gegen das Schema der DIVI.
#
#   werkzeug/naep-pruefen.sh export.xml
#
# Die Tests decken die Struktur ab; dies hier ist die Gegenprobe gegen die
# Norm selbst. Braucht xmllint (Paket libxml2-utils).
set -euo pipefail

datei="${1:?Aufruf: werkzeug/naep-pruefen.sh <datei.xml>}"
schema="$(dirname "$0")/../referenz/naep/xsd/naep-daten.xsd"

if ! command -v xmllint >/dev/null; then
  echo "xmllint fehlt — unter Debian/Ubuntu: apt-get install libxml2-utils" >&2
  exit 2
fi

# Die Warnung über das nicht erreichbare xml.xsd von w3.org ist unerheblich:
# daraus stammt nur xml:base, das im Datenformat nicht vorkommt.
xmllint --noout --schema "$schema" "$datei" 2>&1 | grep -v "www.w3.org/2001/03/xml.xsd" | grep -v "Skipping the import"
