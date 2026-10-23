// MPG-Modul: jede Ansicht hat eine eigene Adresse unter /mpg/*.
//   /mpg                         Heute
//   /mpg/runde/:standort         Prüfrunde an einem Standort
//   /mpg/geraete                 Bestand (breit: Tabelle, Gerät rechts daneben)
//   /mpg/geraete/neu             Gerät anlegen
//   /mpg/geraete/:id             Gerätebuch (?teil=ueberblick|verlauf|stammdaten)
//   /mpg/geraete/:id/bearbeiten  Gerät bearbeiten
//   /mpg/geraete/:id/pruefen     Prüfung
//   /mpg/meldungen               Eingang, offene und behobene Defekte (?teil=…)
//   /mpg/meldungen/:id           Fall
//   /mpg/fristen                 STK und MTK des Bestands
//   /mpg/mehr · /mpg/vorlagen · /mpg/logbuch

import { Navigate, Route, Routes } from 'react-router-dom'
import { MpgDatenQuelle } from './MpgDaten'
import MpgLayout from './MpgLayout'
import Heute from './Heute'
import Runde from './Runde'
import Geraete from './Geraete'
import Geraet from './Geraet'
import GeraetForm from './GeraetForm'
import Pruefung from './Pruefung'
import Meldungen from './Meldungen'
import Fall from './Fall'
import Mehr from './Mehr'
import Vorlagen from './Vorlagen'
import Logbuch from './Logbuch'
import Fristen from './Fristen'

export default function MpgModul() {
  return (
    <MpgDatenQuelle>
      <Routes>
        <Route element={<MpgLayout />}>
          <Route index element={<Heute />} />
          <Route path="runde/:standort" element={<Runde />} />
          <Route path="geraete" element={<Geraete />}>
            <Route path="neu" element={<GeraetForm />} />
            <Route path=":id" element={<Geraet />} />
            <Route path=":id/bearbeiten" element={<GeraetForm />} />
            <Route path=":id/pruefen" element={<Pruefung />} />
          </Route>
          <Route path="meldungen" element={<Meldungen />}>
            <Route path=":id" element={<Fall />} />
          </Route>
          <Route path="mehr" element={<Mehr />} />
          <Route path="vorlagen" element={<Vorlagen />} />
          <Route path="vorlagen/:typ" element={<Vorlagen />} />
          <Route path="logbuch" element={<Logbuch />} />
          <Route path="fristen" element={<Fristen />} />
          <Route path="*" element={<Navigate to="/mpg" replace />} />
        </Route>
      </Routes>
    </MpgDatenQuelle>
  )
}
