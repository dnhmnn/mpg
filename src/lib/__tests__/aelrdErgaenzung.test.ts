import { describe, it, expect } from 'vitest'
import { AELRD_ERGAENZUNG, ergaenzteFelder } from '../../pages/public/aelrdErgaenzung'
import { AELRD_FELDER, aelrdFeld } from '../../katalog/aelrd'
import { aelrdAusPayload } from '../aelrdPayload'
import { SECTION_STEP_MAP } from '../../pages/public/formSchema'

/** Die Felder, die das Formular über die alte Payload schon erreicht. */
function schonErreichbar(): Set<string> {
  const alt: Record<string, unknown> = {}
  for (const f of ['name', 'vorname', 'gebdatum', 'strasse', 'plz_ort', 'kasse', 'versnr',
    'einsatz_nr', 'rufname', 'transport_ziel', 'einsatz_art', 'zeit_einsatz',
    'zeit_eintreffen', 'zeit_transport', 'zeit_uebergabe', 'notfallgeschehen',
    'bewusstsein', 'mannschaft_tf', 'hf', 'spo2', 'af', 'temp', 'etco2', 'schmerz',
    'rr_sys', 'rr_dia', 'bz_mg', 'naca', 'erstdiagnose_text', 'pw_r', 'pw_l',
    'lr_r', 'lr_l', 'o2_flow', 'einsatz_adresse', 'uebergabe_ziel', 'uebergabe_name',
    'beat_fio2', 'beat_af', 'beat_peep', 'beat_pmax', 'beat_amv', 'defi_anzahl',
    'defi_energie', 'defi_zeitpunkt', 'defi_rosc', 'rean_beginn', 'verletz_text',
    'v_sht', 'v_gesicht', 'v_hals', 'v_thorax', 'v_abdomen', 'v_ws', 'v_becken',
    'v_obext', 'v_untext', 'v_weich', 'gcs_e', 'gcs_v', 'gcs_m', 'standort',
    'allergien', 'vorerkrankungen', 'vormedikation_patient', 'verlaufsbeschreibung',
    'hausarzt', 'angehoeriger', 'psy_aggr', 'haut_unauff', 'atm_apnoe', 'sr',
    'v_trauma_stumpf', 'v_sturz_eben', 'v_vt_pkw', 'v_inhalation',
    'beat_maschinell', 'defi_mono', 'medications', 'verlauf', 'bemerkungen']) {
    alt[f] = f.startsWith('gcs_') ? 4
      : f === 'medications' ? [{ name: 'ASS' }]
      : f === 'verlauf' ? [{ zeit: '08:00' }]
      : 'X'
  }
  return new Set(Object.keys(aelrdAusPayload(alt)))
}

describe('Ergänzung der Patientendokumentation', () => {
  it('ordnet nur Felder zu, die es im Katalog gibt', () => {
    const unbekannt = ergaenzteFelder().filter((id) => !aelrdFeld(id))
    expect(unbekannt).toEqual([])
  })

  it('ordnet jedes Feld genau einem Abschnitt zu', () => {
    const alle = ergaenzteFelder()
    expect(alle.filter((id, i) => alle.indexOf(id) !== i)).toEqual([])
  })

  it('verweist nur auf Abschnitte, die das Formular hat', () => {
    const unbekannt = Object.keys(AELRD_ERGAENZUNG).filter((s) => !(s in SECTION_STEP_MAP))
    expect(unbekannt).toEqual([])
  })

  it('deckt jedes Feld des Bogens ab — erfasst oder ergänzt', () => {
    // Ein Feld, das weder erreichbar noch ergänzt ist, bleibt unerfassbar.
    // Das merkt man sonst erst am leeren Protokoll.
    const erreichbar = schonErreichbar()
    const ergaenzt = new Set(ergaenzteFelder())
    const offen = AELRD_FELDER
      .map((f) => f.id)
      .filter((id) => !erreichbar.has(id) && !ergaenzt.has(id))
    expect(offen).toEqual([])
  })

  it('ergänzt nichts doppelt, was das Formular schon erreicht', () => {
    const erreichbar = schonErreichbar()
    const doppelt = ergaenzteFelder().filter((id) => erreichbar.has(id))
    expect(doppelt).toEqual([])
  })
})
