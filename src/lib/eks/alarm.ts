// Alarmierung für die Atemschutzüberwachung.
//
// Grundsatz: OPTISCH ist primär, Ton ist sekundär. Auf iOS ist Hintergrund-Audio
// nicht zuverlässig — deshalb ist der Vollbild-Alarm die eigentliche Sicherung,
// und ein stehengebliebener Überwachungs-Takt wird sichtbar gemacht, statt
// stillschweigend zu passieren.
//
// Töne werden synthetisiert (Web Audio), nicht geladen: nichts kann offline fehlen.

import type { AlarmLevel } from './atemschutz'

let ctx: AudioContext | null = null
let entsperrt = false
let laufenderAlarm: { stop: () => void } | null = null

export function audioEntsperrt(): boolean { return entsperrt }

/** Muß aus einer echten Nutzergeste heraus aufgerufen werden (iOS-Pflicht). */
export async function audioFreischalten(): Promise<boolean> {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    if (ctx.state === 'suspended') await ctx.resume()
    // Stummer Anstoß, damit iOS den Kontext dauerhaft freigibt
    const o = ctx.createOscillator(); const g = ctx.createGain()
    g.gain.value = 0.0001; o.connect(g); g.connect(ctx.destination)
    o.start(); o.stop(ctx.currentTime + 0.02)
    // Klingelschalter-Problem auf iOS entschärfen, wo unterstützt
    try { (navigator as any).audioSession && ((navigator as any).audioSession.type = 'playback') } catch { /* egal */ }
    entsperrt = ctx.state === 'running'
    return entsperrt
  } catch { return false }
}

function ton(freq: number, dauerMs: number, wann = 0): void {
  if (!ctx) return
  const t = ctx.currentTime + wann / 1000
  const o = ctx.createOscillator(); const g = ctx.createGain()
  o.type = 'square'; o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.01)
  g.gain.setValueAtTime(0.25, t + dauerMs / 1000 - 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dauerMs / 1000)
  o.connect(g); g.connect(ctx.destination)
  o.start(t); o.stop(t + dauerMs / 1000 + 0.02)
}

export function testTon(): void { if (ctx) ton(880, 200) }

/** Spielt den Alarm. `critical` wiederholt sich, bis er quittiert wird. */
export function alarmStarten(level: AlarmLevel): void {
  if (!ctx || !entsperrt) return
  alarmStoppen()
  if (level === 'info') { ton(880, 150); return }
  if (level === 'warn') { ton(1046, 120); ton(1046, 120, 220); ton(1046, 120, 440); return }

  const zyklus = () => { ton(1200, 400); ton(900, 400, 400) }
  zyklus()
  const iv = window.setInterval(zyklus, 900)
  if (navigator.vibrate) { try { navigator.vibrate([200, 100, 200, 100, 600]) } catch { /* egal */ } }
  laufenderAlarm = { stop: () => window.clearInterval(iv) }
}

export function alarmStoppen(): void {
  if (laufenderAlarm) { laufenderAlarm.stop(); laufenderAlarm = null }
}

// ── Wake Lock ────────────────────────────────────────────────────────────────
let wakeLock: any = null

export async function wakeLockAn(): Promise<boolean> {
  try {
    if (!(navigator as any).wakeLock) return false
    if (wakeLock) return true
    wakeLock = await (navigator as any).wakeLock.request('screen')
    wakeLock.addEventListener?.('release', () => { wakeLock = null })
    return true
  } catch { return false }
}

export async function wakeLockAus(): Promise<void> {
  try { await wakeLock?.release?.() } catch { /* egal */ }
  wakeLock = null
}

export function wakeLockUnterstuetzt(): boolean { return !!(navigator as any).wakeLock }

// ── Herzschlag ───────────────────────────────────────────────────────────────
// Macht sichtbar, wenn die Überwachung stehengeblieben ist (Hintergrund-Drosselung,
// Standby, Neuladen). Eine erkannte Lücke wird protokolliert und erzwingt eine
// erneute Prüfung aller Trupps — Stillstand darf nicht wie "alles ruhig" aussehen.

export interface HeartbeatOptions {
  onTick: () => void
  onLuecke: (dauerMs: number, grund: string) => void
  lueckeAbMs?: number
}

export function startHeartbeat(o: HeartbeatOptions): () => void {
  const schwelle = o.lueckeAbMs ?? 90000
  let letzter = Date.now()

  const tick = () => {
    const jetzt = Date.now()
    const delta = jetzt - letzter
    if (delta > schwelle) o.onLuecke(delta, document.hidden ? 'hidden' : 'sleep')
    letzter = jetzt
    o.onTick()
  }
  const iv = window.setInterval(tick, 1000)

  const onVisible = () => { if (!document.hidden) tick() }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('pageshow', onVisible)
  window.addEventListener('online', onVisible)

  return () => {
    window.clearInterval(iv)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('pageshow', onVisible)
    window.removeEventListener('online', onVisible)
  }
}

export function letzterTickAlterMs(letzterTick: number): number { return Date.now() - letzterTick }
