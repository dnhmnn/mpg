// Neuigkeiten im Hub: offene Punkte der Organisation, eine Zeile je Modul. Gezeigt im Blatt
// hinter der Glocke (GlockeBlatt.tsx), gezählt am Abzeichen (src/lib/hubGlocke.ts).
// Was gezählt wird, wie bisher (früher components/Widgets.tsx); Einstellungen → „Neuigkeiten“
// schaltet einzelne ab (localStorage notif_prefs), gesperrte Module fragen gar nicht erst.
// Die zuletzt geladene Liste bleibt im Modul gemerkt (je Benutzer, Organisation, Tag und Rechten):
// Zurück aus „Apps anpassen“ oder einer App steht die Zahl an der Glocke sofort da und wird im
// Hintergrund neu geladen. Sonst wäre die Glocke bis zur Antwort leer und sprünge danach.

import { useEffect, useState } from 'react'
import { pb } from '../../lib/pocketbase'
import { hatRecht } from '../../lib/apps'
import { modulFrei } from '../../lib/freigabe'
import { fallAus, istUeberfaellig, type CirsDatensatz } from '../../lib/cirs'
import { zaehleStufen, type ZustandGeraet } from '../../lib/mpg/zustand'
import { mitDefektFallback, neuesteKontrollen, type KontrollEintrag } from '../../lib/mpg/kontrollen'
import { useHeute } from '../../hooks/useHeute'
import type { Tag } from '../../lib/mpg/fristen'
import type { User } from '../../types'

export interface Neuigkeit {
  id: string
  /** Farbkachel des Moduls */
  app: string
  /** Fett gesetzte Zeile; signal: gesperrte Medizinprodukte (--lbf-signal) */
  titel: { text: string; signal?: boolean }[]
  satz: string
  url: string
}

// Reihenfolge der Zeilen, egal welche Abfrage zuerst antwortet
const ORDNUNG = ['patienten', 'mpg', 'lager', 'produktausgabe', 'ausbildungen', 'cirs']

/** Ohne Organisation gibt es nichts zu laden (gleiches Objekt, damit nichts neu zeichnet) */
const LEER: Neuigkeit[] = []

/** Zuletzt geladene Liste (nur im Speicher der laufenden App, nie auf dem Gerät) */
let zuletzt: { schluessel: string; liste: Neuigkeit[] } | null = null

/**
 * Neuigkeiten des Benutzers. null, solange noch nichts geladen ist (dann zählt die Glocke 0);
 * ohne Organisation eine leere Liste.
 */
export function useNeuigkeiten(user: User | null): Neuigkeit[] | null {
  // Neuer Tag (App über Nacht offen): neu zählen, eine STK kann um Mitternacht überfällig werden
  const heute = useHeute()
  const org = user?.organization_id
  // An Benutzer und Organisation gebunden, nicht an das Objekt: der Hub lädt den Benutzer bei jeder Änderung neu
  const schluessel = JSON.stringify([user?.id ?? '', org ?? '', heute, user?.permissions ?? null, user?.temp_permissions ?? null])
  // Wessen Liste: Nach neuem Tag oder geänderten Rechten bleibt die alte stehen, bis die neue da
  // ist (die Glocke springt nicht auf 0); die eines anderen Benutzers nie
  const nutzer = JSON.stringify([user?.id ?? '', org ?? ''])
  const [stand, setStand] = useState<{ nutzer: string; liste: Neuigkeit[] } | null>(() =>
    zuletzt?.schluessel === schluessel ? { nutzer, liste: zuletzt.liste } : null)

  useEffect(() => {
    if (!org || !user) return
    const gemerkt = zuletzt
    if (gemerkt?.schluessel === schluessel) setStand((s) => (s?.nutzer === nutzer && s.liste === gemerkt.liste ? s : { nutzer, liste: gemerkt.liste }))
    let aktiv = true
    laden(user, org, heute).then((liste) => {
      zuletzt = { schluessel, liste }
      if (aktiv) setStand({ nutzer, liste })
    })
    return () => { aktiv = false }
  }, [schluessel]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null
  if (!org) return LEER
  return stand?.nutzer === nutzer ? stand.liste : null
}

async function laden(user: User, org: string, heute: Tag): Promise<Neuigkeit[]> {
  const items: Neuigkeit[] = []
  const soon = new Date()
  soon.setDate(soon.getDate() + 30)
  const soonStr = soon.toISOString().split('T')[0]
  const week = new Date()
  week.setDate(week.getDate() - 7)
  const weekStr = week.toISOString().replace('T', ' ').substring(0, 19)

  const prefs = (() => {
    try { return JSON.parse(localStorage.getItem('notif_prefs') || '{}') } catch { return {} }
  })()
  // Abgeschaltete Hinweise und gesperrte Module fragen gar nicht erst
  const MODUL: Record<string, string> = { patienten: 'patienten', lager: 'lager', ausbildungen: 'ausbildungen', mpg: 'mpg', produktausgabe: 'lager', cirs: 'dokumente' }
  const enabled = (key: string) => prefs[key] !== false && (!MODUL[key] || modulFrei(user.organization, MODUL[key]))
  const text = (t: string) => [{ text: t }]

  const queries: Promise<unknown>[] = []

  if (enabled('patienten')) queries.push(
    pb.collection('patients').getList(1, 1, {
      filter: pb.filter('status = "offen" && organization_id = {:org}', { org }),
      fields: 'id',
      requestKey: 'widget-patients',
    }).then(r => {
      if (r.totalItems > 0) items.push({
        id: 'patienten', app: 'patienten',
        titel: text(`${r.totalItems} offene${r.totalItems === 1 ? 's' : ''} Protokoll${r.totalItems === 1 ? '' : 'e'}`),
        satz: 'Zum Gegenzeichnen oder Bearbeiten',
        url: '/patienten',
      })
    })
  )

  if (enabled('lager')) queries.push(
    pb.collection('inventory_stock').getList(1, 1, {
      filter: pb.filter('organization_id = {:org} && expiry_date != "" && expiry_date <= {:bis}', { org, bis: soonStr }),
      fields: 'id',
      requestKey: 'widget-lager',
    }).then(r => {
      if (r.totalItems > 0) items.push({
        id: 'lager', app: 'lager',
        titel: text(`${r.totalItems} Artikel laufen ab`),
        satz: 'Im Lager in den nächsten 30 Tagen',
        url: '/lager',
      })
    })
  )

  if (enabled('ausbildungen')) queries.push(
    pb.collection('ausbildungen_termine_user').getList<{ id: string; status?: string }>(1, 50, {
      filter: pb.filter('updated >= {:seit} && (status = "abgesagt" || status = "zugesagt")', { seit: weekStr }),
      fields: 'id,status',
      requestKey: 'widget-ausb',
    }).then(r => {
      if (r.totalItems > 0) {
        const abgesagt = r.items.filter((i) => i.status === 'abgesagt').length
        const zugesagt = r.items.filter((i) => i.status === 'zugesagt').length
        const teile: string[] = []
        if (zugesagt > 0) teile.push(`${zugesagt} Zusage${zugesagt > 1 ? 'n' : ''}`)
        if (abgesagt > 0) teile.push(`${abgesagt} Absage${abgesagt > 1 ? 'n' : ''}`)
        if (teile.length) items.push({
          id: 'ausbildungen', app: 'ausbildungen',
          titel: text(teile.join(', ')),
          satz: 'Rückmeldungen in den letzten 7 Tagen',
          url: '/ausbildungen',
        })
      }
    })
  )

  // MPG: dieselbe Zustandsregel wie im MPG selbst (src/lib/mpg/zustand.ts)
  // Nur mit Zugang zum MPG, sonst liefern Defekte und Meldungen nichts und die Zahlen wären zu klein
  if (enabled('mpg') && hatRecht(user, 'dashboard')) queries.push(
    Promise.all([
      pb.collection('mpg_devices').getFullList<ZustandGeraet & { id: string }>({
        filter: pb.filter('organization_id = {:org}', { org }),
        // ausser_betrieb: außer Betrieb genommene zählen nicht mit (fehlt das Feld, liefert PocketBase es einfach nicht)
        fields: 'id,interval,last_inspection,last_inspection_passed,operational,has_stk,last_stk,stk_interval_months,has_mtk,last_mtk,mtk_interval_months,ausser_betrieb,inbetriebnahme',
        requestKey: 'widget-mpg',
      }),
      pb.collection('mpg_defects').getFullList<{ id: string; device_id: string; severity: string; description: string; created: string }>({
        filter: pb.filter('organization_id = {:org} && status != "resolved"', { org }),
        fields: 'id,device_id,severity,description,created', requestKey: 'widget-mpg-defekte',
      }).catch(() => []),
      pb.collection('mpg_defect_reports').getFullList<{ device_id: string; severity: string }>({
        filter: pb.filter('organization_id = {:org} && status = "pending"', { org }),
        fields: 'device_id,severity', requestKey: 'widget-mpg-meldungen',
      }).catch(() => []),
      // STK/MTK aus dem Gerätebuch: eine nicht bestandene sperrt (ohne Gerätebuch: keine)
      pb.collection('mpg_ereignisse').getFullList<KontrollEintrag>({
        filter: pb.filter('organization_id = {:org} && (art = "stk" || art = "mtk")', { org }),
        fields: 'device_id,art,created,text,angaben,bezug', requestKey: 'widget-mpg-kontrollen',
      }).catch(() => []),
    ]).then(([geraete, defekte, meldungen, kontrollEintraege]) => {
      const kontrollen = mitDefektFallback(neuesteKontrollen(kontrollEintraege, heute), defekte, kontrollEintraege)
      const z = zaehleStufen(geraete.map(g => ({ ...g, kontrollen: kontrollen.get(g.id) })), defekte, meldungen, heute)
      const teile: { text: string; signal?: boolean }[] = []
      if (z.gesperrt > 0) teile.push({ text: `${z.gesperrt} gesperrt`, signal: true })
      if (z.handlung > 0) teile.push({ text: `${z.handlung} mit Handlungsbedarf` })
      if (z.bald > 0) teile.push({ text: `${z.bald} bald fällig` })
      if (teile.length) items.push({
        id: 'mpg', app: 'mpg',
        titel: [{ text: 'MPG: ' }, ...teile.flatMap((t, i) => i ? [{ text: ', ' }, t] : [t])],
        satz: 'Geräte und Prüfungen',
        url: '/mpg',
      })
    })
  )

  if (enabled('produktausgabe')) queries.push(
    pb.collection('product_outputs').getList(1, 1, {
      filter: pb.filter('organization_id = {:org} && status = "offen"', { org }),
      fields: 'id',
      requestKey: 'widget-outputs',
    }).then(r => {
      if (r.totalItems > 0) items.push({
        id: 'produktausgabe', app: 'lager',
        titel: text(`${r.totalItems} offene Produktausgabe${r.totalItems === 1 ? '' : 'n'}`),
        satz: 'Noch nicht ins Lager gebucht',
        url: '/lager',
      })
    })
  )

  // CIRS nur für die, die Vorgänge bearbeiten dürfen: eine Meldung ist vertraulich
  if (enabled('cirs') && hatRecht(user, 'dokumente')) queries.push(
    pb.collection('cirs_reports').getFullList<CirsDatensatz>({
      filter: pb.filter('organization_id = {:org} && status != "erledigt"', { org }),
      fields: 'id,created,updated,status,payload',
      requestKey: 'widget-cirs',
    }).then(liste => {
      const jetzt = new Date()
      const faelle = liste.map(fallAus)
      const neu = faelle.filter(f => f.bearbeitung.phase === 'neu').length
      const ueber = faelle.filter(f => istUeberfaellig(f, jetzt)).length
      if (!neu && !ueber) return
      const teile: string[] = []
      if (neu) teile.push(`${neu} neue CIRS-Meldung${neu === 1 ? '' : 'en'}`)
      if (ueber) teile.push(`${ueber} CIRS-Vorg${ueber === 1 ? 'ang' : 'änge'} überfällig`)
      items.push({
        id: 'cirs', app: 'dokumente',
        titel: text(teile.join(', ')),
        satz: neu ? 'Zur Bewertung unter Vorgänge' : 'Frist oder Maßnahme überschritten',
        url: '/vorgaenge?bereich=cirs',
      })
    })
  )

  await Promise.allSettled(queries)
  return items.sort((a, b) => ORDNUNG.indexOf(a.id) - ORDNUNG.indexOf(b.id))
}
