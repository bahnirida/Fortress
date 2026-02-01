import type { VaultApi } from '../types/vault'

const vault: VaultApi = {
  ping: () => window.vault.ping(),
  listEntries: () => window.vault.listEntries(),
  getEntry: (id) => window.vault.getEntry(id),
}

export { vault }
