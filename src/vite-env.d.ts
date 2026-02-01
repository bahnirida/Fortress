/// <reference types="vite/client" />

import type { VaultApi } from '../electron/preload/types'
import type { ShellApi } from '../electron/preload/types'

declare global {
  interface Window {
    vault: VaultApi
    shell: ShellApi
  }
}

export {}
