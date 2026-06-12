import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'systems.responda.app',
  appName: 'Responda',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
  },
}

export default config
