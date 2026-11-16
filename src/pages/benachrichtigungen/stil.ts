// Seite „Benachrichtigungen“: zusätzliches CSS zu BV_CSS (Klassen "pu-"), über die Tokens aus
// globals.css, damit hell, dunkel, System und Retro stimmen.

export const PU_CSS = `
/* Keine Alarmierung: ruhig, aber nicht zu übersehen (Titel in Dunkelrot; ohne Randstreifen und ohne Kursiv,
   wie überall im Dunkelrot-Rahmen) */
.pu-alarm{ margin-top: 12px; }
.pu-alarm b{ color: var(--lbf-akzent); }

/* Hinweis statt Schalter (Zustand des Geräts) */
.pu-zustand{ padding: 12px 14px; font-size: 14px; line-height: 1.45; color: var(--lbf-text); }
.pu-zustand b{ display: block; font-size: 15px; margin-bottom: 4px; }
.pu-zustand p{ margin: 0; color: var(--bv-text-2); }
.pu-zustand .bv-knopf{ margin-top: 12px; }

/* Zeile mit einer Aktion (Probe senden, Organisation) */
.bv .pu-aktion{ color: var(--lbf-akzent); font-weight: 700; }
.bv .pu-aktion small{ font-weight: 400; }

/* Ruhezeit: Von und Bis nebeneinander */
.pu-zeiten{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 4px 14px 14px; position: relative; }
.pu-zeiten label{ display: block; }
.pu-zeiten .bv-label{ margin-bottom: 4px; }
.pu-zeiten input.bv-eingabe{ min-height: 46px; padding-top: 10px; padding-bottom: 10px; }
.pu-zeiten + .bv-z::before{ content: ''; position: absolute; top: 0; left: 16px; right: 0; border-top: 1px solid var(--bv-linie); }
.pu-jetzt{ font-size: 13px; color: var(--lbf-akzent); font-weight: 700; margin: 8px 2px 0; }

/* Geräteliste */
.pu-geraet .bv-knopf{ flex-shrink: 0; }
.pu-dieses{ display: inline-block; font-size: 12px; font-weight: 700; color: var(--lbf-akzent); margin-left: 6px; }
.pu-datum{ font-variant-numeric: tabular-nums; }

/* Mitteilung an die Organisation */
.pu-zahl{ font-variant-numeric: tabular-nums; }
.pu-zahl.zu-viel{ color: var(--lbf-fehler-text-2); font-weight: 700; }
textarea.bv-eingabe.pu-text{ min-height: 132px; }
.pu-vorschau-titel{ font-size: 13px; font-weight: 700; color: var(--bv-text-2); margin: 18px 2px 8px; }
.pu-hub{ padding: 14px 16px 14px; }
.pu-hub small{ display: block; font-size: 13px; color: var(--bv-text-2); overflow-wrap: anywhere; }
.pu-hub h3{ font-size: 17px; font-weight: 700; line-height: 1.25; margin: 4px 0 0; overflow-wrap: anywhere; }
.pu-hub p{ font-size: 15px; line-height: 1.5; margin: 6px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.pu-leer{ color: var(--bv-text-2); }
/* Sperrbildschirm: eine Benachrichtigung, wie das Telefon sie zeigt (nur angedeutet) */
.pu-sperr{ background: var(--lbf-kopf); border-radius: 18px; padding: 14px; }
.pu-mitt{ display: flex; gap: 10px; align-items: flex-start; background: rgba(255,255,255,0.86); color: #1a0e08; border-radius: 14px; padding: 10px 12px; }
.pu-mitt img{ width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0; display: block; }
.pu-mitt-tx{ flex: 1; min-width: 0; }
.pu-mitt-kopf{ display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: #6b5d50; }
.pu-mitt-tx b{ display: block; font-size: 14.5px; line-height: 1.25; margin-top: 2px; overflow-wrap: anywhere; }
.pu-mitt-tx p{ margin: 2px 0 0; font-size: 14px; line-height: 1.35; white-space: pre-line; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; line-clamp: 4; overflow: hidden; }
.pu-senden{ margin-top: 16px; display: flex; justify-content: flex-end; }
.bv .pu-primaer{ min-height: 46px; border-radius: 13px; background: var(--lbf-akzent-grund); color: #fff; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 20px; font-size: 15px; font-weight: 700; white-space: nowrap; }
.bv .pu-primaer:disabled{ opacity: 0.5; }
.pu-rueckfrage{ margin-top: 16px; }
.pu-rueckfrage p{ color: var(--lbf-text); font-size: 15px; }
.pu-rueckfrage .pu-knoepfe{ display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; margin-top: 12px; }
.pu-rueckfrage .pu-knoepfe .bv-knopf{ margin-top: 0; }
.pu-mitteilung{ padding: 12px 14px 10px; }
.pu-mitteilung b{ display: block; font-size: 15px; line-height: 1.25; overflow-wrap: anywhere; }
.pu-mitteilung small{ display: block; font-size: 12px; color: var(--bv-text-2); margin-top: 2px; }
.pu-mitteilung p{ margin: 6px 0 0; font-size: 14px; line-height: 1.45; color: var(--bv-text-2); white-space: pre-wrap; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden; }
`
