import { useState } from 'react'

const SECTIONS = [
  {
    num: '§ 1',
    title: 'Gegenstand und Dauer',
    paragraphs: [
      'Der Auftragnehmer verarbeitet personenbezogene Daten im Auftrag des Auftraggebers im Rahmen der Nutzung der Software Responda (digitale Einsatzverwaltung für Feuerwehr und Rettungsdienst), bereitgestellt unter app.responda.systems.',
      'Die Verarbeitung erfolgt für die Dauer des zwischen den Parteien geschlossenen Nutzungsvertrags. Nach Beendigung gelten die Regelungen in § 9.',
    ],
  },
  {
    num: '§ 2',
    title: 'Art, Zweck und Umfang der Verarbeitung',
    paragraphs: [
      'Zweck: Digitale Verwaltung von Einsätzen, Patientenprotokollen, Lagerhaltung, Ausbildungen und Personalverwaltung für den Auftraggeber.',
      'Art der Verarbeitung: Erhebung, Speicherung, Verarbeitung, Anzeige, Übermittlung (innerhalb des Systems) und Löschung personenbezogener Daten.',
    ],
    list: {
      label: 'Kategorien betroffener Personen',
      items: [
        'Mitglieder und Mitarbeitende der Organisation des Auftraggebers',
        'Patienten und versorgte Personen im Rahmen von Einsätzen',
        'Dritte, sofern im Rahmen von Einsätzen dokumentiert',
      ],
    },
    list2: {
      label: 'Kategorien personenbezogener Daten',
      items: [
        'Stammdaten: Name, Vorname, Geburtsdatum, Adresse',
        'Kontaktdaten: E-Mail-Adresse, Telefonnummer',
        'Gesundheitsdaten (besondere Kategorie gem. Art. 9 DSGVO): Vitalparameter, Diagnosen, Medikamentengaben, Verletzungen, Behandlungsverläufe',
        'Einsatzdaten: Einsatzort, Stichwort, Einsatzzeitraum',
        'Ausbildungsdaten: Teilnahmenachweise, Qualifikationen',
        'Zugangsdaten: Benutzername, gehashtes Passwort',
      ],
    },
  },
  {
    num: '§ 3',
    title: 'Weisungsgebundenheit',
    paragraphs: [
      'Der Auftragnehmer verarbeitet personenbezogene Daten ausschließlich auf dokumentierte Weisung des Auftraggebers, es sei denn, er ist durch das Recht der EU oder eines Mitgliedstaats zur Verarbeitung verpflichtet (Art. 28 Abs. 3 lit. a DSGVO).',
      'Weisungen erteilt der Auftraggeber durch die Konfiguration und Nutzung der Software sowie schriftlich per E-Mail an daniel@responda.systems.',
      'Hält der Auftragnehmer eine Weisung für rechtswidrig, teilt er dies dem Auftraggeber unverzüglich mit.',
    ],
  },
  {
    num: '§ 4',
    title: 'Vertraulichkeit',
    paragraphs: [
      'Der Auftragnehmer stellt sicher, dass die mit der Verarbeitung der Daten befassten Personen zur Vertraulichkeit verpflichtet sind oder einer angemessenen gesetzlichen Verschwiegenheitspflicht unterliegen (Art. 28 Abs. 3 lit. b DSGVO).',
      'Die Vertraulichkeitspflicht gilt über das Ende dieses Vertrags hinaus.',
    ],
  },
  {
    num: '§ 5',
    title: 'Technische und organisatorische Maßnahmen',
    paragraphs: [
      'Der Auftragnehmer trifft geeignete technische und organisatorische Maßnahmen gemäß Art. 32 DSGVO:',
    ],
    toms: [
      { label: 'Zutrittskontrolle', text: 'Der Server befindet sich in Nürnberg, Deutschland und steht im ausschließlichen Eigentum des Auftragnehmers; Zugang ausschließlich für den Auftragnehmer persönlich.' },
      { label: 'Zugangskontrolle', text: 'Starke Passwörter und SSH-Key-Authentifizierung; keine unsicheren Remote-Zugangsprotokolle.' },
      { label: 'Zugriffskontrolle', text: 'Rollenbasiertes Zugriffskonzept (Benutzer, Supervisor, Admin); Mandantentrennung per organization_id.' },
      { label: 'Weitergabekontrolle', text: 'Alle Verbindungen verschlüsselt via TLS 1.2/1.3 (HTTPS); keine Weitergabe an Dritte ohne Weisung.' },
      { label: 'Eingabekontrolle', text: 'Protokollierung relevanter Zugriffe und Änderungen im System.' },
      { label: 'Verfügbarkeitskontrolle', text: 'Regelmäßige Datensicherungen; Wiederherstellungskonzept vorhanden.' },
      { label: 'Trennungskontrolle', text: 'Daten verschiedener Auftraggeber werden strikt getrennt verarbeitet und gespeichert.' },
    ],
  },
  {
    num: '§ 6',
    title: 'Unterauftragsverarbeiter',
    paragraphs: [
      'Der Auftragnehmer setzt zum Zeitpunkt des Vertragsschlusses keine Unterauftragsverarbeiter ein. Alle Daten werden auf dem eigenen Server des Auftragnehmers in Deutschland verarbeitet.',
      'Beabsichtigt der Auftragnehmer künftig Unterauftragsverarbeiter einzusetzen, informiert er den Auftraggeber rechtzeitig (mindestens 4 Wochen vorher). Der Auftraggeber kann schriftlich Einspruch erheben.',
      'Werden Unterauftragsverarbeiter eingesetzt, stellt der Auftragnehmer sicher, dass diesen dieselben Datenschutzpflichten auferlegt werden.',
    ],
  },
  {
    num: '§ 7',
    title: 'Unterstützungspflichten',
    paragraphs: [
      'Der Auftragnehmer unterstützt den Auftraggeber soweit möglich bei der Erfüllung von Betroffenenanfragen (Auskunft, Berichtigung, Löschung gem. Art. 15–21 DSGVO) sowie bei der Einhaltung der Pflichten aus Art. 32–36 DSGVO.',
      'Verletzungen des Schutzes personenbezogener Daten meldet der Auftragnehmer unverzüglich, spätestens innerhalb von 24 Stunden nach Bekanntwerden, an die E-Mail-Adresse des Auftraggebers.',
    ],
  },
  {
    num: '§ 8',
    title: 'Kontrollrechte des Auftraggebers',
    paragraphs: [
      'Der Auftraggeber hat das Recht, die Einhaltung der datenschutzrechtlichen Vorschriften und dieses Vertrags zu kontrollieren.',
      'Kontrollen werden mit mindestens 5 Werktagen Vorlauf schriftlich angekündigt, soweit keine dringende Verdachtslage besteht.',
      'Der Auftragnehmer stellt alle zur Kontrolle erforderlichen Informationen zur Verfügung.',
    ],
  },
  {
    num: '§ 9',
    title: 'Löschung und Rückgabe nach Vertragsende',
    paragraphs: [
      'Nach Beendigung des Nutzungsvertrags löscht oder gibt der Auftragnehmer — nach Wahl des Auftraggebers — alle personenbezogenen Daten zurück und löscht vorhandene Kopien, sofern keine gesetzliche Aufbewahrungspflicht besteht (Art. 28 Abs. 3 lit. g DSGVO).',
      'Der Auftraggeber kann einen Datenexport (JSON- oder CSV-Format) vor Vertragsende anfordern. Dieser wird innerhalb von 14 Tagen bereitgestellt.',
      'Die vollständige Löschung wird dem Auftraggeber schriftlich bestätigt.',
    ],
  },
  {
    num: '§ 10',
    title: 'Haftung',
    paragraphs: [
      'Die Haftung der Parteien richtet sich nach den gesetzlichen Regelungen der DSGVO sowie dem zwischen den Parteien geschlossenen Nutzungsvertrag.',
    ],
  },
  {
    num: '§ 11',
    title: 'Schlussbestimmungen',
    paragraphs: [
      'Dieser Vertrag unterliegt dem Recht der Bundesrepublik Deutschland.',
      'Änderungen und Ergänzungen bedürfen der Schriftform.',
      'Sollten einzelne Bestimmungen unwirksam sein, bleibt der Vertrag im Übrigen wirksam.',
      'Dieser Vertrag ist Bestandteil des Nutzungsvertrags und geht etwaigen anderslautenden Regelungen in diesem vor.',
    ],
  },
]

export default function AVV() {
  const [orgName, setOrgName] = useState('')
  const [orgStreet, setOrgStreet] = useState('')
  const [orgCity, setOrgCity] = useState('')
  const [orgDate, setOrgDate] = useState('')

  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const label: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: '#600812',
    textTransform: 'uppercase', letterSpacing: '0.14em',
    marginBottom: 4, display: 'block',
  }
  const inp: React.CSSProperties = {
    width: '100%', border: 'none', borderBottom: '1px solid rgba(96,8,18,0.2)',
    background: 'transparent', padding: '6px 0', fontSize: 14,
    color: '#1a0e08', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ background: 'var(--warm-bg)', minHeight: '100dvh', fontFamily: "'Atkinson Hyperlegible', Georgia, serif" }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid rgba(96,8,18,0.12)', padding: '24px 24px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>Responda · Rechtliches</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1a0e08', letterSpacing: '-0.02em' }}>
            Auftragsverarbeitungsvertrag
          </div>
          <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>
            gemäß Art. 28 Datenschutz-Grundverordnung (DSGVO) · Entwurf
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Vertragsparteien */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid #600812', padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 16 }}>Vertragsparteien</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Auftraggeber */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a0e08', marginBottom: 12 }}>Auftraggeber <span style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--warm-gray)' }}>(Verantwortlicher)</span></div>
              <div style={{ marginBottom: 12 }}>
                <label style={label}>Organisation</label>
                <input style={inp} value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Name der Organisation" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={label}>Straße</label>
                <input style={inp} value={orgStreet} onChange={e => setOrgStreet(e.target.value)} placeholder="Straße, Hausnummer" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={label}>PLZ / Ort</label>
                <input style={inp} value={orgCity} onChange={e => setOrgCity(e.target.value)} placeholder="PLZ Ort" />
              </div>
              <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 4 }}>Deutschland</div>
            </div>

            {/* Auftragnehmer */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a0e08', marginBottom: 12 }}>Auftragnehmer <span style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--warm-gray)' }}>(Auftragsverarbeiter)</span></div>
              <div style={{ fontSize: 14, color: '#1a0e08', lineHeight: 1.7 }}>
                <div style={{ fontWeight: 700 }}>Daniel Heilmann</div>
                <div style={{ fontStyle: 'italic', color: 'var(--warm-gray)', fontSize: 12 }}>Responda</div>
                <div style={{ marginTop: 8, fontSize: 13 }}>Alter Keller 5</div>
                <div style={{ fontSize: 13 }}>91541 Rothenburg ob der Tauber</div>
                <div style={{ fontSize: 13 }}>Deutschland</div>
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  <a href="mailto:daniel@responda.systems" style={{ color: '#600812', textDecoration: 'none' }}>daniel@responda.systems</a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sections */}
        {SECTIONS.map(s => (
          <div key={s.num} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid rgba(96,8,18,0.25)', padding: '20px 24px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>{s.num}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1a0e08' }}>{s.title}</span>
            </div>

            {s.paragraphs.map((p, i) => (
              <p key={i} style={{ fontSize: 13, color: '#1a0e08', lineHeight: 1.65, margin: '0 0 10px', opacity: 0.9 }}>{p}</p>
            ))}

            {'list' in s && s.list && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{s.list.label}</div>
                {s.list.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <span style={{ color: '#600812', fontWeight: 700, flexShrink: 0 }}>—</span>
                    <span style={{ fontSize: 13, color: '#1a0e08', opacity: 0.9, lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            )}

            {'list2' in s && s.list2 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{s.list2.label}</div>
                {s.list2.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <span style={{ color: '#600812', fontWeight: 700, flexShrink: 0 }}>—</span>
                    <span style={{ fontSize: 13, color: '#1a0e08', opacity: 0.9, lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            )}

            {'toms' in s && s.toms && (
              <div style={{ marginTop: 4 }}>
                {s.toms.map((tom, i) => (
                  <div key={i} style={{ borderTop: i === 0 ? 'none' : '0.5px solid rgba(96,8,18,0.08)', padding: '10px 0', display: 'flex', gap: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap', minWidth: 140, paddingTop: 1 }}>{tom.label}</span>
                    <span style={{ fontSize: 13, color: '#1a0e08', opacity: 0.9, lineHeight: 1.55 }}>{tom.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Unterschriften */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '3px solid #600812', padding: '20px 24px', marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#600812', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 20 }}>Unterschriften</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a0e08', marginBottom: 16 }}>Auftraggeber</div>
              <div style={{ marginBottom: 16 }}>
                <label style={label}>Datum</label>
                <input style={inp} value={orgDate} onChange={e => setOrgDate(e.target.value)} placeholder="TT.MM.JJJJ" />
              </div>
              <div style={{ borderTop: '1px solid rgba(96,8,18,0.2)', paddingTop: 8, marginTop: 32 }}>
                <div style={{ fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic' }}>
                  {orgName || '[Organisation]'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>Unterschrift, Name, Funktion</div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a0e08', marginBottom: 16 }}>Auftragnehmer</div>
              <div style={{ fontSize: 13, color: 'var(--warm-gray)', fontStyle: 'italic', marginBottom: 4 }}>Rothenburg ob der Tauber, {today}</div>
              <div style={{ borderTop: '1px solid rgba(96,8,18,0.2)', paddingTop: 8, marginTop: 32 }}>
                <div style={{ fontSize: 11, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Daniel Heilmann · Responda</div>
                <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>Unterschrift</div>
              </div>
            </div>
          </div>
        </div>

        {/* Stand */}
        <div style={{ textAlign: 'center', marginTop: 32, fontSize: 11, fontStyle: 'italic', color: 'var(--warm-gray)' }}>
          Stand Mai 2026 · Entwurf — noch nicht rechtsverbindlich geprüft
        </div>

      </div>
    </div>
  )
}
