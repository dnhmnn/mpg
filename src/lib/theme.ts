export type ThemeMode = 'light' | 'dark' | 'system' | 'retro'

export function getTheme(): ThemeMode {
  return (localStorage.getItem('theme') as ThemeMode) || 'system'
}

export function setTheme(mode: ThemeMode) {
  localStorage.setItem('theme', mode)
  applyTheme(mode)
}

export function applyTheme(mode: ThemeMode) {
  const html = document.documentElement
  if (mode === 'dark') {
    html.setAttribute('data-theme', 'dark')
  } else if (mode === 'light') {
    html.setAttribute('data-theme', 'light')
  } else if (mode === 'retro') {
    html.setAttribute('data-theme', 'retro')
  } else {
    // System: remove attribute → CSS @media prefers-color-scheme takes over
    html.removeAttribute('data-theme')
  }
}
