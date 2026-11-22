// Schreibstube (/office) im Dunkelrot-Design, Owner 22.11.2026: Dokumente, Tabellen und Präsentationen der
// Organisation ansehen und bearbeiten (Euro-Office). Neu anlegen (Name, Ordner), Suche, Filter nach Art,
// zuletzt geöffnet. Der Editor ist eine eigene Seite in der Adresse (?seite=bearbeiten&id=…), damit „Zurück“
// ihn schließt; statisch wie der Hub, das Dokument rollt im Editor. Verweise anderer Apps (?open=…, auch
// Anhänge anderer Sammlungen mit collection, field, index) führen dorthin. Rechnung in src/pages/schreibstube/logik.ts.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import { useStatusleiste } from '../hooks/useStatusleiste'
import { getTheme } from '../lib/theme'
import type { User } from '../types'
import { Abschnitt, Auswahl, Hinweis, Icon, Seite, Toast } from './benutzer/bausteine'
import { BV_CSS } from './benutzer/stil'
import { HUB_CSS } from './hub/stil'
import Blatt from './hub/Blatt'
import { DF_CSS } from './dateien/stil'
import { ArtSymbol } from './dateien/ArtSymbol'
import { endung, nameVergeben, type Eintrag } from './dateien/logik'
import { SS_CSS } from './schreibstube/stil'
import {
  FILTER, NEU, anzeigeName, artName, dokArt, dokumente, editorTyp, filtern, merken, merkerLesen, neuerName, ordnerWahl, wannText, zuletzt,
  type Filter, type NeuArt,
} from './schreibstube/logik'
import Zwischenschirm from '../components/Zwischenschirm'

const STIL = BV_CSS + HUB_CSS + DF_CSS + SS_CSS
const OFFICE_URL = (import.meta as unknown as { env: Record<string, string> }).env.VITE_OFFICE_URL || 'http://localhost:8090'
/** Merker „zuletzt geöffnet“ auf dem Gerät (Schlüssel wie bisher, damit nichts verloren geht) */
const MERKER = 'office_recent'

function officeThema(): string {
  const mode = getTheme()
  const dunkel = mode === 'dark' || mode === 'retro' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  return dunkel ? 'theme-lbf-dark' : 'theme-lbf'
}

function merkerHolen(): string[] {
  try { return merkerLesen(localStorage.getItem(MERKER)) } catch { return [] }
}

export default function Office() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const ort = useLocation()
  const [adr] = useSearchParams()
  const bearbeiten = adr.get('seite') === 'bearbeiten'
  // Liste rollt (rot, solange der Kopf zu sehen ist); der Editor steht still wie der Hub
  useStatusleiste('--lbf-kopf', bearbeiten ? { statisch: true } : { kopf: '.bv-kopf' })
  const org = user?.organization_id || ''

  const [alle, setAlle] = useState<Eintrag[]>([])
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState('')
  const [suche, setSuche] = useState('')
  const [filter, setFilter] = useState<Filter>('alle')
  const [merker, setMerker] = useState<string[]>(merkerHolen)
  const [neu, setNeu] = useState<NeuArt | null>(null)
  const [neuName, setNeuName] = useState('')
  const [neuOrdner, setNeuOrdner] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<{ text: string; fehler?: boolean } | null>(null)
  const melden = useCallback((text: string, f = false) => { setMeldung({ text, fehler: f }); window.setTimeout(() => setMeldung(null), 4000) }, [])

  const laden = useCallback(async () => {
    if (!org) return
    try {
      const l = await pb.collection('files').getFullList<Eintrag>({
        filter: pb.filter('organization_id = {:o}', { o: org }),
        fields: 'id,name,is_folder,parent_folder_id,organization_id,file,file_size,file_type,created,updated',
        requestKey: null,
      })
      setAlle(l)
      setFehler('')
    } catch { setFehler('Die Dokumente lassen sich gerade nicht laden.') }
    finally { setLaedt(false) }
  }, [org])
  useEffect(() => { void laden() }, [laden])

  // Verweise anderer Apps (?open=…&collection=…&field=…&index=…) führen auf die Seite des Editors
  useLayoutEffect(() => {
    const offen = adr.get('open')
    if (!offen) return
    const p = new URLSearchParams({ seite: 'bearbeiten', id: offen })
    const sammlung = adr.get('collection')
    if (sammlung && sammlung !== 'files') {
      p.set('sammlung', sammlung)
      p.set('feld', adr.get('field') || 'file')
      p.set('nr', adr.get('index') || '0')
    }
    navigate({ search: `?${p.toString()}` }, { replace: true, state: { ssVon: 'verweis' } })
  }, [adr, navigate])

  const docs = useMemo(() => dokumente(alle), [alle])
  const ordner = useMemo(() => alle.filter((e) => e.is_folder), [alle])
  const ordnerName = (id: string) => (id ? ordner.find((o) => o.id === id)?.name || '' : '')
  const liste = useMemo(() => filtern(docs, filter, suche), [docs, filter, suche])
  const kuerzlich = useMemo(() => zuletzt(merker, docs), [merker, docs])
  const wahl = useMemo(() => ordnerWahl(alle), [alle])
  const neuArt = NEU.find((n) => n.art === neu)

  function merkenFuer(id: string) {
    setMerker((m) => {
      const n = merken(m, id)
      try { localStorage.setItem(MERKER, JSON.stringify(n)) } catch { /* Speicher voll oder gesperrt */ }
      return n
    })
  }

  function oeffnen(e: Eintrag) {
    merkenFuer(e.id)
    navigate({ search: `?seite=bearbeiten&id=${encodeURIComponent(e.id)}` }, { state: { ssUnter: true } })
  }

  function editorZu() {
    const s = ort.state as { ssUnter?: boolean; ssVon?: string } | null
    // Aus der Liste geöffnet oder aus einer anderen App verwiesen: einen Schritt zurück; sonst (Link, neu geladen) zur Liste
    if (s?.ssUnter || (s?.ssVon === 'verweis' && window.history.length > 1)) navigate(-1)
    else navigate({ search: '' }, { replace: true })
    void laden()
  }

  function neuOeffnen(a: NeuArt) {
    setNeu(a)
    setNeuName(NEU.find((n) => n.art === a)?.vorgabe || '')
    setNeuOrdner('')
  }

  async function anlegen() {
    if (!neuArt || !org || laeuft) return
    const name = neuerName(neuName, neuArt.endung)
    if (!name) return
    const geschwister = alle.filter((e) => (e.parent_folder_id || '') === neuOrdner)
    if (nameVergeben(geschwister, name)) { melden(`„${name}“ gibt es dort schon.`, true); return }
    setLaeuft(true)
    try {
      const r = await fetch(`${OFFICE_URL}/empty/${neuArt.endung}`)
      if (!r.ok) throw new Error('vorlage')
      const vorlage = await r.blob()
      const fd = new FormData()
      fd.append('file', vorlage, name)
      fd.append('name', name)
      fd.append('organization_id', org)
      fd.append('is_folder', 'false')
      fd.append('parent_folder_id', neuOrdner)
      fd.append('file_size', String(vorlage.size))
      if (vorlage.type) fd.append('file_type', vorlage.type)
      const neuerEintrag = await pb.collection('files').create<Eintrag>(fd, { requestKey: null })
      setNeu(null)
      await laden()
      oeffnen(neuerEintrag)
    } catch (e) {
      melden((e as Error)?.message === 'vorlage'
        ? 'Die leere Vorlage kam nicht. Der Office-Server antwortet gerade nicht.'
        : 'Nicht angelegt. Keine Verbindung oder keine Berechtigung?', true)
    } finally { setLaeuft(false) }
  }

  if (authLoading) return <><style>{STIL}</style><Zwischenschirm /></>

  if (bearbeiten) {
    return (
      <>
        <style>{STIL}</style>
        <Editor key={`${adr.get('sammlung') || 'files'}:${adr.get('id')}:${adr.get('feld') || ''}:${adr.get('nr') || ''}`}
          id={adr.get('id') || ''} sammlung={adr.get('sammlung') || 'files'} feld={adr.get('feld') || 'file'} nr={Number(adr.get('nr') || 0)}
          user={user} zurueck={editorZu} geoeffnet={(id, sammlung) => { if (sammlung === 'files') merkenFuer(id) }} />
        {meldung && <Toast text={meldung.text} fehler={meldung.fehler} onClose={() => setMeldung(null)} />}
      </>
    )
  }

  const zeile = (e: Eintrag) => (
    <button key={e.id} type="button" className="bv-z" onClick={() => oeffnen(e)}>
      <ArtSymbol a={dokArt(e)} />
      <span className="bv-tx"><b>{anzeigeName(e.name)}</b><small>{[wannText(e.updated || e.created), ordnerName(e.parent_folder_id || '') && `in ${ordnerName(e.parent_folder_id || '')}`].filter(Boolean).join(' · ')}</small></span>
      <span className="ss-endung">{endung(e.file || e.name)}</span>
    </button>
  )

  const titelListe = suche.trim() ? 'Gefunden' : filter === 'alle' ? 'Alle Dokumente' : FILTER.find((f) => f.id === filter)?.titel || 'Dokumente'

  return (
    <>
      <style>{STIL}</style>
      <Seite titel="Schreibstube" unter={user?.organization_name || 'Responda'} zurueck={() => navigate('/hub')} zurueckLabel="Zurück zur Übersicht">
        <Abschnitt titel="Neu" erst />
        <div className="ss-neu">
          {NEU.map((n) => (
            <button key={n.art} type="button" onClick={() => neuOeffnen(n.art)}>
              <ArtSymbol a={n.art} />{n.titel}<small>.{n.endung}</small>
            </button>
          ))}
        </div>

        <div className="bv-suche">
          <Icon n="suche" />
          <input type="search" placeholder="Dokumente suchen" aria-label="Dokumente suchen" value={suche} onChange={(e) => setSuche(e.target.value)} />
          {suche && <button type="button" aria-label="Suche leeren" onClick={() => setSuche('')}><Icon n="kreuz" /></button>}
        </div>
        {docs.length > 0 && (
          <div className="ss-filter" role="group" aria-label="Nach Art filtern">
            {FILTER.map((f) => <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.titel}</button>)}
          </div>
        )}

        {fehler && <div className="bv-notiz" style={{ marginTop: 14 }}><b>{fehler}</b><p><button type="button" style={{ color: 'var(--lbf-akzent)', fontWeight: 700, minHeight: 44 }} onClick={() => void laden()}>Erneut versuchen</button></p></div>}

        {!suche.trim() && filter === 'alle' && kuerzlich.length > 0 && (
          <>
            <Abschnitt titel="Zuletzt geöffnet" />
            <div className="bv-flaeche">{kuerzlich.map(zeile)}</div>
          </>
        )}

        {laedt ? <Hinweis>Wird geladen …</Hinweis> : (
          <>
            <Abschnitt titel={titelListe} rechts={liste.length || undefined} />
            {liste.length ? <div className="bv-flaeche">{liste.map(zeile)}</div> : docs.length ? <Hinweis>Nichts gefunden.</Hinweis> : (
              <div className="bv-notiz"><b>Noch keine Dokumente.</b><p>Oben ein neues anlegen. Was in den Dateien liegt (Word, Excel, PowerPoint, PDF), steht hier auch.</p></div>
            )}
          </>
        )}
      </Seite>

      {neuArt && (
        <Blatt titel={neuArt.vorgabe} onClose={() => setNeu(null)}>
          <div className="bv-flaeche">
            <div className="ss-blattfeld">
              <label htmlFor="ss-name">Name</label>
              <input id="ss-name" className="bv-eingabe" value={neuName} maxLength={120}
                onChange={(e) => setNeuName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void anlegen() }} />
              {wahl.length > 0 && (
                <>
                  <label htmlFor="ss-ordner">Ablegen in</label>
                  <Auswahl value={neuOrdner} onChange={setNeuOrdner} label="Ordner">
                    <option value="">Dateien (oberste Ebene)</option>
                    {wahl.map((o) => <option key={o.id} value={o.id}>{o.titel}</option>)}
                  </Auswahl>
                </>
              )}
            </div>
          </div>
          <button type="button" className="ss-anlegen" disabled={laeuft || !neuerName(neuName, neuArt.endung)} onClick={() => void anlegen()}>
            {laeuft ? 'Wird angelegt …' : 'Anlegen und öffnen'}
          </button>
        </Blatt>
      )}
      {meldung && <Toast text={meldung.text} fehler={meldung.fehler} onClose={() => setMeldung(null)} />}
    </>
  )
}

interface Dok { id: string; name: string; file: string; updated: string; sammlung: string }
type DocsApi = { DocEditor: new (id: string, config: unknown) => { destroyEditor?: () => void } }

/** Der Editor als eigene, statische Seite: Kopf mit Zurück und Name, darunter das Dokument im Blatt. */
function Editor({ id, sammlung, feld, nr, user, zurueck, geoeffnet }: {
  id: string; sammlung: string; feld: string; nr: number; user: User | null
  zurueck: () => void; geoeffnet: (id: string, sammlung: string) => void
}) {
  const [dok, setDok] = useState<Dok | null>(null)
  const [bereit, setBereit] = useState(false)
  const [fehler, setFehler] = useState('')
  const [versuch, setVersuch] = useState(0)
  const geoeffnetRef = useRef(geoeffnet)
  geoeffnetRef.current = geoeffnet

  // Datensatz holen: in den Dateien die Datei selbst, sonst ein Anhang (Feld, bei mehreren die Nummer)
  useEffect(() => {
    if (!id) { setFehler('Kein Dokument angegeben.'); return }
    let aus = false
    setFehler('')
    pb.collection(sammlung).getOne<Record<string, unknown>>(id, { requestKey: null }).then((rec) => {
      if (aus) return
      const wert = rec[feld]
      const datei = (Array.isArray(wert) ? wert[nr] : wert) as string | undefined
      if (!datei || typeof datei !== 'string') { setFehler('Dieses Dokument hat keine Datei, die sich bearbeiten lässt.'); return }
      setDok({ id: String(rec.id), name: String(rec.name || datei), file: datei, updated: String(rec.updated || rec.created || ''), sammlung })
      geoeffnetRef.current(String(rec.id), sammlung)
    }).catch(() => { if (!aus) setFehler('Dieses Dokument lässt sich nicht öffnen. Vielleicht gelöscht, oder es fehlt die Berechtigung.') })
    return () => { aus = true }
  }, [id, sammlung, feld, nr, versuch])

  // Editor des Office-Servers einhängen, beim Verlassen sauber abbauen
  useEffect(() => {
    if (!dok) return
    let aus = false
    let editor: { destroyEditor?: () => void } | null = null
    let skript: HTMLScriptElement | null = null
    setBereit(false)
    const starten = async () => {
      const w = window as unknown as { DocsAPI?: DocsApi }
      if (aus) return
      if (!w.DocsAPI) { setFehler('Die Schreibstube ist gerade nicht erreichbar.'); return }
      // Kurzlebiges Datei-Token statt der Anmeldung in der Adresse, die der Office-Server abruft
      let token = ''
      try { token = await pb.files.getToken() } catch { /* ohne: öffentliche Dateien gehen trotzdem */ }
      if (aus) return
      const url = `${pb.baseURL}/api/files/${dok.sammlung}/${dok.id}/${encodeURIComponent(dok.file)}${token ? `?token=${encodeURIComponent(token)}` : ''}`
      const typ = editorTyp(dok.file)
      editor = new w.DocsAPI.DocEditor('ss-editor-flaeche', {
        width: '100%', height: '100%',
        document: { fileType: endung(dok.file), key: `${dok.id}_${new Date((dok.updated || '').replace(' ', 'T')).getTime() || 0}`, title: dok.name, url },
        documentType: typ,
        editorConfig: {
          callbackUrl: `${pb.baseURL}/api/office/callback?file_id=${encodeURIComponent(dok.id)}`,
          user: { id: user?.id || '', name: user?.name || '' },
          lang: 'de',
          customization: {
            autosave: true, chat: false, comments: true, compactHeader: false, feedback: false, forcesave: true,
            help: false, plugins: false, uiTheme: officeThema(),
            logo: { image: 'https://app.responda.systems/office-logo-header.svg', imageDark: 'https://app.responda.systems/office-logo-header.svg', url: 'https://app.responda.systems/office' },
          },
        },
        events: {
          onAppReady: () => { if (!aus) setBereit(true) },
          onDocumentReady: () => { if (!aus) setBereit(true) },
          onError: (event: unknown) => {
            const e = event as { data?: { errorDescription?: string } }
            if (!aus) setFehler(`Der Editor meldet einen Fehler${e?.data?.errorDescription ? `: ${e.data.errorDescription}` : '.'}`)
          },
        },
      })
    }
    if ((window as unknown as { DocsAPI?: DocsApi }).DocsAPI) void starten()
    else {
      skript = document.createElement('script')
      skript.src = `${OFFICE_URL}/web-apps/apps/api/documents/api.js`
      skript.onload = () => { void starten() }
      skript.onerror = () => { if (!aus) setFehler('Die Schreibstube ist gerade nicht erreichbar.') }
      document.head.appendChild(skript)
    }
    return () => {
      aus = true
      try { editor?.destroyEditor?.() } catch { /* schon weg */ }
      if (skript && document.head.contains(skript)) document.head.removeChild(skript)
    }
  }, [dok, user?.id, user?.name, versuch])

  return (
    <Seite statisch titel={dok ? anzeigeName(dok.name) : 'Dokument'} unter={dok ? artName(dokArt({ name: dok.name, file: dok.file })) : 'Wird geöffnet …'}
      zurueck={zurueck} zurueckLabel="Schließen">
      {fehler ? (
        <div className="bv-notiz ss-fehler">
          <b>{fehler}</b>
          <p><button type="button" style={{ color: 'var(--lbf-akzent)', fontWeight: 700, minHeight: 44 }} onClick={() => { setFehler(''); setDok(null); setVersuch((v) => v + 1) }}>Erneut versuchen</button></p>
        </div>
      ) : (
        <div className="ss-editor">
          {!bereit && <div className="ss-laedt" role="status">Wird geöffnet …</div>}
          {dok && <div id="ss-editor-flaeche" />}
        </div>
      )}
    </Seite>
  )
}
