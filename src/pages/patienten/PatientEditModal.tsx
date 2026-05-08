import React, { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import type { Patient, PatientPayload, Medication, VitalRow } from './types'
import { PubSection, inp, sel, ta, field, lbl } from '../public/pubStyles'
import { pb } from '../../lib/pocketbase'
import { useAuth } from '../../hooks/useAuth'

interface RQ { id: string; frage: string; created_by?: string; status: 'offen' | 'beantwortet'; created: string }
interface SN { id: string; rueckfrage_id: string; text: string; created: string }

interface Props {
  patient: Patient
  payload: PatientPayload
  original: PatientPayload
  onClose: () => void
  onSave: (payload: PatientPayload) => void
  onSaveAndSign: (payload: PatientPayload) => void
  onRefresh: () => void
}

const CH: React.CSSProperties = { background: '#fef3c7', borderColor: '#d97706', borderWidth: 2 }
const pil: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', border: '0.5px solid var(--border-medium)',
  borderRadius: 999, padding: '.15rem .6rem', background: 'var(--bg-subtle)',
  fontSize: 13, color: 'var(--text)', margin: '2px 2px 2px 0',
}

function F({ l, children, ch }: { l: string; children: React.ReactNode; ch?: boolean }) {
  return (
    <div style={{ ...field, ...(ch ? { borderLeft: '3px solid #d97706', paddingLeft: 8, marginLeft: -8 } : {}) }}>
      <label style={{ ...lbl, ...(ch ? { color: '#d97706' } : {}) }}>{l}</label>
      {children}
    </div>
  )
}
function G2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>{children}</div>
}
function CbRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 0', marginBottom: 10 }}>{children}</div>
}
function Cat({ t }: { t: string }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 8, marginBottom: 4, paddingTop: 6, borderTop: '0.5px solid var(--border)' }}>{t}</div>
}