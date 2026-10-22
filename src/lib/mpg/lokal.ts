// Was das MPG lokal auf dem Gerät festhält — je Person und Organisation:
// - die begonnene Prüfung (übersteht Neuladen und Beenden der App)
// - Defektmeldungen und Bestätigungen, deren Speicherung unklar ausging
// Beim Abmelden wird localStorage geleert; useAuth warnt vorher mit offeneMpgDaten.

export const entwurfSchluessel = (userId: string, orgId: string) => `mpg_pruefung_entwurf:${userId}:${orgId}`
export const unklarSchluessel = (userId: string, orgId: string) => `mpg_unklar:${userId}:${orgId}`

/** Was ginge beim Abmelden verloren? */
export function offeneMpgDaten(userId: string | undefined, orgId: string | undefined): { unklar: number; entwurf: boolean } {
  const r = { unklar: 0, entwurf: false }
  if (!userId) return r
  try {
    const u = JSON.parse(localStorage.getItem(unklarSchluessel(userId, orgId ?? '')) || 'null')
    if (u) r.unklar += Object.keys(u.defekte || {}).length + Object.keys(u.bestaetigungen || {}).length
  } catch { /* unlesbar: nicht zählen */ }
  try {
    const e = JSON.parse(localStorage.getItem(entwurfSchluessel(userId, orgId ?? '')) || 'null')
    if (e?.versucht) r.unklar++
    else if (e) r.entwurf = true
  } catch { /* unlesbar: nicht zählen */ }
  return r
}
