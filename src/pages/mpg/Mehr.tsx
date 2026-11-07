// MEHR (Telefon): alles, was nicht täglich gebraucht wird.

import { Link } from 'react-router-dom'
import FormularEinstellungLink from '../../components/FormularEinstellungLink'
import { useMpg } from './MpgDaten'
import { ICON, Karte, kursivGrau, pik } from './teile'

const ZIELE = [
  { pfad: '/mpg/fristen', name: 'Fristen', text: 'STK und MTK aller Geräte — zum Planen mit dem Dienstleister', icon: ICON.fristen },
  { pfad: '/mpg/vorlagen', name: 'Prüfvorlagen', text: 'Prüfpunkte je Gerätetyp', icon: ICON.vorlagen },
  { pfad: '/mpg/logbuch', name: 'Logbuch', text: 'Alle Prüfungen und Einträge im Gerätebuch, nach Gerät, Zeitraum und Person', icon: ICON.logbuch },
]

export default function Mehr() {
  const m = useMpg()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {ZIELE.map(z => (
        <Karte key={z.pfad}>
          <Link to={z.pfad} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', textDecoration: 'none', color: 'inherit' }}>
            <span style={{ color: 'var(--lbf-akzent)' }}>{pik(z.icon, 20)}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{z.name}</span>
              <span style={{ display: 'block', ...kursivGrau }}>{z.text}</span>
            </span>
            <span style={{ color: 'var(--warm-gray)' }}>{pik(ICON.weiter, 16)}</span>
          </Link>
        </Karte>
      ))}
      {/* Nur ohne Modul Vorgänge und mit dem Recht, Formulare einzustellen (Bauplan Formulare 3.4) */}
      <FormularEinstellungLink formular="defektmeldung" user={m.user} />
    </div>
  )
}
