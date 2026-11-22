// Dateien (/files) im Dunkelrot-Design, Owner 22.11.2026: die gemeinsame Ablage der Organisation.
// Ordner in der Adresse (?ordner=<id>), damit „Zurück“ im Browser und am Telefon wirkt; Pfad im roten Kopf.
// Hochladen (auch Hineinziehen am Rechner), neuer Ordner, Umbenennen, Löschen (Ordner mit allem darin),
// Suche über alle Dateien der Organisation, Öffnen in der Schreibstube. Rechnung in src/pages/dateien/logik.ts.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { pb } from '../lib/pocketbase'
import { useAuth } from '../hooks/useAuth'
import { useStatusleiste } from '../hooks/useStatusleiste'
import { appFrei } from '../lib/freigabe'
import { Abschnitt, Hinweis, Icon, Seite, Toast } from './benutzer/bausteine'
import { BV_CSS } from './benutzer/stil'
import { HUB_CSS } from './hub/stil'
import Blatt from './hub/Blatt'
import { DF_CSS } from './dateien/stil'
import { art, bearbeitbar, groesse, nachkommen, nameSauber, nameVergeben, passt, pfad, sortieren, umbenennen, type Eintrag } from './dateien/logik'
import { ArtSymbol } from './dateien/ArtSymbol'
import Zwischenschirm from '../components/Zwischenschirm'

const STIL = BV_CSS + HUB_CSS + DF_CSS

const tag = (s: string) => (s ? new Date(s.replace(' ', 'T')).toLocaleDateString('de-DE') : '')

export default function Files() {
  const { user, loading: authLoading } = useAuth()
  useStatusleiste('--lbf-kopf', { kopf: '.bv-kopf' })
  const navigate = useNavigate()
  const ort = useLocation()
  const [adr] = useSearchParams()
  const ordnerId = adr.get('ordner') || ''
  const org = user?.organization_id || ''
  const schreibstube = appFrei(user?.organization, 'office')

  const [alle, setAlle] = useState<Eintrag[]>([])
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState('')
  const [suche, setSuche] = useState('')
  const [meldung, setMeldung] = useState<{ text: string; fehler?: boolean } | null>(null)
  const [hoch, setHoch] = useState<{ name: string; stand: 'laeuft' | 'ok' | 'fehler' }[]>([])
  const [neuerOrdner, setNeuerOrdner] = useState<string | null>(null)
  const [blatt, setBlatt] = useState<Eintrag | null>(null)
  const [umName, setUmName] = useState<string | null>(null)
  const [ziehen, setZiehen] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const datei = useRef<HTMLInputElement>(null)
  const melden = useCallback((text: string, f = false) => { setMeldung({ text, fehler: f }); window.setTimeout(() => setMeldung(null), 3500) }, [])

  const laden = useCallback(async () => {
    if (!org) return
    try {
      const l = await pb.collection('files').getFullList<Eintrag>({ filter: pb.filter('organization_id = {:o}', { o: org }), fields: 'id,name,is_folder,parent_folder_id,organization_id,file,file_size,file_type,created,updated', requestKey: null })
      setAlle(l)
      setFehler('')
    } catch { setFehler('Die Dateien lassen sich gerade nicht laden.') }
    finally { setLaedt(false) }
  }, [org])
  useEffect(() => { void laden() }, [laden])
  useLayoutEffect(() => { window.scrollTo(0, 0); document.body.scrollTop = 0; document.documentElement.scrollTop = 0; setSuche(''); setNeuerOrdner(null) }, [ordnerId])

  const ordner = useMemo(() => alle.filter((e) => e.is_folder), [alle])
  const weg = pfad(ordnerId, ordner)
  const aktuell = weg[weg.length - 1]
  const hier = useMemo(() => sortieren(alle.filter((e) => (e.parent_folder_id || '') === ordnerId)), [alle, ordnerId])
  const treffer = useMemo(() => (suche.trim() ? sortieren(alle.filter((e) => passt(e, suche))).slice(0, 100) : []), [alle, suche])
  const ordnerName = (id: string) => (id ? ordner.find((o) => o.id === id)?.name || 'Ordner' : 'Dateien')

  function oeffneOrdner(id: string) { navigate({ search: id ? `?ordner=${id}` : '' }, { state: { dfUnter: true } }) }
  function zurueck() {
    if (!ordnerId) { navigate('/hub'); return }
    // Selbst geöffnet: einen Schritt zurück; sonst (Link, neu geladen) in den Ordner darüber
    if ((ort.state as { dfUnter?: boolean } | null)?.dfUnter) { navigate(-1); return }
    const oben = ordner.find((o) => o.id === ordnerId)?.parent_folder_id || ''
    navigate({ search: oben ? `?ordner=${oben}` : '' }, { replace: true })
  }

  async function hochladen(liste: FileList | File[]) {
    const dateien = Array.from(liste)
    if (!dateien.length || !org) return
    setHoch(dateien.map((f) => ({ name: f.name, stand: 'laeuft' })))
    for (let i = 0; i < dateien.length; i++) {
      const f = dateien[i]
      try {
        const fd = new FormData()
        fd.append('name', nameSauber(f.name) || 'Datei')
        fd.append('is_folder', 'false')
        fd.append('parent_folder_id', ordnerId)
        fd.append('file', f)
        fd.append('file_size', String(f.size))
        fd.append('file_type', f.type)
        fd.append('organization_id', org)
        await pb.collection('files').create(fd, { requestKey: null })
        setHoch((h) => h.map((x, j) => (j === i ? { ...x, stand: 'ok' } : x)))
      } catch {
        setHoch((h) => h.map((x, j) => (j === i ? { ...x, stand: 'fehler' } : x)))
      }
    }
    await laden()
    window.setTimeout(() => setHoch((h) => h.filter((x) => x.stand === 'fehler')), 2500)
  }

  async function ordnerAnlegen() {
    const n = nameSauber(neuerOrdner || '')
    if (!n || !org || laeuft) return
    if (nameVergeben(hier, n)) { melden(`„${n}“ gibt es hier schon.`, true); return }
    setLaeuft(true)
    try {
      await pb.collection('files').create({ name: n, is_folder: true, parent_folder_id: ordnerId, organization_id: org })
      setNeuerOrdner(null)
      await laden()
    } catch { melden('Ordner nicht angelegt.', true) }
    finally { setLaeuft(false) }
  }

  async function herunterladen(e: Eintrag) {
    if (!e.file) { melden('Zu diesem Eintrag gibt es keine Datei.', true); return }
    try {
      const token = await pb.files.getToken()
      const url = pb.files.getUrl({ ...e, collectionName: 'files' }, e.file, { token })
      const r = await fetch(url)
      if (!r.ok) throw new Error(String(r.status))
      const b = await r.blob()
      const u = URL.createObjectURL(b)
      const a = document.createElement('a')
      a.href = u; a.download = e.name
      document.body.appendChild(a); a.click(); a.remove()
      window.setTimeout(() => URL.revokeObjectURL(u), 1000)
    } catch { melden('Herunterladen hat nicht geklappt.', true) }
  }

  async function umbenennenSpeichern(e: Eintrag) {
    const n = umbenennen(e, umName || '')
    if (!n || laeuft) return
    const geschwister = alle.filter((x) => (x.parent_folder_id || '') === (e.parent_folder_id || ''))
    if (nameVergeben(geschwister, n, e.id)) { melden(`„${n}“ gibt es dort schon.`, true); return }
    setLaeuft(true)
    try {
      await pb.collection('files').update(e.id, { name: n })
      setUmName(null); setBlatt(null)
      await laden()
    } catch { melden('Nicht umbenannt.', true) }
    finally { setLaeuft(false) }
  }

  async function loeschen(e: Eintrag) {
    const darunter = e.is_folder ? nachkommen(e.id, alle) : []
    const text = e.is_folder
      ? `Ordner „${e.name}“ löschen?${darunter.length ? `\n\nMit ihm verschwinden ${darunter.length === 1 ? 'ein Eintrag' : `${darunter.length} Einträge`} darin, auch in Unterordnern.` : ''}`
      : `„${e.name}“ löschen?`
    if (!confirm(text)) return
    setLaeuft(true)
    let fehlt = 0
    // Erst alles darin (die tiefsten zuerst), dann der Ordner selbst
    for (const id of [...darunter, e.id]) {
      try { await pb.collection('files').delete(id, { requestKey: null }) } catch { fehlt++ }
    }
    setLaeuft(false)
    setBlatt(null)
    await laden()
    melden(fehlt ? `${fehlt === 1 ? 'Ein Eintrag ließ' : `${fehlt} Einträge ließen`} sich nicht löschen.` : 'Gelöscht.', fehlt > 0)
  }

  function antippen(e: Eintrag) {
    if (e.is_folder) oeffneOrdner(e.id)
    else { setBlatt(e); setUmName(null) }
  }

  const zeile = (e: Eintrag, mitOrt = false) => (
    <div key={e.id} className="bv-z" style={{ paddingRight: 4 }}>
      <button type="button" className="df-zeile" onClick={() => antippen(e)}>
        <ArtSymbol a={art(e)} />
        <span className="bv-tx"><b>{e.name}</b><small>{[mitOrt ? `in ${ordnerName(e.parent_folder_id || '')}` : '', tag(e.updated || e.created), e.is_folder ? '' : groesse(e.file_size)].filter(Boolean).join(' · ')}</small></span>
      </button>
      <button type="button" className="df-mehr" aria-label={`Mehr zu ${e.name}`} onClick={() => { setBlatt(e); setUmName(null) }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
      </button>
    </div>
  )

  if (authLoading) return <><style>{STIL}</style><Zwischenschirm /></>

  return (
    <div
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setZiehen(true) } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setZiehen(false) }}
      onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setZiehen(false); void hochladen(e.dataTransfer.files) } }}>
      <style>{STIL}</style>
      <Seite titel={aktuell?.name || 'Dateien'} unter={user?.organization_name || 'Responda'}
        zurueck={zurueck} zurueckLabel={ordnerId ? 'Zurück' : 'Zurück zur Übersicht'}
        reiter={weg.length ? (
          <nav className="df-pfad" aria-label="Ordnerpfad">
            <button type="button" onClick={() => oeffneOrdner('')}>Dateien</button>
            {weg.slice(0, -1).map((o) => <span key={o.id} style={{ display: 'contents' }}><span aria-hidden="true">›</span><button type="button" onClick={() => oeffneOrdner(o.id)}>{o.name}</button></span>)}
          </nav>
        ) : undefined}>
        <input ref={datei} type="file" multiple hidden onChange={(e) => { if (e.target.files) void hochladen(e.target.files); e.target.value = '' }} />
        <div className="df-knoepfe">
          <button type="button" onClick={() => datei.current?.click()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>Hochladen
          </button>
          <button type="button" aria-expanded={neuerOrdner !== null} onClick={() => setNeuerOrdner(neuerOrdner === null ? '' : null)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></svg>Neuer Ordner
          </button>
        </div>
        {neuerOrdner !== null && (
          <div className="bv-flaeche df-hoch">
            <div className="df-eingabe">
              <input className="bv-eingabe" autoFocus placeholder="Name des Ordners" value={neuerOrdner} maxLength={120} aria-label="Name des neuen Ordners"
                onChange={(e) => setNeuerOrdner(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void ordnerAnlegen() }} />
              <button type="button" className="df-ok" disabled={!nameSauber(neuerOrdner) || laeuft} onClick={() => void ordnerAnlegen()}>Anlegen</button>
            </div>
          </div>
        )}
        {!!hoch.length && (
          <div className="bv-flaeche df-hoch" role="status">
            {hoch.map((h, i) => (
              <div key={i} className="bv-z">
                <span className="bv-tx"><b>{h.name}</b><small className={h.stand === 'fehler' ? 'fehler' : undefined}>{h.stand === 'laeuft' ? 'Wird hochgeladen …' : h.stand === 'ok' ? 'Hochgeladen' : 'Nicht hochgeladen. Zu groß oder keine Verbindung?'}</small></span>
              </div>
            ))}
          </div>
        )}
        <div className="bv-suche">
          <Icon n="suche" />
          <input type="search" placeholder="In allen Dateien suchen" aria-label="Dateien suchen" value={suche} onChange={(e) => setSuche(e.target.value)} />
          {suche && <button type="button" aria-label="Suche leeren" onClick={() => setSuche('')}><Icon n="kreuz" /></button>}
        </div>

        {fehler && <div className="bv-notiz" style={{ marginTop: 14 }}><b>{fehler}</b><p><button type="button" style={{ color: 'var(--lbf-akzent)', fontWeight: 700, minHeight: 44 }} onClick={() => void laden()}>Erneut versuchen</button></p></div>}

        {suche.trim() ? (
          <>
            <Abschnitt titel="Gefunden" rechts={treffer.length} />
            {treffer.length ? <div className="bv-flaeche">{treffer.map((e) => zeile(e, true))}</div> : <Hinweis>Nichts gefunden.</Hinweis>}
          </>
        ) : laedt ? <Hinweis>Wird geladen …</Hinweis> : (
          <>
            <Abschnitt titel={ordnerId ? 'In diesem Ordner' : 'Alle Dateien'} rechts={hier.length || undefined} />
            {hier.length ? <div className="bv-flaeche">{hier.map((e) => zeile(e))}</div> : (
              <div className="bv-notiz"><b>{ordnerId ? 'Dieser Ordner ist leer.' : 'Noch keine Dateien.'}</b><p>Mit „Hochladen“ kommen Dateien hierher, am Rechner auch durch Hineinziehen.</p></div>
            )}
          </>
        )}
      </Seite>

      {blatt && (
        <Blatt titel={blatt.name} onClose={() => { setBlatt(null); setUmName(null) }}>
          <div className="bv-flaeche">
            {blatt.is_folder ? (
              <button type="button" className="bv-z" onClick={() => { const id = blatt.id; setBlatt(null); oeffneOrdner(id) }}>
                <span className="bv-tx"><b>Öffnen</b></span><Icon n="weiter" className="bv-pfeil" />
              </button>
            ) : (
              <button type="button" className="bv-z" onClick={() => void herunterladen(blatt)}>
                <span className="bv-tx"><b>Herunterladen</b>{groesse(blatt.file_size) && <small>{groesse(blatt.file_size)}</small>}</span>
              </button>
            )}
            {schreibstube && bearbeitbar(blatt) && (
              <button type="button" className="bv-z" onClick={() => { const id = blatt.id; setBlatt(null); navigate(`/office?open=${id}`) }}>
                <span className="bv-tx"><b>In der Schreibstube öffnen</b><small>Ansehen und bearbeiten</small></span><Icon n="weiter" className="bv-pfeil" />
              </button>
            )}
            {umName === null ? (
              <button type="button" className="bv-z" onClick={() => setUmName(blatt.is_folder ? blatt.name : blatt.name.replace(/\.[^.]+$/, ''))}>
                <span className="bv-tx"><b>Umbenennen</b></span>
              </button>
            ) : (
              <div className="df-eingabe">
                <input className="bv-eingabe" autoFocus value={umName} maxLength={120} aria-label="Neuer Name" onChange={(e) => setUmName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void umbenennenSpeichern(blatt) }} />
                <button type="button" className="df-ok" disabled={!nameSauber(umName) || laeuft} onClick={() => void umbenennenSpeichern(blatt)}>Speichern</button>
              </div>
            )}
          </div>
          <div className="bv-flaeche" style={{ marginTop: 12 }}>
            <button type="button" className="bv-z gefahr" disabled={laeuft} onClick={() => void loeschen(blatt)}>{blatt.is_folder ? 'Ordner löschen' : 'Datei löschen'}</button>
          </div>
        </Blatt>
      )}
      {ziehen && <div className="df-ziehen" aria-hidden="true"><div>Loslassen zum Hochladen{aktuell ? ` in „${aktuell.name}“` : ''}</div></div>}
      {meldung && <Toast text={meldung.text} fehler={meldung.fehler} onClose={() => setMeldung(null)} />}
    </div>
  )
}
