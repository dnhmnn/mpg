// Eine Neuigkeit für Unitas schreiben oder bearbeiten. Logik wie bisher (saveN).

import { useState } from 'react'
import { pb } from '../../lib/pocketbase'
import { Abschnitt, Feld, Leiste, SchalterZeile, Seite } from './bausteine'
import type { Neuigkeit } from './logik'
import type { BvKontext } from './kontext'

export default function NeuigkeitSeite({ k, editingN, neuLaden }: { k: BvKontext; editingN: Neuigkeit | null; neuLaden: () => Promise<void> }) {
  const { user, showMsg } = k
  const [nForm, setNForm] = useState(() => editingN
    ? { titel: editingN.titel, inhalt: editingN.inhalt, gepinnt: editingN.gepinnt }
    : { titel: '', inhalt: '', gepinnt: false })
  const [nAnhang, setNAnhang] = useState<File | null>(null)
  const [savingN, setSavingN] = useState(false)

  async function saveN() {
    if (!nForm.titel.trim()) { showMsg('Bitte einen Titel eingeben', 'error'); return }
    const orgId = user?.organization_id || ''
    if (!orgId) { showMsg('Ohne Organisation lässt sich nichts veröffentlichen', 'error'); return }
    setSavingN(true)
    try {
      let data: FormData | Record<string, unknown>
      if (nAnhang) {
        const fd = new FormData()
        fd.append('titel', nForm.titel)
        fd.append('inhalt', nForm.inhalt)
        fd.append('gepinnt', nForm.gepinnt ? 'true' : 'false')
        fd.append('erstellt_von', user?.name || user?.email || '')
        fd.append('organisation_id', orgId)
        fd.append('anhang', nAnhang)
        data = fd
      } else {
        data = {
          titel: nForm.titel, inhalt: nForm.inhalt, gepinnt: nForm.gepinnt,
          erstellt_von: user?.name || user?.email || '',
          organisation_id: orgId,
        }
      }
      if (editingN) await pb.collection('unitas_neuigkeiten').update(editingN.id, data)
      else await pb.collection('unitas_neuigkeiten').create(data)
      k.schliessen()
      await neuLaden()
      showMsg(editingN ? 'Neuigkeit gespeichert' : 'Veröffentlicht')
    } catch (e: any) { showMsg('Fehler: ' + e.message, 'error') }
    finally { setSavingN(false) }
  }

  const bildText = nAnhang ? nAnhang.name : editingN?.anhang ? `Aktuell: ${editingN.anhang}` : 'Kein Bild'
  return (
    <Seite titel={editingN ? 'Neuigkeit bearbeiten' : 'Neue Neuigkeit'} unter={k.orgName} zurueck={k.schliessen}
      leiste={<Leiste titel={nForm.titel.trim() || 'Ohne Titel'} unter={nForm.gepinnt ? 'Angeheftet, erscheint oben' : 'Erscheint in Unitas'}
        knopf={editingN ? 'Speichern' : 'Veröffentlichen'} icon="haken" onClick={saveN} laeuft={savingN} disabled={!nForm.titel.trim()} />}>
      <Abschnitt titel="Neuigkeit" erst />
      <Feld label="Titel" erst>
        <input className="bv-eingabe" value={nForm.titel} onChange={e => setNForm(p => ({ ...p, titel: e.target.value }))} placeholder="Überschrift" />
      </Feld>
      <Feld label="Text" zusatz="optional">
        <textarea className="bv-eingabe" value={nForm.inhalt} rows={6} onChange={e => setNForm(p => ({ ...p, inhalt: e.target.value }))} placeholder="Nachricht" />
      </Feld>
      <Feld label="Bild" zusatz="optional" gruppe>
        <div className="bv-flaeche">
          <label className="bv-z" style={{ cursor: 'pointer' }}>
            <span className="bv-tx"><b>{nAnhang || editingN?.anhang ? 'Anderes Bild wählen' : 'Bild wählen'}</b><small>{bildText}</small></span>
            <input type="file" accept="image/*" onChange={e => setNAnhang(e.target.files?.[0] || null)}
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }} />
          </label>
        </div>
      </Feld>

      <Abschnitt titel="Anzeige" />
      <div className="bv-flaeche">
        <SchalterZeile titel="Anheften" unter="Erscheint oben in Unitas" an={nForm.gepinnt} onChange={v => setNForm(p => ({ ...p, gepinnt: v }))} />
      </div>
    </Seite>
  )
}
