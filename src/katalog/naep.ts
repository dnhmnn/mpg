// Der DIVI-Notarzteinsatzprotokoll-Datensatz, erzeugt aus dem Metamodell.
//
// NICHT VON HAND BEARBEITEN. Quelle ist
//   referenz/naep/naep-metamodell-6.0-1.00-NoVar-01012021.xml
// Neu erzeugen mit
//   python3 werkzeug/naep-katalog-erzeugen.py
//
// Warum erzeugt statt abgeschrieben: Der Datensatz hat ueber vierhundert
// Optionen und eine Verschachtelung, die sich von Hand nicht fehlerfrei
// nachbilden laesst. Jeder Code hier stammt aus der Norm; ein Export traegt
// damit genau die Schluessel, die die DIVI erwartet.

export const NAEP_VERSION = "V.6.0-1.00-NoVar-01012021"
export const NAEP_METAMODELL = '1.0'

/** Eine Angabe im Protokoll. */
export type NaepEingabe =
  | NaepFeld
  | NaepAuswahl
  | NaepAuswahlgruppe
  | NaepFrage
  | NaepFreitext
  | NaepStruktur
  | NaepGruppe
  | NaepOder

/** Was unter einer gewaehlten Option oder einem Feld zusaetzlich erhoben wird. */
export type NaepZusatz = { mehrfach: boolean; kinder: NaepEingabe[] }

/** Eine Angabe, die ausdruecklich nichts aussagt — "keine", "nicht untersucht". */
export type NaepLeer = { code: string; term: string }

export type NaepOption = {
  code: string
  term: string
  /** Punktwert, etwa bei der Glasgow Coma Scale. */
  numerisch?: number
  zusatz?: NaepZusatz
}

export type NaepFeld = {
  art: 'feld'
  code: string
  term: string
  /** Zahl, Text, Zeit oder Datum. */
  typ: string
  einheit?: string
  min?: string
  max?: string
  hinweis?: string
  zusatz?: NaepZusatz
}

export type NaepAuswahl = {
  art: 'auswahl'
  code: string
  term: string
  mehrfach: boolean
  leer: NaepLeer[]
  optionen: NaepOption[]
  sonstiges?: NaepLeer
  zusatz?: NaepZusatz
}

/** Mehrere Auswahlen, die sich eine Optionsliste teilen — etwa Arm links und rechts. */
export type NaepAuswahlgruppe = {
  art: 'auswahlgruppe'
  code: string
  term: string
  auswahlen: NaepLeer[]
  leer: NaepLeer[]
  optionen: NaepOption[]
  zusatz?: NaepZusatz
}

export type NaepFrage = {
  art: 'frage'
  code: string
  term: string
  /** j_opt, j-n, j-n_opt oder j-n-ub. */
  typ: string
  wennJa?: NaepEingabe[]
}

export type NaepFreitext = { art: 'freitext'; code: string }

/** Ein Block mit eigenem Schema: Stammdaten, Einsatzort, Medikation, Erstdiagnosen. */
export type NaepStruktur = {
  art: 'struktur'
  code: string
  term: string
  typ: string
  zusatz?: NaepZusatz
}

export type NaepGruppe = { art: 'gruppe'; code: string; term: string; kinder: NaepEingabe[] }

/** Eine Entweder-oder-Angabe: Alter in Jahren ODER in Tagen. */
export type NaepOder = {
  art: 'oder'
  code: string
  term: string
  leer: NaepLeer[]
  kinder: NaepEingabe[]
}

export type NaepVerlauf = { code: string; leer: NaepLeer[]; spalten: NaepEingabe[] }

export type NaepAbschnitt = {
  code: string
  titel: string
  hinweis?: string
  leer?: NaepLeer[]
  formular?: NaepEingabe[]
  verlauf?: NaepVerlauf
  kinder?: NaepAbschnitt[]
}

/** Welche Antworten ein Fragetyp zulaesst. */
export const NAEP_FRAGETYPEN: Record<string, { optional: boolean; antworten: NaepLeer[] }> =
{
  "j_opt": {
    "optional": true,
    "antworten": [
      {
        "code": "J",
        "term": "ja"
      }
    ]
  },
  "j-n": {
    "optional": false,
    "antworten": [
      {
        "code": "J",
        "term": "ja"
      },
      {
        "code": "N",
        "term": "nein"
      }
    ]
  },
  "j-n_opt": {
    "optional": true,
    "antworten": [
      {
        "code": "J",
        "term": "ja"
      },
      {
        "code": "N",
        "term": "nein"
      }
    ]
  },
  "j-n-ub": {
    "optional": false,
    "antworten": [
      {
        "code": "J",
        "term": "ja"
      },
      {
        "code": "N",
        "term": "nein"
      },
      {
        "code": "UB",
        "term": "unbekannt"
      }
    ]
  }
}

export const NAEP_ABSCHNITTE: NaepAbschnitt[] =
[
  {
    "code": "A01",
    "titel": "Patient - Stammdaten",
    "leer": [],
    "formular": [
      {
        "art": "struktur",
        "code": "A08",
        "term": "",
        "typ": "PatStammdaten",
        "zusatz": {
          "mehrfach": false,
          "kinder": [
            {
              "art": "auswahl",
              "code": "A0F",
              "term": "Geschlecht",
              "mehrfach": false,
              "leer": [
                {
                  "code": "A0M",
                  "term": "unbekannt"
                }
              ],
              "optionen": [
                {
                  "code": "A0T",
                  "term": "männlich"
                },
                {
                  "code": "A10",
                  "term": "weiblich"
                },
                {
                  "code": "A11",
                  "term": "divers"
                }
              ]
            },
            {
              "art": "auswahl",
              "code": "A17",
              "term": "BMI",
              "mehrfach": false,
              "leer": [],
              "optionen": [
                {
                  "code": "A1E",
                  "term": "<=40"
                },
                {
                  "code": "A1L",
                  "term": ">40"
                }
              ]
            },
            {
              "art": "oder",
              "code": "A1S",
              "term": "Alter",
              "leer": [
                {
                  "code": "A1Z",
                  "term": "unbekannt"
                }
              ],
              "kinder": [
                {
                  "art": "feld",
                  "code": "A26",
                  "term": "",
                  "typ": "Zahl",
                  "einheit": "Jahre"
                },
                {
                  "art": "auswahl",
                  "code": "A2D",
                  "term": "",
                  "mehrfach": false,
                  "leer": [],
                  "optionen": [
                    {
                      "code": "A2K",
                      "term": "1-7 Tage"
                    },
                    {
                      "code": "A2R",
                      "term": "8-28 Tage"
                    }
                  ]
                }
              ]
            }
          ]
        }
      }
    ]
  },
  {
    "code": "B01",
    "titel": "Einsatztechnische Daten",
    "leer": [],
    "formular": [
      {
        "art": "struktur",
        "code": "B08",
        "term": "",
        "typ": "EinsatztechnischeDaten"
      },
      {
        "art": "feld",
        "code": "B0F",
        "term": "Einsatz-Datum",
        "typ": "Datum"
      },
      {
        "art": "struktur",
        "code": "B0M",
        "term": "Einsatz-Ort",
        "typ": "Einsatzort",
        "zusatz": {
          "mehrfach": false,
          "kinder": [
            {
              "art": "auswahl",
              "code": "B0T",
              "term": "",
              "mehrfach": false,
              "leer": [],
              "optionen": [
                {
                  "code": "B10",
                  "term": "Wohnung"
                },
                {
                  "code": "B17",
                  "term": "Arztpraxis"
                },
                {
                  "code": "B1E",
                  "term": "öff. Raum"
                },
                {
                  "code": "B1L",
                  "term": "Bildungseinrichtung"
                },
                {
                  "code": "B1S",
                  "term": "Altenheim"
                },
                {
                  "code": "B1Z",
                  "term": "Krankenhaus"
                },
                {
                  "code": "B26",
                  "term": "Straße"
                },
                {
                  "code": "B2D",
                  "term": "Massenveranstaltung"
                },
                {
                  "code": "B2K",
                  "term": "Arbeitsplatz"
                },
                {
                  "code": "B2R",
                  "term": "Geburtshaus"
                },
                {
                  "code": "B2Y",
                  "term": "Schule"
                },
                {
                  "code": "B35",
                  "term": "Sportstätte"
                }
              ],
              "sonstiges": {
                "code": "B3C",
                "term": "Sonstige"
              }
            }
          ]
        }
      },
      {
        "art": "auswahl",
        "code": "B3J",
        "term": "Einsatz-Art",
        "mehrfach": false,
        "leer": [],
        "optionen": [
          {
            "code": "B3Q",
            "term": "Primäreinsatz"
          },
          {
            "code": "B3X",
            "term": "Folgeeinsatz"
          },
          {
            "code": "B44",
            "term": "Fehleinsatz",
            "zusatz": {
              "mehrfach": false,
              "kinder": [
                {
                  "art": "oder",
                  "code": "B4B",
                  "term": "",
                  "leer": [],
                  "kinder": [
                    {
                      "art": "auswahl",
                      "code": "B4I",
                      "term": "",
                      "mehrfach": false,
                      "leer": [],
                      "optionen": [
                        {
                          "code": "B4P",
                          "term": "kein Patient"
                        },
                        {
                          "code": "B4W",
                          "term": "Pat. bereits abtransportiert"
                        },
                        {
                          "code": "B53",
                          "term": "abbestellt"
                        },
                        {
                          "code": "B5A",
                          "term": "böswillige Alarmierung"
                        }
                      ]
                    },
                    {
                      "art": "auswahl",
                      "code": "B5H",
                      "term": "Einsatzabbruch",
                      "mehrfach": false,
                      "leer": [],
                      "optionen": [
                        {
                          "code": "B5O",
                          "term": "technische Gründe"
                        },
                        {
                          "code": "B5V",
                          "term": "Wetter"
                        }
                      ],
                      "sonstiges": {
                        "code": "B62",
                        "term": "Sonstige"
                      }
                    }
                  ]
                }
              ]
            }
          },
          {
            "code": "B69",
            "term": "Notarzt-Nachforderung"
          },
          {
            "code": "B6G",
            "term": "Sekundäreinsatz z.B. Verlegung"
          },
          {
            "code": "B6N",
            "term": "vorsorgliche Bereitstellung"
          }
        ]
      },
      {
        "art": "feld",
        "code": "B6U",
        "term": "Transportziel",
        "typ": "Text",
        "zusatz": {
          "mehrfach": false,
          "kinder": [
            {
              "art": "frage",
              "code": "B71",
              "term": "Voranmeldung",
              "typ": "j_opt",
              "wennJa": [
                {
                  "art": "auswahl",
                  "code": "B78",
                  "term": "",
                  "mehrfach": false,
                  "leer": [],
                  "optionen": [
                    {
                      "code": "B7F",
                      "term": "Stroke Unit"
                    },
                    {
                      "code": "B7M",
                      "term": "Herzkatheter"
                    },
                    {
                      "code": "B7T",
                      "term": "Traumazentrum"
                    }
                  ]
                }
              ]
            }
          ]
        }
      },
      {
        "art": "feld",
        "code": "B80",
        "term": "Notarzt (Name)",
        "typ": "Text",
        "zusatz": {
          "mehrfach": false,
          "kinder": [
            {
              "art": "auswahl",
              "code": "B87",
              "term": "Qualifikation",
              "mehrfach": false,
              "leer": [],
              "optionen": [
                {
                  "code": "B8E",
                  "term": "Arzt in Weiterb."
                },
                {
                  "code": "B8L",
                  "term": "Facharzt",
                  "zusatz": {
                    "mehrfach": false,
                    "kinder": [
                      {
                        "art": "auswahl",
                        "code": "B8S",
                        "term": "Qualifikation",
                        "mehrfach": true,
                        "leer": [],
                        "optionen": [
                          {
                            "code": "B8Z",
                            "term": "Anästhesie"
                          },
                          {
                            "code": "B96",
                            "term": "Chirurgie"
                          },
                          {
                            "code": "B9D",
                            "term": "Innere"
                          },
                          {
                            "code": "B9K",
                            "term": "Pädiatrie"
                          },
                          {
                            "code": "B9R",
                            "term": "Neurologie"
                          },
                          {
                            "code": "B9Y",
                            "term": "Allg. Medizin"
                          },
                          {
                            "code": "B9Z",
                            "term": "Klinische Akutmedizin"
                          },
                          {
                            "code": "BA5",
                            "term": "Zusatz Intensiv"
                          },
                          {
                            "code": "BAC",
                            "term": "Andere"
                          }
                        ]
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      },
      {
        "art": "feld",
        "code": "BAJ",
        "term": "Assistenz",
        "typ": "Text",
        "zusatz": {
          "mehrfach": false,
          "kinder": [
            {
              "art": "auswahl",
              "code": "BAQ",
              "term": "Höchste Qualifikation",
              "mehrfach": false,
              "leer": [],
              "optionen": [
                {
                  "code": "BAX",
                  "term": "Rett.Ass."
                },
                {
                  "code": "BB4",
                  "term": "Rett.San."
                },
                {
                  "code": "BBB",
                  "term": "Notfalll San."
                },
                {
                  "code": "BBI",
                  "term": "(Int.)Pfleg."
                }
              ]
            }
          ]
        }
      },
      {
        "art": "feld",
        "code": "BBP",
        "term": "RTW-Team",
        "typ": "Text"
      },
      {
        "art": "feld",
        "code": "BBW",
        "term": "Rufname eigenes Fahrzeug",
        "typ": "Text",
        "hinweis": "als \"eigenes Fahrzeug\" wird hier das den Notarzt zubringende (nicht das den Patienten schlusendlich transportierende) Rettungsmitel dokumentiert"
      },
      {
        "art": "auswahl",
        "code": "BC3",
        "term": "Beteiligte Rettungsmittel",
        "mehrfach": true,
        "leer": [],
        "optionen": [
          {
            "code": "BCA",
            "term": "NEF",
            "zusatz": {
              "mehrfach": false,
              "kinder": [
                {
                  "art": "frage",
                  "code": "BCH",
                  "term": "Selbstfahrer",
                  "typ": "j_opt"
                }
              ]
            }
          },
          {
            "code": "BCO",
            "term": "NAW"
          },
          {
            "code": "BCV",
            "term": "RTW"
          },
          {
            "code": "BD2",
            "term": "KTW"
          },
          {
            "code": "BD9",
            "term": "RTH"
          },
          {
            "code": "BDG",
            "term": "ITH"
          },
          {
            "code": "BDN",
            "term": "Bergrettung"
          },
          {
            "code": "TNA",
            "term": "TeleNA"
          },
          {
            "code": "BDU",
            "term": "Wasserrettung"
          }
        ],
        "sonstiges": {
          "code": "BE1",
          "term": "Sonstige"
        }
      },
      {
        "art": "oder",
        "code": "BE8",
        "term": "",
        "leer": [],
        "kinder": [
          {
            "art": "feld",
            "code": "BEF",
            "term": "Symptom-Beginn",
            "typ": "Zeit"
          },
          {
            "art": "frage",
            "code": "BEM",
            "term": "vor über 24h",
            "typ": "j_opt"
          },
          {
            "art": "frage",
            "code": "BUK",
            "term": "unbekannt",
            "typ": "j_opt"
          }
        ]
      },
      {
        "art": "frage",
        "code": "BET",
        "term": "Kollaps beobachtet",
        "typ": "j_opt"
      },
      {
        "art": "feld",
        "code": "BF0",
        "term": "Alarm",
        "typ": "Zeit"
      },
      {
        "art": "feld",
        "code": "BF7",
        "term": "Ankunft (Einsatzort)",
        "typ": "Zeit"
      },
      {
        "art": "feld",
        "code": "BFE",
        "term": "Ankunft (am Pat.)",
        "typ": "Zeit",
        "zusatz": {
          "mehrfach": false,
          "kinder": [
            {
              "art": "frage",
              "code": "BFL",
              "term": "vor Rettungsdienst",
              "typ": "j_opt"
            }
          ]
        }
      },
      {
        "art": "feld",
        "code": "BFS",
        "term": "Abfahrt",
        "typ": "Zeit"
      },
      {
        "art": "feld",
        "code": "BFZ",
        "term": "Übergabe",
        "typ": "Zeit"
      },
      {
        "art": "feld",
        "code": "BG6",
        "term": "Einsatzbereit",
        "typ": "Zeit"
      },
      {
        "art": "feld",
        "code": "BGD",
        "term": "Ende",
        "typ": "Zeit"
      }
    ]
  },
  {
    "code": "C01",
    "titel": "Notfallgeschehen, Anamnese, Erstbefund, Vormedikation, Vorbehandlung",
    "leer": [],
    "formular": [
      {
        "art": "freitext",
        "code": "C08"
      },
      {
        "art": "auswahl",
        "code": "C0F",
        "term": "AZ des Pat. vor dem Ereignis (entspr. ASA)",
        "mehrfach": false,
        "leer": [],
        "optionen": [
          {
            "code": "C0M",
            "term": "gesund"
          },
          {
            "code": "C0T",
            "term": "leicht eingeschränkt"
          },
          {
            "code": "C10",
            "term": "deutlich eingeschränkt"
          },
          {
            "code": "C1E",
            "term": "akut lebensgefährdet"
          },
          {
            "code": "C17",
            "term": "moribund"
          }
        ]
      },
      {
        "art": "auswahl",
        "code": "C30",
        "term": "Versorgungssituation",
        "mehrfach": false,
        "leer": [],
        "optionen": [
          {
            "code": "C31",
            "term": "unabhängig"
          },
          {
            "code": "C32",
            "term": "Pflege zuhause"
          },
          {
            "code": "C33",
            "term": "Pflege in Instutition"
          }
        ]
      },
      {
        "art": "auswahl",
        "code": "C40",
        "term": "Antikoagulanzienmedikation (vor dem Ereignis)",
        "mehrfach": true,
        "leer": [],
        "optionen": [
          {
            "code": "C41",
            "term": "TZ-Aggregationshemmer"
          },
          {
            "code": "C42",
            "term": "VitK-Antagonist"
          },
          {
            "code": "C43",
            "term": "DOAK"
          },
          {
            "code": "C44",
            "term": "Heparin"
          }
        ],
        "sonstiges": {
          "code": "C45",
          "term": "Sonstige"
        }
      },
      {
        "art": "auswahl",
        "code": "C1L",
        "term": "Ersthelfermaßnahmen (Laien)",
        "mehrfach": false,
        "leer": [
          {
            "code": "C1S",
            "term": "keine"
          }
        ],
        "optionen": [
          {
            "code": "C1Z",
            "term": "suffizient"
          },
          {
            "code": "C26",
            "term": "insuffizient"
          }
        ]
      },
      {
        "art": "frage",
        "code": "C2D",
        "term": "First Responder vor Ort",
        "typ": "j_opt",
        "wennJa": [
          {
            "art": "feld",
            "code": "C2K",
            "term": "ggf. Uhrzeit des Eintreffens",
            "typ": "Zeit"
          }
        ]
      },
      {
        "art": "frage",
        "code": "C2R",
        "term": "Besiedelung mit multiresistenten Keimen (MRSA, MRSE, ESBL etc) vorbekannt",
        "typ": "j_opt",
        "wennJa": [
          {
            "art": "auswahl",
            "code": "C2Y",
            "term": "",
            "mehrfach": true,
            "leer": [],
            "optionen": [
              {
                "code": "C35",
                "term": "abgedeckt"
              },
              {
                "code": "C3C",
                "term": "offen"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "code": "D01",
    "titel": "Erstbefunde",
    "kinder": [
      {
        "code": "D08",
        "titel": "Neurologie",
        "leer": [
          {
            "code": "D0F",
            "term": "kein"
          },
          {
            "code": "D0M",
            "term": "ohne path. Befund"
          }
        ],
        "formular": [
          {
            "art": "feld",
            "code": "D0T",
            "term": "Zeitpunkt",
            "typ": "Zeit"
          },
          {
            "art": "auswahl",
            "code": "D10",
            "term": "Augen öffnen",
            "mehrfach": false,
            "leer": [],
            "optionen": [
              {
                "code": "D17",
                "term": "spontan",
                "numerisch": 4
              },
              {
                "code": "D1E",
                "term": "auf Geräusch",
                "numerisch": 3
              },
              {
                "code": "D1L",
                "term": "auf Druck",
                "numerisch": 2
              },
              {
                "code": "D1S",
                "term": "kein Augenöffnen",
                "numerisch": 1
              }
            ]
          },
          {
            "art": "auswahl",
            "code": "D1Z",
            "term": "beste verbale Reaktion",
            "mehrfach": false,
            "leer": [],
            "optionen": [
              {
                "code": "D26",
                "term": "konversationsfähig, orientiert",
                "numerisch": 5
              },
              {
                "code": "D2D",
                "term": "konversationsfähig, verwirrt",
                "numerisch": 4
              },
              {
                "code": "D2K",
                "term": "Wörter",
                "numerisch": 3
              },
              {
                "code": "D2R",
                "term": "Laute",
                "numerisch": 2
              },
              {
                "code": "D2Y",
                "term": "keine",
                "numerisch": 1
              }
            ]
          },
          {
            "art": "auswahlgruppe",
            "code": "D35",
            "term": "beste motorische Reaktion",
            "auswahlen": [
              {
                "code": "D3C",
                "term": "Arm, rechts"
              },
              {
                "code": "D3J",
                "term": "Arm, links"
              },
              {
                "code": "D3Q",
                "term": "Bein, rechts"
              },
              {
                "code": "D3X",
                "term": "Arm, rechts"
              }
            ],
            "leer": [],
            "optionen": [
              {
                "code": "D44",
                "term": "folgt Aufforderung",
                "numerisch": 6
              },
              {
                "code": "D4B",
                "term": "lokalisiert",
                "numerisch": 5
              },
              {
                "code": "D4I",
                "term": "Beugt normal",
                "numerisch": 4
              },
              {
                "code": "D4P",
                "term": "Beugt abnormal",
                "numerisch": 3
              },
              {
                "code": "D4W",
                "term": "Streckt",
                "numerisch": 2
              },
              {
                "code": "D53",
                "term": "keine",
                "numerisch": 1
              }
            ]
          },
          {
            "art": "feld",
            "code": "D5A",
            "term": "Glasgow Coma Scale",
            "typ": "Zahl",
            "einheit": "1",
            "hinweis": "Zur Summierung der GCS wird nur der Wert der Extremität mit der besten motorischen Reaktion verwendet siehe www.glasgowcomascale.org"
          },
          {
            "art": "auswahlgruppe",
            "code": "D5H",
            "term": "Extremitätenbewegung",
            "auswahlen": [
              {
                "code": "D5O",
                "term": "Arm, rechts"
              },
              {
                "code": "D5V",
                "term": "Arm, links"
              },
              {
                "code": "D62",
                "term": "Bein, rechts"
              },
              {
                "code": "D69",
                "term": "Arm, rechts"
              }
            ],
            "leer": [],
            "optionen": [
              {
                "code": "D6G",
                "term": "normal",
                "numerisch": 1
              },
              {
                "code": "D6N",
                "term": "leicht vermindert",
                "numerisch": 2
              },
              {
                "code": "D6U",
                "term": "stark vermindert",
                "numerisch": 3
              }
            ]
          },
          {
            "art": "auswahl",
            "code": "D71",
            "term": "Bewusstseinslage",
            "mehrfach": false,
            "leer": [
              {
                "code": "D78",
                "term": "nicht beurteilbar"
              }
            ],
            "optionen": [
              {
                "code": "D7F",
                "term": "wach"
              },
              {
                "code": "D7M",
                "term": "getrübt",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "auswahl",
                      "code": "D7T",
                      "term": "",
                      "mehrfach": true,
                      "leer": [],
                      "optionen": [
                        {
                          "code": "D80",
                          "term": "Reaktion auf Ansprache"
                        },
                        {
                          "code": "D87",
                          "term": "Reaktion auf Schmerzreiz"
                        }
                      ]
                    }
                  ]
                }
              },
              {
                "code": "D8E",
                "term": "bewusstlos"
              },
              {
                "code": "D8L",
                "term": "analgosediert / Narkose"
              }
            ]
          },
          {
            "art": "auswahl",
            "code": "D8S",
            "term": "Neurologische Auffälligkeiten",
            "mehrfach": true,
            "leer": [
              {
                "code": "D8Z",
                "term": "ohne path. Befund"
              },
              {
                "code": "D96",
                "term": "nicht beurteilbar"
              }
            ],
            "optionen": [
              {
                "code": "D9D",
                "term": "Seitenzeichen (Pupillen, periph. Motorik)"
              },
              {
                "code": "D9K",
                "term": "kein Lächeln"
              },
              {
                "code": "D9R",
                "term": "Sprachstörung"
              },
              {
                "code": "D9Y",
                "term": "Sehstörung"
              },
              {
                "code": "DA5",
                "term": "Demenz"
              },
              {
                "code": "DAC",
                "term": "Querschnittssymptomatik"
              },
              {
                "code": "DAJ",
                "term": "Babinski Zeichen"
              },
              {
                "code": "DAQ",
                "term": "Meningismus"
              },
              {
                "code": "DAX",
                "term": "vorbestehende neurologische Defizite"
              }
            ],
            "sonstiges": {
              "code": "DB4",
              "term": "Sonstige"
            }
          },
          {
            "art": "auswahlgruppe",
            "code": "DBB",
            "term": "Pupillenweite",
            "auswahlen": [
              {
                "code": "DBI",
                "term": "rechts"
              },
              {
                "code": "DBP",
                "term": "links"
              }
            ],
            "leer": [],
            "optionen": [
              {
                "code": "DBW",
                "term": "eng"
              },
              {
                "code": "DC3",
                "term": "mittel"
              },
              {
                "code": "DCA",
                "term": "weit"
              },
              {
                "code": "DCH",
                "term": "entrundet"
              }
            ]
          },
          {
            "art": "auswahlgruppe",
            "code": "DCO",
            "term": "Lichtreaktion",
            "auswahlen": [
              {
                "code": "DCV",
                "term": "rechts"
              },
              {
                "code": "DD2",
                "term": "links"
              }
            ],
            "leer": [],
            "optionen": [
              {
                "code": "DD9",
                "term": "prompt"
              },
              {
                "code": "DDG",
                "term": "träge"
              },
              {
                "code": "DDN",
                "term": "keine"
              }
            ]
          }
        ]
      },
      {
        "code": "DDU",
        "titel": "Messwerte initial",
        "leer": [
          {
            "code": "DE1",
            "term": "keine"
          }
        ],
        "formular": [
          {
            "art": "feld",
            "code": "DE8",
            "term": "Schmerzen",
            "typ": "Zahl",
            "einheit": "1",
            "min": "0",
            "max": "10"
          },
          {
            "art": "feld",
            "code": "DEF",
            "term": "RRsys",
            "typ": "Zahl",
            "einheit": "mmHg",
            "min": "0",
            "max": "300"
          },
          {
            "art": "feld",
            "code": "DEM",
            "term": "RRdia",
            "typ": "Zahl",
            "einheit": "mmHg",
            "min": "0",
            "max": "300"
          },
          {
            "art": "feld",
            "code": "DET",
            "term": "Herzfrequenz",
            "typ": "Zahl",
            "einheit": "1/min",
            "min": "0",
            "max": "300",
            "zusatz": {
              "mehrfach": false,
              "kinder": [
                {
                  "art": "auswahl",
                  "code": "DF0",
                  "term": "",
                  "mehrfach": false,
                  "leer": [],
                  "optionen": [
                    {
                      "code": "DF7",
                      "term": "rhythmisch"
                    },
                    {
                      "code": "DFE",
                      "term": "arrhythmisch"
                    }
                  ]
                }
              ]
            }
          },
          {
            "art": "oder",
            "code": "DFL",
            "term": "Blutzucker",
            "leer": [],
            "kinder": [
              {
                "art": "feld",
                "code": "DFS",
                "term": "Wert",
                "typ": "Zahl",
                "einheit": "mg/dl mmol/l",
                "min": "0",
                "max": "600"
              },
              {
                "art": "auswahl",
                "code": "DFZ",
                "term": "Kategorie",
                "mehrfach": false,
                "leer": [],
                "optionen": [
                  {
                    "code": "DG6",
                    "term": "LOW"
                  },
                  {
                    "code": "DGD",
                    "term": "HIGH"
                  }
                ]
              }
            ]
          },
          {
            "art": "feld",
            "code": "DGK",
            "term": "Atemfrequenz",
            "typ": "Zahl",
            "einheit": "1/min",
            "min": "0",
            "max": "60"
          },
          {
            "art": "feld",
            "code": "DGR",
            "term": "SpO2",
            "typ": "Zahl",
            "einheit": "%",
            "min": "0",
            "max": "100",
            "zusatz": {
              "mehrfach": false,
              "kinder": [
                {
                  "art": "auswahl",
                  "code": "DGY",
                  "term": "",
                  "mehrfach": false,
                  "leer": [],
                  "optionen": [
                    {
                      "code": "DH5",
                      "term": "bei Raumluft"
                    },
                    {
                      "code": "DHC",
                      "term": "unter O2-Gabe"
                    }
                  ]
                }
              ]
            }
          },
          {
            "art": "feld",
            "code": "DHJ",
            "term": "Temperatur",
            "typ": "Zahl",
            "einheit": "°C",
            "min": "20.0",
            "max": "42.0"
          },
          {
            "art": "feld",
            "code": "DHQ",
            "term": "etCO2",
            "typ": "Zahl",
            "einheit": "mmHg",
            "min": "0",
            "max": "200"
          },
          {
            "art": "feld",
            "code": "DHS",
            "term": "qSOFA",
            "typ": "Zahl",
            "min": "0",
            "max": "3",
            "hinweis": "je 1 Punkt für GCS < 15, AF > 22, RRsys <= 100mmHg"
          }
        ]
      },
      {
        "code": "DHX",
        "titel": "EKG",
        "leer": [
          {
            "code": "DI4",
            "term": "kein EKG"
          }
        ],
        "formular": [
          {
            "art": "auswahl",
            "code": "DIB",
            "term": "",
            "mehrfach": false,
            "leer": [],
            "optionen": [
              {
                "code": "DII",
                "term": "Sinusrhythmus"
              },
              {
                "code": "DIP",
                "term": "Abs. Arrhythmie"
              },
              {
                "code": "DIW",
                "term": "AV-Block II°"
              },
              {
                "code": "DJ3",
                "term": "AV-Block III°"
              },
              {
                "code": "DJA",
                "term": "Schrittmacherrhythmus"
              },
              {
                "code": "DJH",
                "term": "Kammerflimmern"
              },
              {
                "code": "DJO",
                "term": "PEA / EMD"
              },
              {
                "code": "DJV",
                "term": "Asystolie"
              }
            ],
            "zusatz": {
              "mehrfach": true,
              "kinder": [
                {
                  "art": "auswahl",
                  "code": "DK2",
                  "term": "",
                  "mehrfach": false,
                  "leer": [],
                  "optionen": [
                    {
                      "code": "DK9",
                      "term": "STEMI"
                    },
                    {
                      "code": "DKG",
                      "term": "schmale QRS-Tachykardie"
                    },
                    {
                      "code": "DKN",
                      "term": "breite QRS-Tachykardie"
                    },
                    {
                      "code": "DKU",
                      "term": "SVES / VES monomorph"
                    },
                    {
                      "code": "DL1",
                      "term": "VES polymorph"
                    }
                  ]
                }
              ]
            }
          }
        ]
      },
      {
        "code": "DL8",
        "titel": "Atmung",
        "leer": [
          {
            "code": "DLF",
            "term": "nicht US"
          }
        ],
        "formular": [
          {
            "art": "auswahl",
            "code": "DLM",
            "term": "",
            "mehrfach": false,
            "leer": [],
            "optionen": [
              {
                "code": "DLT",
                "term": "unauffällig"
              },
              {
                "code": "DM0",
                "term": "Dyspnoe",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "auswahl",
                      "code": "DM7",
                      "term": "",
                      "mehrfach": true,
                      "leer": [],
                      "optionen": [
                        {
                          "code": "DME",
                          "term": "Stridor"
                        },
                        {
                          "code": "DML",
                          "term": "Zyanose"
                        },
                        {
                          "code": "DMS",
                          "term": "Spastik"
                        },
                        {
                          "code": "DMZ",
                          "term": "Hyperventilation"
                        },
                        {
                          "code": "DN6",
                          "term": "Atemwegsverlegung"
                        },
                        {
                          "code": "DND",
                          "term": "Rasselgeräusche"
                        }
                      ]
                    }
                  ]
                }
              },
              {
                "code": "DNK",
                "term": "Schnappatmung"
              },
              {
                "code": "DNR",
                "term": "Apnoe"
              },
              {
                "code": "DNY",
                "term": "Beatmung"
              },
              {
                "code": "DO5",
                "term": "sonstiges path. Atemmuster (Biot, Cheyne Stokes etc.)"
              }
            ]
          }
        ]
      },
      {
        "code": "DOC",
        "titel": "Haut",
        "leer": [
          {
            "code": "DOJ",
            "term": "nicht US"
          }
        ],
        "formular": [
          {
            "art": "auswahl",
            "code": "DOQ",
            "term": "",
            "mehrfach": false,
            "leer": [],
            "optionen": [
              {
                "code": "DOX",
                "term": "unauffällig"
              },
              {
                "code": "DP4",
                "term": "pathologisch",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "auswahl",
                      "code": "DPB",
                      "term": "",
                      "mehrfach": true,
                      "leer": [],
                      "optionen": [
                        {
                          "code": "DPI",
                          "term": "stehende Hautfalten"
                        },
                        {
                          "code": "DPP",
                          "term": "Dekubitus"
                        },
                        {
                          "code": "DPW",
                          "term": "Exanthem"
                        },
                        {
                          "code": "DQ3",
                          "term": "Oedeme"
                        },
                        {
                          "code": "DQA",
                          "term": "kaltschweißig"
                        }
                      ]
                    }
                  ]
                }
              }
            ]
          }
        ]
      },
      {
        "code": "DQH",
        "titel": "Psyche",
        "leer": [
          {
            "code": "DQO",
            "term": "nicht US"
          },
          {
            "code": "DQV",
            "term": "unauffällig"
          },
          {
            "code": "DR2",
            "term": "nicht beurteilbar"
          }
        ],
        "formular": [
          {
            "art": "auswahl",
            "code": "DR9",
            "term": "",
            "mehrfach": true,
            "leer": [],
            "optionen": [
              {
                "code": "DRG",
                "term": "wahnhaft"
              },
              {
                "code": "DRN",
                "term": "erregt"
              },
              {
                "code": "DRU",
                "term": "depressiv"
              },
              {
                "code": "DS1",
                "term": "verwirrt"
              },
              {
                "code": "DS8",
                "term": "aggressiv"
              },
              {
                "code": "DSF",
                "term": "ängstlich"
              },
              {
                "code": "DSM",
                "term": "suizidal"
              },
              {
                "code": "DST",
                "term": "verlangsamt/stuporös"
              },
              {
                "code": "DT0",
                "term": "euphorisch"
              },
              {
                "code": "DT7",
                "term": "motorisch unruhig"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "code": "E01",
    "titel": "Erkrankungen",
    "leer": [
      {
        "code": "E08",
        "term": "keine"
      }
    ],
    "formular": [
      {
        "art": "auswahl",
        "code": "E0F",
        "term": "ZNS",
        "mehrfach": true,
        "leer": [],
        "optionen": [
          {
            "code": "E0M",
            "term": "Schlaganfall, TIA, intrakranielle Blutung",
            "zusatz": {
              "mehrfach": false,
              "kinder": [
                {
                  "art": "frage",
                  "code": "E0T",
                  "term": "im Lysefenster",
                  "typ": "j_opt"
                }
              ]
            }
          },
          {
            "code": "E10",
            "term": "Krampfanfall"
          },
          {
            "code": "E17",
            "term": "Status epilepticus"
          },
          {
            "code": "E1E",
            "term": "Meningitis / Encephalitis"
          },
          {
            "code": "E1L",
            "term": "Synkope"
          }
        ],
        "sonstiges": {
          "code": "E1S",
          "term": "Sonstige"
        }
      },
      {
        "art": "auswahl",
        "code": "E1Z",
        "term": "Herz-Kreislauf",
        "mehrfach": true,
        "leer": [],
        "optionen": [
          {
            "code": "E26",
            "term": "Akutes Koronarsyndrom"
          },
          {
            "code": "E2D",
            "term": "STEMI",
            "zusatz": {
              "mehrfach": false,
              "kinder": [
                {
                  "art": "auswahl",
                  "code": "E2K",
                  "term": "",
                  "mehrfach": true,
                  "leer": [],
                  "optionen": [
                    {
                      "code": "E2R",
                      "term": "Vorderwand"
                    },
                    {
                      "code": "E2Y",
                      "term": "Hinterwand"
                    }
                  ]
                }
              ]
            }
          },
          {
            "code": "E35",
            "term": "Rhythmusstörung",
            "zusatz": {
              "mehrfach": false,
              "kinder": [
                {
                  "art": "auswahl",
                  "code": "E3C",
                  "term": "",
                  "mehrfach": true,
                  "leer": [],
                  "optionen": [
                    {
                      "code": "E3J",
                      "term": "tachykard"
                    },
                    {
                      "code": "E3Q",
                      "term": "bradykard"
                    }
                  ]
                }
              ]
            }
          },
          {
            "code": "E3X",
            "term": "Lungenembolie"
          },
          {
            "code": "E44",
            "term": "orthostatische Fehlregulation"
          },
          {
            "code": "E4B",
            "term": "Herzinsuffizienz"
          },
          {
            "code": "E4I",
            "term": "Lungenödem"
          },
          {
            "code": "E4P",
            "term": "hypertensiver Notfall / hypertensive Krise"
          },
          {
            "code": "E4W",
            "term": "kardiogener Schock"
          },
          {
            "code": "E53",
            "term": "Schrittmacher- / ICD-Fehlfunktion"
          }
        ],
        "sonstiges": {
          "code": "E5A",
          "term": "Sonstige"
        }
      },
      {
        "art": "auswahl",
        "code": "E5H",
        "term": "Atmung",
        "mehrfach": true,
        "leer": [],
        "optionen": [
          {
            "code": "E5O",
            "term": "Asthma (Anfall)"
          },
          {
            "code": "E5V",
            "term": "Status asthmaticus"
          },
          {
            "code": "E62",
            "term": "COPD (ggf. Exazerbation)",
            "zusatz": {
              "mehrfach": false,
              "kinder": [
                {
                  "art": "auswahl",
                  "code": "E69",
                  "term": "",
                  "mehrfach": true,
                  "leer": [],
                  "optionen": [
                    {
                      "code": "E6G",
                      "term": "Heimbeatmung"
                    },
                    {
                      "code": "E6N",
                      "term": "Heimsauerstoff"
                    }
                  ]
                }
              ]
            }
          },
          {
            "code": "E6U",
            "term": "Pneumonie, Bronchitis"
          },
          {
            "code": "E71",
            "term": "Hyperventilationssyndrom"
          },
          {
            "code": "E78",
            "term": "Aspiration"
          },
          {
            "code": "E7F",
            "term": "Haemoptysen"
          }
        ],
        "sonstiges": {
          "code": "E7M",
          "term": "Sonstige"
        }
      },
      {
        "art": "auswahl",
        "code": "E7T",
        "term": "Abdomen",
        "mehrfach": true,
        "leer": [],
        "optionen": [
          {
            "code": "E80",
            "term": "Akutes Abdomen"
          },
          {
            "code": "E87",
            "term": "GI-Blutung",
            "zusatz": {
              "mehrfach": false,
              "kinder": [
                {
                  "art": "auswahl",
                  "code": "E8E",
                  "term": "",
                  "mehrfach": true,
                  "leer": [],
                  "optionen": [
                    {
                      "code": "E8L",
                      "term": "obere"
                    },
                    {
                      "code": "E8S",
                      "term": "untere"
                    }
                  ]
                }
              ]
            }
          },
          {
            "code": "E8Z",
            "term": "Kolik (z.B. Niere, Galle)"
          },
          {
            "code": "E96",
            "term": "Enteritis"
          }
        ],
        "sonstiges": {
          "code": "E9D",
          "term": "Sonstige"
        }
      },
      {
        "art": "auswahl",
        "code": "E9K",
        "term": "Psychiatrie",
        "mehrfach": true,
        "leer": [],
        "optionen": [
          {
            "code": "E9R",
            "term": "Psychose, Manie, Erregungszustand"
          },
          {
            "code": "E9Y",
            "term": "Angst, Depression"
          },
          {
            "code": "EA5",
            "term": "Intoxikation",
            "zusatz": {
              "mehrfach": false,
              "kinder": [
                {
                  "art": "auswahl",
                  "code": "EAC",
                  "term": "",
                  "mehrfach": true,
                  "leer": [],
                  "optionen": [
                    {
                      "code": "EAJ",
                      "term": "akzidentell"
                    },
                    {
                      "code": "EAQ",
                      "term": "Alkohol"
                    },
                    {
                      "code": "EAX",
                      "term": "Drogen"
                    },
                    {
                      "code": "EB4",
                      "term": "Medikamente"
                    }
                  ],
                  "sonstiges": {
                    "code": "EBB",
                    "term": "Sonstige"
                  }
                }
              ]
            }
          },
          {
            "code": "EBI",
            "term": "Entzug, Delir"
          },
          {
            "code": "EBP",
            "term": "Suizid(versuch)"
          },
          {
            "code": "EBW",
            "term": "Psychosoziale Krise"
          }
        ],
        "sonstiges": {
          "code": "EC3",
          "term": "Sonstige"
        }
      },
      {
        "art": "auswahl",
        "code": "ECA",
        "term": "Stoffwechsel",
        "mehrfach": true,
        "leer": [],
        "optionen": [
          {
            "code": "ECH",
            "term": "Hypoglykämie"
          },
          {
            "code": "ECO",
            "term": "Hyperglykämie"
          },
          {
            "code": "ECV",
            "term": "Exsiccose"
          },
          {
            "code": "ED2",
            "term": "Urämie/ANV",
            "zusatz": {
              "mehrfach": false,
              "kinder": [
                {
                  "art": "frage",
                  "code": "ED9",
                  "term": "bek. Dialysepflichtig",
                  "typ": "j_opt"
                }
              ]
            }
          }
        ],
        "sonstiges": {
          "code": "EDG",
          "term": "Sonstige"
        }
      },
      {
        "art": "auswahl",
        "code": "EDN",
        "term": "Pädiatrie",
        "mehrfach": true,
        "leer": [],
        "optionen": [
          {
            "code": "EDU",
            "term": "Fieberkrampf"
          },
          {
            "code": "EE1",
            "term": "Pseudokrupp"
          },
          {
            "code": "EE8",
            "term": "SIDS / Near-SIDS"
          }
        ],
        "sonstiges": {
          "code": "EEF",
          "term": "Sonstige"
        }
      },
      {
        "art": "auswahl",
        "code": "EEM",
        "term": "Gynäkologie",
        "mehrfach": true,
        "leer": [],
        "optionen": [
          {
            "code": "EET",
            "term": "Schwangerschaft",
            "zusatz": {
              "mehrfach": false,
              "kinder": [
                {
                  "art": "auswahl",
                  "code": "EF0",
                  "term": "",
                  "mehrfach": false,
                  "leer": [],
                  "optionen": [
                    {
                      "code": "EF7",
                      "term": "drohende Geburt"
                    },
                    {
                      "code": "EFE",
                      "term": "präklinische Geburt"
                    }
                  ]
                }
              ]
            }
          },
          {
            "code": "EFL",
            "term": "(Prä-)Eklampsie"
          },
          {
            "code": "EFS",
            "term": "vaginale Blutung"
          }
        ],
        "sonstiges": {
          "code": "EFZ",
          "term": "Sonstige"
        }
      },
      {
        "art": "auswahl",
        "code": "EG6",
        "term": "Sonstige",
        "mehrfach": true,
        "leer": [],
        "optionen": [
          {
            "code": "EGD",
            "term": "anaphylakt. Reaktion",
            "zusatz": {
              "mehrfach": false,
              "kinder": [
                {
                  "art": "auswahl",
                  "code": "EGK",
                  "term": "",
                  "mehrfach": false,
                  "leer": [],
                  "optionen": [
                    {
                      "code": "EGR",
                      "term": "I-II°"
                    },
                    {
                      "code": "EGY",
                      "term": "III-IV°"
                    }
                  ]
                }
              ]
            }
          },
          {
            "code": "EH5",
            "term": "Hitzeerschöpfung, Hitzschlag"
          },
          {
            "code": "EHC",
            "term": "Unterkühlung / Erfrierung"
          },
          {
            "code": "EHJ",
            "term": "hochfieb. Infekt / Sepsis / sept. Schock"
          },
          {
            "code": "EHCOV",
            "term": "CoViD-19 / -Verdacht"
          },
          {
            "code": "EHQ",
            "term": "Influenza"
          },
          {
            "code": "EHX",
            "term": "Hepatitis / HIV"
          },
          {
            "code": "EI4",
            "term": "akute Lumbago"
          },
          {
            "code": "EIB",
            "term": "Epistaxis"
          },
          {
            "code": "EII",
            "term": "soziales Problem (ohne psych. Störung)"
          },
          {
            "code": "EIP",
            "term": "medizinische Behandlungskomplikation"
          }
        ],
        "sonstiges": {
          "code": "EIW",
          "term": "Sonstige"
        }
      }
    ]
  },
  {
    "code": "F01",
    "titel": "Verletzungen",
    "leer": [
      {
        "code": "F08",
        "term": "keine"
      }
    ],
    "formular": [
      {
        "art": "frage",
        "code": "F0F",
        "term": "Zusammenhang mit sportlicher Aktivität",
        "typ": "j-n_opt"
      },
      {
        "art": "frage",
        "code": "F0M",
        "term": "Zusammenhang mit beruflicher Aktivität",
        "typ": "j-n_opt"
      },
      {
        "art": "auswahlgruppe",
        "code": "F0T",
        "term": "",
        "auswahlen": [
          {
            "code": "F10",
            "term": "Schädel-Hirn"
          },
          {
            "code": "F17",
            "term": "Gesicht"
          },
          {
            "code": "F1E",
            "term": "Hals"
          },
          {
            "code": "F1L",
            "term": "Thorax"
          },
          {
            "code": "F1S",
            "term": "Abdomen"
          },
          {
            "code": "F1Z",
            "term": "Wirbelsäule"
          },
          {
            "code": "F26",
            "term": "Becken"
          },
          {
            "code": "F2D",
            "term": "Obere Extremitäten"
          },
          {
            "code": "F2K",
            "term": "Untere Extremitäten"
          },
          {
            "code": "F2R",
            "term": "Weichteile"
          }
        ],
        "leer": [],
        "optionen": [
          {
            "code": "F2Y",
            "term": "leicht"
          },
          {
            "code": "F35",
            "term": "mittel"
          },
          {
            "code": "F3C",
            "term": "schwer"
          }
        ],
        "zusatz": {
          "mehrfach": false,
          "kinder": [
            {
              "art": "auswahl",
              "code": "F3J",
              "term": "",
              "mehrfach": false,
              "leer": [],
              "optionen": [
                {
                  "code": "F3Q",
                  "term": "geschlossen"
                },
                {
                  "code": "F3X",
                  "term": "offen"
                }
              ]
            }
          ]
        }
      },
      {
        "art": "frage",
        "code": "F44",
        "term": "Polytrauma",
        "typ": "j_opt"
      },
      {
        "art": "auswahl",
        "code": "F4B",
        "term": "Spezielle Traumen",
        "mehrfach": true,
        "leer": [],
        "optionen": [
          {
            "code": "F4I",
            "term": "Verbrennung, Verbrühung",
            "zusatz": {
              "mehrfach": false,
              "kinder": [
                {
                  "art": "feld",
                  "code": "F4P",
                  "term": "1. Grades",
                  "typ": "Zahl",
                  "einheit": "%",
                  "min": "0",
                  "max": "100"
                },
                {
                  "art": "feld",
                  "code": "F4W",
                  "term": "2. Grades",
                  "typ": "Zahl",
                  "einheit": "%",
                  "min": "0",
                  "max": "100"
                },
                {
                  "art": "feld",
                  "code": "F53",
                  "term": "3. Grades",
                  "typ": "Zahl",
                  "einheit": "%",
                  "min": "0",
                  "max": "100"
                },
                {
                  "art": "feld",
                  "code": "F5A",
                  "term": "4. Grades",
                  "typ": "Zahl",
                  "einheit": "%",
                  "min": "0",
                  "max": "100"
                }
              ]
            }
          },
          {
            "code": "F5H",
            "term": "Verätzung"
          },
          {
            "code": "F5O",
            "term": "Verschüttung"
          },
          {
            "code": "F5V",
            "term": "Einklemmung"
          },
          {
            "code": "F62",
            "term": "Inhalationstrauma"
          },
          {
            "code": "F69",
            "term": "Elektrounfall"
          },
          {
            "code": "F6G",
            "term": "Beinahe-Ertrinken"
          },
          {
            "code": "F6N",
            "term": "Tauchunfall"
          },
          {
            "code": "F6U",
            "term": "haemorrhagischer Schock"
          }
        ],
        "sonstiges": {
          "code": "F71",
          "term": "Sonstige"
        }
      },
      {
        "art": "gruppe",
        "code": "F78",
        "term": "Unfallmechanismus",
        "kinder": [
          {
            "art": "auswahl",
            "code": "F7F",
            "term": "Trauma",
            "mehrfach": false,
            "leer": [],
            "optionen": [
              {
                "code": "F7M",
                "term": "stumpf"
              },
              {
                "code": "F7T",
                "term": "penetrierend"
              }
            ]
          },
          {
            "art": "auswahl",
            "code": "F80",
            "term": "Sturz",
            "mehrfach": false,
            "leer": [],
            "optionen": [
              {
                "code": "F86",
                "term": "ebenerdig"
              },
              {
                "code": "F87",
                "term": "<3m"
              },
              {
                "code": "F8E",
                "term": ">3m"
              }
            ]
          }
        ]
      },
      {
        "art": "gruppe",
        "code": "F8L",
        "term": "Unfallhergang",
        "kinder": [
          {
            "art": "auswahl",
            "code": "F8S",
            "term": "Verkersteilnehmer",
            "mehrfach": false,
            "leer": [],
            "optionen": [
              {
                "code": "F8Z",
                "term": "Fußgänger"
              },
              {
                "code": "F9Z",
                "term": "E-Scooter"
              },
              {
                "code": "F96",
                "term": "Fahrrad"
              },
              {
                "code": "F97",
                "term": "E-Bike u.Ä."
              },
              {
                "code": "F9D",
                "term": "Motorrad/Sozius"
              },
              {
                "code": "F9H",
                "term": "PKW-Insasse"
              },
              {
                "code": "F9K",
                "term": "LKW-Insasse"
              },
              {
                "code": "F9L",
                "term": "Bus-Insasse"
              }
            ]
          },
          {
            "art": "auswahl",
            "code": "F9Y",
            "term": "Gewaltanwendung",
            "mehrfach": true,
            "leer": [],
            "optionen": [
              {
                "code": "FA5",
                "term": "Schlag"
              },
              {
                "code": "FAC",
                "term": "Stich"
              },
              {
                "code": "FAJ",
                "term": "Schuss"
              },
              {
                "code": "FAQ",
                "term": "Gewaltverbrechen"
              }
            ],
            "sonstiges": {
              "code": "FAX",
              "term": "Sonstige"
            }
          }
        ]
      }
    ]
  },
  {
    "code": "G01",
    "titel": "Erstdiagnosen",
    "leer": [],
    "formular": [
      {
        "art": "struktur",
        "code": "G07",
        "term": "",
        "typ": "Erstdiagnosen"
      },
      {
        "art": "freitext",
        "code": "G08"
      },
      {
        "art": "auswahl",
        "code": "G0F",
        "term": "NACA SCORE",
        "mehrfach": true,
        "leer": [],
        "optionen": [
          {
            "code": "G0M",
            "term": "I (geringfügige Störung)"
          },
          {
            "code": "G0T",
            "term": "II (leichte Störung)"
          },
          {
            "code": "G10",
            "term": "III (mäßige Störung)"
          },
          {
            "code": "G17",
            "term": "IV (Lebensgefahr nicht auszuschließen)"
          },
          {
            "code": "G1E",
            "term": "V (akute Lebensgefahr)"
          },
          {
            "code": "G1L",
            "term": "VI (Reanimation)"
          },
          {
            "code": "G1S",
            "term": "VII (Tod)"
          }
        ],
        "sonstiges": {
          "code": "G1Z",
          "term": "Sonstige"
        }
      },
      {
        "art": "frage",
        "code": "G26",
        "term": "Palliative Situation",
        "typ": "j_opt"
      }
    ]
  },
  {
    "code": "H01",
    "titel": "Verlaufsbeschreibung",
    "verlauf": {
      "code": "H08",
      "leer": [
        {
          "code": "H0F",
          "term": "keine"
        }
      ],
      "spalten": [
        {
          "art": "feld",
          "code": "H0M",
          "term": "Zeitpunkt",
          "typ": "Zeit",
          "min": "0",
          "max": "300"
        },
        {
          "art": "feld",
          "code": "H0T",
          "term": "Puls",
          "typ": "Zahl",
          "einheit": "1/min",
          "min": "0",
          "max": "300"
        },
        {
          "art": "feld",
          "code": "H10",
          "term": "RRsys",
          "typ": "Zahl",
          "einheit": "mmHg",
          "min": "0",
          "max": "300"
        },
        {
          "art": "feld",
          "code": "H17",
          "term": "RRdia",
          "typ": "Zahl",
          "einheit": "mmHg",
          "min": "0",
          "max": "300"
        },
        {
          "art": "auswahl",
          "code": "H1E",
          "term": "",
          "mehrfach": true,
          "leer": [],
          "optionen": [
            {
              "code": "H1L",
              "term": "HDM"
            },
            {
              "code": "H1S",
              "term": "Defibrillation"
            },
            {
              "code": "H1Z",
              "term": "Transport"
            },
            {
              "code": "H26",
              "term": "Intubation"
            },
            {
              "code": "H2D",
              "term": "Suprarenin"
            },
            {
              "code": "H2K",
              "term": "Amiodaron"
            }
          ]
        },
        {
          "art": "feld",
          "code": "H2R",
          "term": "O2",
          "typ": "Zahl",
          "einheit": "l/min",
          "min": "0",
          "max": "30"
        },
        {
          "art": "feld",
          "code": "H2Y",
          "term": "SpO2",
          "typ": "Zahl",
          "einheit": "%",
          "min": "0",
          "max": "100"
        },
        {
          "art": "feld",
          "code": "H35",
          "term": "etCO2",
          "typ": "Zahl",
          "einheit": "mmHg",
          "min": "0",
          "max": "200"
        }
      ]
    }
  },
  {
    "code": "I01",
    "titel": "Medikation",
    "leer": [
      {
        "code": "I08",
        "term": "keine Medikation"
      }
    ],
    "formular": [
      {
        "art": "struktur",
        "code": "I0F",
        "term": "",
        "typ": "Medikation"
      },
      {
        "art": "auswahl",
        "code": "I0M",
        "term": "Vorab-Intervention durch Rettungsdienst",
        "mehrfach": true,
        "leer": [],
        "optionen": [
          {
            "code": "I0N",
            "term": "Maßnahmen"
          },
          {
            "code": "I0O",
            "term": "Medikamente"
          }
        ],
        "zusatz": {
          "mehrfach": false,
          "kinder": [
            {
              "art": "freitext",
              "code": "I0P"
            }
          ]
        }
      },
      {
        "art": "auswahl",
        "code": "I2D",
        "term": "Lysetherapie",
        "mehrfach": false,
        "leer": [],
        "optionen": [
          {
            "code": "I2K",
            "term": "vor Kreislaufstillstand"
          },
          {
            "code": "I2R",
            "term": "während Kreislaufstillstand"
          },
          {
            "code": "I2Y",
            "term": "nach ROSC"
          }
        ],
        "zusatz": {
          "mehrfach": false,
          "kinder": [
            {
              "art": "feld",
              "code": "I35",
              "term": "Beginn",
              "typ": "Zeit"
            }
          ]
        }
      }
    ]
  },
  {
    "code": "J01",
    "titel": "Massnahmen",
    "kinder": [
      {
        "code": "J08",
        "titel": "Zugänge",
        "leer": [],
        "formular": [
          {
            "art": "auswahl",
            "code": "J0F",
            "term": "",
            "mehrfach": true,
            "leer": [],
            "optionen": [
              {
                "code": "J0M",
                "term": "peripherer Zugang",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "frage",
                      "code": "J0T",
                      "term": "bereits vorhanden",
                      "typ": "j_opt"
                    },
                    {
                      "art": "feld",
                      "code": "J10",
                      "term": "Art / Ort / Größe",
                      "typ": "Text"
                    },
                    {
                      "art": "feld",
                      "code": "J17",
                      "term": "Anzahl",
                      "typ": "Zahl",
                      "einheit": "1",
                      "min": "1",
                      "max": "9"
                    }
                  ]
                }
              },
              {
                "code": "J1E",
                "term": "intraossäre Punktion",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "frage",
                      "code": "J1N",
                      "term": "bereits vorhanden",
                      "typ": "j_opt"
                    },
                    {
                      "art": "feld",
                      "code": "J1L",
                      "term": "Art / Ort / Größe",
                      "typ": "Text"
                    },
                    {
                      "art": "feld",
                      "code": "J1S",
                      "term": "Anzahl",
                      "typ": "Zahl",
                      "einheit": "1",
                      "min": "1",
                      "max": "9"
                    }
                  ]
                }
              },
              {
                "code": "J1Z",
                "term": "Transnasal-Applikator"
              },
              {
                "code": "J26",
                "term": "Sonstige",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "feld",
                      "code": "J2D",
                      "term": "Art / Ort / Größe",
                      "typ": "Text"
                    },
                    {
                      "art": "feld",
                      "code": "J2K",
                      "term": "Anzahl",
                      "typ": "Zahl",
                      "einheit": "1",
                      "min": "1",
                      "max": "9"
                    }
                  ]
                }
              },
              {
                "code": "J2R",
                "term": "Zugang erschwert",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "auswahl",
                      "code": "J2Y",
                      "term": "",
                      "mehrfach": false,
                      "leer": [],
                      "optionen": [
                        {
                          "code": "J35",
                          "term": "mehr als 2 Versuche"
                        },
                        {
                          "code": "J3C",
                          "term": "Zugang unmöglich, Verfahrenswechsel"
                        }
                      ]
                    }
                  ]
                }
              }
            ]
          }
        ]
      },
      {
        "code": "J3J",
        "titel": "Atemweg",
        "leer": [],
        "formular": [
          {
            "art": "auswahl",
            "code": "J3Q",
            "term": "",
            "mehrfach": true,
            "leer": [],
            "optionen": [
              {
                "code": "J3X",
                "term": "Sauerstoffgabe",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "feld",
                      "code": "J44",
                      "term": "",
                      "typ": "Zahl",
                      "einheit": "l/min"
                    },
                    {
                      "art": "frage",
                      "code": "J4B",
                      "term": "als Präoxygenierung",
                      "typ": "j_opt"
                    }
                  ]
                }
              },
              {
                "code": "J4I",
                "term": "Freimachen der Atemwege"
              },
              {
                "code": "J4K",
                "term": "Absaugen"
              },
              {
                "code": "J4L",
                "term": "Absaugpumpe"
              },
              {
                "code": "J4P",
                "term": "Masken-/Beutel-Beatmung",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "auswahl",
                      "code": "J4W",
                      "term": "",
                      "mehrfach": true,
                      "leer": [],
                      "optionen": [
                        {
                          "code": "J53",
                          "term": "kontrolliert"
                        },
                        {
                          "code": "J5A",
                          "term": "unterstützend, Demand-Ventil"
                        },
                        {
                          "code": "J5H",
                          "term": "nicht möglich"
                        }
                      ]
                    }
                  ]
                }
              },
              {
                "code": "J5O",
                "term": "supraglottische Atemwegshilfe",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "auswahl",
                      "code": "J5V",
                      "term": "",
                      "mehrfach": false,
                      "leer": [],
                      "optionen": [
                        {
                          "code": "J62",
                          "term": "Larynxmaske"
                        },
                        {
                          "code": "J69",
                          "term": "Larynxtubus"
                        },
                        {
                          "code": "J6G",
                          "term": "Sonstige"
                        }
                      ]
                    }
                  ]
                }
              },
              {
                "code": "J6N",
                "term": "endotracheale Intubation",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "auswahl",
                      "code": "J6U",
                      "term": "",
                      "mehrfach": false,
                      "leer": [],
                      "optionen": [
                        {
                          "code": "J71",
                          "term": "oral"
                        },
                        {
                          "code": "J78",
                          "term": "nasal"
                        }
                      ]
                    },
                    {
                      "art": "feld",
                      "code": "J7F",
                      "term": "Größe",
                      "typ": "Zahl",
                      "einheit": "mm",
                      "min": "3.0",
                      "max": "9.5"
                    },
                    {
                      "art": "frage",
                      "code": "J7M",
                      "term": "Intubation erschwert",
                      "typ": "j_opt",
                      "wennJa": [
                        {
                          "art": "feld",
                          "code": "J7T",
                          "term": "Anzahl Versuche",
                          "typ": "Zahl",
                          "einheit": "1",
                          "min": "1",
                          "max": "10"
                        }
                      ]
                    }
                  ]
                }
              },
              {
                "code": "J80",
                "term": "Videolaryngoskop"
              },
              {
                "code": "J81",
                "term": "Trachealkanülenwechsel"
              },
              {
                "code": "J87",
                "term": "Koniotomie / chirurgischer Atemweg"
              }
            ],
            "sonstiges": {
              "code": "J8E",
              "term": "sonstiger Atemwegszugang"
            }
          }
        ]
      },
      {
        "code": "J8L",
        "titel": "Beatmung",
        "leer": [],
        "formular": [
          {
            "art": "auswahl",
            "code": "J8S",
            "term": "",
            "mehrfach": false,
            "leer": [],
            "optionen": [
              {
                "code": "J8Z",
                "term": "manuell"
              },
              {
                "code": "J96",
                "term": "maschinell",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "auswahl",
                      "code": "J9D",
                      "term": "",
                      "mehrfach": false,
                      "leer": [],
                      "optionen": [
                        {
                          "code": "J9K",
                          "term": "kontrolliert"
                        },
                        {
                          "code": "J9R",
                          "term": "assistiert"
                        },
                        {
                          "code": "J9Y",
                          "term": "NIV"
                        }
                      ]
                    },
                    {
                      "art": "feld",
                      "code": "JA5",
                      "term": "FiO2",
                      "typ": "Zahl",
                      "einheit": "%",
                      "min": "21",
                      "max": "100"
                    },
                    {
                      "art": "feld",
                      "code": "JAC",
                      "term": "AF",
                      "typ": "Zahl",
                      "einheit": "1/min",
                      "min": "6",
                      "max": "35"
                    },
                    {
                      "art": "feld",
                      "code": "JAJ",
                      "term": "AMV",
                      "typ": "Zahl",
                      "einheit": "l/min",
                      "min": "0.5",
                      "max": "10.0"
                    },
                    {
                      "art": "feld",
                      "code": "JAQ",
                      "term": "PEEP",
                      "typ": "Zahl",
                      "einheit": "mmHg",
                      "min": "0",
                      "max": "20"
                    },
                    {
                      "art": "feld",
                      "code": "JAX",
                      "term": "Pmax",
                      "typ": "Zahl",
                      "einheit": "mmHg",
                      "min": "15",
                      "max": "50"
                    }
                  ]
                }
              },
              {
                "code": "JAZ",
                "term": "Notfallnarkose"
              }
            ]
          }
        ]
      },
      {
        "code": "JB4",
        "titel": "Defibrillation",
        "leer": [],
        "formular": [
          {
            "art": "auswahl",
            "code": "JBB",
            "term": "",
            "mehrfach": true,
            "leer": [],
            "optionen": [
              {
                "code": "JBI",
                "term": "AED",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "auswahl",
                      "code": "JBP",
                      "term": "Erstanwendung",
                      "mehrfach": false,
                      "leer": [],
                      "optionen": [
                        {
                          "code": "JBW",
                          "term": "Laien"
                        },
                        {
                          "code": "JC3",
                          "term": "First Responder"
                        },
                        {
                          "code": "JCA",
                          "term": "Rettungsdienst"
                        },
                        {
                          "code": "JCH",
                          "term": "Arzt"
                        }
                      ]
                    }
                  ]
                }
              },
              {
                "code": "JCO",
                "term": "Defi",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "auswahl",
                      "code": "JCV",
                      "term": "",
                      "mehrfach": false,
                      "leer": [],
                      "optionen": [
                        {
                          "code": "JD2",
                          "term": "monophasisch"
                        },
                        {
                          "code": "JD9",
                          "term": "biphasisch"
                        }
                      ]
                    },
                    {
                      "art": "feld",
                      "code": "JDG",
                      "term": "1. Defibrillation",
                      "typ": "Zeit"
                    },
                    {
                      "art": "feld",
                      "code": "JDN",
                      "term": "1. ROSC",
                      "typ": "Zeit"
                    },
                    {
                      "art": "feld",
                      "code": "JDU",
                      "term": "Anzahl Defi insgesamt",
                      "typ": "Zahl",
                      "einheit": "1"
                    },
                    {
                      "art": "feld",
                      "code": "JE1",
                      "term": "Energie (max)",
                      "typ": "Zahl",
                      "einheit": "Joule"
                    }
                  ]
                }
              }
            ]
          }
        ]
      },
      {
        "code": "JE8",
        "titel": "Reanimation",
        "hinweis": "Ergänzende Angaben unter Abschnitt \"Reanimation / Tod / Todesfeststellung\"",
        "leer": [],
        "formular": [
          {
            "art": "auswahl",
            "code": "JEF",
            "term": "",
            "mehrfach": true,
            "leer": [],
            "optionen": [
              {
                "code": "JEM",
                "term": "Herzdruckmassage",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "feld",
                      "code": "JET",
                      "term": "Beginn HDM",
                      "typ": "Zeit"
                    },
                    {
                      "art": "auswahl",
                      "code": "JF0",
                      "term": "",
                      "mehrfach": false,
                      "leer": [],
                      "optionen": [
                        {
                          "code": "JF7",
                          "term": "Feedbacksystem"
                        },
                        {
                          "code": "JFE",
                          "term": "mechanisches Thoraxkompressionssystem"
                        }
                      ]
                    }
                  ]
                }
              },
              {
                "code": "JFF",
                "term": "VV-ECMO"
              },
              {
                "code": "JFG",
                "term": "VA-ECMO"
              },
              {
                "code": "JFH",
                "term": "REBOA"
              },
              {
                "code": "JFL",
                "term": "Aktive Kühlung",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "auswahl",
                      "code": "JFS",
                      "term": "",
                      "mehrfach": false,
                      "leer": [],
                      "optionen": [
                        {
                          "code": "JFZ",
                          "term": "Infusion"
                        },
                        {
                          "code": "JG6",
                          "term": "Kühlpackungen"
                        },
                        {
                          "code": "JGD",
                          "term": "technisch"
                        }
                      ]
                    }
                  ]
                }
              },
              {
                "code": "JGK",
                "term": "Vorab: Telefonanleitung zur Reanimation"
              }
            ]
          }
        ]
      },
      {
        "code": "JGR",
        "titel": "Sonstige",
        "leer": [],
        "formular": [
          {
            "art": "frage",
            "code": "JGY",
            "term": "Spezielle Lagerung",
            "typ": "j_opt",
            "wennJa": [
              {
                "art": "auswahl",
                "code": "JH5",
                "term": "",
                "mehrfach": true,
                "leer": [],
                "optionen": [
                  {
                    "code": "JHC",
                    "term": "stabile Seitenlage"
                  },
                  {
                    "code": "JHJ",
                    "term": "Wärmeerhalt"
                  },
                  {
                    "code": "JHQ",
                    "term": "Zervikalstütze"
                  },
                  {
                    "code": "JHX",
                    "term": "Schocklagerung"
                  },
                  {
                    "code": "JI4",
                    "term": "Inkubator"
                  },
                  {
                    "code": "JIB",
                    "term": "Vakuumschiene"
                  },
                  {
                    "code": "JII",
                    "term": "Oberkörper Hochlagerung"
                  },
                  {
                    "code": "JIP",
                    "term": "Vakuummatratze"
                  },
                  {
                    "code": "JIW",
                    "term": "Flachlagerung"
                  },
                  {
                    "code": "JJ3",
                    "term": "Schaufeltrage"
                  },
                  {
                    "code": "JJA",
                    "term": "Sitzend"
                  },
                  {
                    "code": "JJH",
                    "term": "Spineboard"
                  }
                ],
                "sonstiges": {
                  "code": "JJO",
                  "term": "Sonstige"
                }
              }
            ]
          },
          {
            "art": "auswahl",
            "code": "JJV",
            "term": "",
            "mehrfach": true,
            "leer": [],
            "optionen": [
              {
                "code": "JK2",
                "term": "12-Kanal EKG"
              },
              {
                "code": "JK9",
                "term": "Funkübermittlung"
              },
              {
                "code": "JKG",
                "term": "externer Schrittmacher"
              },
              {
                "code": "JKN",
                "term": "Spritzenpumpe(n)"
              },
              {
                "code": "JKU",
                "term": "invasiver RR"
              },
              {
                "code": "JL1",
                "term": "Kardioversion"
              },
              {
                "code": "JLF",
                "term": "Verband"
              },
              {
                "code": "JLM",
                "term": "Reposition"
              },
              {
                "code": "JLT",
                "term": "Beckenschlinge"
              },
              {
                "code": "JM7",
                "term": "Thoraxdrainage re."
              },
              {
                "code": "JME",
                "term": "Thoraxdrainage li."
              },
              {
                "code": "JMF",
                "term": "Throakotomie"
              },
              {
                "code": "JMG",
                "term": "Nadeldekompression"
              },
              {
                "code": "JML",
                "term": "Blasenkatheter"
              },
              {
                "code": "JMS",
                "term": "Magensonde"
              },
              {
                "code": "JMZ",
                "term": "Ultraschall"
              },
              {
                "code": "JND",
                "term": "Entbindung"
              },
              {
                "code": "JNK",
                "term": "Krisenintervention"
              },
              {
                "code": "JNH",
                "term": "besondere Hygiene"
              },
              {
                "code": "JN8",
                "term": "Tourniquet"
              },
              {
                "code": "JN9",
                "term": "Haemostyptikum"
              },
              {
                "code": "JNA",
                "term": "Thoraxverschlusspflaster"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "code": "K01",
    "titel": "Reanimation / Tod / Todesfeststellung",
    "leer": [],
    "formular": [
      {
        "art": "auswahl",
        "code": "K08",
        "term": "",
        "mehrfach": false,
        "leer": [],
        "optionen": [
          {
            "code": "K0F",
            "term": "Reanimation",
            "zusatz": {
              "mehrfach": false,
              "kinder": [
                {
                  "art": "auswahl",
                  "code": "K0M",
                  "term": "",
                  "mehrfach": false,
                  "leer": [],
                  "optionen": [
                    {
                      "code": "K0T",
                      "term": "ROSC im Verlauf"
                    },
                    {
                      "code": "K10",
                      "term": "niemals ROSC"
                    },
                    {
                      "code": "K17",
                      "term": "erfolglos"
                    }
                  ]
                },
                {
                  "art": "auswahl",
                  "code": "K1E",
                  "term": "Beginn Rea.",
                  "mehrfach": false,
                  "leer": [],
                  "optionen": [
                    {
                      "code": "K1L",
                      "term": "Ersthelfer"
                    },
                    {
                      "code": "K1S",
                      "term": "First Responder"
                    },
                    {
                      "code": "K1Z",
                      "term": "Rettungsdienst"
                    },
                    {
                      "code": "K26",
                      "term": "Notarzt"
                    }
                  ]
                },
                {
                  "art": "auswahl",
                  "code": "K2D",
                  "term": "KH-Aufnahme",
                  "mehrfach": false,
                  "leer": [],
                  "optionen": [
                    {
                      "code": "K2K",
                      "term": "mit ROSC"
                    },
                    {
                      "code": "K2R",
                      "term": "laufende Reanimation"
                    }
                  ]
                }
              ]
            }
          },
          {
            "code": "K2Y",
            "term": "keine Reanimation",
            "zusatz": {
              "mehrfach": false,
              "kinder": [
                {
                  "art": "auswahl",
                  "code": "K35",
                  "term": "",
                  "mehrfach": false,
                  "leer": [],
                  "optionen": [
                    {
                      "code": "K3C",
                      "term": "nicht gewünscht / Patientenverfügung"
                    },
                    {
                      "code": "K3J",
                      "term": "zu spät"
                    },
                    {
                      "code": "K3Q",
                      "term": "aussichtslose Grunderkrankung"
                    }
                  ],
                  "sonstiges": {
                    "code": "K3X",
                    "term": "Sonstige"
                  }
                }
              ]
            }
          }
        ]
      },
      {
        "art": "frage",
        "code": "K44",
        "term": "Tod",
        "typ": "j_opt",
        "wennJa": [
          {
            "art": "frage",
            "code": "K4B",
            "term": "Todesfeststellung",
            "typ": "j_opt",
            "wennJa": [
              {
                "art": "auswahl",
                "code": "K4I",
                "term": "Todesart",
                "mehrfach": false,
                "leer": [],
                "optionen": [
                  {
                    "code": "K4P",
                    "term": "natürlich"
                  },
                  {
                    "code": "K4W",
                    "term": "unklar"
                  },
                  {
                    "code": "K53",
                    "term": "nicht natürlich"
                  }
                ]
              }
            ]
          },
          {
            "art": "oder",
            "code": "K5A",
            "term": "",
            "leer": [],
            "kinder": [
              {
                "art": "feld",
                "code": "K5H",
                "term": "Todeszeitpunkt",
                "typ": "Zeit"
              },
              {
                "art": "frage",
                "code": "K5O",
                "term": "Todeszeitpunkt nicht bestimmbar",
                "typ": "j_opt"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "code": "L01",
    "titel": "Übergabe",
    "kinder": [
      {
        "code": "L08",
        "titel": "Messwerte",
        "leer": [
          {
            "code": "L0F",
            "term": "keine"
          }
        ],
        "formular": [
          {
            "art": "feld",
            "code": "L0M",
            "term": "Schmerzen",
            "typ": "Zahl",
            "einheit": "1",
            "min": "0",
            "max": "10"
          },
          {
            "art": "feld",
            "code": "L0T",
            "term": "RRsys",
            "typ": "Zahl",
            "einheit": "mmHg",
            "min": "0",
            "max": "300"
          },
          {
            "art": "feld",
            "code": "L10",
            "term": "RRdia",
            "typ": "Zahl",
            "einheit": "mmHg",
            "min": "0",
            "max": "300"
          },
          {
            "art": "feld",
            "code": "L17",
            "term": "Herzfrequenz",
            "typ": "Zahl",
            "einheit": "1/min",
            "min": "0",
            "max": "300",
            "zusatz": {
              "mehrfach": false,
              "kinder": [
                {
                  "art": "auswahl",
                  "code": "L1E",
                  "term": "",
                  "mehrfach": false,
                  "leer": [],
                  "optionen": [
                    {
                      "code": "L1L",
                      "term": "rhythmisch"
                    },
                    {
                      "code": "L1S",
                      "term": "arrhythmisch"
                    }
                  ]
                }
              ]
            }
          },
          {
            "art": "oder",
            "code": "L1Z",
            "term": "Blutzucker",
            "leer": [],
            "kinder": [
              {
                "art": "feld",
                "code": "L26",
                "term": "Wert",
                "typ": "Zahl",
                "einheit": "mg/dl mmol/l",
                "min": "0",
                "max": "600"
              },
              {
                "art": "auswahl",
                "code": "L2D",
                "term": "Kategorie",
                "mehrfach": false,
                "leer": [],
                "optionen": [
                  {
                    "code": "L2K",
                    "term": "LOW"
                  },
                  {
                    "code": "L2R",
                    "term": "HIGH"
                  }
                ]
              }
            ]
          },
          {
            "art": "feld",
            "code": "L2Y",
            "term": "Atemfrequenz",
            "typ": "Zahl",
            "einheit": "1/min",
            "min": "0",
            "max": "60"
          },
          {
            "art": "feld",
            "code": "L35",
            "term": "SpO2",
            "typ": "Zahl",
            "einheit": "%",
            "min": "0",
            "max": "100",
            "zusatz": {
              "mehrfach": false,
              "kinder": [
                {
                  "art": "auswahl",
                  "code": "L3C",
                  "term": "",
                  "mehrfach": false,
                  "leer": [],
                  "optionen": [
                    {
                      "code": "L3J",
                      "term": "bei Raumluft"
                    },
                    {
                      "code": "L3Q",
                      "term": "unter O2-Gabe"
                    }
                  ]
                }
              ]
            }
          },
          {
            "art": "feld",
            "code": "L3X",
            "term": "Temperatur",
            "typ": "Zahl",
            "einheit": "°C",
            "min": "20.0",
            "max": "42.0"
          },
          {
            "art": "feld",
            "code": "L44",
            "term": "etCO2",
            "typ": "Zahl",
            "einheit": "mmHg",
            "min": "0",
            "max": "200"
          }
        ]
      },
      {
        "code": "L4B",
        "titel": "EKG",
        "leer": [
          {
            "code": "L4I",
            "term": "kein EKG"
          }
        ],
        "formular": [
          {
            "art": "auswahl",
            "code": "L4P",
            "term": "",
            "mehrfach": false,
            "leer": [],
            "optionen": [
              {
                "code": "L4W",
                "term": "Sinusrhythmus"
              },
              {
                "code": "L53",
                "term": "Abs. Arrhythmie"
              },
              {
                "code": "L5A",
                "term": "AV-Block II°"
              },
              {
                "code": "L5H",
                "term": "AV-Block III°"
              },
              {
                "code": "L5O",
                "term": "Schrittmacherrhythmus"
              },
              {
                "code": "L5V",
                "term": "Kammerflimmern"
              },
              {
                "code": "L62",
                "term": "PEA / EMD"
              },
              {
                "code": "L69",
                "term": "Asystolie"
              }
            ],
            "zusatz": {
              "mehrfach": true,
              "kinder": [
                {
                  "art": "auswahl",
                  "code": "L6G",
                  "term": "",
                  "mehrfach": false,
                  "leer": [],
                  "optionen": [
                    {
                      "code": "L6N",
                      "term": "STEMI"
                    },
                    {
                      "code": "L6U",
                      "term": "schmale QRS-Tachykardie"
                    },
                    {
                      "code": "L71",
                      "term": "breite QRS-Tachykardie"
                    },
                    {
                      "code": "L78",
                      "term": "SVES / VES monomorph"
                    },
                    {
                      "code": "L7F",
                      "term": "VES polymorph"
                    }
                  ]
                }
              ]
            }
          }
        ]
      },
      {
        "code": "L7M",
        "titel": "Atmung",
        "leer": [
          {
            "code": "L7T",
            "term": "nicht untersucht"
          }
        ],
        "formular": [
          {
            "art": "auswahl",
            "code": "L80",
            "term": "",
            "mehrfach": false,
            "leer": [],
            "optionen": [
              {
                "code": "L87",
                "term": "unauffällig"
              },
              {
                "code": "L8E",
                "term": "Dyspnoe",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "auswahl",
                      "code": "L8L",
                      "term": "",
                      "mehrfach": true,
                      "leer": [],
                      "optionen": [
                        {
                          "code": "L8S",
                          "term": "Stridor"
                        },
                        {
                          "code": "L8Z",
                          "term": "Zyanose"
                        },
                        {
                          "code": "L96",
                          "term": "Spastik"
                        },
                        {
                          "code": "L9D",
                          "term": "Hyperventilation"
                        },
                        {
                          "code": "L9K",
                          "term": "Atemwegsverlegung"
                        },
                        {
                          "code": "L9R",
                          "term": "Rasselgeräusche"
                        }
                      ]
                    }
                  ]
                }
              },
              {
                "code": "L9Y",
                "term": "Schnappatmung"
              },
              {
                "code": "LA5",
                "term": "Apnoe"
              },
              {
                "code": "LAC",
                "term": "Beatmung"
              },
              {
                "code": "LAJ",
                "term": "sonstiges path. Atemmuster (Biot, Cheyne Stokes etc.)"
              }
            ]
          }
        ]
      },
      {
        "code": "LAQ",
        "titel": "Bewusstsein",
        "leer": [
          {
            "code": "LAX",
            "term": "nicht untersucht"
          }
        ],
        "formular": [
          {
            "art": "auswahl",
            "code": "LB4",
            "term": "",
            "mehrfach": false,
            "leer": [
              {
                "code": "LBB",
                "term": "nicht beurteilbar"
              }
            ],
            "optionen": [
              {
                "code": "LBI",
                "term": "wach"
              },
              {
                "code": "LBP",
                "term": "getrübt",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "auswahl",
                      "code": "LBW",
                      "term": "",
                      "mehrfach": true,
                      "leer": [],
                      "optionen": [
                        {
                          "code": "LC3",
                          "term": "Reaktion auf Ansprache"
                        },
                        {
                          "code": "LCA",
                          "term": "Reaktion auf Schmerzreiz"
                        }
                      ]
                    }
                  ]
                }
              },
              {
                "code": "LCH",
                "term": "bewusstlos"
              },
              {
                "code": "LCO",
                "term": "analgosediert / Narkose"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "code": "M01",
    "titel": "Einsatzverlauf",
    "kinder": [
      {
        "code": "M08",
        "titel": "Besonderheiten",
        "leer": [],
        "formular": [
          {
            "art": "auswahl",
            "code": "M0F",
            "term": "",
            "mehrfach": false,
            "leer": [],
            "optionen": [
              {
                "code": "M0M",
                "term": "Übernahme aus arztbesetztem Rettungsmittel"
              },
              {
                "code": "M0T",
                "term": "Übergabe an arztbesetztes Rettungsmittel"
              },
              {
                "code": "M10",
                "term": "Transport ins Krankenhaus",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "auswahl",
                      "code": "M17",
                      "term": "",
                      "mehrfach": true,
                      "leer": [],
                      "optionen": [
                        {
                          "code": "M1E",
                          "term": "mit Arzt"
                        },
                        {
                          "code": "M1L",
                          "term": "RTH"
                        },
                        {
                          "code": "M1S",
                          "term": "mindestens eine Klinik nimmt nicht auf"
                        },
                        {
                          "code": "M1Z",
                          "term": "Zwangsbelegung"
                        },
                        {
                          "code": "M26",
                          "term": "Zwangsunterbringung"
                        },
                        {
                          "code": "M28",
                          "term": "Sondersignal"
                        }
                      ]
                    }
                  ]
                }
              },
              {
                "code": "M2D",
                "term": "nur Untersuchung und Behandlung",
                "zusatz": {
                  "mehrfach": false,
                  "kinder": [
                    {
                      "art": "auswahl",
                      "code": "M2K",
                      "term": "",
                      "mehrfach": false,
                      "leer": [],
                      "optionen": [
                        {
                          "code": "M2R",
                          "term": "Transportverweigerung"
                        },
                        {
                          "code": "M2Y",
                          "term": "Patient nicht transportfähig"
                        },
                        {
                          "code": "M35",
                          "term": "Therapieverzicht/-beschränkung bewusst"
                        }
                      ]
                    }
                  ]
                }
              }
            ]
          },
          {
            "art": "auswahl",
            "code": "M3C",
            "term": "",
            "mehrfach": true,
            "leer": [],
            "optionen": [
              {
                "code": "M3J",
                "term": "Erhöhter Hygieneaufwand"
              },
              {
                "code": "M3Q",
                "term": "erschwerter Pat-Zugang"
              },
              {
                "code": "M3X",
                "term": "techn. Rettung"
              },
              {
                "code": "M44",
                "term": "Schwerlasttransport erforderlich"
              },
              {
                "code": "M4B",
                "term": "LNA am Einsatz"
              },
              {
                "code": "M4I",
                "term": "MANV"
              },
              {
                "code": "M4P",
                "term": "Behandlung mehrerer Patienten"
              }
            ]
          }
        ]
      },
      {
        "code": "M4W",
        "titel": "Übergabe",
        "leer": [],
        "formular": [
          {
            "art": "auswahl",
            "code": "M53",
            "term": "",
            "mehrfach": false,
            "leer": [
              {
                "code": "M5A",
                "term": "keine"
              }
            ],
            "optionen": [
              {
                "code": "M5H",
                "term": "Einsatzstelle"
              },
              {
                "code": "M5O",
                "term": "ZNA / INA"
              },
              {
                "code": "M5V",
                "term": "Stroke Unit"
              },
              {
                "code": "M62",
                "term": "Intensivstation"
              },
              {
                "code": "M69",
                "term": "OP direkt"
              },
              {
                "code": "M6G",
                "term": "Praxis"
              },
              {
                "code": "M6N",
                "term": "Hausarzt / KV-Arzt vor Ort"
              },
              {
                "code": "M6U",
                "term": "Fachambulanz"
              },
              {
                "code": "M71",
                "term": "Schockraum"
              },
              {
                "code": "M78",
                "term": "Herzkatheterlabor"
              },
              {
                "code": "M7F",
                "term": "CPU"
              },
              {
                "code": "M7M",
                "term": "Allgemeinstation"
              }
            ],
            "sonstiges": {
              "code": "M7T",
              "term": "Sonstige"
            },
            "zusatz": {
              "mehrfach": false,
              "kinder": [
                {
                  "art": "feld",
                  "code": "M80",
                  "term": "Übergabe an (Name)",
                  "typ": "Text"
                }
              ]
            }
          }
        ]
      },
      {
        "code": "M87",
        "titel": "Bemerkungen",
        "hinweis": "z.B. Verlauf, Hausarzt, Telefon-Nummer Angehörige, Notkompetenz-Massnahmen",
        "leer": [],
        "formular": [
          {
            "art": "auswahl",
            "code": "M88",
            "term": "",
            "mehrfach": false,
            "leer": [],
            "optionen": [
              {
                "code": "M89",
                "term": "Massnahmenverweigerung (ggf. detailliert angeben)"
              }
            ]
          },
          {
            "art": "freitext",
            "code": "M8E"
          }
        ]
      }
    ]
  }
]


// ── Suchen ───────────────────────────────────────────────────────────────

/** Alle Abschnitte, flach — auch die verschachtelten. */
export function naepAbschnitteFlach(
  abschnitte: NaepAbschnitt[] = NAEP_ABSCHNITTE,
): NaepAbschnitt[] {
  return abschnitte.flatMap((a) => [a, ...naepAbschnitteFlach(a.kinder ?? [])])
}

/** Alle Eingaben einer Liste, flach — auch die aus Zusaetzen, Gruppen und Fragen. */
export function naepEingabenFlach(eingaben: NaepEingabe[]): NaepEingabe[] {
  const aus: NaepEingabe[] = []
  for (const e of eingaben) {
    aus.push(e)
    if ('zusatz' in e && e.zusatz) aus.push(...naepEingabenFlach(e.zusatz.kinder))
    if (e.art === 'gruppe' || e.art === 'oder') aus.push(...naepEingabenFlach(e.kinder))
    if (e.art === 'frage' && e.wennJa) aus.push(...naepEingabenFlach(e.wennJa))
    if (e.art === 'auswahl' || e.art === 'auswahlgruppe') {
      for (const o of e.optionen) if (o.zusatz) aus.push(...naepEingabenFlach(o.zusatz.kinder))
    }
  }
  return aus
}

/** Jede Eingabe des ganzen Protokolls. */
export function naepAlleEingaben(): NaepEingabe[] {
  return naepAbschnitteFlach().flatMap((a) => [
    ...naepEingabenFlach(a.formular ?? []),
    ...naepEingabenFlach(a.verlauf?.spalten ?? []),
  ])
}

/** Eine Eingabe anhand ihres Codes. */
export function naepEingabe(code: string): NaepEingabe | undefined {
  return naepAlleEingaben().find((e) => e.code === code)
}

/** Ein Abschnitt anhand seines Codes. */
export function naepAbschnitt(code: string): NaepAbschnitt | undefined {
  return naepAbschnitteFlach().find((a) => a.code === code)
}

/** Jede Option des Protokolls, mit dem Code der Auswahl, zu der sie gehoert. */
export function naepAlleOptionen(): { auswahl: string; option: NaepOption }[] {
  const aus: { auswahl: string; option: NaepOption }[] = []
  for (const e of naepAlleEingaben()) {
    if (e.art === 'auswahl') for (const o of e.optionen) aus.push({ auswahl: e.code, option: o })
    if (e.art === 'auswahlgruppe') {
      for (const a of e.auswahlen) for (const o of e.optionen) aus.push({ auswahl: a.code, option: o })
    }
  }
  return aus
}
