import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { angemeldeteSitzung, useOrg } from './OrgPublicLayout'
import { pb } from '../../lib/pocketbase'
import { formularFrei, modulFrei } from '../../lib/freigabe'
import { angemeldetTrotzAusgeschaltet } from '../../lib/formular/absender'
import { formConfigLesen } from '../../lib/formular/einstellung'
import { schemaLesen } from '../../lib/formular/felder'
import type { FormTemplate } from './formSchema'
import Warteschlange from './absender/Warteschlange'
import { Icon } from '../benutzer/bausteine'
import { ZugangRahmen, Zeichen } from '../zugang/Rahmen'

const STATIC_ITEMS = [
  {
    id: 'patienten',
    to: 'patienten',
    label: 'Patientendokumentation',
    desc: 'Notfalleinsatz dokumentieren',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <path d="M9 12h6M9 16h4"/>
      </svg>
    ),
  },
  {
    id: 'produktausgabe',
    to: 'produktausgabe',
    label: 'Produktausgabe',
    desc: 'Materialausgabe erfassen',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    id: 'cirs',
    to: 'cirs',
    label: 'CIRS-Meldung',
    desc: 'Kritisches Ereignis melden',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    id: 'defektmeldung',
    to: 'defektmeldung',
    label: 'Defektmeldung',
    desc: 'Medizinprodukt als defekt melden',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
  },
]

const CUSTOM_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="12" x2="12" y2="18"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
)

function felderText(n: number): string {
  return n === 1 ? '1 Feld' : `${n} Felder`
}

/** Öffentliche Seite der Organisation (/<org-code>), ganz in Dunkelrot (src/pages/zugang/Rahmen.tsx). */
export default function OrgLanding() {
  const { org, orgCode } = useOrg()
  const logoUrl = org.logo ? pb.files.getUrl(org, org.logo) : null
  const verborgen = formConfigLesen(org.form_config).hidden_forms
  const hiddenForms: string[] = Array.isArray(verborgen) ? verborgen : []

  const [customTemplates, setCustomTemplates] = useState<FormTemplate[]>([])

  // Eigene Formulare nur mit freiem Modul Vorgänge; aktiv per Filter, archivierte im Client
  // ausgefiltert (das Feld darf in PocketBase noch fehlen, Plan Vorgänge 4.3)
  const eigeneFrei = modulFrei(org, 'dokumente')
  useEffect(() => {
    if (!eigeneFrei) { setCustomTemplates([]); return }
    pb.collection('form_templates').getFullList<FormTemplate>({
      filter: pb.filter('organization_id = {:o} && is_active = true', { o: org.id }),
      sort: 'created',
    }).then((liste) => setCustomTemplates(liste.filter((t) => t.archiviert !== true))).catch(() => {})
  }, [org.id, eigeneFrei])

  // Ausgeblendet (Vorgänge → Formulare) oder Modul nicht freigeschaltet (Supervisor). Ausgeblendet heißt nur
  // „öffentlicher Link aus“: angemeldete Mitglieder dieser Organisation sehen Patientendoku, Produktausgabe
  // und Defektmeldung weiter, wie FormularFrei sie durchlässt (Befund Client-Abläufe 11).
  const sitzung = angemeldeteSitzung()
  const visibleStatic = STATIC_ITEMS.filter(item => formularFrei(org, item.id)
    && (!hiddenForms.includes(item.id) || angemeldetTrotzAusgeschaltet(sitzung, org.id, item.id)))
  const hasAnyForm = visibleStatic.length > 0 || customTemplates.length > 0

  const zeile = (key: string, to: string, symbol: React.ReactNode, titel: string, unter: string) => (
    <Link key={key} to={to} className="bv-z">
      <span className="zg-symbol">{symbol}</span>
      <span className="bv-tx"><b>{titel}</b><small>{unter}</small></span>
      <Icon n="weiter" className="bv-pfeil" />
    </Link>
  )

  return (
    <ZugangRahmen
      zeichen={<Zeichen src={logoUrl} />}
      titel={org.org_name}
      zeile={hasAnyForm ? 'Wähle ein Formular' : 'Zurzeit sind keine Formulare verfügbar.'}
    >
      {/* Was auf diesem Gerät auf das Senden wartet (Bauplan v2, 4.3); leer: nichts */}
      <Warteschlange orgCode={orgCode} org={org} eingebettet />
      {visibleStatic.length > 0 && (
        <>
          <h2 className="zg-ueber">Formulare</h2>
          <div className="zg-karte zeilen">
            {visibleStatic.map(({ id, to, icon, label, desc }) => zeile(id, `/${orgCode}/${to}`, icon, label, desc))}
          </div>
        </>
      )}
      {customTemplates.length > 0 && (
        <>
          <h2 className="zg-ueber">Eigene Formulare</h2>
          <div className="zg-karte zeilen">
            {customTemplates.map((t) => zeile(t.id, `/${orgCode}/formular/${t.id}`, CUSTOM_ICON, t.title,
              t.description || felderText(schemaLesen(t).felder.filter((f) => !f.aus).length)))}
          </div>
        </>
      )}
      {!sitzung && <Link to="/login" className="zg-link hell">Mitglied? Anmelden</Link>}
    </ZugangRahmen>
  )
}
