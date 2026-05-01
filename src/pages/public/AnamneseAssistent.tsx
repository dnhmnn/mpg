import { useState } from 'react'

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
      fontSize: '.8rem', fontWeight: active ? 700 : 400, transition: 'all .15s',
      border: active ? '2px solid var(--accent)' : '1.5px solid var(--border-medium)',
      background: active ? 'var(--accent)' : 'transparent',
      color: active ? '#fff' : 'var(--text)',
    }}>{label}</button>
  )
}

function Chips({ options, value, onChange, multi = false }: {
  options: string[]; value: string[]
  onChange: (v: string[]) => void; multi?: boolean
}) {
  const toggle = (opt: string) => {
    if (multi) onChange(value.includes(opt) ? value.filter(x => x !== opt) : [...value, opt])
    else onChange(value.includes(opt) ? [] : [opt])
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px' }}>
      {options.map(o => <Chip key={o} label={o} active={value.includes(o)} onClick={() => toggle(o)} />)}
    </div>
  )
}

interface WasbState {
  vorgefunden: string[]; vorgefundenFreitext: string
  wo: string[]; ausstrahlung: string[]; seit: string[]; nrs: number; begleitsymptome: string[]
}
interface XabcdeState {
  x: string[]; a: string[]; b_atmung: string[]; b_spo2: string[]
  c_rr: string[]; c_puls: string[]; c_rhythmus: string[]
  d_avpu: string[]; d_pupillen: string[]; e: string[]
}
interface SamplerState {
  allergien: string[]; medikamente: string[]; vorerkrankungen: string[]
  letzteMahlzeit: string[]; ereignis: string[]; risikofaktoren: string[]
}

const a = (arr: string[]) => arr.length ? arr.join(', ') : '–'

function buildText(wasb: WasbState, xabcde: XabcdeState, sampler: SamplerState): string {
  const vorgefundenStr = [
    ...wasb.vorgefunden,
    ...(wasb.vorgefundenFreitext.trim() ? [wasb.vorgefundenFreitext.trim()] : []),
  ]
  const wasbParts = [
    `WASB:`,
    `Vorgefunden: ${vorgefundenStr.length ? vorgefundenStr.join(', ') : '–'}.`,
    `W – Lokalisation: ${a(wasb.wo)}.`,
    `A – Ausstrahlung: ${a(wasb.ausstrahlung)}.`,
    `S – Seit: ${a(wasb.seit)}, NRS ${wasb.nrs}/10.`,
    `B – Begleitsymptome: ${a(wasb.begleitsymptome)}.`,
  ]
  const xParts = [
    `xABCDE:`,
    `x – ${a(xabcde.x)}.`,
    `A – Atemweg: ${a(xabcde.a)}.`,
    `B – Atmung: ${a(xabcde.b_atmung)}, SpO₂: ${a(xabcde.b_spo2)}.`,
    `C – RR: ${a(xabcde.c_rr)}, Puls: ${a(xabcde.c_puls)}${xabcde.c_rhythmus.length ? ` und ${a(xabcde.c_rhythmus)}` : ''}.`,
    `D – ${a(xabcde.d_avpu)}, Pupillen: ${a(xabcde.d_pupillen)}.`,
    `E – ${a(xabcde.e)}.`,
  ]
  const sParts = [
    `SAMPLER:`,
    `A – Allergien: ${a(sampler.allergien)}.`,
    `M – Medikamente: ${a(sampler.medikamente)}.`,
    `P – Vorerkrankungen: ${a(sampler.vorerkrankungen)}.`,
    `L – Letzte Mahlzeit: ${a(sampler.letzteMahlzeit)}.`,
    `E – Ereignis: ${a(sampler.ereignis)}.`,
    `R – Risikofaktoren: ${a(sampler.risikofaktoren)}.`,
  ]
  return [wasbParts.join(' '), xParts.join(' '), sParts.join(' ')].join('\n\n')
}

type VRow = { zeit: string; rr_sys: string; rr_dia: string; hf: string; o2: string; spo2: string; etco2: string; schmerz: string }

interface Props {
  messwerte?: Record<string, string>
  verlauf?: VRow[]
  onComplete: (text: string) => void
  onCancel: () => void
}

function fmtMesswerte(m: Record<string, string>): string {
  const parts: string[] = []
  if (m.rr_sys || m.rr_dia) parts.push(`RR ${m.rr_sys || '–'}/${m.rr_dia || '–'} mmHg`)
  if (m.hf)     parts.push(`HF ${m.hf}/min`)
  if (m.af)     parts.push(`AF ${m.af}/min`)
  if (m.spo2)   parts.push(`SpO₂ ${m.spo2} %`)
  if (m.etco2)  parts.push(`etCO₂ ${m.etco2} mmHg`)
  if (m.temp)   parts.push(`Temp ${m.temp} °C`)
  if (m.bz_mg)  parts.push(`BZ ${m.bz_mg} mg/dl`)
  if (m.schmerz) parts.push(`Schmerz ${m.schmerz}/10`)
  return parts.length ? parts.join(', ') : '–'
}

function fmtVerlaufRow(r: VRow): string {
  const parts: string[] = []
  if (r.zeit) parts.push(r.zeit)
  if (r.rr_sys || r.rr_dia) parts.push(`RR ${r.rr_sys || '–'}/${r.rr_dia || '–'} mmHg`)
  if (r.hf)    parts.push(`HF ${r.hf}/min`)
  if (r.spo2)  parts.push(`SpO₂ ${r.spo2} %`)
  if (r.etco2) parts.push(`etCO₂ ${r.etco2} mmHg`)
  if (r.o2)    parts.push(`O₂ ${r.o2} l/min`)
  if (r.schmerz) parts.push(`Schmerz ${r.schmerz}/10`)
  return parts.join(', ')
}

export default function AnamneseAssistent({ messwerte = {}, verlauf = [], onComplete, onCancel }: Props) {
  const [step, setStep] = useState(0)
  const [wasb, setWasb] = useState<WasbState>({ vorgefunden: [], vorgefundenFreitext: '', wo: [], ausstrahlung: [], seit: [], nrs: 0, begleitsymptome: [] })
  const [xabcde, setXabcde] = useState<XabcdeState>({ x: [], a: [], b_atmung: [], b_spo2: [], c_rr: [], c_puls: [], c_rhythmus: [], d_avpu: [], d_pupillen: [], e: [] })
  const [sampler, setSampler] = useState<SamplerState>({ allergien: [], medikamente: [], vorerkrankungen: [], letzteMahlzeit: [], ereignis: [], risikofaktoren: [] })

  const sw = (key: keyof WasbState) => (v: string[]) => setWasb(p => ({ ...p, [key]: v }))
  const sx = (key: keyof XabcdeState) => (v: string[]) => setXabcde(p => ({ ...p, [key]: v }))
  const ss = (key: keyof SamplerState) => (v: string[]) => setSampler(p => ({ ...p, [key]: v }))

  const STEPS = ['WASB', 'xABCDE', 'Messwerte', 'SAMPLER']
  const sec: React.CSSProperties = { marginBottom: '1rem' }
  const secLbl: React.CSSProperties = { display: 'block', fontWeight: 700, fontSize: '.78rem', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.03em' }
  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', marginBottom: '1rem' }
  const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.75rem', marginBottom: '1rem' }

  return (
    <div style={{ border: '0.5px solid var(--border)', borderRadius: 12, background: 'var(--bg-card)', overflow: 'hidden', marginTop: '.75rem' }}>

      {/* Step indicator */}
      <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderBottom: '0.5px solid var(--border)', padding: '.75rem 1rem', gap: 0 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {i > 0 && (
              <div style={{ position: 'absolute', left: 0, right: '50%', top: 13, height: 2, background: i <= step ? 'var(--accent)' : 'var(--border)', zIndex: 0 }} />
            )}
            {i < STEPS.length - 1 && (
              <div style={{ position: 'absolute', left: '50%', right: 0, top: 13, height: 2, background: i < step ? 'var(--accent)' : 'var(--border)', zIndex: 0 }} />
            )}
            <div style={{
              width: 28, height: 28, borderRadius: '50%', position: 'relative', zIndex: 1,
              background: i <= step ? 'var(--accent)' : 'var(--bg)',
              border: `2px solid ${i <= step ? 'var(--accent)' : 'var(--border-medium)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '.75rem', fontWeight: 700,
              color: i <= step ? '#fff' : 'var(--text-secondary)',
              boxShadow: i === step ? '0 0 0 4px var(--accent)22' : 'none',
            }}>{i + 1}</div>
            <div style={{ fontSize: '.73rem', marginTop: 5, fontWeight: i === step ? 700 : 400, color: i === step ? 'var(--accent)' : 'var(--text-secondary)' }}>{s}</div>
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '1rem 1rem .25rem' }}>

        {/* ── WASB ── */}
        {step === 0 && (
          <>
            <div style={sec}>
              <span style={secLbl}>Vorgefunden</span>
              <Chips options={['Liegend vorgefunden','Sitzend vorgefunden','Stehend entgegengekommen']} value={wasb.vorgefunden} onChange={v => setWasb(p => ({ ...p, vorgefunden: v }))} />
              <input
                type="text"
                placeholder="Freitext…"
                value={wasb.vorgefundenFreitext}
                onChange={e => setWasb(p => ({ ...p, vorgefundenFreitext: e.target.value }))}
                style={{ marginTop: 8, width: '100%', padding: '6px 10px', borderRadius: 7, border: '0.5px solid var(--border-medium)', background: 'var(--bg)', color: 'var(--text)', fontSize: '.85rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            <div style={sec}>
              <span style={secLbl}>W – Wo? Lokalisation (Mehrfachauswahl)</span>
              <Chips multi options={['Kopf','Gesicht/Hals','Brust links','Brustmitte','Brust rechts','Bauch oben','Bauch unten','Rücken oben','Rücken unten','Linker Arm','Rechter Arm','Linkes Bein','Rechtes Bein','Ganzkörper','Unbekannt']} value={wasb.wo} onChange={sw('wo')} />
            </div>
            <div style={sec}>
              <span style={secLbl}>A – Ausstrahlung</span>
              <Chips options={['Keine','In linken Arm','In Kiefer/Hals','In Rücken','In Bauch','Sonstiges']} value={wasb.ausstrahlung} onChange={sw('ausstrahlung')} />
            </div>
            <div style={sec}>
              <span style={secLbl}>S – Seit wann?</span>
              <Chips options={['< 5 min','5–30 min','30–60 min','1–6 Std.','6–24 Std.','>24 Std.','Unbekannt']} value={wasb.seit} onChange={sw('seit')} />
            </div>
            <div style={sec}>
              <span style={secLbl}>S – Schmerzstärke NRS (0 = kein Schmerz, 10 = stärkster Schmerz)</span>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button key={n} type="button" onClick={() => setWasb(p => ({ ...p, nrs: n }))} style={{
                    width: 34, height: 34, borderRadius: 7, fontFamily: 'inherit',
                    border: wasb.nrs === n ? '2px solid var(--accent)' : '1.5px solid var(--border-medium)',
                    background: wasb.nrs === n ? 'var(--accent)' : 'transparent',
                    color: wasb.nrs === n ? '#fff' : 'var(--text)',
                    fontWeight: wasb.nrs === n ? 700 : 400, fontSize: '.85rem', cursor: 'pointer',
                  }}>{n}</button>
                ))}
              </div>
            </div>
            <div style={sec}>
              <span style={secLbl}>B – Begleitsymptome (Mehrfachauswahl)</span>
              <Chips multi options={['Keine','Übelkeit','Erbrechen','Schwindel','Dyspnoe','Schweißausbruch','Palpitationen','Synkope/Bewusstlosigkeit','Fieber','Husten','Krampfanfall','Lähmungen/Paresen','Sehstörungen']} value={wasb.begleitsymptome} onChange={sw('begleitsymptome')} />
            </div>
          </>
        )}

        {/* ── xABCDE ── */}
        {step === 1 && (
          <>
            <div style={sec}>
              <span style={secLbl}>x – Exsanguination (lebensbedrohliche Blutung)</span>
              <Chips options={['Keine lebensbedrohliche Blutung','Lebensbedrohliche Blutung – gestillt','Lebensbedrohliche Blutung – unkontrolliert']} value={xabcde.x} onChange={sx('x')} />
            </div>
            <div style={sec}>
              <span style={secLbl}>A – Atemweg (Airway)</span>
              <Chips options={['Frei','Verlegt – Fremdkörper','Verlegt – Zunge/Weichteile','Gesichert – Tubus','Gesichert – SGA/iGel']} value={xabcde.a} onChange={sx('a')} />
            </div>
            <div style={grid2}>
              <div>
                <span style={secLbl}>B – Atmung (Breathing)</span>
                <Chips options={['Normal','Tachypnoe','Bradypnoe','Apnoe','Schnappatmung','Pathologisch (Kussmaul/Cheyne-Stokes)']} value={xabcde.b_atmung} onChange={sx('b_atmung')} />
              </div>
              <div>
                <span style={secLbl}>B – SpO₂</span>
                <Chips options={['≥95 % (normal)','90–94 %','<90 %','Nicht messbar']} value={xabcde.b_spo2} onChange={sx('b_spo2')} />
              </div>
            </div>
            <div style={grid3}>
              <div>
                <span style={secLbl}>C – Blutdruck</span>
                <Chips options={['Normal (90–180)','Hypoton (<90 syst.)','Hypertensiv (>180 syst.)','Nicht messbar']} value={xabcde.c_rr} onChange={sx('c_rr')} />
              </div>
              <div>
                <span style={secLbl}>C – Puls</span>
                <Chips options={['Normofrequent (50–100)','Bradykard (<50)','Tachykard (>100)','Nicht tastbar']} value={xabcde.c_puls} onChange={sx('c_puls')} />
              </div>
              <div>
                <span style={secLbl}>C – Rhythmus</span>
                <Chips options={['Regelmäßig','Arrhythmisch']} value={xabcde.c_rhythmus} onChange={sx('c_rhythmus')} />
              </div>
            </div>
            <div style={grid2}>
              <div>
                <span style={secLbl}>D – Bewusstsein AVPU</span>
                <Chips options={['Alert (A)','Verbal (V)','Pain (P)','Unresponsive (U)']} value={xabcde.d_avpu} onChange={sx('d_avpu')} />
              </div>
              <div>
                <span style={secLbl}>D – Pupillen</span>
                <Chips options={['Isokor / rund / lichtreagibel','Anisokor','Weit und träge','Eng und träge','Entrundet']} value={xabcde.d_pupillen} onChange={sx('d_pupillen')} />
              </div>
            </div>
            <div style={sec}>
              <span style={secLbl}>E – Exposure / Befunde (Mehrfachauswahl)</span>
              <Chips multi options={['Keine Verletzungen sichtbar','Schürfwunden','Platzwunden','Hämatome','Frakturen/Deformitäten','Verbrennungen','Hypothermie','Hyperthermie','Exanthem/Rötung']} value={xabcde.e} onChange={sx('e')} />
            </div>
          </>
        )}

        {/* ── Messwerte ── */}
        {step === 2 && (() => {
          const verlaufFilled = verlauf.filter(r => r.zeit || r.rr_sys || r.hf || r.spo2)
          const hasErstwerte = Object.values(messwerte).some(v => v)
          const MESS_LABELS: [string, string][] = [
            ['rr_sys','RR syst.'],['rr_dia','RR diast.'],['hf','HF'],['af','AF'],
            ['spo2','SpO₂ %'],['etco2','etCO₂'],['temp','Temp'],['bz_mg','BZ'],['schmerz','Schmerz'],
          ]
          return (
            <>
              <div style={sec}>
                <span style={secLbl}>Erstwerte (aus Messwerte / Atmung)</span>
                {hasErstwerte ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px' }}>
                    {MESS_LABELS.map(([k, l]) => messwerte[k] ? (
                      <div key={k} style={{ background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '5px 10px', fontSize: '.83rem' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '.73rem', display: 'block' }}>{l}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{messwerte[k]}</span>
                      </div>
                    ) : null)}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '.83rem', margin: 0 }}>Keine Werte in Messwerte / Atmung eingetragen.</p>
                )}
              </div>
              <div style={sec}>
                <span style={secLbl}>Verlauf (alle Zeilen)</span>
                {verlaufFilled.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '.83rem', margin: 0 }}>Noch keine Verlaufswerte eingetragen.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.81rem' }}>
                      <thead>
                        <tr>{['Zeit','RR sys','RR dia','HF','O₂','SpO₂','etCO₂','Schmerz'].map(h =>
                          <th key={h} style={{ background: 'var(--bg-subtle)', border: '0.5px solid var(--border)', padding: '4px 8px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                        )}</tr>
                      </thead>
                      <tbody>
                        {verlaufFilled.map((r, i) => (
                          <tr key={i}>
                            {(['zeit','rr_sys','rr_dia','hf','o2','spo2','etco2','schmerz'] as (keyof VRow)[]).map(k => (
                              <td key={k} style={{ border: '0.5px solid var(--border)', padding: '4px 8px', color: r[k] ? 'var(--text)' : 'var(--text-secondary)' }}>{r[k] || '–'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )
        })()}

        {/* ── SAMPLER ── */}
        {step === 3 && (
          <>
            <div style={sec}>
              <span style={secLbl}>A – Allergien (Mehrfachauswahl)</span>
              <Chips multi options={['Keine bekannt','Medikamente','Nahrungsmittel','Insektenstiche','Latex','Pflaster/Materialien','Sonstige']} value={sampler.allergien} onChange={ss('allergien')} />
            </div>
            <div style={sec}>
              <span style={secLbl}>M – Dauermedikation (Mehrfachauswahl)</span>
              <Chips multi options={['Keine','ASS','Antikoagulanzien (Marcumar / NOAC)','Antihypertensiva','Beta-Blocker','Insulin / Antidiabetika','Diuretika','Steroide','Psychopharmaka','Sonstige']} value={sampler.medikamente} onChange={ss('medikamente')} />
            </div>
            <div style={sec}>
              <span style={secLbl}>P – Vorerkrankungen (Mehrfachauswahl)</span>
              <Chips multi options={['Keine','KHK / Herzinfarkt (Z.n.)','Herzinsuffizienz','Arterielle Hypertonie','Diabetes mellitus','COPD / Asthma','Schlaganfall (Z.n.)','Epilepsie','Demenz / Psychiatrie','Niereninsuffizienz','pAVK','Vorhofflimmern','Onkologisch']} value={sampler.vorerkrankungen} onChange={ss('vorerkrankungen')} />
            </div>
            <div style={sec}>
              <span style={secLbl}>L – Letzte Mahlzeit / Trinken</span>
              <Chips options={['Vor <1 Std.','Vor 1–4 Std.','Vor 4–8 Std.','Vor >8 Std.','Nüchtern','Unbekannt']} value={sampler.letzteMahlzeit} onChange={ss('letzteMahlzeit')} />
            </div>
            <div style={sec}>
              <span style={secLbl}>E – Ereignis / Auslöser</span>
              <Chips options={['Plötzlich in Ruhe','Plötzlich bei Belastung','Schleichendes Auftreten','Nach Trauma','Nach Medikamenten / Substanzen','Postoperativ','Unbekannt']} value={sampler.ereignis} onChange={ss('ereignis')} />
            </div>
            <div style={sec}>
              <span style={secLbl}>R – Risikofaktoren (Mehrfachauswahl)</span>
              <Chips multi options={['Keine bekannten','Raucher','Alkohol / Drogen','Übergewicht','Immobilisation','Stress','Schwangerschaft','Sprachbarriere']} value={sampler.risikofaktoren} onChange={ss('risikofaktoren')} />
            </div>
          </>
        )}
      </div>

      {/* Navigation bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '.75rem 1rem', borderTop: '0.5px solid var(--border)', background: 'var(--bg-subtle)',
      }}>
        <button type="button" onClick={onCancel} style={{
          padding: '7px 16px', borderRadius: 7, border: '0.5px solid var(--border-medium)',
          background: 'transparent', color: 'var(--text-secondary)', fontSize: '.85rem', cursor: 'pointer', fontFamily: 'inherit',
        }}>Abbrechen</button>
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 && (
            <button type="button" onClick={() => setStep(s => s - 1)} style={{
              padding: '7px 16px', borderRadius: 7, border: '0.5px solid var(--border-medium)',
              background: 'transparent', color: 'var(--text)', fontSize: '.85rem', cursor: 'pointer', fontFamily: 'inherit',
            }}>← Zurück</button>
          )}
          {step < 3 ? (
            <button type="button" onClick={() => setStep(s => s + 1)} style={{
              padding: '7px 16px', borderRadius: 7, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 700,
              fontSize: '.85rem', cursor: 'pointer', fontFamily: 'inherit',
            }}>Weiter →</button>
          ) : (
            <button type="button" onClick={() => {
              const verlaufFilled = verlauf.filter(r => r.zeit || r.rr_sys || r.hf || r.spo2)
              const messwerteLine = `Messwerte:\nErstwerte: ${fmtMesswerte(messwerte)}.${verlaufFilled.length ? '\nVerlauf: ' + verlaufFilled.map((r, i) => `(${i+1}) ${fmtVerlaufRow(r)}`).join(' | ') + '.' : ''}`
              onComplete(buildText(wasb, xabcde, sampler) + '\n\n' + messwerteLine)
            }} style={{
              padding: '7px 16px', borderRadius: 7, border: 'none',
              background: '#16a34a', color: '#fff', fontWeight: 700,
              fontSize: '.85rem', cursor: 'pointer', fontFamily: 'inherit',
            }}>Übernehmen</button>
          )}
        </div>
      </div>
    </div>
  )
}
