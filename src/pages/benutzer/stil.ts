// Benutzerverwaltung im Dunkelrot-Design: dunkelroter Kopf, Elfenbein-Blatt,
// weiße Flächen mit Zeilen. Alles über die Tokens aus globals.css, damit hell,
// dunkel, System und Retro stimmen. Klassen mit "bv-", nur auf dieser Seite.

export const BV_CSS = `
.bv{
  --bv-text-2: var(--warm-gray);
  --bv-linie: rgba(var(--lbf-grau-rgb), 0.2);
  --bv-feldrand: rgba(var(--lbf-grau-rgb), 0.4);
  --bv-schalter-aus: rgba(var(--lbf-grau-rgb), 0.26);
  min-height: 100vh; min-height: 100dvh;
  display: flex; flex-direction: column;
  background: var(--warm-bg); color: var(--lbf-text);
  font-size: 15px; line-height: 1.3; font-variant-numeric: tabular-nums;
}
/* Zweitschrift etwas dunkler als warm-gray, damit 15 px gut lesbar bleiben */
@supports (color: color-mix(in srgb, red, blue)) {
  .bv{ --bv-text-2: color-mix(in srgb, var(--warm-gray) 72%, var(--lbf-text)); }
}
.bv *{ box-sizing: border-box; }
.bv button{ font: inherit; color: inherit; background: none; border: 0; cursor: pointer; text-align: left; padding: 0; }
.bv button:disabled{ cursor: not-allowed; }
.bv svg.bv-i{ width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; display: block; }
.bv :focus-visible{ outline: 2px solid var(--lbf-akzent); outline-offset: 2px; }
.bv .bv-kopf :focus-visible{ outline-color: var(--lbf-kopf-text); }

/* Statusleiste: fester Streifen in der Höhe der Uhr-Zeile (nur als App vom Homebildschirm > 0) */
/* Im Browser liegt der Streifen hinter der Seite (z-index -1): Safari 26 erkennt ihn am Rand
   und färbt die Leiste danach, zu sehen ist er nicht — beim Scrollen also keine Linie. */
.bv-statusleiste{ position: fixed; top: 0; left: 0; right: 0; height: max(env(safe-area-inset-top), 2px); background: var(--lbf-kopf); z-index: -1; pointer-events: none; }
/* Als App vom Homebildschirm liegt die Seite unter Uhr und Akku: dort vorn und genau so hoch */
@media (display-mode: standalone){ .bv-statusleiste{ z-index: 70; height: env(safe-area-inset-top); } }
/* Unten Elfenbein am Rand, VOR der Seite: Safari 26 nimmt für die untere Leiste ein festes
   Element am Rand nur, wenn es dort zuoberst liegt — sonst tönte es sie nach dem roten html/body.
   Es sitzt unter der Safari-Leiste und fällt nicht auf; die Aktionsleiste der Seiten liegt darüber. */
.bv-bodenkante{ position: fixed; bottom: 0; left: 0; right: 0; height: max(env(safe-area-inset-bottom), 6px); background: var(--warm-bg); z-index: 45; pointer-events: none; }

/* Kopf */
.bv-kopf{ background: var(--lbf-kopf); color: var(--lbf-kopf-text);
  padding: calc(10px + env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 38px max(16px, env(safe-area-inset-left)); }
.bv-kopf-innen{ max-width: 760px; margin: 0 auto; }
.bv-zeile1{ display: flex; align-items: center; gap: 12px; min-height: 48px; }
.bv .bv-rund{ width: 44px; height: 44px; border-radius: 50%; background: var(--lbf-kopf-feld); color: var(--lbf-kopf-text); display: grid; place-items: center; flex-shrink: 0; }
.bv .bv-rund.hell{ background: var(--lbf-kopf-text); color: var(--lbf-kopf); }
.bv-titel{ flex: 1; min-width: 0; }
.bv-titel b{ display: block; font-size: 18px; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bv-titel span{ display: block; font-size: 13px; color: var(--lbf-kopf-text-2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bv-reiter{ display: flex; background: var(--lbf-kopf-feld); border-radius: 14px; padding: 4px; gap: 2px; margin-top: 16px; overflow-x: auto; scrollbar-width: none; }
.bv-reiter::-webkit-scrollbar{ display: none; }
.bv .bv-reiter button{ flex: 1 1 auto; min-height: 40px; border-radius: 10px; font-size: 14px; font-weight: 700; color: var(--lbf-kopf-text-2); padding: 0 10px; white-space: nowrap; text-align: center; }
/* Schmale Telefone: alle vier Reiter sichtbar, ohne Wischen */
@media (max-width: 420px){ .bv .bv-reiter{ gap: 0; } .bv .bv-reiter button{ padding: 0 5px; } }
.bv .bv-reiter button[aria-selected="true"]{ background: var(--lbf-kopf-text); color: var(--lbf-kopf); }
.bv-reiter em{ font-style: normal; font-weight: 400; margin-left: 3px; }

/* Blatt */
.bv-blatt{ flex: 1; background: var(--warm-bg); border-radius: 24px 24px 0 0; margin-top: -24px; position: relative;
  padding: 20px max(16px, env(safe-area-inset-right)) calc(40px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
.bv-blatt.mitleiste{ padding-bottom: calc(120px + env(safe-area-inset-bottom)); }
.bv-innen{ max-width: 760px; margin: 0 auto; }

/* Abschnitte und Text */
.bv-ab{ display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 30px 2px 10px; }
.bv-ab.erst{ margin-top: 4px; }
.bv-ab h2{ font-size: 17px; font-weight: 700; letter-spacing: -0.01em; margin: 0; }
.bv-ab span{ font-size: 13px; color: var(--bv-text-2); white-space: nowrap; }
.bv-gruppe{ font-size: 14px; font-weight: 700; color: var(--bv-text-2); margin: 20px 2px 8px; }
.bv-hinweis{ font-size: 13px; color: var(--bv-text-2); margin: 8px 2px 0; line-height: 1.4; }
.bv-hinweis.oben{ margin: -2px 2px 12px; }
.bv-leer{ font-size: 15px; color: var(--bv-text-2); text-align: center; padding: 36px 12px; }

/* Weiße Fläche mit Zeilen */
.bv-flaeche{ background: var(--lbf-card); border-radius: 18px; box-shadow: var(--lbf-shadow); overflow: hidden; }
.bv-flaeche + .bv-flaeche{ margin-top: 12px; }
.bv .bv-z{ display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 8px 12px 8px 14px; position: relative; width: 100%; }
.bv .bv-z + .bv-z::before{ content: ''; position: absolute; top: 0; left: 16px; right: 0; border-top: 1px solid var(--bv-linie); }
.bv button.bv-z:active:not(:disabled){ background: rgba(var(--lbf-grau-rgb), 0.08); }
.bv .bv-z:focus-visible{ outline-offset: -2px; }
.bv .bv-z:disabled{ opacity: 0.45; }
.bv-tx{ flex: 1; min-width: 0; }
.bv-z b{ display: block; font-size: 15px; line-height: 1.25; font-weight: 700; }
.bv-z small{ display: block; font-size: 13px; color: var(--bv-text-2); margin-top: 2px; line-height: 1.3; }
.bv-pfeil{ color: var(--warm-gray); }
.bv svg.bv-pfeil{ width: 20px; height: 20px; }
.bv .bv-z.neu{ color: var(--lbf-akzent); font-weight: 700; min-height: 48px; }
.bv .bv-z.neu svg{ width: 20px; height: 20px; }
.bv .bv-z.gefahr{ color: var(--lbf-fehler-text-2); font-weight: 700; }
.bv .bv-z.akzent{ color: var(--lbf-akzent); font-weight: 700; }
.bv .bv-z.aktion{ color: var(--lbf-akzent); font-weight: 700; }

.bv label.bv-z:focus-within{ outline: 2px solid var(--lbf-akzent); outline-offset: -2px; }
.bv .bv-aufklapp{ display: flex; align-items: center; gap: 6px; min-height: 44px; font-size: 14px; font-weight: 700; color: var(--bv-text-2); margin: 14px 0 4px; padding: 0 2px; }

/* Benutzerzeile */
.bv-ava{ width: 38px; height: 38px; border-radius: 50%; color: var(--lbf-kopf-text); display: grid; place-items: center; font-size: 13px; font-weight: 700; flex-shrink: 0; letter-spacing: 0.02em; }
.bv .bv-nutzer{ min-height: 60px; padding-top: 7px; padding-bottom: 7px; }
.bv-nutzer b{ line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bv-du{ font-weight: 400; color: var(--bv-text-2); margin-left: 6px; }
.bv-mail{ display: block; font-size: 13px; line-height: 1.25; color: var(--bv-text-2); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bv-rolle{ display: flex; justify-content: space-between; gap: 10px; font-size: 13px; line-height: 1.25; margin-top: 1px; }
.bv-rolle > span:first-child{ min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bv-st{ font-weight: 700; white-space: nowrap; }
.bv-st.leer{ color: var(--lbf-signal); }
.bv-st.gesperrt, .bv-st.abgelaufen{ color: var(--bv-text-2); }
.bv-st.befristet{ font-weight: 400; color: var(--bv-text-2); }
.bv-nutzer.aus b, .bv-nutzer.aus .bv-rolle > span:first-child{ color: var(--bv-text-2); }

/* Suche */
.bv-suche{ height: 46px; border-radius: 14px; background: var(--lbf-card); border: 1px solid var(--bv-feldrand); display: flex; align-items: center; gap: 10px; padding: 0 4px 0 14px; }
.bv-suche:focus-within{ border-color: var(--lbf-akzent); }
/* Der Rahmen der Suche zeigt den Fokus; kein zweiter, eckiger Rahmen um das Eingabefeld darin */
.bv .bv-suche input:focus-visible{ outline: none; }
.bv-suche > svg{ color: var(--lbf-akzent); }
.bv svg.bv-klein{ width: 20px; height: 20px; }
.bv-suche input{ flex: 1; min-width: 0; height: 100%; border: 0; background: none; font: inherit; font-size: 16px; color: var(--lbf-text); outline: none; user-select: text; -webkit-user-select: text; }
.bv .bv-suche button{ width: 44px; height: 44px; display: grid; place-items: center; color: var(--warm-gray); border-radius: 10px; }
.bv input::placeholder, .bv textarea::placeholder{ color: var(--warm-gray); opacity: 1; }

/* Formularfelder */
.bv-feld{ margin-top: 16px; }
.bv-feld.erst{ margin-top: 0; }
.bv-feld > label{ display: block; }
.bv-label{ display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 14px; font-weight: 700; margin: 0 2px 6px; }
.bv-label small{ font-size: 13px; font-weight: 400; color: var(--bv-text-2); }
.bv-eingabe{ display: block; width: 100%; min-height: 46px; border-radius: 14px; background: var(--lbf-card); border: 1px solid var(--bv-feldrand);
  padding: 0 14px; font: inherit; font-size: 16px; color: var(--lbf-text); outline: none; user-select: text; -webkit-user-select: text; }
.bv-eingabe:focus{ border-color: var(--lbf-akzent); box-shadow: 0 0 0 1px var(--lbf-akzent); }
.bv .bv-eingabe:focus-visible{ outline: none; }
.bv-eingabe.fehler{ border-color: var(--lbf-fehler-text-2); }
textarea.bv-eingabe{ min-height: 96px; padding: 13px 14px; resize: vertical; line-height: 1.4; }
input.bv-eingabe[type="datetime-local"]{ padding-top: 12px; padding-bottom: 12px; }
.bv-eingabe.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 16px; }
.bv-auswahl{ position: relative; }
.bv-auswahl select{ appearance: none; -webkit-appearance: none; padding-right: 44px; cursor: pointer; }
.bv-auswahl > svg{ position: absolute; right: 14px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--warm-gray); }
.bv-fehltext{ font-size: 13px; color: var(--lbf-fehler-text-2); margin: 6px 2px 0; line-height: 1.35; }
.bv-reihe{ display: flex; gap: 8px; align-items: stretch; }
.bv-reihe > .bv-eingabe{ flex: 1; min-width: 0; }

/* Knöpfe */
.bv .bv-knopf{ min-height: 44px; padding: 0 16px; border-radius: 12px; border: 1px solid var(--bv-feldrand); background: var(--lbf-card); color: var(--lbf-akzent);
  font-size: 14px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 8px; white-space: nowrap; }
.bv .bv-knopf:disabled{ opacity: 0.45; }
.bv .bv-knopf.gross{ min-height: 46px; }
.bv-segmente{ display: grid; grid-template-columns: repeat(auto-fit, minmax(62px, 1fr)); gap: 6px; }
.bv .bv-seg{ min-height: 44px; padding: 0 2px; white-space: nowrap; border-radius: 12px; border: 1px solid var(--bv-feldrand); background: var(--lbf-card); color: var(--lbf-text); font-size: 14px; font-weight: 700; text-align: center; }
.bv .bv-seg[aria-pressed="true"]{ background: var(--lbf-akzent-grund); border-color: var(--lbf-akzent-grund); color: #fff; }
.bv .bv-seg:disabled{ opacity: 0.45; }

/* Auswahl (Rolle) */
.bv-radio{ width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--bv-feldrand); flex-shrink: 0; position: relative; background: var(--lbf-card); }
[aria-checked="true"] > .bv-radio{ border-color: var(--lbf-akzent); }
[aria-checked="true"] > .bv-radio::after{ content: ''; position: absolute; inset: 4px; border-radius: 50%; background: var(--lbf-akzent); }
.bv .bv-wahl{ min-height: 54px; }
.bv-wahl small{ display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.bv-punkt{ display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; vertical-align: 1px; }

/* Rollenfarben: Farbfeld in der Rollenliste und die Farbwahl */
.bv-feldr{ width: 34px; height: 34px; border-radius: 10px; color: var(--lbf-kopf-text); display: grid; place-items: center; font-size: 12.5px; font-weight: 700; flex-shrink: 0; letter-spacing: 0.02em; }
.bv-farben{ display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); }
.bv .bv-farbe{ height: 48px; display: grid; place-items: center; }
.bv-farbe i{ display: block; width: 36px; height: 36px; border-radius: 50%; }
.bv-farbe[aria-checked="true"] i{ box-shadow: 0 0 0 3px var(--warm-bg), 0 0 0 5px var(--lbf-text); }

/* Schalter */
.bv .bv-recht{ min-height: 48px; }
.bv-schalter{ width: 51px; height: 31px; flex: 0 0 51px; border-radius: 16px; background: var(--bv-schalter-aus); position: relative; transition: background 0.15s; }
.bv-schalter::after{ content: ''; position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(26,14,8,0.25); transition: left 0.15s; }
[aria-checked="true"] > .bv-schalter{ background: var(--lbf-akzent-grund); }
[aria-checked="true"] > .bv-schalter::after{ left: 22px; }

/* Ruhiger Hinweis in einer Fläche */
.bv-notiz{ background: var(--lbf-card); border-radius: 18px; box-shadow: var(--lbf-shadow); padding: 12px 14px; font-size: 13.5px; line-height: 1.45; color: var(--lbf-text); }
.bv-notiz b{ display: block; font-size: 14.5px; margin-bottom: 4px; }
.bv-notiz p{ margin: 0; color: var(--bv-text-2); }
.bv-notiz p + p{ margin-top: 6px; }
.bv-notiz code{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
.bv-notiz .bv-knopf{ margin-top: 12px; }

/* Unten: Stand und Hauptaktion */
.bv-unten{ position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(10px + env(safe-area-inset-bottom)); width: min(736px, calc(100% - 24px));
  min-height: 64px; background: var(--lbf-card); z-index: 50; border-radius: 18px; border: 1px solid var(--bv-linie);
  box-shadow: 0 2px 14px rgba(26,14,8,0.16); display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 16px; }
.bv-stand{ flex: 1; min-width: 0; }
.bv-stand b{ display: block; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bv-stand span{ display: block; font-size: 13px; color: var(--bv-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bv .bv-vor{ min-height: 46px; border-radius: 13px; background: var(--lbf-akzent-grund); color: #fff; display: flex; align-items: center; gap: 8px; padding: 0 16px; font-size: 15px; font-weight: 700; white-space: nowrap; }
.bv .bv-vor:disabled{ opacity: 0.5; }
.bv .bv-vor svg{ width: 20px; height: 20px; }

/* Bild bei Neuigkeiten */
.bv-bild{ width: 100%; max-height: 240px; object-fit: cover; display: block; }
.bv-text{ font-size: 15px; line-height: 1.5; white-space: pre-wrap; margin-top: 6px; }
.bv-fuss{ display: flex; justify-content: flex-end; gap: 4px; border-top: 1px solid var(--bv-linie); padding: 4px 8px; }
.bv .bv-fuss button{ min-height: 44px; padding: 0 12px; border-radius: 10px; font-size: 14px; font-weight: 700; color: var(--lbf-akzent); }
.bv .bv-fuss button.gefahr{ color: var(--lbf-fehler-text-2); }

/* Willkommens-Knopf (gemeinsame Komponente) als Zeile */
.bv-willkommen{ padding: 4px 16px; position: relative; }
.bv .bv-z + .bv-willkommen::before, .bv .bv-willkommen + .bv-z::before{ content: ''; position: absolute; top: 0; left: 16px; right: 0; border-top: 1px solid var(--bv-linie); }
.bv .bv-willkommen button{ display: block !important; width: 100% !important; min-height: 48px !important; border: 0 !important; padding: 0 !important;
  font-size: 15px !important; font-weight: 700 !important; text-align: left !important; background: none !important; color: var(--lbf-akzent) !important; border-radius: 0 !important; }
.bv-willkommen [role="status"], .bv-willkommen [role="alert"]{ font-size: 13px !important; border-radius: 12px !important; margin: 0 0 10px !important; line-height: 1.4 !important; }

/* Rückmeldung */
.bv-toast{ position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(24px + env(safe-area-inset-bottom)); z-index: 9999;
  width: max-content; max-width: min(560px, calc(100% - 32px)); padding: 12px 16px; border-radius: 14px; font-size: 14px; line-height: 1.4;
  background: var(--lbf-text); color: var(--warm-bg); box-shadow: 0 8px 28px rgba(0,0,0,0.22); cursor: pointer; }
.bv-toast.fehler{ background: var(--lbf-fehler-grund); color: var(--lbf-fehler-text); border: 1px solid rgba(var(--lbf-defekt-rgb), 0.25); }
.bv-toast.hoch{ bottom: calc(96px + env(safe-area-inset-bottom)); }

@media (prefers-reduced-motion: reduce){
  .bv-schalter, .bv-schalter::after{ transition: none; }
}
`
